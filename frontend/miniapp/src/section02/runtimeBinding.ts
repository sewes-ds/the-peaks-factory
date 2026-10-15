import {
  createGraphReadyBusinessExecutionRuntime,
  createGraphReadyInteractionPlanner,
  type GraphActivationReadyState,
  type GraphActivationRuntime,
  type GraphBusinessExecutionResult,
  type GraphBusinessInteractionPlan,
  type GraphPresentationExecutionResult,
  type GraphPresentationExecutionRuntime,
  type GraphPresentationInteractionPlan,
  type GraphReadyNodeActionFactory,
  type GraphRuntimeActionDescriptor,
} from '../foundation/graphRuntime';
import { ApiClientError } from '../foundation/apiClient';
import type { Section02NodeId } from './ids';
import type { Section02Program } from './program';

export type Section02ExecutionResult =
  | Readonly<{ kind: 'business'; result: GraphBusinessExecutionResult<Section02NodeId> }>
  | Readonly<{ kind: 'presentation'; result: GraphPresentationExecutionResult<Section02NodeId> }>;

export type Section02InteractionChange =
  | Readonly<{ status: 'pending'; activationId: number; nodeId: Section02NodeId; actionClass: 'business' | 'presentation'; actionId: string }>
  | Readonly<{ status: 'settled'; activationId: number; nodeId: Section02NodeId; actionClass: 'business' | 'presentation'; actionId: string; result: Section02ExecutionResult; expectedConflictRecovered: boolean }>;

type RuntimePlan = GraphBusinessInteractionPlan | GraphPresentationInteractionPlan;

export const SECTION02_ADDITIONAL_WORK_START_RACE_MESSAGE =
  'Доп. работу не удалось начать: состояние изменилось. Данные обновлены.';

function isAdditionalWorkRequestConflict(result: Section02ExecutionResult): boolean {
  if (result.kind !== 'business' || result.result.status !== 'error') return false;
  const originalError = result.result.error.originalError;
  if (!(originalError instanceof ApiClientError) || originalError.status !== 409) return false;
  if (typeof originalError.payload !== 'object' || originalError.payload === null) return false;
  const publicError = (originalError.payload as Readonly<{ error?: unknown }>).error;
  return typeof publicError === 'object'
    && publicError !== null
    && (publicError as Readonly<{ code?: unknown }>).code === 'conflict';
}

export function createSection02RuntimeBinding(input: Readonly<{
  runtime: GraphActivationRuntime<Section02Program>;
  presentationExecution: GraphPresentationExecutionRuntime<Section02Program>;
  nodeId: Section02NodeId;
  onInteractionStateChange: (change: Section02InteractionChange) => void;
}>): Readonly<{
  ready: GraphActivationReadyState<Section02NodeId>;
  actionFactory: GraphReadyNodeActionFactory<Section02Program, Section02NodeId>;
  execute: (instance: object) => Promise<Section02ExecutionResult>;
}> {
  if (input.presentationExecution.runtime !== input.runtime) throw new Error('Section 02 presentation execution runtime mismatch.');
  const state = input.runtime.getState();
  if (state.status !== 'ready' || state.nodeId !== input.nodeId) throw new Error('Section 02 runtime binding requires current ready node.');
  const ready = state as GraphActivationReadyState<Section02NodeId>;
  const planner = createGraphReadyInteractionPlanner(input.runtime, input.nodeId);
  const businessExecution = createGraphReadyBusinessExecutionRuntime(input.runtime, planner);
  const actionFactory = planner.actions;
  let pendingExecution: Promise<Section02ExecutionResult> | null = null;
  const run = async (instance: object): Promise<Section02ExecutionResult> => {
    const descriptor = actionFactory.describe(instance as never);
    const plan = (planner.plan as unknown as (exact: object, current: GraphRuntimeActionDescriptor) => RuntimePlan)(instance, descriptor);
    const actionClass = plan.kind === 'graph-business-interaction-plan' ? 'business' as const : 'presentation' as const;
    input.onInteractionStateChange(Object.freeze({ status: 'pending', activationId: ready.activationId, nodeId: ready.nodeId, actionClass, actionId: plan.actionId }));
    const executePlan = async (): Promise<Section02ExecutionResult> => plan.kind === 'graph-business-interaction-plan'
      ? Object.freeze({ kind: 'business' as const, result: await businessExecution.execute(plan as never) })
      : Object.freeze({ kind: 'presentation' as const, result: await input.presentationExecution.execute(planner, plan as never) });
    const coordinated = input.runtime.coordinateInteraction(ready, async () => {
      await Promise.resolve();
      return executePlan();
    });
    const result = await (coordinated ?? executePlan());
    if (result.kind === 'business' && result.result.status === 'ready') {
      input.presentationExecution.replaceHistory(
        result.result.activation.nodeId === 'S02-N11'
          ? [Object.freeze({ nodeId: 'S02-N02' as const, context: Object.freeze({}) })]
          : [],
      );
    }
    if (result.kind === 'presentation' && result.result.status === 'ready') {
      if (ready.nodeId === 'S02-N28') {
        input.presentationExecution.replaceHistory([]);
      } else if (ready.nodeId === 'S02-AW05') {
        input.presentationExecution.replaceHistory([
          Object.freeze({ nodeId: 'S02-N02' as const, context: Object.freeze({}) }),
        ]);
      }
    }
    let expectedConflictRecovered = false;
    if (
      plan.actionId === 'START_ADDITIONAL_WORK'
      && result.kind === 'business'
      && result.result.status === 'error'
    ) {
      await input.runtime.activate({ nodeId: ready.nodeId, context: ready.context });
    } else if (
      plan.actionId === 'REQUEST_ADDITIONAL_WORK'
      && isAdditionalWorkRequestConflict(result)
    ) {
      const refreshed = await input.runtime.activate({ nodeId: 'S02-AW01', context: Object.freeze({}) });
      if (refreshed.status === 'ready') {
        input.presentationExecution.replaceHistory([
          Object.freeze({ nodeId: 'S02-N02' as const, context: Object.freeze({}) }),
          Object.freeze({ nodeId: 'S02-N11' as const, context: Object.freeze({}) }),
        ]);
        expectedConflictRecovered = true;
      }
    }
    input.onInteractionStateChange(Object.freeze({ status: 'settled', activationId: ready.activationId, nodeId: ready.nodeId, actionClass, actionId: plan.actionId, result, expectedConflictRecovered }));
    return result;
  };
  const execute = (instance: object): Promise<Section02ExecutionResult> => {
    if (pendingExecution !== null) return pendingExecution;
    pendingExecution = run(instance).finally(() => { pendingExecution = null; });
    return pendingExecution;
  };
  return Object.freeze({ ready, actionFactory, execute });
}
