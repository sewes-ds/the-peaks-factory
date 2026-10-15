import type {
  GraphActionRegistry,
  GraphBusinessActionMap,
  GraphPresentationActionMap,
} from './action';
import type {
  GraphDefinition,
  GraphNodeId,
  GraphNodeMap,
} from './definition';
import type {
  GraphNodeActionFactoryFor,
  GraphNodeInteractionsBoundary,
} from './interaction';

type GraphActionRegistryBoundary = GraphActionRegistry<
  GraphBusinessActionMap,
  GraphPresentationActionMap
>;

export type GraphProgramInteractionMap<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TActions extends GraphActionRegistryBoundary,
> = Readonly<
  Partial<{
    [TNodeId in GraphNodeId<TGraph>]:
      GraphNodeInteractionsBoundary &
        Readonly<{
          graph: TGraph;
          actions: TActions;
          node: TNodeId;
        }>;
  }>
>;

type NoUnknownGraphProgramNodeKeys<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TInteractions extends Readonly<Record<string, unknown>>,
> = Exclude<keyof TInteractions, GraphNodeId<TGraph>> extends never
  ? unknown
  : never;

type NonEmptyGraphProgramInteractions<
  TInteractions extends Readonly<Record<string, unknown>>,
> = keyof TInteractions extends never ? never : unknown;

type GraphProgramBusinessActionIds<
  TInteractions extends Readonly<Record<string, unknown>>,
> = {
  [TNodeId in keyof TInteractions]:
    TInteractions[TNodeId] extends GraphNodeInteractionsBoundary
      ? Extract<keyof TInteractions[TNodeId]['business'], string>
      : never;
}[keyof TInteractions];

type GraphProgramPresentationActionIds<
  TInteractions extends Readonly<Record<string, unknown>>,
> = {
  [TNodeId in keyof TInteractions]:
    TInteractions[TNodeId] extends GraphNodeInteractionsBoundary
      ? Extract<keyof TInteractions[TNodeId]['presentation'], string>
      : never;
}[keyof TInteractions];

type AllGraphProgramActionsReachable<
  TActions extends GraphActionRegistryBoundary,
  TInteractions extends Readonly<Record<string, unknown>>,
> =
  Exclude<
    Extract<keyof TActions['business'], string>,
    GraphProgramBusinessActionIds<TInteractions>
  > extends never
    ? Exclude<
        Extract<keyof TActions['presentation'], string>,
        GraphProgramPresentationActionIds<TInteractions>
      > extends never
      ? unknown
      : never
    : never;

declare const graphProgramBrand: unique symbol;

export type GraphProgram<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TActions extends GraphActionRegistryBoundary,
  TInteractions extends GraphProgramInteractionMap<TGraph, TActions>,
> = Readonly<{
  kind: 'graph-program';
  graph: TGraph;
  actions: TActions;
  interactions: TInteractions;
  readonly [graphProgramBrand]: true;
}>;

type GraphProgramBoundary = Readonly<{
  kind: 'graph-program';
  graph: GraphDefinition<GraphNodeMap>;
  actions: GraphActionRegistryBoundary;
  interactions: Readonly<Record<string, GraphNodeInteractionsBoundary>>;
}>;

export type GraphProgramInteractionNodeId<
  TProgram extends GraphProgramBoundary,
> = Extract<
  keyof TProgram['interactions'],
  GraphNodeId<TProgram['graph']>
>;

export type GraphProgramNodeInteractions<
  TProgram extends GraphProgramBoundary,
  TNodeId extends GraphProgramInteractionNodeId<TProgram>,
> = Extract<
  TProgram['interactions'][TNodeId],
  GraphNodeInteractionsBoundary
>;

export type GraphProgramProjectorActionFactory<
  TProgram extends GraphProgramBoundary,
  TNodeId extends GraphProgramInteractionNodeId<TProgram>,
> = GraphNodeActionFactoryFor<
  GraphProgramNodeInteractions<TProgram, TNodeId>
>;

export class GraphProgramValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphProgramValidationError';
  }
}

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

function assertPlainRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw new GraphProgramValidationError(
      `${label} must be a plain object.`,
    );
  }
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  allowedKeys: ReadonlySet<string>,
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new GraphProgramValidationError(
        `Unknown ${label} field "${key}".`,
      );
    }
  }
}

function validateInteractionMap(
  value: unknown,
  graph: GraphDefinition<GraphNodeMap>,
  actions: GraphActionRegistryBoundary,
  nodeId: string,
  interactionClass: 'business' | 'presentation',
  reachable: Set<string>,
): void {
  assertPlainRecord(
    value,
    `Graph program ${interactionClass} interaction map for "${nodeId}"`,
  );

  for (const [actionId, interaction] of Object.entries(value)) {
    assertPlainRecord(
      interaction,
      `Graph program ${interactionClass} interaction "${actionId}"`,
    );

    const expectedKind =
      interactionClass === 'business'
        ? 'business-interaction'
        : 'presentation-interaction';

    if (interaction.kind !== expectedKind) {
      throw new GraphProgramValidationError(
        `Graph program ${interactionClass} interaction "${actionId}" has invalid kind.`,
      );
    }

    if (interaction.graph !== graph) {
      throw new GraphProgramValidationError(
        `Graph program interaction "${actionId}" must reference the program graph.`,
      );
    }

    if (interaction.actions !== actions) {
      throw new GraphProgramValidationError(
        `Graph program interaction "${actionId}" must reference the program action registry.`,
      );
    }

    if (interaction.node !== nodeId) {
      throw new GraphProgramValidationError(
        `Graph program interaction "${actionId}" must belong to node "${nodeId}".`,
      );
    }

    if (interaction.action !== actionId) {
      throw new GraphProgramValidationError(
        `Graph program interaction map key "${actionId}" must match interaction action "${String(interaction.action)}".`,
      );
    }

    const registry =
      interactionClass === 'business'
        ? actions.business
        : actions.presentation;

    if (!(actionId in registry)) {
      throw new GraphProgramValidationError(
        `Unknown graph program ${interactionClass} action "${actionId}".`,
      );
    }

    reachable.add(actionId);
  }
}

export function defineGraphProgram<
  const TGraph extends GraphDefinition<GraphNodeMap>,
  const TActions extends GraphActionRegistryBoundary,
  const TInteractions extends GraphProgramInteractionMap<
    TGraph,
    TActions
  >,
>(
  definition: Readonly<{
    graph: TGraph;
    actions: TActions;
    interactions: TInteractions;
  }> &
    NoUnknownGraphProgramNodeKeys<TGraph, TInteractions> &
    NonEmptyGraphProgramInteractions<TInteractions> &
    AllGraphProgramActionsReachable<TActions, TInteractions>,
): GraphProgram<TGraph, TActions, TInteractions> {
  assertPlainRecord(definition, 'Graph program definition');
  assertExactKeys(
    definition,
    new Set(['graph', 'actions', 'interactions']),
    'graph program definition',
  );

  if (definition.graph.kind !== 'graph-definition') {
    throw new GraphProgramValidationError(
      'Graph program requires a GraphDefinition.',
    );
  }

  if (definition.actions.kind !== 'graph-action-registry') {
    throw new GraphProgramValidationError(
      'Graph program requires a GraphActionRegistry.',
    );
  }

  assertPlainRecord(
    definition.interactions,
    'Graph program interactions',
  );

  const interactionEntries = Object.entries(definition.interactions);

  if (interactionEntries.length === 0) {
    throw new GraphProgramValidationError(
      'Graph program must declare at least one node interaction set.',
    );
  }

  const reachableBusiness = new Set<string>();
  const reachablePresentation = new Set<string>();

  for (const [nodeId, nodeInteractions] of interactionEntries) {
    if (!(nodeId in definition.graph.nodes)) {
      throw new GraphProgramValidationError(
        `Unknown graph program node "${nodeId}".`,
      );
    }

    assertPlainRecord(
      nodeInteractions,
      `Graph program node interactions for "${nodeId}"`,
    );
    assertExactKeys(
      nodeInteractions,
      new Set([
        'kind',
        'graph',
        'actions',
        'node',
        'business',
        'presentation',
      ]),
      'graph program node interaction declaration',
    );

    if (nodeInteractions.kind !== 'graph-node-interactions') {
      throw new GraphProgramValidationError(
        `Graph program node "${nodeId}" requires GraphNodeInteractions.`,
      );
    }

    if (nodeInteractions.graph !== definition.graph) {
      throw new GraphProgramValidationError(
        `Graph program node "${nodeId}" interactions must reference the program graph.`,
      );
    }

    if (nodeInteractions.actions !== definition.actions) {
      throw new GraphProgramValidationError(
        `Graph program node "${nodeId}" interactions must reference the program action registry.`,
      );
    }

    if (nodeInteractions.node !== nodeId) {
      throw new GraphProgramValidationError(
        `Graph program node key "${nodeId}" must match interaction node "${String(nodeInteractions.node)}".`,
      );
    }

    validateInteractionMap(
      nodeInteractions.business,
      definition.graph,
      definition.actions,
      nodeId,
      'business',
      reachableBusiness,
    );

    validateInteractionMap(
      nodeInteractions.presentation,
      definition.graph,
      definition.actions,
      nodeId,
      'presentation',
      reachablePresentation,
    );
  }

  for (const actionId of Object.keys(definition.actions.business)) {
    if (!reachableBusiness.has(actionId)) {
      throw new GraphProgramValidationError(
        `Graph business semantic action "${actionId}" is unreachable from the program interaction map.`,
      );
    }
  }

  for (const actionId of Object.keys(definition.actions.presentation)) {
    if (!reachablePresentation.has(actionId)) {
      throw new GraphProgramValidationError(
        `Graph presentation semantic action "${actionId}" is unreachable from the program interaction map.`,
      );
    }
  }

  return Object.freeze({
    kind: 'graph-program' as const,
    graph: definition.graph,
    actions: definition.actions,
    interactions: Object.freeze({
      ...definition.interactions,
    }) as TInteractions,
  }) as GraphProgram<TGraph, TActions, TInteractions>;
}
