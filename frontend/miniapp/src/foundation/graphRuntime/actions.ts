import {
  graphActionInstancesFor,
  type GraphActionRegistry,
  type GraphBusinessActionDefinition,
  type GraphBusinessActionMap,
  type GraphPresentationActionDefinition,
  type GraphPresentationActionMap,
} from '../graphProtocol/action';
import type {
  GraphNodeActionFactoryFor,
  GraphNodeInteractionsBoundary,
} from '../graphProtocol/interaction';
import type {
  GraphActivationProgram,
  GraphActivationReadyState,
  GraphActivationRuntime,
} from './activation';

type RuntimeActionRegistry = GraphActionRegistry<
  GraphBusinessActionMap,
  GraphPresentationActionMap
>;

type RuntimeBusinessInteraction = Readonly<{
  kind: 'business-interaction';
  action: string;
  availability: Readonly<{
    source: 'available-actions';
    sourceName: string;
    path: readonly string[];
  }>;
}>;

type RuntimePresentationInteraction = Readonly<{
  kind: 'presentation-interaction';
  action: string;
}>;

type RuntimeNodeInteractions = Readonly<{
  kind: 'graph-node-interactions';
  node: string;
  business: Readonly<Record<string, RuntimeBusinessInteraction>>;
  presentation: Readonly<
    Record<string, RuntimePresentationInteraction>
  >;
}>;

type RuntimeActionInstance = Readonly<{
  kind: 'business-action' | 'presentation-action';
  actionId: string;
}>;

type RuntimeActionInstanceFactory = Readonly<{
  business: (
    actionId: string,
    input: Readonly<Record<string, string>>,
    event: unknown,
  ) => RuntimeActionInstance;
  presentation: (
    actionId: string,
    input: Readonly<Record<string, string>>,
    event: unknown,
  ) => RuntimeActionInstance;
}>;

export type GraphNodeActionFactoryErrorCode =
  | 'ACTIVATION_NOT_READY'
  | 'ACTIVATION_NODE_MISMATCH'
  | 'ACTIVATION_NOT_CURRENT'
  | 'NODE_HAS_NO_INTERACTIONS'
  | 'UNKNOWN_NODE_ACTION'
  | 'INVALID_AVAILABILITY_EVIDENCE'
  | 'INVALID_INSTANCE_INPUT'
  | 'UNKNOWN_ACTION_INSTANCE';

export class GraphNodeActionFactoryError extends Error {
  readonly code: GraphNodeActionFactoryErrorCode;
  readonly activationId: number | null;
  readonly nodeId: string | null;
  readonly actionId: string | null;

  constructor(
    definition: Readonly<{
      code: GraphNodeActionFactoryErrorCode;
      message: string;
      activationId?: number;
      nodeId?: string;
      actionId?: string;
    }>,
  ) {
    super(definition.message);
    this.name = 'GraphNodeActionFactoryError';
    this.code = definition.code;
    this.activationId = definition.activationId ?? null;
    this.nodeId = definition.nodeId ?? null;
    this.actionId = definition.actionId ?? null;
  }
}

export type GraphRuntimeActionDescriptor<
  TNodeId extends string = string,
> = Readonly<{
  kind: 'graph-runtime-action-descriptor';
  activationId: number;
  nodeId: TNodeId;
  actionClass: 'business' | 'presentation';
  actionId: string;
}>;

export type GraphRuntimeInteractionNodeId<
  TProgram extends GraphActivationProgram,
> = Extract<keyof TProgram['interactions'], string>;

type GraphRuntimeNodeInteractions<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Extract<
  TProgram['interactions'][TNodeId],
  GraphNodeInteractionsBoundary
>;

export type GraphReadyNodeActionFactory<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = GraphNodeActionFactoryFor<
  GraphRuntimeNodeInteractions<TProgram, TNodeId>
> &
  Readonly<{
    activationId: number;
    nodeId: TNodeId;
    describe: (
      instance: RuntimeActionInstance,
    ) => GraphRuntimeActionDescriptor<TNodeId>;
  }>;

const emptyBusinessProjection = Object.freeze(
  [],
) as readonly [];

function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function asRuntimeNodeInteractions(
  value: unknown,
): RuntimeNodeInteractions | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  if (
    value.kind !== 'graph-node-interactions' ||
    typeof value.node !== 'string' ||
    !isPlainRecord(value.business) ||
    !isPlainRecord(value.presentation)
  ) {
    return null;
  }

  return value as RuntimeNodeInteractions;
}

function parseInstanceInput(
  definition:
    | GraphBusinessActionDefinition
    | GraphPresentationActionDefinition,
  input: unknown,
  activationId: number,
  nodeId: string,
  actionId: string,
): Readonly<Record<string, string>> {
  if (!isPlainRecord(input)) {
    throw new GraphNodeActionFactoryError({
      code: 'INVALID_INSTANCE_INPUT',
      message: `Graph action instance input for "${actionId}" must be a plain object.`,
      activationId,
      nodeId,
      actionId,
    });
  }

  const visual = Object.prototype.hasOwnProperty.call(
    definition,
    'visual',
  )
    ? definition.visual
    : undefined;

  const allowed = new Set([
    'instanceId',
    'ariaLabel',
    ...(visual?.kind === 'list-button'
      ? ['mainLine', 'secondaryLine']
      : []),
  ]);

  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new GraphNodeActionFactoryError({
        code: 'INVALID_INSTANCE_INPUT',
        message: `Unknown graph action instance input field "${key}" for "${actionId}".`,
        activationId,
        nodeId,
        actionId,
      });
    }
  }

  if (
    visual?.kind === 'list-button' &&
    typeof input.mainLine !== 'string'
  ) {
    throw new GraphNodeActionFactoryError({
      code: 'INVALID_INSTANCE_INPUT',
      message: `Graph list action "${actionId}" requires string mainLine.`,
      activationId,
      nodeId,
      actionId,
    });
  }

  const output: Record<string, string> = {};

  for (const key of allowed) {
    const value = input[key];

    if (value === undefined) {
      continue;
    }

    if (typeof value !== 'string') {
      throw new GraphNodeActionFactoryError({
        code: 'INVALID_INSTANCE_INPUT',
        message: `Graph action instance input field "${key}" for "${actionId}" must be a string.`,
        activationId,
        nodeId,
        actionId,
      });
    }

    output[key] = value;
  }

  return Object.freeze(output);
}

function readAvailabilityEvidence(
  sources: Readonly<Record<string, unknown>> | null,
  binding: RuntimeBusinessInteraction['availability'],
  activationId: number,
  nodeId: string,
  actionId: string,
): readonly string[] {
  const fail = (
    message: string,
  ): never => {
    throw new GraphNodeActionFactoryError({
      code: 'INVALID_AVAILABILITY_EVIDENCE',
      message,
      activationId,
      nodeId,
      actionId,
    });
  };

  if (sources === null) {
    return fail(
      `Business action "${actionId}" requires endpoint source evidence.`,
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      sources,
      binding.sourceName,
    )
  ) {
    return fail(
      `Missing graph action availability source "${binding.sourceName}" for "${actionId}".`,
    );
  }

  let current: unknown = sources[binding.sourceName];

  if (binding.path.length === 0) {
    return fail(
      `Graph action availability path for "${actionId}" must not be empty.`,
    );
  }

  for (const segment of binding.path) {
    if (
      (typeof current !== 'object' || current === null) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return fail(
        `Missing graph action availability path "${binding.path.join('.')}" for "${actionId}".`,
      );
    }

    current = (
      current as Readonly<Record<string, unknown>>
    )[segment];
  }

  if (
    !Array.isArray(current) ||
    !current.every((value) => typeof value === 'string')
  ) {
    return fail(
      `Graph action availability path "${binding.path.join('.')}" for "${actionId}" must resolve to a string array.`,
    );
  }

  return current;
}

function runtimeInstanceFactory(
  registry: RuntimeActionRegistry,
): RuntimeActionInstanceFactory {
  return graphActionInstancesFor(
    registry,
  ) as unknown as RuntimeActionInstanceFactory;
}

export function createGraphReadyNodeActionFactory<
  const TProgram extends GraphActivationProgram,
  const TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
>(
  runtime: GraphActivationRuntime<TProgram>,
  nodeId: TNodeId,
): GraphReadyNodeActionFactory<TProgram, TNodeId> {
  const current = runtime.getState();

  if (current.status !== 'ready') {
    throw new GraphNodeActionFactoryError({
      code: 'ACTIVATION_NOT_READY',
      message: 'Graph node action factory requires current ready state.',
      nodeId,
    });
  }

  if (current.nodeId !== nodeId) {
    throw new GraphNodeActionFactoryError({
      code: 'ACTIVATION_NODE_MISMATCH',
      message:
        `Current ready node "${current.nodeId}" does not match requested ` +
        `action-factory node "${nodeId}".`,
      activationId: current.activationId,
      nodeId,
    });
  }

  const ready = current as GraphActivationReadyState<TNodeId>;

  const assertCurrent = (): void => {
    if (runtime.getState() !== ready) {
      throw new GraphNodeActionFactoryError({
        code: 'ACTIVATION_NOT_CURRENT',
        message:
          `Graph action factory activation ${ready.activationId} ` +
          `for node "${ready.nodeId}" is no longer current.`,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
      });
    }
  };

  assertCurrent();

  const program = runtime.program;
  const interactions = asRuntimeNodeInteractions(
    (
      program.interactions as Readonly<Record<string, unknown>>
    )[ready.nodeId],
  );

  if (
    interactions === null ||
    interactions.node !== ready.nodeId
  ) {
    throw new GraphNodeActionFactoryError({
      code: 'NODE_HAS_NO_INTERACTIONS',
      message:
        `Graph node "${ready.nodeId}" has no declared program interactions.`,
      activationId: ready.activationId,
      nodeId: ready.nodeId,
    });
  }

  const registry = program.actions;
  const instances = runtimeInstanceFactory(registry);
  const descriptors = new WeakMap<
    object,
    GraphRuntimeActionDescriptor<TNodeId>
  >();

  const register = (
    instance: RuntimeActionInstance,
    actionClass: 'business' | 'presentation',
    actionId: string,
  ): RuntimeActionInstance => {
    const descriptor = Object.freeze({
      kind: 'graph-runtime-action-descriptor' as const,
      activationId: ready.activationId,
      nodeId: ready.nodeId,
      actionClass,
      actionId,
    });

    descriptors.set(instance, descriptor);
    return instance;
  };

  const business = (
    actionId: string,
    input: unknown,
    event: unknown,
  ): readonly [] | readonly [RuntimeActionInstance] => {
    assertCurrent();

    const interaction = interactions.business[actionId];

    if (
      !interaction ||
      interaction.kind !== 'business-interaction'
    ) {
      throw new GraphNodeActionFactoryError({
        code: 'UNKNOWN_NODE_ACTION',
        message:
          `Business action "${actionId}" is not declared for node "${ready.nodeId}".`,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
        actionId,
      });
    }

    const definition = registry.business[actionId];

    if (!definition) {
      throw new GraphNodeActionFactoryError({
        code: 'UNKNOWN_NODE_ACTION',
        message:
          `Unknown graph business semantic action "${actionId}".`,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
        actionId,
      });
    }

    const availableActions = readAvailabilityEvidence(
      ready.sources,
      interaction.availability,
      ready.activationId,
      ready.nodeId,
      actionId,
    );

    if (
      !availableActions.includes(
        definition.availableAction,
      )
    ) {
      return emptyBusinessProjection;
    }

    const parsedInput = parseInstanceInput(
      definition,
      input,
      ready.activationId,
      ready.nodeId,
      actionId,
    );

    const instance = register(
      instances.business(
        actionId,
        parsedInput,
        event,
      ),
      'business',
      actionId,
    );

    return Object.freeze([instance]) as readonly [
      RuntimeActionInstance,
    ];
  };

  const presentation = (
    actionId: string,
    input: unknown,
    event: unknown,
  ): RuntimeActionInstance => {
    assertCurrent();

    const interaction = interactions.presentation[actionId];

    if (
      !interaction ||
      interaction.kind !== 'presentation-interaction'
    ) {
      throw new GraphNodeActionFactoryError({
        code: 'UNKNOWN_NODE_ACTION',
        message:
          `Presentation action "${actionId}" is not declared for node "${ready.nodeId}".`,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
        actionId,
      });
    }

    const definition = registry.presentation[actionId];

    if (!definition) {
      throw new GraphNodeActionFactoryError({
        code: 'UNKNOWN_NODE_ACTION',
        message:
          `Unknown graph presentation semantic action "${actionId}".`,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
        actionId,
      });
    }

    const parsedInput = parseInstanceInput(
      definition,
      input,
      ready.activationId,
      ready.nodeId,
      actionId,
    );

    return register(
      instances.presentation(
        actionId,
        parsedInput,
        event,
      ),
      'presentation',
      actionId,
    );
  };

  const describe = (
    instance: RuntimeActionInstance,
  ): GraphRuntimeActionDescriptor<TNodeId> => {
    assertCurrent();

    if (
      typeof instance !== 'object' ||
      instance === null
    ) {
      throw new GraphNodeActionFactoryError({
        code: 'UNKNOWN_ACTION_INSTANCE',
        message:
          `Graph action instance does not belong to activation ${ready.activationId}.`,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
      });
    }

    const descriptor = descriptors.get(instance);

    if (!descriptor) {
      throw new GraphNodeActionFactoryError({
        code: 'UNKNOWN_ACTION_INSTANCE',
        message:
          `Graph action instance does not belong to activation ${ready.activationId}.`,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
      });
    }

    return descriptor;
  };

  return Object.freeze({
    activationId: ready.activationId,
    nodeId: ready.nodeId,
    business,
    presentation,
    describe,
  }) as GraphReadyNodeActionFactory<TProgram, TNodeId>;
}
