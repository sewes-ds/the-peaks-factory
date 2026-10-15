import { describe, expect, it } from 'vitest';

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
import { createGraphActivationRuntime } from './activation';
import {
  GraphNodeActionFactoryError,
  createGraphReadyNodeActionFactory,
} from './actions';
import { createGraphReadyInteractionPlanner } from './planning';

type EmployeeReadModel = Readonly<{
  employee_id: string | number;
  manager_id?: string | number | null;
  available_actions: readonly string[];
}>;

type EmployeeContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
  scope: string;
}>;

function makeFixture(
  initialReadModel: EmployeeReadModel = {
    employee_id: 42,
    manager_id: 7,
    available_actions: ['FINISH_EMPLOYEE_BLOCKER'],
  },
) {
  let readModel = initialReadModel;
  let requestCalls = 0;

  const employeeContext = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
    scope: graphContext.textInput(),
  });

  const employeeSources = graphSourcesFor<EmployeeContext>();
  const employeeSource = employeeSources.required<
    EmployeeReadModel,
    'employee',
    '/manager/employees/:id'
  >({
    sourceId: 'employee',
    endpoint: '/manager/employees/:id',
    request: async () => readModel,
    decode: (input: unknown) => input as EmployeeReadModel,
  });

  const graph = defineGraph({
    EMPLOYEE: graphNodesFor(employeeContext).endpointBacked({
      source: employeeSources.endpointBacked(
        employeeSources.bundle({
          employee: employeeSource,
        }),
      ),
      project: ({ context }) => ({
        employeeId: context.employee_id,
      }),
    }),
    LOCAL: graphNodesFor(employeeContext).local({
      source: employeeSources.local(),
      project: ({ context }) => ({
        employeeId: context.employee_id,
      }),
    }),
    NONE: graphNodesFor(employeeContext).local({
      source: employeeSources.local(),
      project: ({ context }) => ({
        employeeId: context.employee_id,
      }),
    }),
  });

  const blockerEvent = defineGraphActionEvent({
    blocker_id: graphActionEvent.id(),
  });
  const employeeEvent = defineGraphActionEvent({
    employee_id: graphActionEvent.id(),
  });
  const noEvent = defineGraphActionEvent({});

  const actions = defineGraphActions({
    business: {
      finish: graphAction.business(
        'FINISH_EMPLOYEE_BLOCKER',
        blockerEvent,
        graphAction.actionButton({
          label: 'Завершить',
          icon: 'finish.svg',
          variant: 'green',
        }),
      ),
    },
    presentation: {
      back: graphAction.presentation(
        noEvent,
        graphAction.actionButton({
          label: 'Назад',
          icon: 'back.svg',
          variant: 'outlineBlue',
        }),
      ),
      open: graphAction.presentation(
        employeeEvent,
        graphAction.listButton({
          variant: 'blue',
        }),
      ),
    },
  });

  const commandInput = defineGraphCommandInput({
    employee_id: graphCommandInput.id(),
    blocker_id: graphCommandInput.id(),
    source_employee_id: graphCommandInput.id(),
    manager_id: graphCommandInput.optionalId(),
  });

  const command = graphCommandFor(commandInput).define({
    command: 'FINISH_EMPLOYEE_BLOCKER',
    method: 'POST',
    endpoint: '/operations/employee-blockers/finish',
    outcomes: ['DONE'],
    entities: defineGraphCommandEntities({
      employee_id: graphCommandEntity.id(),
    }),
    request: async () => {
      requestCalls += 1;
      return {} as unknown;
    },
  });

  const transition = defineGraphTransitions({
    graph,
    command,
    currentContext: employeeContext,
    transitions: {
      DONE: {
        node: 'LOCAL',
        context: {
          employee_id: graphTransition.entityId('employee_id'),
          mode: graphTransition.context('mode'),
          scope: graphTransition.context('scope'),
        },
      },
    },
  });

  const employeeScope =
    graphInteractionsFor(graph, actions).node('EMPLOYEE');
  const finish = employeeScope.business({
    action: 'finish',
    availability: graphInteraction.availableActions(
      'employee',
      'available_actions',
    ),
    command,
    input: {
      employee_id: graphInteraction.context('employee_id'),
      blocker_id: graphInteraction.event('blocker_id'),
      source_employee_id: graphInteraction.sourceId(
        'employee',
        'employee_id',
      ),
      manager_id: graphInteraction.optionalSourceId(
        'employee',
        'manager_id',
      ),
    },
    transition,
  });
  const back = employeeScope.presentation({
    action: 'back',
    effect: graphInteraction.back(),
  });
  const employeeInteractions = employeeScope.define({
    business: [finish],
    presentation: [back],
  });

  const localScope =
    graphInteractionsFor(graph, actions).node('LOCAL');
  const open = localScope.presentation({
    action: 'open',
    effect: graphInteraction.navigate('EMPLOYEE', {
      employee_id: graphInteraction.event('employee_id'),
      mode: graphInteraction.literal('view'),
      scope: graphInteraction.context('scope'),
    }),
  });
  const localInteractions = localScope.define({
    business: [],
    presentation: [open],
  });

  const program = defineGraphProgram({
    graph,
    actions,
    interactions: {
      EMPLOYEE: employeeInteractions,
      LOCAL: localInteractions,
    },
  });
  const runtime = createGraphActivationRuntime(program);

  return {
    command,
    transition,
    runtime,
    getRequestCalls: () => requestCalls,
    setReadModel(value: EmployeeReadModel): void {
      readModel = value;
    },
  };
}

async function activate(
  fixture: ReturnType<typeof makeFixture>,
  nodeId: 'EMPLOYEE' | 'LOCAL' | 'NONE',
) {
  return fixture.runtime.activate({
    nodeId,
    context: {
      employee_id: 'E-1',
      mode: 'edit',
      scope: 'roster',
    },
  });
}

function currentBusinessInstance(
  planner: ReturnType<
    typeof createGraphReadyInteractionPlanner<
      ReturnType<typeof makeFixture>['runtime']['program'],
      'EMPLOYEE'
    >
  >,
) {
  const projection = planner.actions.business(
    'finish',
    {},
    { blocker_id: 'B-1' },
  );

  if (projection.length !== 1) {
    throw new Error('expected one projected business action');
  }

  return projection[0];
}

describe('Graph Runtime synthetic interaction planning', () => {
  it('builds a frozen schema-validated business plan without requesting or transitioning', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');

    const planner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const instance = currentBusinessInstance(planner);
    const descriptor = planner.actions.describe(instance);
    const beforeState = fixture.runtime.getState();
    const plan = planner.plan(instance, descriptor);

    expect(plan).toEqual({
      kind: 'graph-business-interaction-plan',
      activationId: 1,
      nodeId: 'EMPLOYEE',
      actionId: 'finish',
      command: fixture.command,
      input: {
        employee_id: 'E-1',
        blocker_id: 'B-1',
        source_employee_id: '42',
        manager_id: '7',
      },
      transition: fixture.transition,
    });
    expect(plan.command).toBe(fixture.command);
    expect(plan.transition).toBe(fixture.transition);
    expect(planner.ownsBusinessPlan(plan)).toBe(true);
    expect(fixture.getRequestCalls()).toBe(0);
    expect(fixture.runtime.getState()).toBe(beforeState);
    expect(Object.isFrozen(planner)).toBe(true);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.input)).toBe(true);
  });

  it('omits only an optional missing source ID and normalizes finite numbers deterministically', async () => {
    const fixture = makeFixture({
      employee_id: 1001,
      available_actions: ['FINISH_EMPLOYEE_BLOCKER'],
    });
    await activate(fixture, 'EMPLOYEE');

    const planner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const instance = currentBusinessInstance(planner);
    const plan = planner.plan(
      instance,
      planner.actions.describe(instance),
    );

    expect(plan.input).toEqual({
      employee_id: 'E-1',
      blocker_id: 'B-1',
      source_employee_id: '1001',
    });
    expect('manager_id' in plan.input).toBe(false);
    expect(fixture.getRequestCalls()).toBe(0);
  });

  it('rejects missing required and malformed node-source IDs', async () => {
    const missing = makeFixture({
      available_actions: ['FINISH_EMPLOYEE_BLOCKER'],
    } as unknown as EmployeeReadModel);
    await activate(missing, 'EMPLOYEE');
    const missingPlanner = createGraphReadyInteractionPlanner(
      missing.runtime,
      'EMPLOYEE',
    );
    const missingInstance = currentBusinessInstance(missingPlanner);

    expect(() =>
      missingPlanner.plan(
        missingInstance,
        missingPlanner.actions.describe(missingInstance),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'MISSING_SOURCE_ID',
        field: 'source_employee_id',
      }),
    );

    const malformed = makeFixture({
      employee_id: false as unknown as string,
      available_actions: ['FINISH_EMPLOYEE_BLOCKER'],
    });
    await activate(malformed, 'EMPLOYEE');
    const malformedPlanner = createGraphReadyInteractionPlanner(
      malformed.runtime,
      'EMPLOYEE',
    );
    const malformedInstance = currentBusinessInstance(malformedPlanner);

    expect(() =>
      malformedPlanner.plan(
        malformedInstance,
        malformedPlanner.actions.describe(malformedInstance),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_SOURCE_ID',
        field: 'source_employee_id',
      }),
    );
  });

  it('returns a frozen inert back plan and does not activate, render, load, or mutate runtime state', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');
    const planner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const instance = planner.actions.presentation('back', {}, {});
    const state = fixture.runtime.getState();
    const plan = planner.plan(
      instance,
      planner.actions.describe(instance),
    );

    expect(plan).toEqual({
      kind: 'graph-presentation-interaction-plan',
      activationId: 1,
      nodeId: 'EMPLOYEE',
      actionId: 'back',
      effect: 'back',
    });
    expect(planner.ownsBusinessPlan(plan)).toBe(false);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(fixture.runtime.getState()).toBe(state);
    expect(fixture.getRequestCalls()).toBe(0);
  });

  it('materializes canonical navigate context from event, literal, and current context without activation', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'LOCAL');
    const planner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'LOCAL',
    );
    const instance = planner.actions.presentation(
      'open',
      { mainLine: 'Employee' },
      { employee_id: 'E-9' },
    );
    const state = fixture.runtime.getState();
    const plan = planner.plan(
      instance,
      planner.actions.describe(instance),
    );

    expect(plan).toEqual({
      kind: 'graph-presentation-interaction-plan',
      activationId: 1,
      nodeId: 'LOCAL',
      actionId: 'open',
      effect: 'navigate',
      destination: {
        nodeId: 'EMPLOYEE',
        context: {
          employee_id: 'E-9',
          mode: 'view',
          scope: 'roster',
        },
      },
    });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(
      plan.effect === 'navigate' &&
        Object.isFrozen(plan.destination),
    ).toBe(true);
    expect(
      plan.effect === 'navigate' &&
        Object.isFrozen(plan.destination.context),
    ).toBe(true);
    expect(fixture.runtime.getState()).toBe(state);
  });

  it('requires the exact descriptor object returned for the exact planner-owned instance', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');
    const planner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const instance = currentBusinessInstance(planner);
    const descriptor = planner.actions.describe(instance);

    expect(() =>
      planner.plan(
        instance,
        Object.freeze({ ...descriptor }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'DESCRIPTOR_IDENTITY_MISMATCH',
      }),
    );

    const back = planner.actions.presentation('back', {}, {});
    expect(() =>
      planner.plan(
        instance,
        planner.actions.describe(back),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'DESCRIPTOR_IDENTITY_MISMATCH',
      }),
    );
  });

  it('rejects a foreign factory instance and an instance from a stale activation', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');
    const planner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const foreignFactory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );
    const foreign = foreignFactory.presentation('back', {}, {});

    expect(() =>
      planner.plan(
        foreign,
        foreignFactory.describe(foreign),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'UNKNOWN_ACTION_INSTANCE',
      }),
    );

    const current = planner.actions.presentation('back', {}, {});
    const descriptor = planner.actions.describe(current);
    fixture.setReadModel({
      employee_id: 'E-2',
      available_actions: ['FINISH_EMPLOYEE_BLOCKER'],
    });
    await activate(fixture, 'EMPLOYEE');

    expect(() =>
      planner.plan(current, descriptor),
    ).toThrow(
      expect.objectContaining({
        code: 'ACTIVATION_NOT_CURRENT',
      }),
    );
  });

  it('recognizes only the exact current planner-owned business plan object', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');

    const owner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const ownerInstance = currentBusinessInstance(owner);
    const exactPlan = owner.plan(
      ownerInstance,
      owner.actions.describe(ownerInstance),
    );
    const structuralClone = Object.freeze({ ...exactPlan });
    const reconstructed = Object.freeze({
      kind: 'graph-business-interaction-plan' as const,
      activationId: exactPlan.activationId,
      nodeId: exactPlan.nodeId,
      actionId: exactPlan.actionId,
      command: exactPlan.command,
      input: exactPlan.input,
      transition: exactPlan.transition,
    });

    const foreignPlanner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const foreignInstance = currentBusinessInstance(foreignPlanner);
    const foreignPlan = foreignPlanner.plan(
      foreignInstance,
      foreignPlanner.actions.describe(foreignInstance),
    );

    expect(owner.ownsBusinessPlan(exactPlan)).toBe(true);
    expect(owner.ownsBusinessPlan(structuralClone)).toBe(false);
    expect(owner.ownsBusinessPlan(reconstructed)).toBe(false);
    expect(owner.ownsBusinessPlan(foreignPlan)).toBe(false);
    expect(foreignPlanner.ownsBusinessPlan(foreignPlan)).toBe(true);
    expect(fixture.getRequestCalls()).toBe(0);

    await activate(fixture, 'EMPLOYEE');
    expect(owner.ownsBusinessPlan(exactPlan)).toBe(false);
  });

  it('recognizes only exact current planner-owned presentation plan objects separately from business plans', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');

    const owner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const backInstance = owner.actions.presentation('back', {}, {});
    const backPlan = owner.plan(
      backInstance,
      owner.actions.describe(backInstance),
    );
    const businessInstance = currentBusinessInstance(owner);
    const businessPlan = owner.plan(
      businessInstance,
      owner.actions.describe(businessInstance),
    );
    const structuralClone = Object.freeze({ ...backPlan });
    const reconstructed = Object.freeze({
      kind: 'graph-presentation-interaction-plan' as const,
      activationId: backPlan.activationId,
      nodeId: backPlan.nodeId,
      actionId: backPlan.actionId,
      effect: backPlan.effect,
    });
    const foreignPlanner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'EMPLOYEE',
    );
    const foreignBack = foreignPlanner.actions.presentation('back', {}, {});
    const foreignPlan = foreignPlanner.plan(
      foreignBack,
      foreignPlanner.actions.describe(foreignBack),
    );

    expect(owner.ownsPresentationPlan(backPlan)).toBe(true);
    expect(owner.ownsBusinessPlan(backPlan)).toBe(false);
    expect(owner.ownsPresentationPlan(structuralClone)).toBe(false);
    expect(owner.ownsPresentationPlan(reconstructed)).toBe(false);
    expect(owner.ownsPresentationPlan(businessPlan)).toBe(false);
    expect(owner.ownsPresentationPlan(foreignPlan)).toBe(false);
    expect(foreignPlanner.ownsPresentationPlan(foreignPlan)).toBe(true);

    await activate(fixture, 'LOCAL');
    const localPlanner = createGraphReadyInteractionPlanner(
      fixture.runtime,
      'LOCAL',
    );
    const openInstance = localPlanner.actions.presentation(
      'open',
      { mainLine: 'Employee' },
      { employee_id: 'E-9' },
    );
    const navigatePlan = localPlanner.plan(
      openInstance,
      localPlanner.actions.describe(openInstance),
    );

    expect(localPlanner.ownsPresentationPlan(navigatePlan)).toBe(true);
    await activate(fixture, 'EMPLOYEE');
    expect(owner.ownsPresentationPlan(backPlan)).toBe(false);
    expect(localPlanner.ownsPresentationPlan(navigatePlan)).toBe(false);
  });

  it('surfaces constructor lifecycle failure as GraphNodeActionFactoryError', () => {
    const fixture = makeFixture();

    try {
      createGraphReadyInteractionPlanner(
        fixture.runtime,
        'EMPLOYEE',
      );
      throw new Error('expected constructor to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(GraphNodeActionFactoryError);
      expect(error).toMatchObject({
        name: 'GraphNodeActionFactoryError',
        code: 'ACTIVATION_NOT_READY',
      });
    }

    expect(fixture.getRequestCalls()).toBe(0);
  });
});
