import type {
  GraphActivationContext,
  GraphActivationNodeId,
  GraphActivationProgram,
  GraphActivationReadyState,
  GraphActivationRuntime,
} from './activation';
import type { GraphRuntimeInteractionNodeId } from './actions';
import type {
  GraphPresentationInteractionPlan,
  GraphReadyInteractionPlanner,
  GraphRuntimePresentationInteractionActionId,
} from './planning';
import { parseGraphContext } from '../graphProtocol/context';

export type GraphPresentationExecutionFailurePhase =
  | 'plan-acceptance'
  | 'attempt-id-allocation'
  | 'history-resolution'
  | 'destination-activation';

export type GraphPresentationExecutionStaleReason =
  | 'newer-attempt'
  | 'activation-changed'
  | 'destination-superseded';

export type GraphPresentationExecutionErrorCode =
  | 'RUNTIME_NOT_READY'
  | 'PLANNER_ACTIVATION_MISMATCH'
  | 'PLANNER_NODE_MISMATCH'
  | 'PLAN_NOT_OWNED'
  | 'ATTEMPT_ID_EXHAUSTED'
  | 'HISTORY_EMPTY'
  | 'DESTINATION_ACTIVATION_FAILED';

export class GraphPresentationExecutionError extends Error {
  readonly code: GraphPresentationExecutionErrorCode;
  readonly phase: GraphPresentationExecutionFailurePhase;
  readonly attemptId: number | null;
  readonly activationId: number | null;
  readonly nodeId: string | null;
  readonly actionId: string | null;
  readonly originalError: unknown;

  constructor(
    definition: Readonly<{
      code: GraphPresentationExecutionErrorCode;
      phase: GraphPresentationExecutionFailurePhase;
      message: string;
      attemptId?: number;
      activationId?: number;
      nodeId?: string;
      actionId?: string;
      originalError?: unknown;
    }>,
  ) {
    super(definition.message);
    this.name = 'GraphPresentationExecutionError';
    this.code = definition.code;
    this.phase = definition.phase;
    this.attemptId = definition.attemptId ?? null;
    this.activationId = definition.activationId ?? null;
    this.nodeId = definition.nodeId ?? null;
    this.actionId = definition.actionId ?? null;
    this.originalError = definition.originalError;
    Object.freeze(this);
  }
}

export type GraphPresentationExecutionIdleState = Readonly<{
  status: 'idle';
}>;

export type GraphPresentationExecutionPendingState<
  TPlan = unknown,
> = Readonly<{
  status: 'pending';
  attemptId: number;
  sourceActivationId: number;
  sourceNodeId: string;
  effect: 'back' | 'navigate';
  plan: TPlan;
  historyDepthBefore: number;
}>;

export type GraphPresentationExecutionReadyResult<
  TNodeId extends string = string,
> = Readonly<{
  status: 'ready';
  attemptId: number;
  effect: 'back' | 'navigate';
  activation: GraphActivationReadyState<TNodeId>;
  historyDepthAfter: number;
}>;

export type GraphPresentationExecutionErrorResult = Readonly<{
  status: 'error';
  attemptId: number | null;
  error: GraphPresentationExecutionError;
}>;

export type GraphPresentationExecutionStaleResult = Readonly<{
  status: 'stale';
  attemptId: number;
  reason: GraphPresentationExecutionStaleReason;
}>;

export type GraphPresentationExecutionResult<
  TNodeId extends string = string,
> =
  | GraphPresentationExecutionReadyResult<TNodeId>
  | GraphPresentationExecutionErrorResult
  | GraphPresentationExecutionStaleResult;

export type GraphPresentationExecutionCurrentState<
  TPlan = unknown,
  TNodeId extends string = string,
> =
  | GraphPresentationExecutionIdleState
  | GraphPresentationExecutionPendingState<TPlan>
  | GraphPresentationExecutionReadyResult<TNodeId>
  | GraphPresentationExecutionErrorResult
  | GraphPresentationExecutionStaleResult;

type GraphAnyPresentationPlan<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = GraphPresentationInteractionPlan<
  TNodeId,
  GraphRuntimePresentationInteractionActionId<TProgram, TNodeId>
>;

export type GraphPresentationExecutionRuntime<
  TProgram extends GraphActivationProgram,
> = Readonly<{
  runtime: GraphActivationRuntime<TProgram>;
  getState: () => GraphPresentationExecutionCurrentState<
    GraphPresentationInteractionPlan,
    GraphActivationNodeId<TProgram>
  >;
  execute: <
    TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
  >(
    planner: GraphReadyInteractionPlanner<TProgram, TNodeId>,
    plan: GraphAnyPresentationPlan<TProgram, TNodeId>,
  ) => Promise<
    GraphPresentationExecutionResult<GraphActivationNodeId<TProgram>>
  >;
  getHistoryDepth: () => number;
  replaceHistory: (
    locations: readonly GraphPresentationHistoryLocation<GraphActivationNodeId<TProgram>>[],
  ) => void;
}>;

export type GraphPresentationHistoryLocation<
  TNodeId extends string,
> = Readonly<{
  nodeId: TNodeId;
  context: GraphActivationContext;
}>;

function freezeIdle(): GraphPresentationExecutionIdleState {
  return Object.freeze({ status: 'idle' as const });
}

function freezeContextCopy(
  context: GraphActivationContext,
): GraphActivationContext {
  return Object.freeze({ ...context });
}

function freezeLocation<TNodeId extends string>(
  ready: GraphActivationReadyState<TNodeId>,
  context: GraphActivationContext = ready.context,
): GraphPresentationHistoryLocation<TNodeId> {
  return Object.freeze({
    nodeId: ready.nodeId,
    context: freezeContextCopy(context),
  });
}

function freezeErrorResult(
  error: GraphPresentationExecutionError,
): GraphPresentationExecutionErrorResult {
  return Object.freeze({
    status: 'error' as const,
    attemptId: error.attemptId,
    error,
  });
}

function freezeStale(
  attemptId: number,
  reason: GraphPresentationExecutionStaleReason,
): GraphPresentationExecutionStaleResult {
  return Object.freeze({
    status: 'stale' as const,
    attemptId,
    reason,
  });
}

function freezeReady<TNodeId extends string>(
  attemptId: number,
  effect: 'back' | 'navigate',
  activation: GraphActivationReadyState<TNodeId>,
  historyDepthAfter: number,
): GraphPresentationExecutionReadyResult<TNodeId> {
  return Object.freeze({
    status: 'ready' as const,
    attemptId,
    effect,
    activation,
    historyDepthAfter,
  });
}

function freezePending<TPlan>(
  attemptId: number,
  ready: GraphActivationReadyState<string>,
  plan: TPlan,
  effect: 'back' | 'navigate',
  historyDepthBefore: number,
): GraphPresentationExecutionPendingState<TPlan> {
  return Object.freeze({
    status: 'pending' as const,
    attemptId,
    sourceActivationId: ready.activationId,
    sourceNodeId: ready.nodeId,
    effect,
    plan,
    historyDepthBefore,
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

function presentationError(
  code: GraphPresentationExecutionErrorCode,
  phase: GraphPresentationExecutionFailurePhase,
  message: string,
  details: Readonly<{
    attemptId?: number;
    activationId?: number;
    nodeId?: string;
    actionId?: string;
    originalError?: unknown;
  }> = {},
): GraphPresentationExecutionError {
  return new GraphPresentationExecutionError({
    code,
    phase,
    message,
    ...details,
  });
}

function preActivationStaleReason(
  currentAttemptId: number,
  attemptId: number,
  runtimeState: unknown,
  capturedReady: GraphActivationReadyState<string>,
): GraphPresentationExecutionStaleReason | null {
  if (currentAttemptId !== attemptId) return 'newer-attempt';
  if (runtimeState !== capturedReady) return 'activation-changed';
  return null;
}

export function createGraphPresentationExecutionRuntime<
  const TProgram extends GraphActivationProgram,
>(
  runtime: GraphActivationRuntime<TProgram>,
): GraphPresentationExecutionRuntime<TProgram> {
  type TRuntimeNodeId = GraphActivationNodeId<TProgram>;
  type TAnyPresentationPlan = GraphPresentationInteractionPlan;

  const history: Array<GraphPresentationHistoryLocation<TRuntimeNodeId>> = [];
  let nextAttemptId = 0;
  let currentAttemptId = 0;
  let state: GraphPresentationExecutionCurrentState<
    TAnyPresentationPlan,
    TRuntimeNodeId
  > = freezeIdle();

  const getState = (): GraphPresentationExecutionCurrentState<
    TAnyPresentationPlan,
    TRuntimeNodeId
  > => state;

  const getHistoryDepth = (): number => history.length;

  const replaceHistory = (
    locations: readonly GraphPresentationHistoryLocation<TRuntimeNodeId>[],
  ): void => {
    if (state.status === 'pending') {
      throw new Error('Graph navigation history cannot be replaced during presentation execution.');
    }
    const normalized = locations.map((location) => {
      const node = runtime.program.graph.nodes[location.nodeId];
      if (node === undefined) {
        throw new Error(`Unknown graph history node "${String(location.nodeId)}".`);
      }
      return Object.freeze({
        nodeId: location.nodeId,
        context: parseGraphContext(node.context, location.context),
      });
    });
    history.splice(0, history.length, ...normalized);
  };

  const publish = (
    attemptId: number,
    result: GraphPresentationExecutionResult<TRuntimeNodeId>,
  ): void => {
    if (currentAttemptId === attemptId) state = result;
  };

  const execute = async <
    TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
  >(
    planner: GraphReadyInteractionPlanner<TProgram, TNodeId>,
    plan: GraphAnyPresentationPlan<TProgram, TNodeId>,
  ): Promise<GraphPresentationExecutionResult<TRuntimeNodeId>> => {
    const current = runtime.getState();

    if (current.status !== 'ready') {
      return freezeErrorResult(
        presentationError(
          'RUNTIME_NOT_READY',
          'plan-acceptance',
          'Graph presentation execution requires a current ready activation.',
        ),
      );
    }

    if (current.activationId !== planner.activationId) {
      return freezeErrorResult(
        presentationError(
          'PLANNER_ACTIVATION_MISMATCH',
          'plan-acceptance',
          'Graph presentation planner activation does not match the current ready activation.',
          {
            activationId: current.activationId,
            nodeId: current.nodeId,
          },
        ),
      );
    }

    if (current.nodeId !== planner.nodeId) {
      return freezeErrorResult(
        presentationError(
          'PLANNER_NODE_MISMATCH',
          'plan-acceptance',
          'Graph presentation planner node does not match the current ready node.',
          {
            activationId: current.activationId,
            nodeId: current.nodeId,
          },
        ),
      );
    }

    if (!planner.ownsPresentationPlan(plan)) {
      return freezeErrorResult(
        presentationError(
          'PLAN_NOT_OWNED',
          'plan-acceptance',
          'Graph presentation execution requires the exact current planner-owned presentation plan.',
        ),
      );
    }

    if (nextAttemptId >= Number.MAX_SAFE_INTEGER) {
      return freezeErrorResult(
        presentationError(
          'ATTEMPT_ID_EXHAUSTED',
          'attempt-id-allocation',
          'Graph presentation execution attempt identity exhausted the safe integer range.',
          {
            activationId: current.activationId,
            nodeId: current.nodeId,
            actionId: plan.actionId,
          },
        ),
      );
    }

    const capturedReady = current;
    const attemptId = nextAttemptId + 1;
    nextAttemptId = attemptId;
    currentAttemptId = attemptId;
    state = freezePending(
      attemptId,
      capturedReady,
      plan,
      plan.effect,
      history.length,
    );

    const coordinated = runtime.coordinateInteraction(capturedReady, async () => {
      if (plan.effect === 'back') {
        if (history.length === 0) {
          const result = freezeErrorResult(
            presentationError(
              'HISTORY_EMPTY',
              'history-resolution',
              'Graph presentation back requires a non-empty navigation history.',
              {
                attemptId,
                activationId: capturedReady.activationId,
                nodeId: capturedReady.nodeId,
                actionId: plan.actionId,
              },
            ),
          );
          publish(attemptId, result);
          return result;
        }
      }

      const target =
        plan.effect === 'navigate'
          ? Object.freeze({
              nodeId: plan.destination.nodeId,
              context: plan.destination.context,
            })
          : history[history.length - 1];
      const selfNavigation = plan.effect === 'navigate' && target.nodeId === capturedReady.nodeId;
      const sourceLocation = freezeLocation(
        capturedReady,
        plan.effect === 'navigate'
          ? parseGraphContext(
              runtime.program.graph.nodes[capturedReady.nodeId].context,
              plan.destination.context,
            )
          : capturedReady.context,
      );
      const staleBeforeActivation = preActivationStaleReason(
        currentAttemptId,
        attemptId,
        runtime.getState(),
        capturedReady,
      );

      if (staleBeforeActivation !== null) {
        return freezeStale(attemptId, staleBeforeActivation);
      }

      let activationResult;
      try {
        activationResult = await runtime.activate({
          nodeId: target.nodeId,
          context: target.context,
        });
      } catch (error: unknown) {
        if (currentAttemptId !== attemptId) {
          return freezeStale(attemptId, 'newer-attempt');
        }

        const result = freezeErrorResult(
          presentationError(
            'DESTINATION_ACTIVATION_FAILED',
            'destination-activation',
            `Graph presentation destination activation failed: ${errorMessage(error)}`,
            {
              attemptId,
              activationId: capturedReady.activationId,
              nodeId: target.nodeId,
              actionId: plan.actionId,
              originalError: error,
            },
          ),
        );
        publish(attemptId, result);
        return result;
      }

      if (currentAttemptId !== attemptId) {
        return freezeStale(attemptId, 'newer-attempt');
      }

      if (activationResult.status === 'stale') {
        const result = freezeStale(attemptId, 'destination-superseded');
        publish(attemptId, result);
        return result;
      }

      if (runtime.getState() !== activationResult) {
        const result = freezeStale(attemptId, 'destination-superseded');
        publish(attemptId, result);
        return result;
      }

      if (activationResult.status === 'error') {
        const result = freezeErrorResult(
          presentationError(
            'DESTINATION_ACTIVATION_FAILED',
            'destination-activation',
            `Graph presentation destination activation failed: ${errorMessage(activationResult.error)}`,
            {
              attemptId,
              activationId: activationResult.activationId,
              nodeId: activationResult.nodeId ?? target.nodeId,
              actionId: plan.actionId,
              originalError: activationResult.error,
            },
          ),
        );
        publish(attemptId, result);
        return result;
      }

      if (plan.effect === 'navigate' && !selfNavigation) {
        history.push(sourceLocation);
      } else if (plan.effect === 'back') {
        history.pop();
      }

      const result = freezeReady(
        attemptId,
        plan.effect,
        activationResult,
        history.length,
      );
      publish(attemptId, result);
      return result;
    });
    if (coordinated === null) {
      const result = freezeStale(attemptId, 'activation-changed');
      publish(attemptId, result);
      return result;
    }
    return coordinated;
  };

  return Object.freeze({
    runtime,
    getState,
    getHistoryDepth,
    replaceHistory,
    execute,
  });
}
