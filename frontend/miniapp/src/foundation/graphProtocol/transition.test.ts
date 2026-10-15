import { describe, expect, it } from 'vitest';

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
import { graphSourcesFor } from './source';
import {
  defineGraphTransitions,
  graphTransition,
} from './transition';

describe('Graph Protocol transitions', () => {
  const currentContext = defineGraphContext({
    employee_id: graphContext.id(),
    period: graphContext.period('today', 'week'),
    mode: graphContext.mode('view', 'edit'),
    optional_note: graphContext.optionalTextInput(),
  });

  const destinationContext = defineGraphContext({
    employee_id: graphContext.id(),
    period: graphContext.period('today', 'week', 'month'),
    mode: graphContext.mode('view', 'edit'),
  });

  type DestinationContext = Readonly<{
    employee_id: string;
    period: 'today' | 'week' | 'month';
    mode: 'view' | 'edit';
  }>;

  const sources = graphSourcesFor<DestinationContext>();
  const nodes = graphNodesFor(destinationContext);

  const graph = defineGraph({
    'S03-E12': nodes.local({
      source: sources.local(),
      project: ({ context }) => ({
        employeeId: context.employee_id,
      }),
    }),
    'S03-E10': nodes.local({
      source: sources.local(),
      project: ({ context }) => ({
        employeeId: context.employee_id,
      }),
    }),
  });

  const commandInput = defineGraphCommandInput({
    employee_id: graphCommandInput.id(),
    blocker_id: graphCommandInput.id(),
  });

  const command = graphCommandFor(commandInput).define({
    command: 'FINISH_EMPLOYEE_BLOCKER',
    method: 'POST',
    endpoint: '/operations/employee-blockers/finish',
    outcomes: [
      'EMPLOYEE_BLOCKERS_REMAIN',
      'EMPLOYEE_READY_TO_CLOSE_SHIFT',
    ],
    entities: defineGraphCommandEntities({
      employee_id: graphCommandEntity.id(),
      optional_blocker_id: graphCommandEntity.optionalId(),
    }),
    request: async (_input) => ({}) as unknown,
  });

  const validTransitions = {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.context('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  } as const;

  const unsafeDefine = defineGraphTransitions as (
    definition: Readonly<{
      graph: typeof graph;
      command: typeof command;
      currentContext: typeof currentContext;
      transitions: Readonly<Record<string, unknown>>;
    }>,
  ) => unknown;

  it('stores one exhaustive outcome map against canonical graph nodes', () => {
    const definition = defineGraphTransitions({
      graph,
      command,
      currentContext,
      transitions: validTransitions,
    });

    expect(definition.kind).toBe('graph-transition-definition');
    expect(Object.keys(definition.transitions)).toEqual([
      'EMPLOYEE_BLOCKERS_REMAIN',
      'EMPLOYEE_READY_TO_CLOSE_SHIFT',
    ]);
    expect(
      definition.transitions.EMPLOYEE_BLOCKERS_REMAIN.node,
    ).toBe('S03-E12');
    expect(
      definition.transitions.EMPLOYEE_READY_TO_CLOSE_SHIFT.node,
    ).toBe('S03-E10');
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.transitions)).toBe(true);
  });

  it('declares deterministic string normalization for command entity IDs', () => {
    expect(graphTransition.entityId('employee_id')).toEqual({
      source: 'command-entity',
      field: 'employee_id',
      normalize: 'string',
    });

    expect(
      validTransitions.EMPLOYEE_BLOCKERS_REMAIN.context.employee_id,
    ).toEqual({
      source: 'command-entity',
      field: 'employee_id',
      normalize: 'string',
    });
  });

  it('rejects missing or extra command outcomes across an unsafe boundary', () => {
    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          EMPLOYEE_BLOCKERS_REMAIN:
            validTransitions.EMPLOYEE_BLOCKERS_REMAIN,
        },
      }),
    ).toThrow(
      'Missing graph transition for command outcome "EMPLOYEE_READY_TO_CLOSE_SHIFT".',
    );

    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          FRONTEND_DECIDED_NEXT_SCREEN:
            validTransitions.EMPLOYEE_READY_TO_CLOSE_SHIFT,
        },
      }),
    ).toThrow(
      'Unknown graph transition outcome field "FRONTEND_DECIDED_NEXT_SCREEN".',
    );
  });

  it('rejects unknown destination nodes and missing required destination context', () => {
    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            ...validTransitions.EMPLOYEE_BLOCKERS_REMAIN,
            node: 'S03-X99',
          },
        },
      }),
    ).toThrow(
      'Unknown graph transition destination node "S03-X99".',
    );

    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            node: 'S03-E12',
            context: {
              employee_id: graphTransition.entityId('employee_id'),
              period: graphTransition.context('period'),
            },
          },
        },
      }),
    ).toThrow(
      'Missing required graph transition destination context "mode".',
    );
  });

  it('rejects cross-category current-context bindings', () => {
    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            node: 'S03-E12',
            context: {
              employee_id: graphTransition.entityId('employee_id'),
              period: graphTransition.context('employee_id'),
              mode: graphTransition.context('mode'),
            },
          },
        },
      }),
    ).toThrow(
      'cannot bind to destination "period" across context categories',
    );

    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            node: 'S03-E12',
            context: {
              employee_id: graphTransition.entityId('employee_id'),
              period: graphTransition.context('period'),
              mode: graphTransition.context('optional_note'),
            },
          },
        },
      }),
    ).toThrow(
      'cannot bind to destination "mode" across context categories',
    );
  });

  it('rejects invalid command entity bindings', () => {
    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            node: 'S03-E12',
            context: {
              employee_id: graphTransition.entityId('machine_id'),
              period: graphTransition.context('period'),
              mode: graphTransition.context('mode'),
            },
          },
        },
      }),
    ).toThrow(
      'Unknown graph transition command entity "machine_id".',
    );

    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            node: 'S03-E12',
            context: {
              employee_id:
                graphTransition.entityId('optional_blocker_id'),
              period: graphTransition.context('period'),
              mode: graphTransition.context('mode'),
            },
          },
        },
      }),
    ).toThrow(
      'Optional graph transition command entity "optional_blocker_id" cannot bind required destination "employee_id".',
    );

    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            node: 'S03-E12',
            context: {
              employee_id: graphTransition.entityId('employee_id'),
              period: graphTransition.entityId('employee_id'),
              mode: graphTransition.context('mode'),
            },
          },
        },
      }),
    ).toThrow(
      'Graph transition command entity "employee_id" can bind only destination id fields.',
    );
  });

  it('rejects predicates and unknown binding sources across an unsafe boundary', () => {
    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            ...validTransitions.EMPLOYEE_BLOCKERS_REMAIN,
            predicate: () => true,
          },
        },
      }),
    ).toThrow(
      'Unknown graph transition target field "predicate".',
    );

    expect(() =>
      unsafeDefine({
        graph,
        command,
        currentContext,
        transitions: {
          ...validTransitions,
          EMPLOYEE_BLOCKERS_REMAIN: {
            node: 'S03-E12',
            context: {
              employee_id: {
                source: 'calculated-business-state',
                field: 'employee_id',
              },
              period: graphTransition.context('period'),
              mode: graphTransition.context('mode'),
            },
          },
        },
      }),
    ).toThrow(
      'Unknown graph transition binding source "calculated-business-state".',
    );
  });
});
