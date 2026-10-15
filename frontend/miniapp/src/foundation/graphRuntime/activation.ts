import {
  GraphContextValidationError,
  parseGraphContext,
  type GraphContextScalar,
  type GraphContextSchema,
} from '../graphProtocol/context';
import type {
  GraphNodeMap,
  GraphNodeProjection,
} from '../graphProtocol/definition';
import type {
  GraphActionRegistry,
  GraphBusinessActionMap,
  GraphPresentationActionMap,
} from '../graphProtocol/action';
import type {
  GraphProgram,
  GraphProgramInteractionMap,
} from '../graphProtocol/program';
import type {
  GraphDefinition,
  GraphNodeId,
} from '../graphProtocol/definition';
import type {
  GraphOptionalSourceResult,
  GraphSourceFailure,
  GraphSourceRequirement,
} from '../graphProtocol/source';

type GraphActivationGraph = GraphDefinition<GraphNodeMap>;

type GraphActivationActions = GraphActionRegistry<
  GraphBusinessActionMap,
  GraphPresentationActionMap
>;

type GraphActivationInteractions = GraphProgramInteractionMap<
  GraphActivationGraph,
  GraphActivationActions
>;

export type GraphActivationProgram = GraphProgram<
  GraphActivationGraph,
  GraphActivationActions,
  GraphActivationInteractions
>;

export type GraphActivationNodeId<
  TProgram extends GraphActivationProgram,
> = GraphNodeId<TProgram['graph']>;

export type GraphActivationContext = Readonly<
  Record<string, GraphContextScalar>
>;

export type GraphActivationErrorCode =
  | 'UNKNOWN_NODE'
  | 'INVALID_CONTEXT'
  | 'REQUIRED_SOURCE_FAILED'
  | 'PROJECTION_FAILED';

export class GraphActivationError extends Error {
  readonly code: GraphActivationErrorCode;
  readonly activationId: number;
  readonly nodeId: string | null;
  readonly sourceFailure: GraphSourceFailure | null;
  readonly originalError: unknown;

  constructor(
    definition: Readonly<{
      code: GraphActivationErrorCode;
      message: string;
      activationId: number;
      nodeId: string | null;
      sourceFailure?: GraphSourceFailure;
      originalError?: unknown;
    }>,
  ) {
    super(definition.message);
    this.name = 'GraphActivationError';
    this.code = definition.code;
    this.activationId = definition.activationId;
    this.nodeId = definition.nodeId;
    this.sourceFailure = definition.sourceFailure ?? null;
    this.originalError = definition.originalError;
  }
}

export type GraphActivationIdleState = Readonly<{
  status: 'idle';
}>;

export type GraphActivationLoadingState<
  TNodeId extends string,
> = Readonly<{
  status: 'loading';
  activationId: number;
  nodeId: TNodeId | null;
  context: GraphActivationContext | null;
}>;

export type GraphActivationReadyState<
  TNodeId extends string,
> = Readonly<{
  status: 'ready';
  activationId: number;
  nodeId: TNodeId;
  context: GraphActivationContext;
  sources: Readonly<Record<string, unknown>> | null;
  projection: GraphNodeProjection;
}>;

export type GraphActivationErrorState = Readonly<{
  status: 'error';
  activationId: number;
  nodeId: string | null;
  error: GraphActivationError;
}>;

export type GraphActivationCurrentState<
  TNodeId extends string,
> =
  | GraphActivationIdleState
  | GraphActivationLoadingState<TNodeId>
  | GraphActivationReadyState<TNodeId>
  | GraphActivationErrorState;

export type GraphActivationStaleResult<
  TNodeId extends string,
> = Readonly<{
  status: 'stale';
  activationId: number;
  nodeId: TNodeId;
}>;

export type GraphActivationResult<
  TNodeId extends string,
> =
  | GraphActivationReadyState<TNodeId>
  | GraphActivationErrorState
  | GraphActivationStaleResult<TNodeId>;

export type GraphActivationRuntime<
  TProgram extends GraphActivationProgram,
> = Readonly<{
  program: TProgram;
  activate: (
    input: Readonly<{
      nodeId: unknown;
      context: unknown;
    }>,
  ) => Promise<
    GraphActivationResult<GraphActivationNodeId<TProgram>>
  >;
  refresh: (
    input?: Readonly<{ context?: unknown }>,
  ) => Promise<
    GraphActivationResult<GraphActivationNodeId<TProgram>>
  >;
  coordinateInteraction: <TResult>(
    ready: GraphActivationReadyState<string>,
    operation: () => Promise<TResult>,
  ) => Promise<TResult> | null;
  getState: () => GraphActivationCurrentState<
    GraphActivationNodeId<TProgram>
  >;
}>;

type RuntimeSourceDefinition = Readonly<{
  kind: 'endpoint';
  method: 'GET';
  sourceId: string;
  endpoint: string;
  requirement: GraphSourceRequirement;
  request: (
    context: GraphActivationContext,
  ) => Promise<unknown>;
  decode: (input: unknown) => unknown;
}>;

type RuntimeLocalNode = Readonly<{
  kind: 'local';
  context: GraphContextSchema;
  source: Readonly<{
    kind: 'local';
  }>;
  project: (
    input: Readonly<{
      context: GraphActivationContext;
    }>,
  ) => GraphNodeProjection;
}>;

type RuntimeEndpointNode = Readonly<{
  kind: 'endpoint-backed';
  context: GraphContextSchema;
  source: Readonly<{
    kind: 'endpoint-backed';
    sourceBundle: Readonly<{
      kind: 'source-bundle';
      sources: Readonly<Record<string, RuntimeSourceDefinition>>;
    }>;
  }>;
  project: (
    input: Readonly<{
      context: GraphActivationContext;
      sources: Readonly<Record<string, unknown>>;
    }>,
  ) => GraphNodeProjection;
}>;

type RuntimeNode = RuntimeLocalNode | RuntimeEndpointNode;

class RequiredSourceLoadError extends Error {
  readonly failure: GraphSourceFailure;
  readonly originalError: unknown;

  constructor(
    failure: GraphSourceFailure,
    originalError: unknown,
  ) {
    super(failure.message);
    this.name = 'RequiredSourceLoadError';
    this.failure = failure;
    this.originalError = originalError;
  }
}

function freezeIdle(): GraphActivationIdleState {
  return Object.freeze({
    status: 'idle' as const,
  });
}

function errorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return String(error);
}

function sourceFailure(
  source: RuntimeSourceDefinition,
  error: unknown,
): GraphSourceFailure {
  return Object.freeze({
    sourceId: source.sourceId,
    endpoint: source.endpoint,
    message: errorMessage(error),
  });
}

async function loadOneSource(
  source: RuntimeSourceDefinition,
  context: GraphActivationContext,
): Promise<unknown> {
  try {
    const response = await source.request(context);
    const value = source.decode(response);

    if (source.requirement === 'optional') {
      return Object.freeze({
        status: 'available' as const,
        value,
      }) satisfies GraphOptionalSourceResult<unknown>;
    }

    return value;
  } catch (error: unknown) {
    const failure = sourceFailure(source, error);

    if (source.requirement === 'optional') {
      return Object.freeze({
        status: 'unavailable' as const,
        failure,
      }) satisfies GraphOptionalSourceResult<unknown>;
    }

    throw new RequiredSourceLoadError(
      failure,
      error,
    );
  }
}

async function loadSourceBundle(
  node: RuntimeEndpointNode,
  context: GraphActivationContext,
): Promise<Readonly<Record<string, unknown>>> {
  const entries = Object.entries(
    node.source.sourceBundle.sources,
  );

  const loaded = await Promise.all(
    entries.map(async ([name, source]) => {
      const value = await loadOneSource(
        source,
        context,
      );

      return [name, value] as const;
    }),
  );

  return Object.freeze(
    Object.fromEntries(loaded),
  ) as Readonly<Record<string, unknown>>;
}

function asRuntimeNode(node: unknown): RuntimeNode {
  return node as RuntimeNode;
}

function isCanonicalNodeId<
  TProgram extends GraphActivationProgram,
>(
  program: TProgram,
  value: unknown,
): value is GraphActivationNodeId<TProgram> {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(
      program.graph.nodes,
      value,
    )
  );
}

function freezeLoading<TNodeId extends string>(
  activationId: number,
  nodeId: TNodeId | null,
  context: GraphActivationContext | null,
): GraphActivationLoadingState<TNodeId> {
  return Object.freeze({
    status: 'loading' as const,
    activationId,
    nodeId,
    context,
  });
}

function freezeError(
  error: GraphActivationError,
): GraphActivationErrorState {
  return Object.freeze({
    status: 'error' as const,
    activationId: error.activationId,
    nodeId: error.nodeId,
    error,
  });
}

function freezeStale<TNodeId extends string>(
  activationId: number,
  nodeId: TNodeId,
): GraphActivationStaleResult<TNodeId> {
  return Object.freeze({
    status: 'stale' as const,
    activationId,
    nodeId,
  });
}

function freezeReady<TNodeId extends string>(
  activationId: number,
  nodeId: TNodeId,
  context: GraphActivationContext,
  sources: Readonly<Record<string, unknown>> | null,
  projection: GraphNodeProjection,
): GraphActivationReadyState<TNodeId> {
  return Object.freeze({
    status: 'ready' as const,
    activationId,
    nodeId,
    context,
    sources,
    projection,
  });
}

export function createGraphActivationRuntime<
  const TProgram extends GraphActivationProgram,
>(
  program: TProgram,
): GraphActivationRuntime<TProgram> {
  let nextActivationId = 0;
  let currentActivationId = 0;
  let state: GraphActivationCurrentState<
    GraphActivationNodeId<TProgram>
  > = freezeIdle();
  const activeInteractions = new Map<
    symbol,
    GraphActivationReadyState<string>
  >();

  const getState = (): GraphActivationCurrentState<
    GraphActivationNodeId<TProgram>
  > => state;

  const runActivation = async (
    input: Readonly<{
      nodeId: unknown;
      context: unknown;
    }>,
    retainedReady: GraphActivationReadyState<GraphActivationNodeId<TProgram>> | null,
  ): Promise<
    GraphActivationResult<GraphActivationNodeId<TProgram>>
  > => {
    if (nextActivationId >= Number.MAX_SAFE_INTEGER) {
      throw new Error(
        'Graph activation identity exhausted the safe integer range.',
      );
    }

    const activationId = nextActivationId + 1;
    nextActivationId = activationId;
    currentActivationId = activationId;

    const initialNodeId =
      typeof input.nodeId === 'string'
        ? input.nodeId
        : null;

    if (retainedReady === null) {
      state = freezeLoading(
        activationId,
        isCanonicalNodeId(program, input.nodeId)
          ? input.nodeId
          : null,
        null,
      );
    }

    if (!isCanonicalNodeId(program, input.nodeId)) {
      const error = new GraphActivationError({
        code: 'UNKNOWN_NODE',
        message: `Unknown graph activation node "${String(input.nodeId)}".`,
        activationId,
        nodeId: initialNodeId,
      });
      const result = freezeError(error);
      state = retainedReady ?? result;
      return result;
    }

    const nodeId = input.nodeId;
    const node = asRuntimeNode(
      program.graph.nodes[nodeId],
    );

    let context: GraphActivationContext;
    try {
      context = parseGraphContext(
        node.context,
        input.context,
      );
    } catch (error: unknown) {
      const activationError = new GraphActivationError({
        code: 'INVALID_CONTEXT',
        message:
          error instanceof GraphContextValidationError
            ? error.message
            : `Graph context validation failed: ${errorMessage(error)}`,
        activationId,
        nodeId,
        originalError: error,
      });
      const result = freezeError(activationError);

      if (currentActivationId === activationId) {
        state = retainedReady ?? result;
      }

      return result;
    }

    if (currentActivationId !== activationId) {
      return freezeStale(
        activationId,
        nodeId,
      );
    }

    if (retainedReady === null) {
      state = freezeLoading(
        activationId,
        nodeId,
        context,
      );
    }

    try {
      let projection: GraphNodeProjection;
      let sources: Readonly<Record<string, unknown>> | null = null;

      if (node.kind === 'local') {
        projection = node.project({
          context,
        });
      } else {
        sources = await loadSourceBundle(
          node,
          context,
        );

        if (currentActivationId !== activationId) {
          return freezeStale(
            activationId,
            nodeId,
          );
        }

        projection = node.project({
          context,
          sources,
        });
      }

      if (currentActivationId !== activationId) {
        return freezeStale(
          activationId,
          nodeId,
        );
      }

      const result = freezeReady(
        activationId,
        nodeId,
        context,
        sources,
        projection,
      );
      state = result;
      return result;
    } catch (error: unknown) {
      if (currentActivationId !== activationId) {
        return freezeStale(
          activationId,
          nodeId,
        );
      }

      const activationError =
        error instanceof RequiredSourceLoadError
          ? new GraphActivationError({
              code: 'REQUIRED_SOURCE_FAILED',
              message:
                `Required graph source "${error.failure.sourceId}" failed: ` +
                error.failure.message,
              activationId,
              nodeId,
              sourceFailure: error.failure,
              originalError: error.originalError,
            })
          : new GraphActivationError({
              code: 'PROJECTION_FAILED',
              message:
                `Graph node "${nodeId}" projection failed: ` +
                errorMessage(error),
              activationId,
              nodeId,
              originalError: error,
            });

      const result = freezeError(activationError);
      state = retainedReady ?? result;
      return result;
    }
  };

  const activate = (
    input: Readonly<{ nodeId: unknown; context: unknown }>,
  ) => runActivation(input, null);

  const refresh = (
    input: Readonly<{ context?: unknown }> = {},
  ): Promise<GraphActivationResult<GraphActivationNodeId<TProgram>>> => {
    const current = state;
    if (current.status !== 'ready') {
      throw new Error('Graph refresh requires a current ready activation.');
    }
    if (activeInteractions.size > 0) {
      return Promise.resolve(freezeStale(current.activationId, current.nodeId));
    }
    return runActivation({
      nodeId: current.nodeId,
      context: input.context ?? current.context,
    }, current);
  };

  const coordinateInteraction = <TResult>(
    ready: GraphActivationReadyState<string>,
    operation: () => Promise<TResult>,
  ): Promise<TResult> | null => {
    if (state !== ready) return null;
    const readyAlreadyCoordinated = [...activeInteractions.values()]
      .some((activeReady) => activeReady === ready);
    if (currentActivationId !== ready.activationId && !readyAlreadyCoordinated) {
      if (nextActivationId >= Number.MAX_SAFE_INTEGER) {
        throw new Error('Graph activation identity exhausted the safe integer range.');
      }
      nextActivationId += 1;
      currentActivationId = nextActivationId;
    }
    const interaction = Symbol('graph-interaction');
    activeInteractions.set(interaction, ready);
    const release = () => {
      activeInteractions.delete(interaction);
    };
    try {
      return operation().finally(release);
    } catch (error: unknown) {
      release();
      throw error;
    }
  };

  return Object.freeze({
    program,
    activate,
    refresh,
    coordinateInteraction,
    getState,
  });
}
