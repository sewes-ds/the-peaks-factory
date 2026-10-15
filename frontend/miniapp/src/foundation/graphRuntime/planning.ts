import type {
  GraphBusinessActionDefinition,
  GraphBusinessActionInstance,
  GraphPresentationActionDefinition,
  GraphPresentationActionInstance,
} from '../graphProtocol/action';
import type {
  GraphCommandDefinition,
  GraphCommandEntitySchema,
  GraphCommandInput,
  GraphCommandInputSchema,
} from '../graphProtocol/command';
import {
  parseGraphContext,
  type GraphContextScalar,
  type GraphContextSchema,
} from '../graphProtocol/context';
import type { GraphNodeInteractionsBoundary } from '../graphProtocol/interaction';
import type {
  GraphActivationProgram,
  GraphActivationReadyState,
  GraphActivationRuntime,
} from './activation';
import {
  createGraphReadyNodeActionFactory,
  type GraphReadyNodeActionFactory,
  type GraphRuntimeActionDescriptor,
  type GraphRuntimeInteractionNodeId,
} from './actions';

type GraphRuntimeCommandBoundary = GraphCommandDefinition<
  GraphCommandInputSchema,
  string,
  readonly [string, ...string[]],
  GraphCommandEntitySchema
>;

type GraphRuntimeNodeInteractions<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Extract<
  TProgram['interactions'][TNodeId],
  GraphNodeInteractionsBoundary
>;

type GraphRuntimeBusinessInteractions<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = GraphRuntimeNodeInteractions<TProgram, TNodeId> extends Readonly<{
  business: infer TBusiness;
}>
  ? TBusiness
  : never;

type GraphRuntimePresentationInteractions<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = GraphRuntimeNodeInteractions<TProgram, TNodeId> extends Readonly<{
  presentation: infer TPresentation;
}>
  ? TPresentation
  : never;

export type GraphRuntimeBusinessInteractionActionId<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Extract<
  keyof GraphRuntimeBusinessInteractions<TProgram, TNodeId>,
  keyof TProgram['actions']['business'] & string
>;

export type GraphRuntimePresentationInteractionActionId<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Extract<
  keyof GraphRuntimePresentationInteractions<TProgram, TNodeId>,
  keyof TProgram['actions']['presentation'] & string
>;

type GraphRuntimeBusinessInteractionFor<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
  TActionId extends GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >,
> = GraphRuntimeBusinessInteractions<TProgram, TNodeId> extends Readonly<
  Record<TActionId, infer TInteraction>
>
  ? TInteraction
  : never;

type GraphRuntimeBusinessCommandFor<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
  TActionId extends GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >,
> = Extract<
  GraphRuntimeBusinessInteractionFor<
    TProgram,
    TNodeId,
    TActionId
  > extends Readonly<{ command: infer TCommand }>
    ? TCommand
    : never,
  GraphRuntimeCommandBoundary
>;

type GraphRuntimeBusinessTransitionFor<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
  TActionId extends GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >,
> = GraphRuntimeBusinessInteractionFor<
  TProgram,
  TNodeId,
  TActionId
> extends Readonly<{ transition: infer TTransition }>
  ? TTransition
  : never;

type GraphRuntimeBusinessActionInstanceFor<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
  TActionId extends GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >,
> = GraphBusinessActionInstance<
  TActionId,
  Extract<
    TProgram['actions']['business'][TActionId],
    GraphBusinessActionDefinition
  >
>;

type GraphRuntimePresentationActionInstanceFor<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
  TActionId extends GraphRuntimePresentationInteractionActionId<
    TProgram,
    TNodeId
  >,
> = GraphPresentationActionInstance<
  TActionId,
  Extract<
    TProgram['actions']['presentation'][TActionId],
    GraphPresentationActionDefinition
  >
>;

export type GraphBusinessInteractionPlan<
  TNodeId extends string = string,
  TActionId extends string = string,
  TCommand = unknown,
  TTransition = unknown,
  TInput extends Readonly<
    Record<string, GraphContextScalar>
  > = Readonly<Record<string, GraphContextScalar>>,
> = Readonly<{
  kind: 'graph-business-interaction-plan';
  activationId: number;
  nodeId: TNodeId;
  actionId: TActionId;
  command: TCommand;
  input: TInput;
  transition: TTransition;
}>;

export type GraphBusinessInteractionPlanFor<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
  TActionId extends GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >,
> = GraphBusinessInteractionPlan<
  TNodeId,
  TActionId,
  GraphRuntimeBusinessCommandFor<TProgram, TNodeId, TActionId>,
  GraphRuntimeBusinessTransitionFor<TProgram, TNodeId, TActionId>,
  GraphCommandInput<
    GraphRuntimeBusinessCommandFor<TProgram, TNodeId, TActionId>
  >
>;

type GraphAnyBusinessInteractionPlanFor<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = {
  [TActionId in GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >]: GraphBusinessInteractionPlanFor<
    TProgram,
    TNodeId,
    TActionId
  >;
}[GraphRuntimeBusinessInteractionActionId<TProgram, TNodeId>];

type GraphAnyPresentationInteractionPlanFor<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = GraphPresentationInteractionPlan<
  TNodeId,
  GraphRuntimePresentationInteractionActionId<TProgram, TNodeId>
>;

export type GraphBackInteractionPlan<
  TNodeId extends string = string,
  TActionId extends string = string,
> = Readonly<{
  kind: 'graph-presentation-interaction-plan';
  activationId: number;
  nodeId: TNodeId;
  actionId: TActionId;
  effect: 'back';
}>;

export type GraphNavigateInteractionPlan<
  TNodeId extends string = string,
  TActionId extends string = string,
  TDestinationNodeId extends string = string,
> = Readonly<{
  kind: 'graph-presentation-interaction-plan';
  activationId: number;
  nodeId: TNodeId;
  actionId: TActionId;
  effect: 'navigate';
  destination: Readonly<{
    nodeId: TDestinationNodeId;
    context: Readonly<Record<string, GraphContextScalar>>;
  }>;
}>;

export type GraphPresentationInteractionPlan<
  TNodeId extends string = string,
  TActionId extends string = string,
> =
  | GraphBackInteractionPlan<TNodeId, TActionId>
  | GraphNavigateInteractionPlan<TNodeId, TActionId>;

export type GraphInteractionPlanningErrorCode =
  | 'DESCRIPTOR_IDENTITY_MISMATCH'
  | 'DESCRIPTOR_INSTANCE_MISMATCH'
  | 'INTERACTION_IDENTITY_MISMATCH'
  | 'MISSING_SOURCE_ID'
  | 'INVALID_SOURCE_ID'
  | 'INVALID_PRESENTATION_EFFECT'
  | 'INVALID_DESTINATION_NODE';

export class GraphInteractionPlanningError extends Error {
  readonly code: GraphInteractionPlanningErrorCode;
  readonly activationId: number;
  readonly nodeId: string;
  readonly actionId: string;
  readonly field: string | null;

  constructor(
    definition: Readonly<{
      code: GraphInteractionPlanningErrorCode;
      message: string;
      activationId: number;
      nodeId: string;
      actionId: string;
      field?: string;
    }>,
  ) {
    super(definition.message);
    this.name = 'GraphInteractionPlanningError';
    this.code = definition.code;
    this.activationId = definition.activationId;
    this.nodeId = definition.nodeId;
    this.actionId = definition.actionId;
    this.field = definition.field ?? null;
  }
}

export type GraphReadyInteractionPlanner<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Readonly<{
  activationId: number;
  nodeId: TNodeId;
  actions: GraphReadyNodeActionFactory<TProgram, TNodeId>;
  ownsBusinessPlan: (
    plan: unknown,
  ) => plan is GraphAnyBusinessInteractionPlanFor<TProgram, TNodeId>;
  ownsPresentationPlan: (
    plan: unknown,
  ) => plan is GraphAnyPresentationInteractionPlanFor<TProgram, TNodeId>;
  plan<
    TActionId extends GraphRuntimeBusinessInteractionActionId<
      TProgram,
      TNodeId
    >,
  >(
    instance: GraphRuntimeBusinessActionInstanceFor<
      TProgram,
      TNodeId,
      TActionId
    >,
    descriptor: GraphRuntimeActionDescriptor<TNodeId>,
  ): GraphBusinessInteractionPlanFor<
    TProgram,
    TNodeId,
    TActionId
  >;
  plan<
    TActionId extends GraphRuntimePresentationInteractionActionId<
      TProgram,
      TNodeId
    >,
  >(
    instance: GraphRuntimePresentationActionInstanceFor<
      TProgram,
      TNodeId,
      TActionId
    >,
    descriptor: GraphRuntimeActionDescriptor<TNodeId>,
  ): GraphPresentationInteractionPlan<TNodeId, TActionId>;
}>;

type RuntimeActionInstance = Readonly<{
  kind: 'business-action' | 'presentation-action';
  actionId: string;
  event: Readonly<Record<string, GraphContextScalar>>;
}>;

type RuntimeCommand = Readonly<{
  parseInput: (
    input: unknown,
  ) => Readonly<Record<string, GraphContextScalar>>;
}>;

type RuntimeBinding = Readonly<{
  source: string;
  field?: string;
  sourceName?: string;
  path?: readonly string[];
  normalize?: string;
  missing?: string;
  value?: GraphContextScalar;
}>;

type RuntimeBusinessInteraction = Readonly<{
  kind: 'business-interaction';
  graph: unknown;
  actions: unknown;
  node: string;
  action: string;
  command: RuntimeCommand;
  input: Readonly<Record<string, RuntimeBinding>>;
  transition: unknown;
}>;

type RuntimePresentationInteraction = Readonly<{
  kind: 'presentation-interaction';
  graph: unknown;
  actions: unknown;
  node: string;
  action: string;
  effect:
    | Readonly<{ kind: 'back' }>
    | Readonly<{
        kind: 'navigate';
        node: string;
        context: Readonly<Record<string, RuntimeBinding>>;
      }>;
}>;

type RuntimeNodeInteractions = Readonly<{
  kind: 'graph-node-interactions';
  graph: unknown;
  actions: unknown;
  node: string;
  business: Readonly<Record<string, RuntimeBusinessInteraction>>;
  presentation: Readonly<
    Record<string, RuntimePresentationInteraction>
  >;
}>;

const omittedBinding = Symbol('omitted-graph-interaction-binding');

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
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

function fail(
  ready: GraphActivationReadyState<string>,
  actionId: string,
  code: GraphInteractionPlanningErrorCode,
  message: string,
  field?: string,
): never {
  throw new GraphInteractionPlanningError({
    code,
    message,
    activationId: ready.activationId,
    nodeId: ready.nodeId,
    actionId,
    field,
  });
}

function readScalarBinding(
  binding: RuntimeBinding,
  ready: GraphActivationReadyState<string>,
  instance: RuntimeActionInstance,
  actionId: string,
  destinationField: string,
): GraphContextScalar | typeof omittedBinding {
  if (binding.source === 'context' || binding.source === 'event') {
    if (typeof binding.field !== 'string') {
      return fail(
        ready,
        actionId,
        'INTERACTION_IDENTITY_MISMATCH',
        `Graph interaction binding for "${destinationField}" has no scalar field identity.`,
        destinationField,
      );
    }

    const source =
      binding.source === 'context'
        ? ready.context
        : instance.event;

    if (
      !Object.prototype.hasOwnProperty.call(source, binding.field) ||
      source[binding.field] === undefined
    ) {
      return omittedBinding;
    }

    return source[binding.field] as GraphContextScalar;
  }

  if (binding.source === 'literal') {
    if (!Object.prototype.hasOwnProperty.call(binding, 'value')) {
      return fail(
        ready,
        actionId,
        'INTERACTION_IDENTITY_MISMATCH',
        `Graph interaction literal for "${destinationField}" has no value.`,
        destinationField,
      );
    }

    return binding.value as GraphContextScalar;
  }

  return fail(
    ready,
    actionId,
    'INTERACTION_IDENTITY_MISMATCH',
    `Unknown scalar binding source "${binding.source}" for "${destinationField}".`,
    destinationField,
  );
}

function readSourceIdBinding(
  binding: RuntimeBinding,
  ready: GraphActivationReadyState<string>,
  actionId: string,
  destinationField: string,
): string | typeof omittedBinding {
  if (
    binding.source !== 'node-source-id' ||
    typeof binding.sourceName !== 'string' ||
    !Array.isArray(binding.path) ||
    binding.path.length === 0 ||
    binding.normalize !== 'string' ||
    (binding.missing !== 'reject' && binding.missing !== 'omit')
  ) {
    return fail(
      ready,
      actionId,
      'INTERACTION_IDENTITY_MISMATCH',
      `Invalid node-source ID binding for "${destinationField}".`,
      destinationField,
    );
  }

  if (
    ready.sources === null ||
    !Object.prototype.hasOwnProperty.call(
      ready.sources,
      binding.sourceName,
    )
  ) {
    return fail(
      ready,
      actionId,
      'MISSING_SOURCE_ID',
      `Missing graph source "${binding.sourceName}" for command input "${destinationField}".`,
      destinationField,
    );
  }

  let current: unknown = ready.sources[binding.sourceName];
  let missing = false;

  for (const segment of binding.path) {
    if (
      typeof segment !== 'string' ||
      segment.trim().length === 0
    ) {
      return fail(
        ready,
        actionId,
        'INTERACTION_IDENTITY_MISMATCH',
        `Invalid node-source ID path for "${destinationField}".`,
        destinationField,
      );
    }

    if (
      !isPlainRecord(current) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      missing = true;
      break;
    }

    current = current[segment];
  }

  if (current === null || current === undefined) {
    missing = true;
  }

  if (missing) {
    if (binding.missing === 'omit') {
      return omittedBinding;
    }

    return fail(
      ready,
      actionId,
      'MISSING_SOURCE_ID',
      `Missing required node-source ID for command input "${destinationField}".`,
      destinationField,
    );
  }

  if (
    typeof current === 'string' &&
    current.trim().length > 0
  ) {
    return String(current);
  }

  if (
    typeof current === 'number' &&
    Number.isFinite(current)
  ) {
    return String(current);
  }

  return fail(
    ready,
    actionId,
    'INVALID_SOURCE_ID',
    `Node-source ID for command input "${destinationField}" must be a non-empty string or finite number.`,
    destinationField,
  );
}

function assertInteractionIdentity(
  interaction:
    | RuntimeBusinessInteraction
    | RuntimePresentationInteraction,
  program: GraphActivationProgram,
  ready: GraphActivationReadyState<string>,
  actionId: string,
): void {
  if (
    interaction.graph !== program.graph ||
    interaction.actions !== program.actions ||
    interaction.node !== ready.nodeId ||
    interaction.action !== actionId
  ) {
    fail(
      ready,
      actionId,
      'INTERACTION_IDENTITY_MISMATCH',
      `Graph interaction "${actionId}" does not match the exact current program identity.`,
    );
  }
}

function planPresentation(
  interaction: RuntimePresentationInteraction,
  program: GraphActivationProgram,
  ready: GraphActivationReadyState<string>,
  instance: RuntimeActionInstance,
): GraphPresentationInteractionPlan {
  assertInteractionIdentity(
    interaction,
    program,
    ready,
    instance.actionId,
  );

  if (interaction.effect.kind === 'back') {
    return Object.freeze({
      kind: 'graph-presentation-interaction-plan' as const,
      activationId: ready.activationId,
      nodeId: ready.nodeId,
      actionId: instance.actionId,
      effect: 'back' as const,
    });
  }

  if (interaction.effect.kind !== 'navigate') {
    return fail(
      ready,
      instance.actionId,
      'INVALID_PRESENTATION_EFFECT',
      `Unknown graph presentation effect for "${instance.actionId}".`,
    );
  }

  const destinationNode = program.graph.nodes[
    interaction.effect.node
  ];

  if (!destinationNode) {
    return fail(
      ready,
      instance.actionId,
      'INVALID_DESTINATION_NODE',
      `Unknown graph navigation destination "${interaction.effect.node}".`,
    );
  }

  const rawContext: Record<string, GraphContextScalar> = {};

  for (const [field, binding] of Object.entries(
    interaction.effect.context,
  )) {
    const value = readScalarBinding(
      binding,
      ready,
      instance,
      instance.actionId,
      field,
    );

    if (value !== omittedBinding) {
      rawContext[field] = value;
    }
  }

  const context = parseGraphContext(
    destinationNode.context as GraphContextSchema,
    Object.freeze(rawContext),
  );
  const destination = Object.freeze({
    nodeId: interaction.effect.node,
    context,
  });

  return Object.freeze({
    kind: 'graph-presentation-interaction-plan' as const,
    activationId: ready.activationId,
    nodeId: ready.nodeId,
    actionId: instance.actionId,
    effect: 'navigate' as const,
    destination,
  });
}

export function createGraphReadyInteractionPlanner<
  const TProgram extends GraphActivationProgram,
  const TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
>(
  runtime: GraphActivationRuntime<TProgram>,
  nodeId: TNodeId,
): GraphReadyInteractionPlanner<TProgram, TNodeId> {
  const current = runtime.getState();
  const actions = createGraphReadyNodeActionFactory(
    runtime,
    nodeId,
  );
  const ready = current as GraphActivationReadyState<TNodeId>;
  const interactions = (
    runtime.program.interactions as unknown as Readonly<
      Record<string, RuntimeNodeInteractions>
    >
  )[nodeId];
  const businessPlans = new WeakSet<object>();
  const presentationPlans = new WeakSet<object>();

  const plan = (
    instance: RuntimeActionInstance,
    descriptor: GraphRuntimeActionDescriptor<TNodeId>,
  ): GraphBusinessInteractionPlan | GraphPresentationInteractionPlan => {
    const exactDescriptor = actions.describe(instance);

    if (exactDescriptor !== descriptor) {
      return fail(
        ready,
        instance.actionId,
        'DESCRIPTOR_IDENTITY_MISMATCH',
        'Graph interaction planning requires the exact descriptor returned for the exact action instance.',
      );
    }

    const expectedClass =
      instance.kind === 'business-action'
        ? 'business'
        : 'presentation';

    if (
      descriptor.activationId !== ready.activationId ||
      descriptor.nodeId !== ready.nodeId ||
      descriptor.actionClass !== expectedClass ||
      descriptor.actionId !== instance.actionId
    ) {
      return fail(
        ready,
        instance.actionId,
        'DESCRIPTOR_INSTANCE_MISMATCH',
        'Graph action descriptor does not match its exact current instance.',
      );
    }

    if (
      !interactions ||
      interactions.kind !== 'graph-node-interactions' ||
      interactions.graph !== runtime.program.graph ||
      interactions.actions !== runtime.program.actions ||
      interactions.node !== ready.nodeId
    ) {
      return fail(
        ready,
        instance.actionId,
        'INTERACTION_IDENTITY_MISMATCH',
        `Graph node interactions for "${ready.nodeId}" do not match the exact current program identity.`,
      );
    }

    if (instance.kind === 'business-action') {
      const interaction = interactions.business[instance.actionId];

      if (!interaction || interaction.kind !== 'business-interaction') {
        return fail(
          ready,
          instance.actionId,
          'INTERACTION_IDENTITY_MISMATCH',
          `Missing exact business interaction for "${instance.actionId}".`,
        );
      }

      assertInteractionIdentity(
        interaction,
        runtime.program,
        ready,
        instance.actionId,
      );

      const rawInput: Record<string, GraphContextScalar> = {};

      for (const [field, binding] of Object.entries(interaction.input)) {
        const value =
          binding.source === 'node-source-id'
            ? readSourceIdBinding(
                binding,
                ready,
                instance.actionId,
                field,
              )
            : readScalarBinding(
                binding,
                ready,
                instance,
                instance.actionId,
                field,
              );

        if (value !== omittedBinding) {
          rawInput[field] = value;
        }
      }

      const input = interaction.command.parseInput(
        Object.freeze(rawInput),
      );
      const businessPlan = Object.freeze({
        kind: 'graph-business-interaction-plan' as const,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
        actionId: instance.actionId,
        command: interaction.command,
        input,
        transition: interaction.transition,
      });

      businessPlans.add(businessPlan);
      return businessPlan;
    }

    const interaction = interactions.presentation[instance.actionId];

    if (!interaction || interaction.kind !== 'presentation-interaction') {
      return fail(
        ready,
        instance.actionId,
        'INTERACTION_IDENTITY_MISMATCH',
        `Missing exact presentation interaction for "${instance.actionId}".`,
      );
    }

    const presentationPlan = planPresentation(
      interaction,
      runtime.program,
      ready,
      instance,
    );
    presentationPlans.add(presentationPlan);
    return presentationPlan;
  };

  const ownsBusinessPlan = (
    candidate: unknown,
  ): candidate is GraphAnyBusinessInteractionPlanFor<
    TProgram,
    TNodeId
  > =>
    typeof candidate === 'object' &&
    candidate !== null &&
    runtime.getState() === ready &&
    businessPlans.has(candidate);

  const ownsPresentationPlan = (
    candidate: unknown,
  ): candidate is GraphAnyPresentationInteractionPlanFor<
    TProgram,
    TNodeId
  > =>
    typeof candidate === 'object' &&
    candidate !== null &&
    runtime.getState() === ready &&
    presentationPlans.has(candidate);

  return Object.freeze({
    activationId: ready.activationId,
    nodeId: ready.nodeId,
    actions,
    ownsBusinessPlan,
    ownsPresentationPlan,
    plan,
  }) as unknown as GraphReadyInteractionPlanner<TProgram, TNodeId>;
}
