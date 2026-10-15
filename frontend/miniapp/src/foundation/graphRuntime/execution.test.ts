import { describe, expect, it, vi } from 'vitest';

import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
} from '../graphProtocol/action';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
} from '../graphProtocol/command';
import { defineGraphContext, graphContext } from '../graphProtocol/context';
import { defineGraph, graphNodesFor } from '../graphProtocol/definition';
import { graphInteraction, graphInteractionsFor } from '../graphProtocol/interaction';
import { defineGraphProgram } from '../graphProtocol/program';
import { graphSourcesFor } from '../graphProtocol/source';
import { defineGraphTransitions, graphTransition } from '../graphProtocol/transition';
import {
  GraphActivationError,
  createGraphActivationRuntime,
  type GraphActivationProgram,
  type GraphActivationRuntime,
} from './activation';
import {
  GraphBusinessExecutionError,
  createGraphReadyBusinessExecutionRuntime,
  type GraphBusinessExecutionCurrentState,
  type GraphBusinessExecutionResult,
} from './execution';
import {
  createGraphReadyInteractionPlanner,
  type GraphReadyInteractionPlanner,
} from './planning';

type RawResult = Readonly<{
  command: string;
  outcome: string;
  entities: Readonly<Record<string, unknown>>;
}>;

type Deferred<T> = Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}>;

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

type TestExecutor = Readonly<{
  getState: () => GraphBusinessExecutionCurrentState;
  execute: (plan: unknown) => Promise<GraphBusinessExecutionResult>;
}>;

function makeUnprintable(): unknown {
  return new Proxy(Object.create(null) as object, {
    get(_target, property) {
      if (property === 'toString' || property === 'message') {
        throw new Error('printing forbidden');
      }
      return undefined;
    },
  });
}

function makeHarness() {
  const sourceContext = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
    optional_scope: graphContext.optionalTextInput(),
  });
  const destinationContext = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
    optional_scope: graphContext.optionalTextInput(),
    optional_manager_id: graphContext.optionalId(),
  });
  const sourceNode = Object.freeze({
    kind: 'local' as const,
    context: sourceContext,
    source: Object.freeze({ kind: 'local' as const }),
    project: () => Object.freeze({}),
  });
  const destinationNode = Object.freeze({
    kind: 'local' as const,
    context: destinationContext,
    source: Object.freeze({ kind: 'local' as const }),
    project: () => Object.freeze({}),
  });
  const graph = Object.freeze({
    kind: 'graph-definition' as const,
    nodes: Object.freeze({ SOURCE: sourceNode, DESTINATION: destinationNode }),
  });
  const program = Object.freeze({
    kind: 'graph-program' as const,
    graph,
    actions: Object.freeze({ kind: 'graph-action-registry', business: {}, presentation: {} }),
    interactions: Object.freeze({}),
  }) as unknown as GraphActivationProgram;
  const capturedReady = Object.freeze({
    status: 'ready' as const,
    activationId: 7,
    nodeId: 'SOURCE',
    context: Object.freeze({ employee_id: 'E-1', mode: 'edit' as const }),
    sources: null,
    projection: Object.freeze({}),
  });
  let runtimeState: unknown = capturedReady;
  let nextActivationResult: unknown = null;
  let activateImpl: ((input: unknown) => Promise<unknown>) | null = null;
  const activate = vi.fn(async (input: unknown) => {
    if (activateImpl) return activateImpl(input);
    const ready = Object.freeze({
      status: 'ready' as const,
      activationId: 8,
      nodeId: 'DESTINATION',
      context: Object.freeze((input as { context: Record<string, unknown> }).context),
      sources: Object.freeze({ fresh: true }),
      projection: Object.freeze({}),
    });
    runtimeState = nextActivationResult ?? ready;
    return nextActivationResult ?? ready;
  });
  const runtime = Object.freeze({
    program,
    activate,
    getState: () => runtimeState,
    coordinateInteraction: <TResult,>(
      ready: unknown,
      operation: () => Promise<TResult>,
    ) => runtimeState === ready ? operation() : null,
  }) as unknown as GraphActivationRuntime<GraphActivationProgram>;
  const command = Object.freeze({
    request: vi.fn(async (): Promise<RawResult> => ({
      command: 'FINISH',
      outcome: 'DONE',
      entities: { employee_id: 42 },
    })),
    decode: vi.fn((raw: unknown) => raw as RawResult),
  });
  const transitions = Object.freeze({
    DONE: Object.freeze({
      node: 'DESTINATION',
      context: Object.freeze({
        employee_id: Object.freeze({ source: 'command-entity', field: 'employee_id', normalize: 'string' }),
        mode: Object.freeze({ source: 'context', field: 'mode' }),
        optional_scope: Object.freeze({ source: 'context', field: 'optional_scope' }),
        optional_manager_id: Object.freeze({ source: 'command-entity', field: 'manager_id', normalize: 'string' }),
      }),
    }),
  });
  const transition = Object.freeze({ graph, command, currentContext: sourceContext, transitions });
  const exactPlan = Object.freeze({
    kind: 'graph-business-interaction-plan' as const,
    activationId: 7,
    nodeId: 'SOURCE',
    actionId: 'finish',
    command,
    input: Object.freeze({ employee_id: 'E-1' }),
    transition,
  });
  const owned = new WeakSet<object>([exactPlan]);
  const planner = Object.freeze({
    activationId: 7,
    nodeId: 'SOURCE',
    actions: Object.freeze({}),
    ownsBusinessPlan: (candidate: unknown) =>
      typeof candidate === 'object' && candidate !== null && runtimeState === capturedReady && owned.has(candidate),
    plan: () => exactPlan,
  }) as unknown as GraphReadyInteractionPlanner<GraphActivationProgram, 'SOURCE'>;
  return {
    runtime,
    planner,
    exactPlan,
    command,
    transition,
    transitions,
    capturedReady,
    activate,
    setRuntimeState: (value: unknown) => { runtimeState = value; },
    setActivationResult: (value: unknown) => { nextActivationResult = value; },
    setActivateImpl: (value: (input: unknown) => Promise<unknown>) => { activateImpl = value; },
  };
}

function createExecutor(h: ReturnType<typeof makeHarness>): TestExecutor {
  return createGraphReadyBusinessExecutionRuntime(h.runtime, h.planner) as unknown as TestExecutor;
}

function ownedExecutor(
  h: ReturnType<typeof makeHarness>,
  plan: object,
  runtime = h.runtime,
): TestExecutor {
  const planner = Object.freeze({
    ...h.planner,
    ownsBusinessPlan: (candidate: unknown) => candidate === plan,
  }) as typeof h.planner;
  return createGraphReadyBusinessExecutionRuntime(runtime, planner) as unknown as TestExecutor;
}

function planWith(
  h: ReturnType<typeof makeHarness>,
  changes: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...h.exactPlan, ...changes });
}

describe('Graph Runtime B4 execution hardening', () => {
  it('executes the happy path once and freezes the result', async () => {
    const h = makeHarness();
    const executor = createExecutor(h);
    const result = await executor.execute(h.exactPlan);
    expect(result.status).toBe('ready');
    expect(h.command.request).toHaveBeenCalledTimes(1);
    expect(h.command.decode).toHaveBeenCalledTimes(1);
    expect(h.activate).toHaveBeenCalledTimes(1);
    expect(h.activate).toHaveBeenCalledWith({
      nodeId: 'DESTINATION',
      context: { employee_id: '42', mode: 'edit' },
    });
    expect(result.status === 'ready' && result.activation.sources).toEqual({ fresh: true });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(executor.getState())).toBe(true);
  });

  it('resolves typed request, decode and activation errors for unprintable values', async () => {
    const requestHarness = makeHarness();
    const requestError = makeUnprintable();
    requestHarness.command.request.mockRejectedValueOnce(requestError);
    await expect(createExecutor(requestHarness).execute(requestHarness.exactPlan)).resolves.toMatchObject({
      status: 'error',
      error: { phase: 'request', originalError: requestError },
    });

    const decodeHarness = makeHarness();
    const decodeError = makeUnprintable();
    decodeHarness.command.decode.mockImplementationOnce(() => { throw decodeError; });
    await expect(createExecutor(decodeHarness).execute(decodeHarness.exactPlan)).resolves.toMatchObject({
      status: 'error',
      error: { phase: 'decode', originalError: decodeError },
    });

    const activationHarness = makeHarness();
    const activationError = makeUnprintable();
    activationHarness.setActivateImpl(async () => { throw activationError; });
    await expect(createExecutor(activationHarness).execute(activationHarness.exactPlan)).resolves.toMatchObject({
      status: 'error',
      error: { phase: 'destination-activation', originalError: activationError },
    });
  });

  it('applies exact authority to activation error states', async () => {
    const superseded = makeHarness();
    const supersededError = new GraphActivationError({
      code: 'REQUIRED_SOURCE_FAILED',
      message: 'destination failed',
      activationId: 8,
      nodeId: 'DESTINATION',
    });
    const staleErrorState = Object.freeze({
      status: 'error' as const,
      activationId: 8,
      nodeId: 'DESTINATION',
      error: supersededError,
    });
    superseded.setActivateImpl(async () => {
      superseded.setRuntimeState(Object.freeze({ ...staleErrorState }));
      return staleErrorState;
    });
    await expect(createExecutor(superseded).execute(superseded.exactPlan)).resolves.toMatchObject({
      status: 'stale',
      reason: 'destination-superseded',
    });

    const current = makeHarness();
    const currentError = new GraphActivationError({
      code: 'REQUIRED_SOURCE_FAILED',
      message: 'destination failed',
      activationId: 8,
      nodeId: 'DESTINATION',
    });
    const currentErrorState = Object.freeze({
      status: 'error' as const,
      activationId: 8,
      nodeId: 'DESTINATION',
      error: currentError,
    });
    current.setActivationResult(currentErrorState);
    await expect(createExecutor(current).execute(current.exactPlan)).resolves.toMatchObject({
      status: 'error',
      error: { phase: 'destination-activation', originalError: currentError },
    });
  });

  it('rejects graph and command identity mismatches', async () => {
    const graphHarness = makeHarness();
    const graphPlan = planWith(graphHarness, {
      transition: Object.freeze({
        ...graphHarness.transition,
        graph: Object.freeze({ ...graphHarness.transition.graph }),
      }),
    });
    await expect(ownedExecutor(graphHarness, graphPlan).execute(graphPlan)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'TRANSITION_IDENTITY_MISMATCH' },
    });

    const commandHarness = makeHarness();
    const commandPlan = planWith(commandHarness, {
      transition: Object.freeze({
        ...commandHarness.transition,
        command: Object.freeze({ ...commandHarness.command }),
      }),
    });
    await expect(ownedExecutor(commandHarness, commandPlan).execute(commandPlan)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'TRANSITION_IDENTITY_MISMATCH' },
    });
  });

  it('returns typed invalid-binding and destination-context validation failures', async () => {
    const invalidBinding = makeHarness();
    const badBindingPlan = planWith(invalidBinding, {
      transition: Object.freeze({
        ...invalidBinding.transition,
        transitions: Object.freeze({
          DONE: Object.freeze({
            ...invalidBinding.transitions.DONE,
            context: Object.freeze({
              ...invalidBinding.transitions.DONE.context,
              mode: Object.freeze({ source: 'literal', field: 'mode' }),
            }),
          }),
        }),
      }),
    });
    await expect(ownedExecutor(invalidBinding, badBindingPlan).execute(badBindingPlan)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'DESTINATION_BINDING_INVALID' },
    });

    const invalidContext = makeHarness();
    invalidContext.command.decode.mockReturnValueOnce({
      command: 'FINISH',
      outcome: 'DONE',
      entities: { employee_id: 42, invalid_mode: 'not-a-mode' },
    });
    const invalidContextPlan = planWith(invalidContext, {
      transition: Object.freeze({
        ...invalidContext.transition,
        transitions: Object.freeze({
          DONE: Object.freeze({
            ...invalidContext.transitions.DONE,
            context: Object.freeze({
              ...invalidContext.transitions.DONE.context,
              mode: Object.freeze({ source: 'command-entity', field: 'invalid_mode', normalize: 'string' }),
            }),
          }),
        }),
      }),
    });
    await expect(ownedExecutor(invalidContext, invalidContextPlan).execute(invalidContextPlan)).resolves.toMatchObject({
      status: 'error',
      error: { code: 'DESTINATION_CONTEXT_INVALID' },
    });
  });

  it('keeps latest-wins state when a newer attempt supersedes an older request', async () => {
    const h = makeHarness();
    const first = deferred<RawResult>();
    h.command.request
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ command: 'FINISH', outcome: 'DONE', entities: { employee_id: 99 } });
    const executor = createExecutor(h);
    const oldPromise = executor.execute(h.exactPlan);
    const newer = await executor.execute(h.exactPlan);
    const newerState = executor.getState();
    expect(newer.status).toBe('ready');
    first.resolve({ command: 'FINISH', outcome: 'DONE', entities: { employee_id: 42 } });
    await expect(oldPromise).resolves.toMatchObject({ status: 'stale', reason: 'newer-attempt' });
    expect(h.command.decode).toHaveBeenCalledTimes(1);
    expect(h.activate).toHaveBeenCalledTimes(1);
    expect(executor.getState()).toBe(newerState);
  });

  it('performs a real fresh endpoint-backed destination read with materialized context', async () => {
    type Context = Readonly<{ employee_id: string; mode: 'view' | 'edit' }>;
    type SourceModel = Readonly<{
      employee_id: string;
      available_actions: readonly ['FINISH'];
    }>;
    type Employee = Readonly<{ employee_id: string; revision: number }>;

    const context = defineGraphContext({
      employee_id: graphContext.id(),
      mode: graphContext.mode('view', 'edit'),
    });
    const sources = graphSourcesFor<Context>();
    const sourceRequest = vi.fn(async (current: Context): Promise<SourceModel> => ({
      employee_id: current.employee_id,
      available_actions: ['FINISH'],
    }));
    const sourceModel = sources.required<SourceModel, 'source', '/source/:id'>({
      sourceId: 'source',
      endpoint: '/source/:id',
      request: sourceRequest,
      decode: (input: unknown) => input as SourceModel,
    });
    let revision = 0;
    const destinationRequest = vi.fn(async (current: Context) => ({
      employee_id: current.employee_id,
      revision: ++revision,
    }));
    const employee = sources.required<Employee, 'employee', '/employees/:id'>({
      sourceId: 'employee',
      endpoint: '/employees/:id',
      request: destinationRequest,
      decode: (input: unknown) => input as Employee,
    });
    const graph = defineGraph({
      SOURCE: graphNodesFor(context).endpointBacked({
        source: sources.endpointBacked(sources.bundle({ source: sourceModel })),
        project: ({ context: current }) => ({ employeeId: current.employee_id }),
      }),
      DESTINATION: graphNodesFor(context).endpointBacked({
        source: sources.endpointBacked(sources.bundle({ employee })),
        project: ({ context: current, sources: loaded }) => ({
          employeeId: current.employee_id,
          revision: loaded.employee.revision,
        }),
      }),
    });
    const noEvent = defineGraphActionEvent({});
    const actions = defineGraphActions({
      business: {
        finish: graphAction.business(
          'FINISH',
          noEvent,
          graphAction.actionButton({ label: 'Finish', icon: 'finish.svg', variant: 'green' }),
        ),
      },
      presentation: {
        back: graphAction.presentation(
          noEvent,
          graphAction.actionButton({ label: 'Back', icon: 'back.svg', variant: 'outlineBlue' }),
        ),
      },
    });
    const input = defineGraphCommandInput({ employee_id: graphCommandInput.id() });
    const command = graphCommandFor(input).define({
      command: 'FINISH',
      method: 'POST',
      endpoint: '/finish',
      outcomes: ['DONE'],
      entities: defineGraphCommandEntities({ employee_id: graphCommandEntity.id() }),
      request: vi.fn(async () => ({
        command: 'FINISH',
        outcome: 'DONE',
        entities: { employee_id: 77 },
      })),
    });
    const transition = defineGraphTransitions({
      graph,
      command,
      currentContext: context,
      transitions: {
        DONE: {
          node: 'DESTINATION',
          context: {
            employee_id: graphTransition.entityId('employee_id'),
            mode: graphTransition.context('mode'),
          },
        },
      },
    });
    const sourceScope = graphInteractionsFor(graph, actions).node('SOURCE');
    const destinationScope = graphInteractionsFor(graph, actions).node('DESTINATION');
    const program = defineGraphProgram({
      graph,
      actions,
      interactions: {
        SOURCE: sourceScope.define({
          business: [sourceScope.business({
            action: 'finish',
            availability: graphInteraction.availableActions('source', 'available_actions'),
            command,
            input: { employee_id: graphInteraction.context('employee_id') },
            transition,
          })],
          presentation: [],
        }),
        DESTINATION: destinationScope.define({
          business: [],
          presentation: [destinationScope.presentation({
            action: 'back',
            effect: graphInteraction.back(),
          })],
        }),
      },
    });
    const runtime = createGraphActivationRuntime(program);
    await runtime.activate({ nodeId: 'SOURCE', context: { employee_id: 'E-1', mode: 'edit' } });
    const planner = createGraphReadyInteractionPlanner(runtime, 'SOURCE');
    const instances = planner.actions.business('finish', {}, {});
    expect(instances).toHaveLength(1);
    const instance = instances[0];
    if (!instance) throw new Error('Expected one business action instance.');
    const plan = planner.plan(instance, planner.actions.describe(instance));
    const executor = createGraphReadyBusinessExecutionRuntime(runtime, planner);
    const result = await executor.execute(plan);

    expect(sourceRequest).toHaveBeenCalledTimes(1);
    expect(destinationRequest).toHaveBeenCalledTimes(1);
    expect(destinationRequest).toHaveBeenCalledWith({ employee_id: '77', mode: 'edit' });
    expect(result).toMatchObject({
      status: 'ready',
      activation: {
        nodeId: 'DESTINATION',
        context: { employee_id: '77', mode: 'edit' },
        sources: { employee: { employee_id: '77', revision: 1 } },
        projection: { employeeId: '77', revision: 1 },
      },
    });
  });

  it('factory remains synchronous and request-free', () => {
    const h = makeHarness();
    const executor = createExecutor(h);
    expect(executor.getState()).toEqual({ status: 'idle' });
    expect(h.command.request).not.toHaveBeenCalled();
    h.setRuntimeState(Object.freeze({ status: 'idle' }));
    expect(() => createExecutor(h)).toThrow(GraphBusinessExecutionError);
  });
});
