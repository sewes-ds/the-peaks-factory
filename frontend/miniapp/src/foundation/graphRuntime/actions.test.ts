import { describe, expect, it } from 'vitest';

import {
  GraphActionEventValidationError,
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

type EmployeeReadModel = Readonly<{
  employee_id: string;
  available_actions: readonly (
    | 'FINISH_EMPLOYEE_BLOCKER'
    | 'CLOSE_SHIFT'
  )[];
}>;

type EmployeeContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;

function makeFixture(
  initialAvailableActions: unknown = [
    'FINISH_EMPLOYEE_BLOCKER',
  ],
) {
  let availableActions = initialAvailableActions;

  const employeeContext = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
  });

  const employeeSources = graphSourcesFor<EmployeeContext>();
  const employeeSource = employeeSources.required<
    EmployeeReadModel,
    'employee',
    '/manager/employees/:id'
  >({
    sourceId: 'employee',
    endpoint: '/manager/employees/:id',
    request: async (context) => ({
      employee_id: context.employee_id,
      available_actions: availableActions,
    }),
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
  });

  const command = graphCommandFor(commandInput).define({
    command: 'FINISH_EMPLOYEE_BLOCKER',
    method: 'POST',
    endpoint: '/operations/employee-blockers/finish',
    outcomes: ['DONE'],
    entities: defineGraphCommandEntities({
      employee_id: graphCommandEntity.id(),
    }),
    request: async (_input) => ({}) as unknown,
  });

  const transitions = defineGraphTransitions({
    graph,
    command,
    currentContext: employeeContext,
    transitions: {
      DONE: {
        node: 'LOCAL',
        context: {
          employee_id: graphTransition.entityId('employee_id'),
          mode: graphTransition.context('mode'),
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
    },
    transition: transitions,
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
    actions,
    runtime,
    setAvailableActions(value: unknown): void {
      availableActions = value;
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
      mode: 'view',
    },
  });
}

describe('Graph Runtime node-scoped action projection', () => {
  it('projects a presentation action with a frozen inert descriptor', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');

    const factory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );
    const instance = factory.presentation('back', {}, {});
    const descriptor = factory.describe(instance);

    expect(instance).toMatchObject({
      kind: 'presentation-action',
      actionId: 'back',
      input: {},
      event: {},
    });
    expect(instance.definition).toBe(
      fixture.actions.presentation.back,
    );
    expect(descriptor).toEqual({
      kind: 'graph-runtime-action-descriptor',
      activationId: 1,
      nodeId: 'EMPLOYEE',
      actionClass: 'presentation',
      actionId: 'back',
    });
    expect(Object.isFrozen(factory)).toBe(true);
    expect(Object.isFrozen(instance)).toBe(true);
    expect(Object.isFrozen(descriptor)).toBe(true);
  });

  it('projects exactly one business action when backend evidence contains its token', async () => {
    const fixture = makeFixture([
      'FINISH_EMPLOYEE_BLOCKER',
    ]);
    await activate(fixture, 'EMPLOYEE');

    const factory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );
    const projection = factory.business(
      'finish',
      {},
      { blocker_id: 'B-1' },
    );

    expect(projection).toHaveLength(1);
    expect(Object.isFrozen(projection)).toBe(true);

    if (projection.length === 1) {
      expect(projection[0]).toMatchObject({
        kind: 'business-action',
        actionId: 'finish',
        event: {
          blocker_id: 'B-1',
        },
      });
      expect(projection[0].definition).toBe(
        fixture.actions.business.finish,
      );
      expect(factory.describe(projection[0])).toMatchObject({
        activationId: 1,
        nodeId: 'EMPLOYEE',
        actionClass: 'business',
        actionId: 'finish',
      });
    }
  });

  it('projects no business action when current backend evidence omits its token', async () => {
    const fixture = makeFixture([]);
    await activate(fixture, 'EMPLOYEE');

    const factory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );
    const projection = factory.business(
      'finish',
      {},
      { blocker_id: 'B-1' },
    );

    expect(projection).toEqual([]);
    expect(Object.isFrozen(projection)).toBe(true);
  });

  it('invalidates an old factory after a fresh activation and uses only new evidence', async () => {
    const fixture = makeFixture([
      'FINISH_EMPLOYEE_BLOCKER',
    ]);
    await activate(fixture, 'EMPLOYEE');

    const oldFactory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );

    fixture.setAvailableActions([]);
    await activate(fixture, 'EMPLOYEE');

    expect(() =>
      oldFactory.presentation('back', {}, {}),
    ).toThrow(
      expect.objectContaining({
        code: 'ACTIVATION_NOT_CURRENT',
      }),
    );

    const currentFactory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );

    expect(
      currentFactory.business(
        'finish',
        {},
        { blocker_id: 'B-1' },
      ),
    ).toEqual([]);
    expect(currentFactory.activationId).toBe(2);
  });

  it('requires current ready state for the requested interaction-bearing node', async () => {
    const fixture = makeFixture();

    expect(() =>
      createGraphReadyNodeActionFactory(
        fixture.runtime,
        'EMPLOYEE',
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'ACTIVATION_NOT_READY',
      }),
    );

    await activate(fixture, 'LOCAL');

    expect(() =>
      createGraphReadyNodeActionFactory(
        fixture.runtime,
        'EMPLOYEE',
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'ACTIVATION_NODE_MISMATCH',
      }),
    );

    await activate(fixture, 'NONE');

    const unsafeCreate =
      createGraphReadyNodeActionFactory as (
        runtime: typeof fixture.runtime,
        nodeId: string,
      ) => unknown;

    expect(() =>
      unsafeCreate(fixture.runtime, 'NONE'),
    ).toThrow(
      expect.objectContaining({
        code: 'NODE_HAS_NO_INTERACTIONS',
      }),
    );
  });

  it('validates business and presentation event data separately from display input', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');

    const employeeFactory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );

    const unsafeBusiness =
      employeeFactory.business as (
        actionId: string,
        input: unknown,
        event: unknown,
      ) => unknown;

    expect(() =>
      unsafeBusiness('finish', {}, {}),
    ).toThrow(GraphActionEventValidationError);

    await activate(fixture, 'LOCAL');

    const localFactory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'LOCAL',
    );

    expect(() =>
      localFactory.presentation(
        'open',
        {
          mainLine: 'Employee',
        },
        {
          employee_id: {
            employee_id: 'E-1',
          },
        } as never,
      ),
    ).toThrow(GraphActionEventValidationError);
  });

  it('rejects visual overrides and enforces list display-instance shape', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'EMPLOYEE');

    const employeeFactory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );
    const unsafePresentation =
      employeeFactory.presentation as (
        actionId: string,
        input: unknown,
        event: unknown,
      ) => unknown;

    expect(() =>
      unsafePresentation(
        'back',
        {
          variant: 'red',
        },
        {},
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_INSTANCE_INPUT',
      }),
    );

    await activate(fixture, 'LOCAL');

    const localFactory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'LOCAL',
    );
    const unsafeOpen =
      localFactory.presentation as (
        actionId: string,
        input: unknown,
        event: unknown,
      ) => unknown;

    expect(() =>
      unsafeOpen(
        'open',
        {},
        { employee_id: 'E-1' },
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_INSTANCE_INPUT',
      }),
    );

    expect(
      localFactory.presentation(
        'open',
        {
          mainLine: 'Employee',
          secondaryLine: 'E-1',
        },
        { employee_id: 'E-1' },
      ),
    ).toMatchObject({
      actionId: 'open',
      input: {
        mainLine: 'Employee',
        secondaryLine: 'E-1',
      },
    });
  });

  it('rejects malformed availability evidence and foreign instances', async () => {
    const fixture = makeFixture(
      'FINISH_EMPLOYEE_BLOCKER',
    );
    await activate(fixture, 'EMPLOYEE');

    const factory = createGraphReadyNodeActionFactory(
      fixture.runtime,
      'EMPLOYEE',
    );

    expect(() =>
      factory.business(
        'finish',
        {},
        { blocker_id: 'B-1' },
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_AVAILABILITY_EVIDENCE',
      }),
    );

    expect(() =>
      factory.describe({
        kind: 'presentation-action',
        actionId: 'back',
      }),
    ).toThrow(
      expect.objectContaining({
        code: 'UNKNOWN_ACTION_INSTANCE',
      }),
    );
  });
});
