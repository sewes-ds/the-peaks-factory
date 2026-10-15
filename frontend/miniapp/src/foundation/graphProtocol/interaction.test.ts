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
  GraphInteractionValidationError,
  graphInteraction,
  graphInteractionsFor,
} from './interaction';
import { graphSourcesFor } from './source';
import {
  defineGraphTransitions,
  graphTransition,
} from './transition';

describe('Graph Protocol interactions', () => {
  type EmployeeReadModel = Readonly<{
    employee_id: string;
    display_name: string;
    available_actions: readonly [
      'FINISH_EMPLOYEE_BLOCKER',
      ...'FINISH_EMPLOYEE_BLOCKER'[],
    ];
    active: Readonly<{
      operation_id: string | null;
    }>;
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

  const optionalHintSource = employeeSources.optional<
    Readonly<{
      available_actions: readonly ['FINISH_EMPLOYEE_BLOCKER'];
    }>,
    'hint',
    '/manager/employees/:id/hint'
  >({
    sourceId: 'hint',
    endpoint: '/manager/employees/:id/hint',
    request: async (_context) => ({}) as unknown,
    decode: (input: unknown) =>
      input as Readonly<{
        available_actions: readonly ['FINISH_EMPLOYEE_BLOCKER'];
      }>,
  });

  const destinationContext = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
  });

  type DestinationContext = Readonly<{
    employee_id: string;
    mode: 'view' | 'edit';
  }>;

  const graph = defineGraph({
    'S03-E12': graphNodesFor(employeeContext).endpointBacked({
      source: employeeSources.endpointBacked(
        employeeSources.bundle({
          employee: employeeSource,
          hint: optionalHintSource,
        }),
      ),
      project: ({ context, sources }) => ({
        employeeId: context.employee_id,
        availableActions: sources.employee.available_actions,
      }),
    }),
    'S03-E10': graphNodesFor(destinationContext).local({
      source: graphSourcesFor<DestinationContext>().local(),
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
    mode: graphActionEvent.mode('view', 'edit'),
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
      openEmployee: graphAction.presentation(
        employeeEvent,
        graphAction.listButton({
          variant: 'blue',
        }),
      ),
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

  const finishInput = defineGraphCommandInput({
    employee_id: graphCommandInput.id(),
    blocker_id: graphCommandInput.id(),
    operation_id: graphCommandInput.optionalId(),
  });

  const finishCommand = graphCommandFor(finishInput).define({
    command: 'FINISH_EMPLOYEE_BLOCKER',
    method: 'POST',
    endpoint: '/operations/employee-blockers/finish',
    outcomes: [
      'EMPLOYEE_BLOCKERS_REMAIN',
      'EMPLOYEE_READY_TO_CLOSE_SHIFT',
    ],
    entities: defineGraphCommandEntities({
      employee_id: graphCommandEntity.id(),
    }),
    request: async (_input) => ({}) as unknown,
  });

  const finishTransitions = defineGraphTransitions({
    graph,
    command: finishCommand,
    currentContext: employeeContext,
    transitions: {
      EMPLOYEE_BLOCKERS_REMAIN: {
        node: 'S03-E12',
        context: {
          employee_id: graphTransition.entityId('employee_id'),
          mode: graphTransition.context('mode'),
        },
      },
      EMPLOYEE_READY_TO_CLOSE_SHIFT: {
        node: 'S03-E10',
        context: {
          employee_id: graphTransition.entityId('employee_id'),
          mode: graphTransition.context('mode'),
        },
      },
    },
  });

  const scope = graphInteractionsFor(graph, actions).node('S03-E12');

  const finishInteraction = scope.business({
    action: 'finishEmployeeBlocker',
    availability: graphInteraction.availableActions(
      'employee',
      'available_actions',
    ),
    command: finishCommand,
    input: {
      employee_id: graphInteraction.context('employee_id'),
      blocker_id: graphInteraction.event('blocker_id'),
      operation_id: graphInteraction.optionalSourceId(
        'employee',
        'active',
        'operation_id',
      ),
    },
    transition: finishTransitions,
  });

  const backInteraction = scope.presentation({
    action: 'back',
    effect: graphInteraction.back(),
  });

  const openEmployeeInteraction = scope.presentation({
    action: 'openEmployee',
    effect: graphInteraction.navigate('S03-E10', {
      employee_id: graphInteraction.event('employee_id'),
      mode: graphInteraction.literal('view'),
    }),
  });

  const nodeInteractions = scope.define({
    business: [finishInteraction],
    presentation: [backInteraction, openEmployeeInteraction],
  });

  const unsafeBusiness = scope.business as (
    definition: unknown,
  ) => unknown;

  const unsafePresentation = scope.presentation as (
    definition: unknown,
  ) => unknown;

  it('binds one closed business chain and closed presentation effects to one canonical node', () => {
    expect(nodeInteractions.node).toBe('S03-E12');
    expect(
      nodeInteractions.business.finishEmployeeBlocker,
    ).toBe(finishInteraction);
    expect(nodeInteractions.presentation.back).toBe(backInteraction);
    expect(
      nodeInteractions.presentation.openEmployee,
    ).toBe(openEmployeeInteraction);

    expect(finishInteraction.command).toBe(finishCommand);
    expect(finishInteraction.transition).toBe(finishTransitions);
    expect(finishInteraction.availability).toEqual({
      source: 'available-actions',
      sourceName: 'employee',
      path: ['available_actions'],
    });

    expect(Object.isFrozen(nodeInteractions)).toBe(true);
    expect(Object.isFrozen(nodeInteractions.business)).toBe(true);
    expect(Object.isFrozen(nodeInteractions.presentation)).toBe(true);
  });

  it('requires available_actions evidence from a declared required node source', () => {
    expect(() =>
      unsafeBusiness({
        action: 'finishEmployeeBlocker',
        availability: graphInteraction.availableActions(
          'hint',
          'available_actions',
        ),
        command: finishCommand,
        input: {
          employee_id: graphInteraction.context('employee_id'),
          blocker_id: graphInteraction.event('blocker_id'),
          operation_id: graphInteraction.optionalSourceId(
            'employee',
            'active',
            'operation_id',
          ),
        },
        transition: finishTransitions,
      }),
    ).toThrow(
      'Graph interaction node source "hint" must be required.',
    );

    expect(() =>
      unsafeBusiness({
        action: 'finishEmployeeBlocker',
        availability: graphInteraction.availableActions(
          'missing',
          'available_actions',
        ),
        command: finishCommand,
        input: {
          employee_id: graphInteraction.context('employee_id'),
          blocker_id: graphInteraction.event('blocker_id'),
          operation_id: graphInteraction.optionalSourceId(
            'employee',
            'active',
            'operation_id',
          ),
        },
        transition: finishTransitions,
      }),
    ).toThrow(
      'Unknown graph interaction node source "missing".',
    );
  });

  it('validates declarative command-input binding categories and source-ID semantics', () => {
    expect(() =>
      unsafeBusiness({
        action: 'finishEmployeeBlocker',
        availability: graphInteraction.availableActions(
          'employee',
          'available_actions',
        ),
        command: finishCommand,
        input: {
          employee_id: graphInteraction.context('employee_id'),
          blocker_id: graphInteraction.context('mode'),
          operation_id: graphInteraction.optionalSourceId(
            'employee',
            'active',
            'operation_id',
          ),
        },
        transition: finishTransitions,
      }),
    ).toThrow('across scalar categories');

    expect(() =>
      unsafeBusiness({
        action: 'finishEmployeeBlocker',
        availability: graphInteraction.availableActions(
          'employee',
          'available_actions',
        ),
        command: finishCommand,
        input: {
          employee_id: graphInteraction.context('employee_id'),
          blocker_id: graphInteraction.event('blocker_id'),
          operation_id: {
            source: 'node-source-id',
            sourceName: 'employee',
            path: ['active', 'operation_id'],
            normalize: 'string',
            missing: 'bad',
          },
        },
        transition: finishTransitions,
      }),
    ).toThrow(
      'node-source ID binding must declare missing as reject or omit',
    );

    const nonIdInput = defineGraphCommandInput({
      mode: graphCommandInput.mode('view', 'edit'),
    });

    const nonIdCommand = graphCommandFor(nonIdInput).define({
      command: 'FINISH_EMPLOYEE_BLOCKER',
      method: 'POST',
      endpoint: '/operations/employee-blockers/finish',
      outcomes: ['EMPLOYEE_BLOCKER_UPDATED'],
      entities: defineGraphCommandEntities({
        employee_id: graphCommandEntity.id(),
      }),
      request: async (_input) => ({}) as unknown,
    });

    const nonIdTransitions = defineGraphTransitions({
      graph,
      command: nonIdCommand,
      currentContext: employeeContext,
      transitions: {
        EMPLOYEE_BLOCKER_UPDATED: {
          node: 'S03-E10',
          context: {
            employee_id: graphTransition.entityId('employee_id'),
            mode: graphTransition.context('mode'),
          },
        },
      },
    });

    expect(() =>
      unsafeBusiness({
        action: 'finishEmployeeBlocker',
        availability: graphInteraction.availableActions(
          'employee',
          'available_actions',
        ),
        command: nonIdCommand,
        input: {
          mode: graphInteraction.sourceId(
            'employee',
            'employee_id',
          ),
        },
        transition: nonIdTransitions,
      }),
    ).toThrow('can bind only destination id fields');
  });

  it('requires the transition to reference the same graph, command and current-node context identity', () => {
    const otherCommand = graphCommandFor(finishInput).define({
      command: 'OTHER_COMMAND',
      method: 'POST',
      endpoint: '/operations/other',
      outcomes: ['OTHER_DONE'],
      entities: defineGraphCommandEntities({
        employee_id: graphCommandEntity.id(),
      }),
      request: async (_input) => ({}) as unknown,
    });

    const otherTransition = defineGraphTransitions({
      graph,
      command: otherCommand,
      currentContext: employeeContext,
      transitions: {
        OTHER_DONE: {
          node: 'S03-E10',
          context: {
            employee_id: graphTransition.entityId('employee_id'),
            mode: graphTransition.context('mode'),
          },
        },
      },
    });

    expect(() =>
      unsafeBusiness({
        action: 'finishEmployeeBlocker',
        availability: graphInteraction.availableActions(
          'employee',
          'available_actions',
        ),
        command: finishCommand,
        input: {
          employee_id: graphInteraction.context('employee_id'),
          blocker_id: graphInteraction.event('blocker_id'),
          operation_id: graphInteraction.optionalSourceId(
            'employee',
            'active',
            'operation_id',
          ),
        },
        transition: otherTransition,
      }),
    ).toThrow(
      'Graph business transition must reference the same command.',
    );

    const clonedCurrentContext = defineGraphContext({
      employee_id: graphContext.id(),
      mode: graphContext.mode('view', 'edit'),
    });

    const clonedContextTransition = defineGraphTransitions({
      graph,
      command: finishCommand,
      currentContext: clonedCurrentContext,
      transitions: {
        EMPLOYEE_BLOCKERS_REMAIN: {
          node: 'S03-E12',
          context: {
            employee_id: graphTransition.entityId('employee_id'),
            mode: graphTransition.context('mode'),
          },
        },
        EMPLOYEE_READY_TO_CLOSE_SHIFT: {
          node: 'S03-E10',
          context: {
            employee_id: graphTransition.entityId('employee_id'),
            mode: graphTransition.context('mode'),
          },
        },
      },
    });

    expect(() =>
      unsafeBusiness({
        action: 'finishEmployeeBlocker',
        availability: graphInteraction.availableActions(
          'employee',
          'available_actions',
        ),
        command: finishCommand,
        input: {
          employee_id: graphInteraction.context('employee_id'),
          blocker_id: graphInteraction.event('blocker_id'),
          operation_id: graphInteraction.optionalSourceId(
            'employee',
            'active',
            'operation_id',
          ),
        },
        transition: clonedContextTransition,
      }),
    ).toThrow(
      'Graph business transition must reference the current node context schema.',
    );
  });

  it('rejects unknown navigation targets, invalid literals and presentation predicates', () => {
    expect(() =>
      unsafePresentation({
        action: 'openEmployee',
        effect: graphInteraction.navigate('S03-X99', {
          employee_id: graphInteraction.event('employee_id'),
          mode: graphInteraction.literal('view'),
        }),
      }),
    ).toThrow(
      'Unknown graph presentation destination node "S03-X99".',
    );

    expect(() =>
      unsafePresentation({
        action: 'openEmployee',
        effect: graphInteraction.navigate('S03-E10', {
          employee_id: graphInteraction.event('employee_id'),
          mode: graphInteraction.literal('manage'),
        }),
      }),
    ).toThrow(
      'Invalid graph presentation literal for "mode"',
    );

    expect(() =>
      unsafePresentation({
        action: 'back',
        effect: {
          kind: 'back',
          predicate: () => true,
        },
      }),
    ).toThrow(
      'Unknown graph presentation back effect field "predicate".',
    );
  });

  it('exposes only semantic interactions declared for the canonical node', () => {
    expect(Object.keys(nodeInteractions.business)).toEqual([
      'finishEmployeeBlocker',
    ]);
    expect(Object.keys(nodeInteractions.presentation)).toEqual([
      'back',
      'openEmployee',
    ]);
    expect(
      Object.prototype.hasOwnProperty.call(
        nodeInteractions.presentation,
        'next',
      ),
    ).toBe(false);
    expect(Object.isFrozen(nodeInteractions)).toBe(true);
    expect(Object.isFrozen(nodeInteractions.business)).toBe(true);
    expect(Object.isFrozen(nodeInteractions.presentation)).toBe(true);
  });

  it('rejects duplicate and cross-node interaction declarations', () => {
    const unsafeDefine = scope.define as (
      definition: unknown,
    ) => unknown;

    expect(() =>
      unsafeDefine({
        business: [finishInteraction, finishInteraction],
        presentation: [],
      }),
    ).toThrow(
      'Duplicate graph interaction action "finishEmployeeBlocker" on node "S03-E12".',
    );

    const destinationScope = graphInteractionsFor(
      graph,
      actions,
    ).node('S03-E10');

    const destinationBack = destinationScope.presentation({
      action: 'back',
      effect: graphInteraction.back(),
    });

    expect(() =>
      unsafeDefine({
        business: [],
        presentation: [destinationBack],
      }),
    ).toThrow(
      'Graph interaction for node "S03-E10" cannot be declared under node "S03-E12".',
    );
  });

  it('rejects business interactions on local nodes because backend availability evidence is absent', () => {
    const localScope = graphInteractionsFor(graph, actions).node(
      'S03-E10',
    );

    const unsafeLocalBusiness = localScope.business as (
      definition: unknown,
    ) => unknown;

    expect(() =>
      unsafeLocalBusiness({
        action: 'finishEmployeeBlocker',
        availability: graphInteraction.availableActions(
          'employee',
          'available_actions',
        ),
        command: finishCommand,
        input: {
          employee_id: graphInteraction.context('employee_id'),
          blocker_id: graphInteraction.event('blocker_id'),
        },
        transition: finishTransitions,
      }),
    ).toThrow(
      'Business interactions require endpoint-backed node "S03-E10".',
    );
  });
});
