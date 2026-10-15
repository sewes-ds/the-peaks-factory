import { describe, expect, it } from 'vitest';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import {
  emergencyCloseEmployeeShift,
  finishEmployeeShift,
  startEmployeeShift
} from '../../src/services/shifts.js';
import { parseShiftRequestPart } from '../../src/routes/shifts.js';
import { z } from 'zod';

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

describe('shift services', () => {
  it('starts actor employee shift through approved runtime_api', async () => {
    await expect(
      startEmployeeShift(createPool('select app.start_employee_shift($1) as result', ['7']), actor)
    ).resolves.toEqual({ employee_shift_id: '42' });
  });

  it('finishes actor employee shift through approved runtime_api', async () => {
    await expect(
      finishEmployeeShift(createPool('select app.finish_employee_shift($1) as result', ['7']), actor)
    ).resolves.toEqual({ employee_shift_id: '42' });
  });

  it('emergency closes target employee shift with explicit actor and reason', async () => {
    await expect(
      emergencyCloseEmployeeShift(
        createPool('select app.emergency_close_employee_shift($1, $2, $3) as result', ['7', '99', 'manual close']),
        actor,
        '99',
        'manual close'
      )
    ).resolves.toEqual({ employee_shift_id: '42' });
  });
});

describe('shift route validation', () => {
  it('maps invalid request parts to API bad request', () => {
    expect(() => parseShiftRequestPart(z.object({ id: z.string().regex(/^[1-9][0-9]*$/) }), { id: '0' })).toThrow(
      'Invalid shift request'
    );
  });
});
