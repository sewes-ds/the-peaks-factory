import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import { parseProductionRequestPart } from '../../src/routes/production.js';
import {
  cancelProductionOperation,
  finishProductionOperation,
  startProductionOperation
} from '../../src/services/production.js';

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

describe('production operation services', () => {
  it('starts production operation through approved runtime_api', async () => {
    await expect(
      startProductionOperation(
        createPool('select app.start_production_operation($1, $2, $3) as result', ['7', '22', '33']),
        actor,
        '22',
        '33'
      )
    ).resolves.toEqual({ production_operation_id: '42' });
  });

  it('finishes production operation through approved runtime_api', async () => {
    await expect(
      finishProductionOperation(
        createPool('select app.finish_production_operation($1, $2, $3, $4) as result', ['7', '42', '12.5', null]),
        actor,
        '42',
        '12.5',
        null
      )
    ).resolves.toEqual({ production_operation_id: '42' });
  });

  it('cancels production operation through approved runtime_api', async () => {
    await expect(
      cancelProductionOperation(
        createPool('select app.cancel_production_operation($1, $2, $3) as result', ['7', '42', 'bad input']),
        actor,
        '42',
        'bad input'
      )
    ).resolves.toEqual({ production_operation_id: '42' });
  });
});

describe('production route validation', () => {
  it('maps invalid request parts to API bad request', () => {
    expect(() => parseProductionRequestPart(z.object({ id: z.string().regex(/^[1-9][0-9]*$/) }), { id: '0' })).toThrow(
      'Invalid production operation request'
    );
  });
});
