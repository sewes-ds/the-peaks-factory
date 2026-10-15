import type {
  GraphCommandDefinition,
  GraphCommandEntitySchema,
  GraphCommandInputSchema,
} from '../graphProtocol/command';
import {
  parseGraphContext,
  type GraphContextScalar,
  type GraphContextSchema,
} from '../graphProtocol/context';
import type { GraphNodeId } from '../graphProtocol/definition';
import type { GraphTransitionDefinition } from '../graphProtocol/transition';
import type {
  GraphActivationErrorState,
  GraphActivationNodeId,
  GraphActivationProgram,
  GraphActivationReadyState,
  GraphActivationRuntime,
} from './activation';
import type { GraphRuntimeInteractionNodeId } from './actions';
import type {
  GraphBusinessInteractionPlanFor,
  GraphReadyInteractionPlanner,
  GraphRuntimeBusinessInteractionActionId,
} from './planning';

type GraphExecutionCommand = GraphCommandDefinition<
  GraphCommandInputSchema,
  string,
  readonly [string, ...string[]],
  GraphCommandEntitySchema
>;

type GraphExecutionTransition = GraphTransitionDefinition<
  GraphActivationProgram['graph'],
  GraphExecutionCommand,
  GraphContextSchema
>;

type GraphAnyBusinessPlan<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = {
  [TActionId in GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >]: GraphBusinessInteractionPlanFor<TProgram, TNodeId, TActionId>;
}[GraphRuntimeBusinessInteractionActionId<TProgram, TNodeId>];

export type GraphBusinessExecutionFailurePhase =
  | 'plan-acceptance'
  | 'attempt-id-allocation'
  | 'request'
  | 'decode'
  | 'transition-resolution'
  | 'destination-context-materialization'
  | 'destination-activation';

export type GraphBusinessExecutionStaleReason =
  | 'newer-attempt'
  | 'activation-changed'
  | 'destination-superseded';

export type GraphBusinessExecutionErrorCode =
  | 'RUNTIME_NOT_READY'
  | 'PLANNER_ACTIVATION_MISMATCH'
  | 'PLANNER_NODE_MISMATCH'
  | 'PLAN_NOT_OWNED'
  | 'ATTEMPT_ID_EXHAUSTED'
  | 'REQUEST_FAILED'
  | 'DECODE_FAILED'
  | 'TRANSITION_IDENTITY_MISMATCH'
  | 'TRANSITION_OUTCOME_MISSING'
  | 'DESTINATION_NODE_INVALID'
  | 'DESTINATION_BINDING_INVALID'
  | 'DESTINATION_VALUE_MISSING'
  | 'DESTINATION_CONTEXT_INVALID'
  | 'DESTINATION_ACTIVATION_FAILED';

export class GraphBusinessExecutionError extends Error {
  readonly code: GraphBusinessExecutionErrorCode;
  readonly phase: GraphBusinessExecutionFailurePhase;
  readonly attemptId: number | null;
  readonly activationId: number | null;
  readonly nodeId: string | null;
  readonly actionId: string | null;
  readonly field: string | null;
  readonly originalError: unknown;

  constructor(
    definition: Readonly<{
      code: GraphBusinessExecutionErrorCode;
      phase: GraphBusinessExecutionFailurePhase;
      message: string;
      attemptId?: number;
      activationId?: number;
      nodeId?: string;
      actionId?: string;
      field?: string;
      originalError?: unknown;
    }>,
  ) {
    super(definition.message);
    this.name = 'GraphBusinessExecutionError';
    this.code = definition.code;
    this.phase = definition.phase;
    this.attemptId = definition.attemptId ?? null;
    this.activationId = definition.activationId ?? null;
    this.nodeId = definition.nodeId ?? null;
    this.actionId = definition.actionId ?? null;
    this.field = definition.field ?? null;
    this.originalError = definition.originalError;
    Object.freeze(this);
  }
}

export type GraphBusinessExecutionIdleState = Readonly<{ status: 'idle' }>;

export type GraphBusinessExecutionPendingState<TPlan = unknown> = Readonly<{
  status: 'pending';
  attemptId: number;
  activationId: number;
  nodeId: string;
  plan: TPlan;
}>;

export type GraphBusinessExecutionReadyResult<
  TNodeId extends string = string,
> = Readonly<{
  status: 'ready';
  attemptId: number;
  activation: GraphActivationReadyState<TNodeId>;
}>;

export type GraphBusinessExecutionErrorResult = Readonly<{
  status: 'error';
  attemptId: number | null;
  error: GraphBusinessExecutionError;
}>;

export type GraphBusinessExecutionStaleResult = Readonly<{
  status: 'stale';
  attemptId: number;
  reason: GraphBusinessExecutionStaleReason;
}>;

export type GraphBusinessExecutionResult<
  TNodeId extends string = string,
> =
  | GraphBusinessExecutionReadyResult<TNodeId>
  | GraphBusinessExecutionErrorResult
  | GraphBusinessExecutionStaleResult;

export type GraphBusinessExecutionCurrentState<
  TPlan = unknown,
  TNodeId extends string = string,
> =
  | GraphBusinessExecutionIdleState
  | GraphBusinessExecutionPendingState<TPlan>
  | GraphBusinessExecutionResult<TNodeId>;

export type GraphReadyBusinessExecutionRuntime<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Readonly<{
  runtime: GraphActivationRuntime<TProgram>;
  planner: GraphReadyInteractionPlanner<TProgram, TNodeId>;
  activationId: number;
  nodeId: TNodeId;
  getState: () => GraphBusinessExecutionCurrentState<
    GraphAnyBusinessPlan<TProgram, TNodeId>,
    GraphActivationNodeId<TProgram>
  >;
  execute: (
    plan: GraphAnyBusinessPlan<TProgram, TNodeId>,
  ) => Promise<GraphBusinessExecutionResult<GraphActivationNodeId<TProgram>>>;
}>;

type RuntimeBinding = Readonly<{
  source: unknown;
  field?: unknown;
  normalize?: unknown;
}>;

type RuntimeTarget = Readonly<{
  node: unknown;
  context: unknown;
}>;

type RuntimeTransition = Readonly<{
  graph: unknown;
  command: unknown;
  currentContext: unknown;
  transitions: Readonly<Record<string, RuntimeTarget>>;
}>;

type RuntimeCommand = Readonly<{
  request: (input: unknown) => Promise<unknown>;
  decode: (input: unknown) => Readonly<{
    outcome: unknown;
    entities: Readonly<Record<string, unknown>>;
  }>;
}>;

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function freezeIdle(): GraphBusinessExecutionIdleState {
  return Object.freeze({ status: 'idle' as const });
}

function freezeErrorResult(
  error: GraphBusinessExecutionError,
): GraphBusinessExecutionErrorResult {
  return Object.freeze({ status: 'error' as const, attemptId: error.attemptId, error });
}

function freezeStale(
  attemptId: number,
  reason: GraphBusinessExecutionStaleReason,
): GraphBusinessExecutionStaleResult {
  return Object.freeze({ status: 'stale' as const, attemptId, reason });
}

function safeErrorMessage(value: unknown): string {
  try {
    if (value instanceof Error) {
      try {
        const message = value.message;
        if (typeof message === 'string') {
          try {
            if (message.trim().length > 0) return message;
          } catch {
            return '[unprintable error message]';
          }
        }
      } catch {
        return '[unprintable error message]';
      }
    }
  } catch {
    return '[unprintable error]';
  }

  try {
    const rendered = String(value);
    try {
      return rendered.trim().length > 0 ? rendered : '[unknown error]';
    } catch {
      return '[unprintable error]';
    }
  } catch {
    return '[unprintable error]';
  }
}

function executionError(
  code: GraphBusinessExecutionErrorCode,
  phase: GraphBusinessExecutionFailurePhase,
  message: string,
  details: Readonly<{
    attemptId?: number;
    activationId?: number;
    nodeId?: string;
    actionId?: string;
    field?: string;
    originalError?: unknown;
  }> = {},
): GraphBusinessExecutionError {
  return new GraphBusinessExecutionError({ code, phase, message, ...details });
}

function isCanonicalNodeId<TProgram extends GraphActivationProgram>(
  program: TProgram,
  value: unknown,
): value is GraphNodeId<TProgram['graph']> {
  return typeof value === 'string' && hasOwn(program.graph.nodes, value);
}

function normalizeEntityId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    try {
      return value.trim().length > 0 ? String(value) : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function materializeDestinationContext(
  target: RuntimeTarget,
  destinationSchema: GraphContextSchema,
  capturedContext: Readonly<Record<string, GraphContextScalar>>,
  entities: Readonly<Record<string, unknown>>,
  attemptId: number,
  activationId: number,
  nodeId: string,
  actionId: string,
): Readonly<Record<string, GraphContextScalar>> | GraphBusinessExecutionError {
  if (
    typeof target.context !== 'object' ||
    target.context === null ||
    Array.isArray(target.context)
  ) {
    return executionError(
      'DESTINATION_BINDING_INVALID',
      'destination-context-materialization',
      'Graph transition destination context bindings must be a plain object.',
      { attemptId, activationId, nodeId, actionId },
    );
  }

  const bindings = target.context as Readonly<Record<string, RuntimeBinding>>;
  const raw: Record<string, GraphContextScalar> = {};

  for (const [destinationField, destinationDefinition] of Object.entries(destinationSchema)) {
    if (!hasOwn(bindings, destinationField)) {
      if (destinationDefinition.optional) continue;
      return executionError(
        'DESTINATION_VALUE_MISSING',
        'destination-context-materialization',
        `Missing required destination binding for "${destinationField}".`,
        { attemptId, activationId, nodeId, actionId, field: destinationField },
      );
    }

    const binding = bindings[destinationField];
    if (
      typeof binding !== 'object' ||
      binding === null ||
      Array.isArray(binding) ||
      typeof binding.field !== 'string'
    ) {
      return executionError(
        'DESTINATION_BINDING_INVALID',
        'destination-context-materialization',
        `Invalid destination binding for "${destinationField}".`,
        { attemptId, activationId, nodeId, actionId, field: destinationField },
      );
    }

    let value: GraphContextScalar | undefined;
    if (binding.source === 'context') {
      if (hasOwn(capturedContext, binding.field)) value = capturedContext[binding.field];
    } else if (
      binding.source === 'command-entity' &&
      binding.normalize === 'string'
    ) {
      if (hasOwn(entities, binding.field)) value = normalizeEntityId(entities[binding.field]);
    } else {
      return executionError(
        'DESTINATION_BINDING_INVALID',
        'destination-context-materialization',
        `Unsupported destination binding for "${destinationField}".`,
        { attemptId, activationId, nodeId, actionId, field: destinationField },
      );
    }

    if (value === undefined) {
      if (destinationDefinition.optional) continue;
      return executionError(
        'DESTINATION_VALUE_MISSING',
        'destination-context-materialization',
        `Missing required destination value for "${destinationField}".`,
        { attemptId, activationId, nodeId, actionId, field: destinationField },
      );
    }

    raw[destinationField] = value;
  }

  try {
    return parseGraphContext(destinationSchema, Object.freeze(raw));
  } catch (error: unknown) {
    return executionError(
      'DESTINATION_CONTEXT_INVALID',
      'destination-context-materialization',
      `Invalid destination context: ${safeErrorMessage(error)}`,
      { attemptId, activationId, nodeId, actionId, originalError: error },
    );
  }
}

export function createGraphReadyBusinessExecutionRuntime<
  const TProgram extends GraphActivationProgram,
  const TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
>(
  runtime: GraphActivationRuntime<TProgram>,
  planner: GraphReadyInteractionPlanner<TProgram, TNodeId>,
): GraphReadyBusinessExecutionRuntime<TProgram, TNodeId> {
  const current = runtime.getState();
  if (current.status !== 'ready') {
    throw executionError(
      'RUNTIME_NOT_READY',
      'plan-acceptance',
      'Graph business execution requires a current ready activation.',
    );
  }
  if (current.activationId !== planner.activationId) {
    throw executionError(
      'PLANNER_ACTIVATION_MISMATCH',
      'plan-acceptance',
      'Graph execution planner activation does not match the current ready activation.',
      { activationId: current.activationId, nodeId: current.nodeId },
    );
  }
  if (current.nodeId !== planner.nodeId) {
    throw executionError(
      'PLANNER_NODE_MISMATCH',
      'plan-acceptance',
      'Graph execution planner node does not match the current ready node.',
      { activationId: current.activationId, nodeId: current.nodeId },
    );
  }

  const capturedReady = current as GraphActivationReadyState<TNodeId>;
  let nextAttemptId = 0;
  let currentAttemptId = 0;
  let state: GraphBusinessExecutionCurrentState<
    GraphAnyBusinessPlan<TProgram, TNodeId>,
    GraphActivationNodeId<TProgram>
  > = freezeIdle();

  const getState = () => state;
  const publish = (
    attemptId: number,
    result: GraphBusinessExecutionResult<GraphActivationNodeId<TProgram>>,
  ): void => {
    if (currentAttemptId === attemptId) state = result;
  };
  const staleReasonBeforeActivation = (
    attemptId: number,
  ): GraphBusinessExecutionStaleReason | null => {
    if (currentAttemptId !== attemptId) return 'newer-attempt';
    if (runtime.getState() !== capturedReady) return 'activation-changed';
    return null;
  };

  const execute = async (
    plan: GraphAnyBusinessPlan<TProgram, TNodeId>,
  ): Promise<GraphBusinessExecutionResult<GraphActivationNodeId<TProgram>>> => {
    if (!planner.ownsBusinessPlan(plan)) {
      return freezeErrorResult(
        executionError(
          'PLAN_NOT_OWNED',
          'plan-acceptance',
          'Graph business execution requires the exact current planner-owned business plan.',
        ),
      );
    }

    if (nextAttemptId >= Number.MAX_SAFE_INTEGER) {
      return freezeErrorResult(
        executionError(
          'ATTEMPT_ID_EXHAUSTED',
          'attempt-id-allocation',
          'Graph business execution attempt identity exhausted the safe integer range.',
          {
            activationId: capturedReady.activationId,
            nodeId: capturedReady.nodeId,
            actionId: plan.actionId,
          },
        ),
      );
    }

    const attemptId = nextAttemptId + 1;
    nextAttemptId = attemptId;
    currentAttemptId = attemptId;
    state = Object.freeze({
      status: 'pending' as const,
      attemptId,
      activationId: capturedReady.activationId,
      nodeId: capturedReady.nodeId,
      plan,
    });

    const coordinated = runtime.coordinateInteraction(capturedReady, async () => {
      const command = plan.command as RuntimeCommand;
      const transition = plan.transition as RuntimeTransition;
      let rawResult: unknown;
      try {
        const requestPromise = command.request(plan.input);
        rawResult = await requestPromise;
      } catch (error: unknown) {
        const stale = staleReasonBeforeActivation(attemptId);
        if (stale !== null) {
          const result = freezeStale(attemptId, stale);
          publish(attemptId, result);
          return result;
        }
        const result = freezeErrorResult(
          executionError(
            'REQUEST_FAILED',
            'request',
            `Graph business request failed: ${safeErrorMessage(error)}`,
            {
              attemptId,
              activationId: capturedReady.activationId,
              nodeId: capturedReady.nodeId,
              actionId: plan.actionId,
              originalError: error,
            },
          ),
        );
        publish(attemptId, result);
        return result;
      }

      const staleAfterRequest = staleReasonBeforeActivation(attemptId);
      if (staleAfterRequest !== null) {
        const result = freezeStale(attemptId, staleAfterRequest);
        publish(attemptId, result);
        return result;
      }

      let decoded: ReturnType<RuntimeCommand['decode']>;
      try {
        decoded = command.decode(rawResult);
      } catch (error: unknown) {
        const result = freezeErrorResult(
          executionError(
            'DECODE_FAILED',
            'decode',
            `Graph business result decode failed: ${safeErrorMessage(error)}`,
            {
              attemptId,
              activationId: capturedReady.activationId,
              nodeId: capturedReady.nodeId,
              actionId: plan.actionId,
              originalError: error,
            },
          ),
        );
        publish(attemptId, result);
        return result;
      }

      const capturedNode = runtime.program.graph.nodes[capturedReady.nodeId];
      if (
        transition.graph !== runtime.program.graph ||
        transition.command !== plan.command ||
        transition.currentContext !== capturedNode.context
      ) {
        const result = freezeErrorResult(
          executionError(
            'TRANSITION_IDENTITY_MISMATCH',
            'transition-resolution',
            'Graph business transition does not match the exact runtime, command, and captured context identities.',
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

      if (
        typeof decoded.outcome !== 'string' ||
        !hasOwn(transition.transitions, decoded.outcome)
      ) {
        const result = freezeErrorResult(
          executionError(
            'TRANSITION_OUTCOME_MISSING',
            'transition-resolution',
            'No own transition exists for the decoded outcome.',
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

      const target = transition.transitions[decoded.outcome];
      if (!isCanonicalNodeId(runtime.program, target.node)) {
        const result = freezeErrorResult(
          executionError(
            'DESTINATION_NODE_INVALID',
            'transition-resolution',
            'Graph transition destination is not an own canonical program node.',
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

      const destinationNodeId = target.node;
      const destinationContext = materializeDestinationContext(
        target,
        runtime.program.graph.nodes[destinationNodeId].context,
        capturedReady.context,
        decoded.entities,
        attemptId,
        capturedReady.activationId,
        capturedReady.nodeId,
        plan.actionId,
      );
      if (destinationContext instanceof GraphBusinessExecutionError) {
        const result = freezeErrorResult(destinationContext);
        publish(attemptId, result);
        return result;
      }

      const staleBeforeActivation = staleReasonBeforeActivation(attemptId);
      if (staleBeforeActivation !== null) {
        const result = freezeStale(attemptId, staleBeforeActivation);
        publish(attemptId, result);
        return result;
      }

      let activationResult;
      try {
        activationResult = await runtime.activate({
          nodeId: destinationNodeId,
          context: destinationContext,
        });
      } catch (error: unknown) {
        if (currentAttemptId !== attemptId) return freezeStale(attemptId, 'newer-attempt');
        const result = freezeErrorResult(
          executionError(
            'DESTINATION_ACTIVATION_FAILED',
            'destination-activation',
            `Graph destination activation failed: ${safeErrorMessage(error)}`,
            {
              attemptId,
              activationId: capturedReady.activationId,
              nodeId: destinationNodeId,
              actionId: plan.actionId,
              originalError: error,
            },
          ),
        );
        publish(attemptId, result);
        return result;
      }

      if (currentAttemptId !== attemptId) return freezeStale(attemptId, 'newer-attempt');

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
        const activationErrorState = activationResult as GraphActivationErrorState;
        const result = freezeErrorResult(
          executionError(
            'DESTINATION_ACTIVATION_FAILED',
            'destination-activation',
            `Graph destination activation failed: ${safeErrorMessage(activationErrorState.error)}`,
            {
              attemptId,
              activationId: activationErrorState.activationId,
              nodeId: activationErrorState.nodeId ?? destinationNodeId,
              actionId: plan.actionId,
              originalError: activationErrorState.error,
            },
          ),
        );
        publish(attemptId, result);
        return result;
      }

      const result = Object.freeze({
        status: 'ready' as const,
        attemptId,
        activation: activationResult,
      });
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
    planner,
    activationId: capturedReady.activationId,
    nodeId: capturedReady.nodeId,
    getState,
    execute,
  });
}
