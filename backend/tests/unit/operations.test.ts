import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import { ApiError } from '../../src/db/errors.js';
import { parseOperationRequestPart } from '../../src/routes/operations.js';
import {
  accrueAdditionalWorkSalary,
  approveAdditionalWorkRequest,
  assignAdditionalWork,
  cancelMachineDowntime,
  emergencyFinishOperatorBreak,
  finishOperatorBreak,
  mapAdditionalWorkAssignmentError,
  rejectAdditionalWorkRequest,
  requestAdditionalWork,
  startAdditionalWork,
  startMachineDowntime
} from '../../src/services/operations.js';

const actor: ActorContext = {
  employeeId: 7n,
  telegramUserId: 1000n
};

function createPool(expectedSql: string, expectedParams: readonly unknown[]): DbPool {
  return {
    query: async (sql: string, params: readonly unknown[]) => {
      expect(sql).toBe(expectedSql);
      expect(params).toEqual(expectedParams);
      return { rows: [{ result: '42' }] };
    }
  } as unknown as DbPool;
}

describe('operations services', () => {
  it('starts critical downtime without production operation through approved runtime_api', async () => {
    await expect(
      startMachineDowntime(
        createPool('select app.start_machine_downtime($1, $2, $3, $4, $5) as result', ['7', '10', '30', null, null]),
        actor,
        { machineId: '10', downtimeTypeId: '30', productionOperationId: null, comment: null }
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('passes missing production operation as null for downtime start', async () => {
    await expect(
      startMachineDowntime(
        createPool('select app.start_machine_downtime($1, $2, $3, $4, $5) as result', ['7', '10', '30', null, null]),
        actor,
        { machineId: '10', downtimeTypeId: '30', comment: null }
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('maps operational downtime production operation to SQL argument 4', async () => {
    await expect(
      startMachineDowntime(
        createPool('select app.start_machine_downtime($1, $2, $3, $4, $5) as result', ['7', '10', '30', '20', null]),
        actor,
        { machineId: '10', downtimeTypeId: '30', productionOperationId: '20', comment: null }
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('keeps downtime type and production operation SQL argument semantics distinct', async () => {
    await expect(
      startMachineDowntime(
        createPool('select app.start_machine_downtime($1, $2, $3, $4, $5) as result', [
          '7',
          '100',
          '300',
          '200',
          'comment'
        ]),
        actor,
        { machineId: '100', downtimeTypeId: '300', productionOperationId: '200', comment: 'comment' }
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('cancels downtime through approved runtime_api', async () => {
    await expect(
      cancelMachineDowntime(
        createPool('select app.cancel_machine_downtime($1, $2, $3) as result', ['7', '44', 'reason']),
        actor,
        '44',
        'reason'
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('finishes own operator break through approved runtime_api', async () => {
    await expect(
      finishOperatorBreak(createPool('select app.finish_operator_break($1) as result', ['7']), actor)
    ).resolves.toEqual({ id: '42' });
  });

  it('emergency finishes operator break through approved runtime_api', async () => {
    await expect(
      emergencyFinishOperatorBreak(
        createPool('select app.emergency_finish_operator_break($1, $2, $3) as result', ['7', '99', 'reason']),
        actor,
        '99',
        'reason'
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('assigns additional work through approved runtime_api', async () => {
    await expect(
      assignAdditionalWork(
        createPool('select app.assign_additional_work($1, $2, $3) as result', ['7', '99', '15']),
        actor,
        '99',
        '15'
      )
    ).resolves.toEqual({ id: '42' });
  });

  it.each([
    [
      { code: 'P0001', message: 'unfinished Допработа already exists for employee and type' },
      409, 'additional_work_assignment_already_exists',
      'Такая доп. работа уже назначена этому сотруднику и ещё не завершена.'
    ],
    [
      { code: 'P0001', message: 'active operator target employee is required' },
      409, 'additional_work_target_not_available',
      'Сотрудник недоступен для назначения доп. работы. Обновите список.'
    ],
    [
      { code: '22023', message: 'active Допработа type is required' },
      409, 'additional_work_type_not_available',
      'Этот вид доп. работы больше недоступен. Обновите список.'
    ],
    [
      { code: '42501', message: 'actor lacks any required permission' },
      403, 'additional_work_assignment_forbidden',
      'Недостаточно прав для назначения доп. работы.'
    ],
    [
      { code: 'P0001', message: 'unexpected concurrent state' },
      409, 'additional_work_assignment_conflict',
      'Не удалось назначить доп. работу из-за изменения данных. Обновите список и повторите.'
    ],
    [
      { code: '40001', message: 'could not serialize access due to concurrent update' },
      409, 'additional_work_assignment_conflict',
      'Не удалось назначить доп. работу из-за изменения данных. Обновите список и повторите.'
    ],
    [
      { code: '40P01', message: 'deadlock detected' },
      409, 'additional_work_assignment_conflict',
      'Не удалось назначить доп. работу из-за изменения данных. Обновите список и повторите.'
    ]
  ] as const)('maps assignment DB conflicts to stable safe API contracts', (databaseError, statusCode, code, message) => {
    expect(mapAdditionalWorkAssignmentError(databaseError)).toMatchObject({ statusCode, code, message });
  });

  it('maps the unfinished unique-index race to the already-exists contract', () => {
    expect(mapAdditionalWorkAssignmentError({
      code: '23505',
      constraint: 'additional_works_one_unfinished_assignment_per_type_idx',
      message: 'raw duplicate detail'
    })).toMatchObject({
      statusCode: 409,
      code: 'additional_work_assignment_already_exists',
      message: 'Такая доп. работа уже назначена этому сотруднику и ещё не завершена.'
    });
  });

  it('does not expose raw assignment database details', async () => {
    const pool = {
      query: async () => {
        throw { code: 'P0001', message: 'unexpected concurrent state' };
      }
    } as unknown as DbPool;
    const result = assignAdditionalWork(pool, actor, '99', '15');
    await expect(result).rejects.toMatchObject({ code: 'additional_work_assignment_conflict' });
    await expect(result).rejects.not.toThrow('unexpected concurrent state');
  });

  it('requests additional work through approved runtime_api', async () => {
    await expect(
      requestAdditionalWork(
        createPool('select app.request_additional_work($1, $2) as result', ['7', '15']),
        actor,
        '15'
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('maps an additional-work start race to the stable API conflict', async () => {
    const pool = {
      query: async () => {
        throw { code: 'P0001', message: 'raw database business-state detail' };
      }
    } as unknown as DbPool;
    const result = startAdditionalWork(pool, actor, '88');
    await expect(result).rejects.toMatchObject({
      statusCode: 409,
      code: 'additional_work_start_blocked',
      message: 'Additional work start is blocked by current business state'
    } satisfies Partial<ApiError>);
    await expect(result).rejects.not.toThrow('raw database business-state detail');
  });

  it('approves an additional work request through approved runtime_api', async () => {
    await expect(
      approveAdditionalWorkRequest(
        createPool('select app.approve_additional_work_request($1, $2, $3) as result', ['7', '88', null]),
        actor,
        '88',
        null
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('rejects an additional work request through approved runtime_api', async () => {
    await expect(
      rejectAdditionalWorkRequest(
        createPool('select app.reject_additional_work_request($1, $2, $3) as result', ['7', '88', 'reason']),
        actor,
        '88',
        'reason'
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('accrues additional work salary through approved runtime_api with amount and quantity semantics', async () => {
    await expect(
      accrueAdditionalWorkSalary(
        createPool('select app.accrue_additional_work_salary($1, $2, $3, $4) as result', ['7', '88', '1000', '12.5']),
        actor,
        { additionalWorkId: '88', amountUzs: '1000', quantity: '12.5' }
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('passes missing additional work salary quantity as null', async () => {
    await expect(
      accrueAdditionalWorkSalary(
        createPool('select app.accrue_additional_work_salary($1, $2, $3, $4) as result', ['7', '88', '1000', null]),
        actor,
        { additionalWorkId: '88', amountUzs: '1000' }
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('passes null additional work salary quantity as null', async () => {
    await expect(
      accrueAdditionalWorkSalary(
        createPool('select app.accrue_additional_work_salary($1, $2, $3, $4) as result', ['7', '88', '1000', null]),
        actor,
        { additionalWorkId: '88', amountUzs: '1000', quantity: null }
      )
    ).resolves.toEqual({ id: '42' });
  });
});

describe('operations route validation', () => {
  it('maps invalid request parts to API bad request', () => {
    expect(() => parseOperationRequestPart(z.object({ id: z.string().regex(/^[1-9][0-9]*$/) }), { id: '0' })).toThrow(
      'Invalid operation request'
    );
  });

  it('accepts missing production operation for downtime start payload validation', () => {
    expect(
      parseOperationRequestPart(
        z.object({
          machine_id: z.string().regex(/^[1-9][0-9]*$/),
          downtime_type_id: z.string().regex(/^[1-9][0-9]*$/),
          production_operation_id: z.string().regex(/^[1-9][0-9]*$/).nullable().optional()
        }),
        { machine_id: '10', downtime_type_id: '30' }
      )
    ).toEqual({ machine_id: '10', downtime_type_id: '30' });
  });

  it('accepts null production operation for downtime start payload validation', () => {
    expect(
      parseOperationRequestPart(
        z.object({
          machine_id: z.string().regex(/^[1-9][0-9]*$/),
          downtime_type_id: z.string().regex(/^[1-9][0-9]*$/),
          production_operation_id: z.string().regex(/^[1-9][0-9]*$/).nullable().optional()
        }),
        { machine_id: '10', downtime_type_id: '30', production_operation_id: null }
      )
    ).toEqual({ machine_id: '10', downtime_type_id: '30', production_operation_id: null });
  });

  it('accepts null comment so PostgreSQL can enforce it by downtime semantic class', () => {
    expect(
      parseOperationRequestPart(
        z.object({
          machine_id: z.string().regex(/^[1-9][0-9]*$/),
          downtime_type_id: z.string().regex(/^[1-9][0-9]*$/),
          production_operation_id: z.string().regex(/^[1-9][0-9]*$/).nullable().optional(),
          comment: z.string().trim().min(1).nullable().optional()
        }),
        { machine_id: '10', downtime_type_id: '30', production_operation_id: null, comment: null }
      )
    ).toEqual({ machine_id: '10', downtime_type_id: '30', production_operation_id: null, comment: null });
  });

  it('rejects a non-null whitespace-only downtime comment before SQL call', () => {
    expect(() =>
      parseOperationRequestPart(
        z.object({
          machine_id: z.string().regex(/^[1-9][0-9]*$/),
          downtime_type_id: z.string().regex(/^[1-9][0-9]*$/),
          production_operation_id: z.string().regex(/^[1-9][0-9]*$/).nullable().optional(),
          comment: z.string().trim().min(1).nullable().optional()
        }),
        { machine_id: '10', downtime_type_id: '30', production_operation_id: null, comment: '   ' }
      )
    ).toThrow('Invalid operation request');
  });

  it('rejects missing machine id for downtime start payload validation', () => {
    expect(() =>
      parseOperationRequestPart(
        z.object({
          machine_id: z.string().regex(/^[1-9][0-9]*$/),
          downtime_type_id: z.string().regex(/^[1-9][0-9]*$/),
          production_operation_id: z.string().regex(/^[1-9][0-9]*$/).nullable().optional()
        }),
        { downtime_type_id: '30' }
      )
    ).toThrow('Invalid operation request');
  });

  it('rejects missing downtime type id for downtime start payload validation', () => {
    expect(() =>
      parseOperationRequestPart(
        z.object({
          machine_id: z.string().regex(/^[1-9][0-9]*$/),
          downtime_type_id: z.string().regex(/^[1-9][0-9]*$/),
          production_operation_id: z.string().regex(/^[1-9][0-9]*$/).nullable().optional()
        }),
        { machine_id: '10' }
      )
    ).toThrow('Invalid operation request');
  });
});
