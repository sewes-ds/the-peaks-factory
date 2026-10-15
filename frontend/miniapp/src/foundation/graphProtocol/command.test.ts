import { describe, expect, it } from 'vitest';

import {
  GraphCommandValidationError,
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
} from './command';

describe('Graph Protocol command envelope', () => {
  const finishBlockerInput = defineGraphCommandInput({
    employee_id: graphCommandInput.id(),
    blocker_id: graphCommandInput.id(),
  });

  const commands = graphCommandFor(finishBlockerInput);

  const command = commands.define({
    command: 'FINISH_EMPLOYEE_BLOCKER',
    method: 'POST',
    endpoint: '/operations/employee-blockers/finish',
    outcomes: [
      'EMPLOYEE_BLOCKERS_REMAIN',
      'EMPLOYEE_READY_TO_CLOSE_SHIFT',
    ],
    entities: defineGraphCommandEntities({
      employee_id: graphCommandEntity.id(),
      blocker_id: graphCommandEntity.optionalId(),
    }),
    request: async (_input) => ({}) as unknown,
  });

  it('decodes and freezes the declared authoritative domain result', () => {
    const result = command.decode({
      command: 'FINISH_EMPLOYEE_BLOCKER',
      outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
      entities: {
        employee_id: '1',
      },
    });

    expect(result).toEqual({
      command: 'FINISH_EMPLOYEE_BLOCKER',
      outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
      entities: {
        employee_id: '1',
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.entities)).toBe(true);
  });

  it('rejects frontend presentation fields in the closed result envelope', () => {
    for (const extra of [
      { nodeId: 'S03-E10' },
      { route: { screenId: 'S03-E10' } },
      { visual: { variant: 'green' } },
    ]) {
      expect(() =>
        command.decode({
          command: 'FINISH_EMPLOYEE_BLOCKER',
          outcome: 'EMPLOYEE_READY_TO_CLOSE_SHIFT',
          entities: {
            employee_id: '1',
          },
          ...extra,
        }),
      ).toThrow('Unknown graph command result field');
    }
  });

  it('rejects a mismatched command identity or undeclared outcome', () => {
    expect(() =>
      command.decode({
        command: 'OTHER_COMMAND',
        outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
        entities: {
          employee_id: '1',
        },
      }),
    ).toThrow(
      'Graph command result command must be "FINISH_EMPLOYEE_BLOCKER".',
    );

    expect(() =>
      command.decode({
        command: 'FINISH_EMPLOYEE_BLOCKER',
        outcome: 'FRONTEND_DECIDED_NEXT_SCREEN',
        entities: {
          employee_id: '1',
        },
      }),
    ).toThrow(
      'Unknown graph command outcome "FRONTEND_DECIDED_NEXT_SCREEN".',
    );
  });

  it('rejects entity snapshots, unknown entity fields and missing required IDs', () => {
    expect(() =>
      command.decode({
        command: 'FINISH_EMPLOYEE_BLOCKER',
        outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
        entities: {
          employee_id: {
            employee_id: '1',
            full_name: 'Snapshot',
          },
        },
      }),
    ).toThrow(
      'Graph command entity "employee_id" must be a non-empty string or finite number ID.',
    );

    expect(() =>
      command.decode({
        command: 'FINISH_EMPLOYEE_BLOCKER',
        outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
        entities: {
          employee_id: '1',
          machine: {
            machine_id: '3',
          },
        },
      }),
    ).toThrow(
      'Unknown graph command entity field "machine".',
    );

    expect(() =>
      command.decode({
        command: 'FINISH_EMPLOYEE_BLOCKER',
        outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
        entities: {},
      }),
    ).toThrow(
      'Missing required graph command entity "employee_id".',
    );
  });

  it('accepts optional IDs only when they are valid scalar IDs', () => {
    expect(
      command.decode({
        command: 'FINISH_EMPLOYEE_BLOCKER',
        outcome: 'EMPLOYEE_READY_TO_CLOSE_SHIFT',
        entities: {
          employee_id: 1,
          blocker_id: 2,
        },
      }),
    ).toEqual({
      command: 'FINISH_EMPLOYEE_BLOCKER',
      outcome: 'EMPLOYEE_READY_TO_CLOSE_SHIFT',
      entities: {
        employee_id: 1,
        blocker_id: 2,
      },
    });

    expect(() =>
      command.decode({
        command: 'FINISH_EMPLOYEE_BLOCKER',
        outcome: 'EMPLOYEE_READY_TO_CLOSE_SHIFT',
        entities: {
          employee_id: '1',
          blocker_id: null,
        },
      }),
    ).toThrow(
      'Graph command entity "blocker_id" must be a non-empty string or finite number ID.',
    );
  });

  it('validates command, endpoint, outcomes and entity-schema names at unsafe boundaries', () => {
    expect(() =>
      commands.define({
        command: '   ',
        method: 'POST',
        endpoint: '/operations/action',
        outcomes: ['DONE'],
        entities: defineGraphCommandEntities({}),
        request: async (_input) => ({}) as unknown,
      }),
    ).toThrow(
      'Graph command identity must be a non-empty string.',
    );

    expect(() =>
      commands.define({
        command: 'ACTION',
        method: 'POST',
        endpoint: 'operations/action',
        outcomes: ['DONE'],
        entities: defineGraphCommandEntities({}),
        request: async (_input) => ({}) as unknown,
      }),
    ).toThrow(
      'Graph command endpoint must start with "/".',
    );

    expect(() =>
      commands.define({
        command: 'ACTION',
        method: 'POST',
        endpoint: '/operations/action',
        outcomes: ['DONE', 'DONE'],
        entities: defineGraphCommandEntities({}),
        request: async (_input) => ({}) as unknown,
      }),
    ).toThrow(
      'Duplicate graph command outcome "DONE".',
    );

    expect(() =>
      defineGraphCommandEntities({
        '  ': graphCommandEntity.id(),
      }),
    ).toThrow(
      'Graph command entity field names must be non-empty strings.',
    );
  });
});
