import { describe, expect, it } from 'vitest';
import { recordTelegramContactProof } from '../../src/services/telegramContactProof.js';
import type { DbPool } from '../../src/db/pool.js';

describe('telegram contact proof service', () => {
  it('calls accepted record_telegram_contact_proof runtime function', async () => {
    let sqlText = '';
    let sqlParams: unknown[] = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        sqlText = sql;
        sqlParams = params;
        return { rows: [{ telegram_contact_proof_id: '1001' }] };
      }
    } as unknown as DbPool;

    await expect(
      recordTelegramContactProof(pool, {
        telegramUserId: 777n,
        phoneE164: '+998901234567',
        telegramUsername: 'worker',
        botUpdateId: 555n,
        botMessageId: 44n
      })
    ).resolves.toBe('1001');

    expect(sqlText).toContain('app.record_telegram_contact_proof');
    expect(sqlParams).toEqual(['777', '+998901234567', 'worker', '555', '44']);
  });
});
