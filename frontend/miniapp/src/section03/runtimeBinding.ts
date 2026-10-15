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
import type {
  Section03NodeId,
  Section03Program,
} from './program';

export type Section03ExecutionResult =
  | Readonly<{
      kind: 'business';
      result: GraphBusinessExecutionResult<Section03NodeId>;
    }>
  | Readonly<{
      kind: 'presentation';
      result: GraphPresentationExecutionResult<Section03NodeId>;
    }>;

export type Section03InteractionChange =
  | Readonly<{
      status: 'pending';
      activationId: number;
      nodeId: Section03NodeId;
      actionClass: 'business' | 'presentation';
      actionId: string;
    }>
  | Readonly<{
      status: 'settled';
      activationId: number;
      nodeId: Section03NodeId;
      actionClass: 'business' | 'presentation';
      actionId: string;
      result: Section03ExecutionResult;
    }>;

export type Section03RuntimeBinding = Readonly<{
  ready: GraphActivationReadyState<Section03NodeId>;
  actionFactory: GraphReadyNodeActionFactory<
    Section03Program,
    Section03NodeId
  >;
  execute: (instance: object) => Promise<Section03ExecutionResult>;
}>;

type RuntimePlan =
  | GraphBusinessInteractionPlan
  | GraphPresentationInteractionPlan;

export function createSection03RuntimeBinding(input: Readonly<{
  runtime: GraphActivationRuntime<Section03Program>;
  presentationExecution: GraphPresentationExecutionRuntime<Section03Program>;
  nodeId: Section03NodeId;
  onInteractionStateChange: (change: Section03InteractionChange) => void;
}>): Section03RuntimeBinding {
  if (input.presentationExecution.runtime !== input.runtime) {
    throw new Error('Section 03 presentation execution runtime mismatch.');
  }
  const current = input.runtime.getState();
  if (current.status !== 'ready' || current.nodeId !== input.nodeId) {
    throw new Error('Section 03 runtime binding requires the current ready node.');
  }
  const ready = current as GraphActivationReadyState<Section03NodeId>;
  const planner = createGraphReadyInteractionPlanner(input.runtime, input.nodeId);
  const businessExecution = createGraphReadyBusinessExecutionRuntime(input.runtime, planner);
  const actionFactory = planner.actions;

  let activeExecution: Promise<Section03ExecutionResult> | null = null;

  const execute = (instance: object): Promise<Section03ExecutionResult> => {
    if (activeExecution !== null) return activeExecution;
    const execution = (async (): Promise<Section03ExecutionResult> => {
    const descriptor = actionFactory.describe(
      instance as Parameters<typeof actionFactory.describe>[0],
    );
    const planAction = planner.plan as unknown as (
      exactInstance: object,
      exactDescriptor: GraphRuntimeActionDescriptor,
    ) => RuntimePlan;
    const plan = planAction(instance, descriptor);
    const actionClass = plan.kind === 'graph-business-interaction-plan'
      ? 'business' as const
      : 'presentation' as const;
    input.onInteractionStateChange(Object.freeze({
      status: 'pending' as const,
      activationId: ready.activationId,
      nodeId: ready.nodeId,
      actionClass,
      actionId: plan.actionId,
    }));
    const executePlan = async (): Promise<Section03ExecutionResult> =>
      plan.kind === 'graph-business-interaction-plan'
        ? Object.freeze({
            kind: 'business' as const,
            result: await businessExecution.execute(plan as never),
          })
        : Object.freeze({
            kind: 'presentation' as const,
            result: await input.presentationExecution.execute(
              planner,
              plan as never,
            ),
          });
    const coordinated = input.runtime.coordinateInteraction(ready, async () => {
      await Promise.resolve();
      return executePlan();
    });
    const result = await (coordinated ?? executePlan());
    if (result.kind === 'business' && result.result.status === 'ready') {
      const activation = result.result.activation;
      if (activation.nodeId !== 'S03-D12') {
        const root = Object.freeze({ nodeId: 'S03-N01' as const, context: Object.freeze({}) });
        const employeeId = activation.context.employee_id;
        const history = activation.nodeId === 'S03-N01'
          ? []
          : activation.nodeId === 'S03-E10' || activation.nodeId === 'S03-E12'
            ? [
                root,
                Object.freeze({ nodeId: 'S03-E01' as const, context: Object.freeze({}) }),
                Object.freeze({
                  nodeId: 'S03-E02' as const,
                  context: Object.freeze({ ...(employeeId === undefined ? {} : { employee_id: employeeId }) }),
                }),
              ]
            : [root];
        input.presentationExecution.replaceHistory(history);
      }
    }
    input.onInteractionStateChange(Object.freeze({
      status: 'settled' as const,
      activationId: ready.activationId,
      nodeId: ready.nodeId,
      actionClass,
      actionId: plan.actionId,
      result,
    }));
    return result;
    })();
    activeExecution = execution;
    const clear = () => {
      if (activeExecution === execution) activeExecution = null;
    };
    void execution.then(clear, clear);
    return execution;
  };

  return Object.freeze({ ready, actionFactory, execute });
}
