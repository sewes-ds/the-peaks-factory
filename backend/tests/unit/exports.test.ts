import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import { parseExportPart } from '../../src/routes/exports.js';
import { callExportRuntime } from '../../src/services/exports.js';

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

describe('export service', () => {
  it('creates export run through approved runtime_api', async () => {
    await expect(
      callExportRuntime(
        createPool('select app.create_google_sheets_export_run($1, $2, $3, $4) as result', ['7', 'salary', '2026-06-01', '2026-06-02']),
        actor,
        'create_google_sheets_export_run',
        ['salary', '2026-06-01', '2026-06-02']
      )
    ).resolves.toEqual({ export_run_id: '42' });
  });

  it('finishes export run through approved runtime_api', async () => {
    await expect(
      callExportRuntime(
        createPool('select app.finish_google_sheets_export_run_success($1, $2, $3) as result', ['7', '42', 'https://sheet']),
        actor,
        'finish_google_sheets_export_run_success',
        ['42', 'https://sheet']
      )
    ).resolves.toEqual({ export_run_id: '42' });
  });
});

describe('export route validation', () => {
  it('maps invalid request parts to API bad request', () => {
    expect(() => parseExportPart(z.object({ date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/) }), { date: 'bad' })).toThrow(
      'Invalid export request'
    );
  });
});
