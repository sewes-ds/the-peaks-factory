import { describe, expect, it } from 'vitest';

import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
} from './action';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
} from './command';
import {
  defineGraphContext,
  graphContext,
} from './context';
import {
  defineGraph,
  graphNodesFor,
} from './definition';
import {
  graphInteraction,
  graphInteractionsFor,
} from './interaction';
import {
  GraphProgramValidationError,
  defineGraphProgram,
} from './program';
import { graphSourcesFor } from './source';
import {
  defineGraphTransitions,
  graphTransition,
} from './transition';

describe('Graph Protocol program composition', () => {
  type EmployeeReadModel = Readonly<{
    employee_id: string;
    available_actions: readonly ['FINISH_EMPLOYEE_BLOCKER'];
  }>;

  const employeeContext = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
  });

  type EmployeeContext = Readonly<{
    employee_id: string;
    mode: 'view' | 'edit';
  }>;

  const employeeSources = graphSourcesFor<EmployeeContext>();
  const employeeSource = employeeSources.required<
    EmployeeReadModel,
    'employee',
    '/manager/employees/:id'
  >({
    sourceId: 'employee',
    endpoint: '/manager/employees/:id',
    request: async (_context) => ({}) as unknown,
    decode: (input: unknown) => input as EmployeeReadModel,
  });

  const graph = defineGraph({
    'S03-E12': graphNodesFor(employeeContext).endpointBacked({
      source: employeeSources.endpointBacked(
        employeeSources.bundle({
          employee: employeeSource,
        }),
      ),
      project: ({ context }) => ({
        employeeId: context.employee_id,
      }),
    }),
    'S03-E10': graphNodesFor(employeeContext).local({
      source: graphSourcesFor<EmployeeContext>().local(),
      project: ({ context }) => ({
        employeeId: context.employee_id,
      }),
    }),
  });

  const blockerEvent = defineGraphActionEvent({
    blocker_id: graphActionEvent.id(),
  });
  const noEvent = defineGraphActionEvent({});

  const actions = defineGraphActions({
    business: {
      finishEmployeeBlocker: graphAction.business(
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
        node: 'S03-E10',
        context: {
          employee_id: graphTransition.entityId('employee_id'),
          mode: graphTransition.context('mode'),
        },
      },
    },
  });

  const scope = graphInteractionsFor(graph, actions).node('S03-E12');

  const finish = scope.business({
    action: 'finishEmployeeBlocker',
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

  const back = scope.presentation({
    action: 'back',
    effect: graphInteraction.back(),
  });

  const employeeInteractions = scope.define({
    business: [finish],
    presentation: [back],
  });

  const validDefinition = {
    graph,
    actions,
    interactions: {
      'S03-E12': employeeInteractions,
    },
  } as const;

  const unsafeDefine = defineGraphProgram as (
    definition: unknown,
  ) => unknown;

  it('composes one frozen program from exact graph, registry and canonical node interactions', () => {
    const program = defineGraphProgram(validDefinition);

    expect(program.kind).toBe('graph-program');
    expect(program.graph).toBe(graph);
    expect(program.actions).toBe(actions);
    expect(program.interactions['S03-E12']).toBe(
      employeeInteractions,
    );
    expect(Object.isFrozen(program)).toBe(true);
    expect(Object.isFrozen(program.interactions)).toBe(true);
  });

  it('rejects unknown node keys and node-key mismatches across an unsafe boundary', () => {
    expect(() =>
      unsafeDefine({
        graph,
        actions,
        interactions: {
          'S03-X99': employeeInteractions,
        },
      }),
    ).toThrow(
      new GraphProgramValidationError(
        'Unknown graph program node "S03-X99".',
      ),
    );

    expect(() =>
      unsafeDefine({
        graph,
        actions,
        interactions: {
          'S03-E10': employeeInteractions,
        },
      }),
    ).toThrow(
      'Graph program node key "S03-E10" must match interaction node "S03-E12".',
    );
  });

  it('rejects node interaction declarations from another graph identity', () => {
    const foreignGraph = defineGraph({
      ...graph.nodes,
    });

    expect(() =>
      unsafeDefine({
        graph: foreignGraph,
        actions,
        interactions: {
          'S03-E12': employeeInteractions,
        },
      }),
    ).toThrow(
      'Graph program node "S03-E12" interactions must reference the program graph.',
    );
  });

  it('rejects node interaction declarations from another action-registry identity', () => {
    const foreignActions = defineGraphActions({
      business: {
        finishEmployeeBlocker: actions.business.finishEmployeeBlocker,
      },
      presentation: {
        back: actions.presentation.back,
      },
    });

    expect(() =>
      unsafeDefine({
        graph,
        actions: foreignActions,
        interactions: {
          'S03-E12': employeeInteractions,
        },
      }),
    ).toThrow(
      'Graph program node "S03-E12" interactions must reference the program action registry.',
    );
  });

  it('rejects nested interaction map keys that disagree with semantic action identity', () => {
    expect(() =>
      unsafeDefine({
        graph,
        actions,
        interactions: {
          'S03-E12': {
            ...employeeInteractions,
            business: {
              wrongKey: finish,
            },
          },
        },
      }),
    ).toThrow(
      'Graph program interaction map key "wrongKey" must match interaction action "finishEmployeeBlocker".',
    );

    expect(() =>
      unsafeDefine({
        graph,
        actions,
        interactions: {
          'S03-E12': {
            ...employeeInteractions,
            business: {
              finishEmployeeBlocker: back,
            },
          },
        },
      }),
    ).toThrow(
      'Graph program business interaction "finishEmployeeBlocker" has invalid kind.',
    );
  });

  it('rejects semantic actions that are unreachable from every program node', () => {
    const actionsWithUnusedNext = defineGraphActions({
      business: {
        finishEmployeeBlocker:
          actions.business.finishEmployeeBlocker,
      },
      presentation: {
        back: actions.presentation.back,
        next: graphAction.presentation(
          noEvent,
          graphAction.actionButton({
            label: 'Далее',
            icon: 'next.svg',
            variant: 'primaryBlue',
          }),
        ),
      },
    });

    const scoped = graphInteractionsFor(
      graph,
      actionsWithUnusedNext,
    ).node('S03-E12');

    const scopedFinish = scoped.business({
      action: 'finishEmployeeBlocker',
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

    const scopedBack = scoped.presentation({
      action: 'back',
      effect: graphInteraction.back(),
    });

    const scopedInteractions = scoped.define({
      business: [scopedFinish],
      presentation: [scopedBack],
    });

    expect(() =>
      unsafeDefine({
        graph,
        actions: actionsWithUnusedNext,
        interactions: {
          'S03-E12': scopedInteractions,
        },
      }),
    ).toThrow(
      'Graph presentation semantic action "next" is unreachable from the program interaction map.',
    );
  });

  it('rejects an empty program interaction map', () => {
    expect(() =>
      unsafeDefine({
        graph,
        actions,
        interactions: {},
      }),
    ).toThrow(
      'Graph program must declare at least one node interaction set.',
    );
  });
});
