import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
} from '../graphProtocol/action';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
} from '../graphProtocol/command';
import {
  defineGraphContext,
  graphContext,
} from '../graphProtocol/context';
import {
  defineGraph,
  graphNodesFor,
} from '../graphProtocol/definition';
import {
  graphInteraction,
  graphInteractionsFor,
} from '../graphProtocol/interaction';
import { defineGraphProgram } from '../graphProtocol/program';
import { graphSourcesFor } from '../graphProtocol/source';
import {
  defineGraphTransitions,
  graphTransition,
} from '../graphProtocol/transition';
import {
  GraphActivationError,
  createGraphActivationRuntime,
  type GraphActivationProgram,
  type GraphActivationReadyState,
  type GraphActivationRuntime,
} from './activation';
import { createGraphReadyBusinessExecutionRuntime } from './execution';
import {
  createGraphReadyInteractionPlanner,
  type GraphPresentationInteractionPlan,
  type GraphReadyInteractionPlanner,
} from './planning';
import {
  createGraphPresentationExecutionRuntime,
  type GraphPresentationExecutionRuntime,
} from './presentationExecution';

type NodeId = 'SOURCE' | 'DESTINATION' | 'OTHER';
type TestContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;
type TestReadModel = Readonly<{
  node: NodeId;
  reads: number;
  available_actions: readonly string[];
}>;
type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function makeFixture() {
  const reads: Record<NodeId, number> = {
    SOURCE: 0,
    DESTINATION: 0,
    OTHER: 0,
  };
  const deferredSources: Partial<Record<NodeId, Deferred<TestReadModel>>> = {};
  const failingSources = new Set<NodeId>();
  const commandRequest = vi.fn(async () => ({
    command: 'MOVE_DONE',
    outcome: 'DONE',
    entities: { employee_id: 'E-1' },
  }));

  const context = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
  });
  const sources = graphSourcesFor<TestContext>();
  const sourceFor = (node: NodeId) =>
    sources.required<TestReadModel, `${NodeId}-source`, '/nodes/:id'>({
      sourceId: `${node}-source`,
      endpoint: '/nodes/:id',
      request: async () => {
        reads[node] += 1;
        const deferredSource = deferredSources[node];
        if (deferredSource) return deferredSource.promise;
        if (failingSources.has(node)) {
          throw new Error(`${node} failed`);
        }
        return {
          node,
          reads: reads[node],
          available_actions: ['MOVE_DONE'],
        };
      },
      decode: (input: unknown) => input as TestReadModel,
    });
  const nodeFor = (node: NodeId) =>
    graphNodesFor(context).endpointBacked({
      source: sources.endpointBacked(
        sources.bundle({ model: sourceFor(node) }),
      ),
      project: ({ context: currentContext, sources: currentSources }) => ({
        node,
        employeeId: currentContext.employee_id,
        model: currentSources.model,
      }),
    });
  const graph = defineGraph({
    SOURCE: nodeFor('SOURCE'),
    DESTINATION: nodeFor('DESTINATION'),
    OTHER: nodeFor('OTHER'),
  });
  const noEvent = defineGraphActionEvent({});
  const actions = defineGraphActions({
    business: {
      moveDone: graphAction.business(
        'MOVE_DONE',
        noEvent,
        graphAction.actionButton({
          label: 'Move',
          icon: 'move.svg',
          variant: 'green',
        }),
      ),
    },
    presentation: {
      back: graphAction.presentation(
        noEvent,
        graphAction.actionButton({
          label: 'Back',
          icon: 'back.svg',
          variant: 'outlineBlue',
        }),
      ),
      openDestination: graphAction.presentation(
        defineGraphActionEvent({
          employee_id: graphActionEvent.id(),
        }),
        graphAction.listButton({ variant: 'blue' }),
      ),
    },
  });
  const commandInput = defineGraphCommandInput({
    employee_id: graphCommandInput.id(),
  });
  const command = graphCommandFor(commandInput).define({
    command: 'MOVE_DONE',
    method: 'POST',
    endpoint: '/move',
    outcomes: ['DONE'],
    entities: defineGraphCommandEntities({
      employee_id: graphCommandEntity.id(),
    }),
    request: commandRequest,
  });
  const transition = defineGraphTransitions({
    graph,
    command,
    currentContext: context,
    transitions: {
      DONE: {
        node: 'OTHER',
        context: {
          employee_id: graphTransition.entityId('employee_id'),
          mode: graphTransition.context('mode'),
        },
      },
    },
  });
  const interactionsFor = graphInteractionsFor(graph, actions);
  const sourceScope = interactionsFor.node('SOURCE');
  const destinationScope = interactionsFor.node('DESTINATION');
  const otherScope = interactionsFor.node('OTHER');
  const sourceInteractions = sourceScope.define({
    business: [],
    presentation: [
      sourceScope.presentation({
        action: 'back',
        effect: graphInteraction.back(),
      }),
      sourceScope.presentation({
        action: 'openDestination',
        effect: graphInteraction.navigate('DESTINATION', {
          employee_id: graphInteraction.event('employee_id'),
          mode: graphInteraction.literal('view'),
        }),
      }),
    ],
  });
  const destinationInteractions = destinationScope.define({
    business: [
      destinationScope.business({
        action: 'moveDone',
        availability: graphInteraction.availableActions(
          'model',
          'available_actions',
        ),
        command,
        input: {
          employee_id: graphInteraction.context('employee_id'),
        },
        transition,
      }),
    ],
    presentation: [
      destinationScope.presentation({
        action: 'back',
        effect: graphInteraction.back(),
      }),
    ],
  });
  const otherInteractions = otherScope.define({
    business: [],
    presentation: [
      otherScope.presentation({
        action: 'back',
        effect: graphInteraction.back(),
      }),
    ],
  });
  const program = defineGraphProgram({
    graph,
    actions,
    interactions: {
      SOURCE: sourceInteractions,
      DESTINATION: destinationInteractions,
      OTHER: otherInteractions,
    },
  });
  const baseRuntime = createGraphActivationRuntime(program);
  const wrappedRuntime = Object.freeze({
    program,
    getState: baseRuntime.getState,
    activate: vi.fn(baseRuntime.activate),
    refresh: vi.fn(baseRuntime.refresh),
    coordinateInteraction: baseRuntime.coordinateInteraction,
  }) satisfies GraphActivationRuntime<typeof program>;

  return {
    program,
    baseRuntime,
    runtime: wrappedRuntime,
    commandRequest,
    reads,
    deferredSources,
    failingSources,
  };
}

async function activate(
  fixture: ReturnType<typeof makeFixture>,
  nodeId: NodeId,
  mode: 'view' | 'edit' = 'edit',
) {
  return fixture.baseRuntime.activate({
    nodeId,
    context: { employee_id: 'E-1', mode },
  });
}

function presentationRuntime(
  fixture: ReturnType<typeof makeFixture>,
): GraphPresentationExecutionRuntime<typeof fixture.program> {
  return createGraphPresentationExecutionRuntime(fixture.runtime);
}

function navigatePlan(fixture: ReturnType<typeof makeFixture>) {
  const planner = createGraphReadyInteractionPlanner(
    fixture.runtime,
    'SOURCE',
  );
  const instance = planner.actions.presentation(
    'openDestination',
    { mainLine: 'Destination' },
    { employee_id: 'E-2' },
  );
  return {
    planner,
    plan: planner.plan(instance, planner.actions.describe(instance)),
  };
}

function backPlan(
  fixture: ReturnType<typeof makeFixture>,
  nodeId: NodeId,
) {
  const planner = createGraphReadyInteractionPlanner(
    fixture.runtime,
    nodeId,
  );
  const instance = planner.actions.presentation('back', {}, {});
  return {
    planner,
    plan: planner.plan(instance, planner.actions.describe(instance)),
  };
}

function businessPlan(fixture: ReturnType<typeof makeFixture>) {
  const planner = createGraphReadyInteractionPlanner(
    fixture.runtime,
    'DESTINATION',
  );
  const projection = planner.actions.business('moveDone', {}, {});
  if (projection.length !== 1) {
    throw new Error('expected business projection');
  }
  const plan = planner.plan(
    projection[0],
    planner.actions.describe(projection[0]),
  );
  return { planner, plan };
}

describe('Graph Runtime B5 presentation execution', () => {
  it('starts idle over an idle activation runtime and performs no initial activation', () => {
    const fixture = makeFixture();
    const executor = presentationRuntime(fixture);

    expect(executor.getState()).toEqual({ status: 'idle' });
    expect(Object.isFrozen(executor)).toBe(true);
    expect(Object.isFrozen(executor.getState())).toBe(true);
    expect(fixture.runtime.activate).not.toHaveBeenCalled();
  });

  it('accepts an exact planner-owned navigate plan, activates destination and fresh-reads its source', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const { planner, plan } = navigatePlan(fixture);
    const result = await executor.execute(planner, plan);

    expect(fixture.runtime.activate).toHaveBeenCalledTimes(1);
    expect(fixture.runtime.activate).toHaveBeenCalledWith({
      nodeId: 'DESTINATION',
      context: { employee_id: 'E-2', mode: 'view' },
    });
    expect(result.status).toBe('ready');
    expect(result.status === 'ready' && result.historyDepthAfter).toBe(1);
    expect(result.status === 'ready' && result.activation.nodeId).toBe('DESTINATION');
    expect(fixture.reads.DESTINATION).toBe(1);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(executor.getState())).toBe(true);
  });

  it('executes successful back with fresh previous-node activation and decrements history depth', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const navigation = navigatePlan(fixture);
    await executor.execute(navigation.planner, navigation.plan);
    const sourceReadsBeforeBack = fixture.reads.SOURCE;
    const back = backPlan(fixture, 'DESTINATION');
    const result = await executor.execute(back.planner, back.plan);

    expect(result.status).toBe('ready');
    expect(result.status === 'ready' && result.activation.nodeId).toBe('SOURCE');
    expect(result.status === 'ready' && result.historyDepthAfter).toBe(0);
    expect(fixture.reads.SOURCE).toBe(sourceReadsBeforeBack + 1);
    expect(fixture.runtime.activate).toHaveBeenLastCalledWith({
      nodeId: 'SOURCE',
      context: { employee_id: 'E-2', mode: 'view' },
    });
  });

  it('returns HISTORY_EMPTY for empty back without activation', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const back = backPlan(fixture, 'SOURCE');
    fixture.runtime.activate.mockClear();
    const result = await executor.execute(back.planner, back.plan);

    expect(result).toMatchObject({
      status: 'error',
      error: {
        code: 'HISTORY_EMPTY',
        phase: 'history-resolution',
      },
    });
    expect(result.status === 'error' && result.attemptId).toBe(1);
    expect(fixture.runtime.activate).not.toHaveBeenCalled();
    expect(executor.getState()).toBe(result);
  });

  it('rejects structural clone presentation plans without activation or state/history mutation', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const { planner, plan } = navigatePlan(fixture);
    const before = executor.getState();
    const clone = Object.freeze({ ...plan }) as unknown as typeof plan;
    const result = await executor.execute(planner, clone);

    expect(result).toMatchObject({
      status: 'error',
      error: { code: 'PLAN_NOT_OWNED', phase: 'plan-acceptance' },
    });
    expect(fixture.runtime.activate).not.toHaveBeenCalled();
    expect(executor.getState()).toBe(before);
  });

  it('rejects foreign planner plans without activation', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const owner = navigatePlan(fixture);
    const foreign = navigatePlan(fixture);
    const result = await executor.execute(
      owner.planner,
      foreign.plan as unknown as typeof owner.plan,
    );

    expect(result).toMatchObject({
      status: 'error',
      error: { code: 'PLAN_NOT_OWNED' },
    });
    expect(fixture.runtime.activate).not.toHaveBeenCalled();
  });

  it('rejects a stale planner after activation changes before any presentation activation', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const stale = navigatePlan(fixture);
    await activate(fixture, 'OTHER');
    fixture.runtime.activate.mockClear();
    const result = await executor.execute(stale.planner, stale.plan);

    expect(result.status).toBe('error');
    expect(
      result.status === 'error' &&
        [
          'RUNTIME_NOT_READY',
          'PLANNER_ACTIVATION_MISMATCH',
          'PLAN_NOT_OWNED',
        ].includes(result.error.code),
    ).toBe(true);
    expect(fixture.runtime.activate).not.toHaveBeenCalled();
  });

  it('runtime-rejects a business plan cast through unknown and does not call the command request', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'DESTINATION');
    const executor = presentationRuntime(fixture);
    const { planner, plan } = businessPlan(fixture);
    const result = await executor.execute(
      planner,
      plan as unknown as GraphPresentationInteractionPlan<'DESTINATION', 'back'>,
    );

    expect(result).toMatchObject({
      status: 'error',
      error: { code: 'PLAN_NOT_OWNED' },
    });
    expect(fixture.commandRequest).not.toHaveBeenCalled();
    expect(fixture.runtime.activate).not.toHaveBeenCalled();
  });

  it('keeps history unchanged on failed destination activation and then back remains empty', async () => {
    const fixture = makeFixture();
    fixture.failingSources.add('DESTINATION');
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const navigation = navigatePlan(fixture);
    const result = await executor.execute(navigation.planner, navigation.plan);

    expect(result).toMatchObject({
      status: 'error',
      error: {
        code: 'DESTINATION_ACTIVATION_FAILED',
        phase: 'destination-activation',
      },
    });
    expect(result.status === 'error' && result.error.originalError).toBeInstanceOf(GraphActivationError);

    await activate(fixture, 'SOURCE');
    const back = backPlan(fixture, 'SOURCE');
    const backResult = await executor.execute(back.planner, back.plan);
    expect(backResult).toMatchObject({
      status: 'error',
      error: { code: 'HISTORY_EMPTY' },
    });
  });

  it('keeps history unchanged on stale destination activation', async () => {
    const fixture = makeFixture();
    const pendingDestination = deferred<TestReadModel>();
    fixture.deferredSources.DESTINATION = pendingDestination;
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const navigation = navigatePlan(fixture);
    const promise = executor.execute(navigation.planner, navigation.plan);

    await activate(fixture, 'OTHER');
    pendingDestination.resolve({
      node: 'DESTINATION',
      reads: 1,
      available_actions: ['MOVE_DONE'],
    });
    const result = await promise;

    expect(result).toEqual({
      status: 'stale',
      attemptId: 1,
      reason: 'destination-superseded',
    });

    const back = backPlan(fixture, 'OTHER');
    const backResult = await executor.execute(back.planner, back.plan);
    expect(backResult).toMatchObject({
      status: 'error',
      error: { code: 'HISTORY_EMPTY' },
    });
  });

  it('uses latest-wins so a newer attempt prevents an older attempt from mutating state or history', async () => {
    const fixture = makeFixture();
    const capturedReady = Object.freeze({
      status: 'ready' as const,
      activationId: 1,
      nodeId: 'SOURCE' as const,
      context: Object.freeze({ employee_id: 'E-1', mode: 'edit' as const }),
      sources: null,
      projection: Object.freeze({}),
    }) satisfies GraphActivationReadyState<'SOURCE'>;
    let fakeState: unknown = capturedReady;
    const activations: Array<
      Deferred<GraphActivationReadyState<'SOURCE' | 'DESTINATION'>>
    > = [];
    const fakeRuntime = Object.freeze({
      program: fixture.program,
      getState: () => fakeState,
      activate: vi.fn((input: Readonly<{ nodeId: unknown; context: unknown }>) => {
        const pending = deferred<
          GraphActivationReadyState<'SOURCE' | 'DESTINATION'>
        >();
        activations.push(pending);
        return pending.promise.then((ready) => {
          fakeState = ready;
          return ready;
        });
      }),
      coordinateInteraction: <TResult,>(
        ready: unknown,
        operation: () => Promise<TResult>,
      ) => fakeState === ready ? operation() : null,
    }) as unknown as GraphActivationRuntime<typeof fixture.program>;
    const planner = createGraphReadyInteractionPlanner(fakeRuntime, 'SOURCE');
    const instance = planner.actions.presentation(
      'openDestination',
      { mainLine: 'Destination' },
      { employee_id: 'E-2' },
    );
    const plan = planner.plan(instance, planner.actions.describe(instance));
    const executor = createGraphPresentationExecutionRuntime(fakeRuntime);
    const first = executor.execute(planner, plan);
    const second = executor.execute(planner, plan);
    const secondReady = Object.freeze({
      status: 'ready' as const,
      activationId: 3,
      nodeId: 'DESTINATION' as const,
      context: Object.freeze({ employee_id: 'E-2', mode: 'view' as const }),
      sources: null,
      projection: Object.freeze({}),
    });
    activations[1].resolve(secondReady);
    await expect(second).resolves.toMatchObject({
      status: 'ready',
      attemptId: 2,
      historyDepthAfter: 1,
    });
    const stateAfterSecond = executor.getState();
    const firstReady = Object.freeze({
      ...secondReady,
      activationId: 2,
    });
    activations[0].resolve(firstReady);
    await expect(first).resolves.toEqual({
      status: 'stale',
      attemptId: 1,
      reason: 'newer-attempt',
    });
    expect(executor.getState()).toBe(stateAfterSecond);

    const back = createGraphReadyInteractionPlanner(fakeRuntime, 'DESTINATION');
    const backInstance = back.actions.presentation('back', {}, {});
    const backExecution = executor.execute(
      back,
      back.plan(backInstance, back.actions.describe(backInstance)),
    );
    const sourceReady = Object.freeze({
      ...capturedReady,
      activationId: 4,
    });
    activations[2].resolve(sourceReady);
    await expect(backExecution).resolves.toMatchObject({
      status: 'ready',
      historyDepthAfter: 0,
    });
  });

  it('does not mutate presentation history for direct activation outside the executor', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const navigation = navigatePlan(fixture);
    await executor.execute(navigation.planner, navigation.plan);
    await activate(fixture, 'OTHER');
    const back = backPlan(fixture, 'OTHER');
    const result = await executor.execute(back.planner, back.plan);

    expect(result.status).toBe('ready');
    expect(result.status === 'ready' && result.activation.nodeId).toBe('SOURCE');
    expect(result.status === 'ready' && result.historyDepthAfter).toBe(0);
  });

  it('does not mutate presentation history for business transition execution', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const executor = presentationRuntime(fixture);
    const navigation = navigatePlan(fixture);
    await executor.execute(navigation.planner, navigation.plan);
    const business = businessPlan(fixture);
    const businessExecutor = createGraphReadyBusinessExecutionRuntime(
      fixture.runtime,
      business.planner,
    );
    await businessExecutor.execute(business.plan);
    const back = backPlan(fixture, 'OTHER');
    const result = await executor.execute(back.planner, back.plan);

    expect(fixture.commandRequest).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
    expect(result.status === 'ready' && result.activation.nodeId).toBe('SOURCE');
    expect(result.status === 'ready' && result.historyDepthAfter).toBe(0);
  });

  it('does not import renderer, browser routing, callbacks, legacy screen IDs or section code', () => {
    const source = readFileSync(
      `${process.cwd()}/src/foundation/graphRuntime/presentationExecution.ts`,
      'utf8',
    );

    expect(source).not.toContain('graphRenderer');
    expect(source).not.toContain('React');
    expect(source).not.toContain('react-router');
    expect(source).not.toContain('window.history');
    expect(source).not.toContain('Section02');
    expect(source).not.toContain('Section03');
    expect(source).not.toContain('Section04');
    expect(source).not.toContain('screenId');
    expect(source).not.toContain('callback navigation');
  });
});
