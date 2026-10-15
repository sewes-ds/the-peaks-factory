import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { DbPool } from '../../src/db/pool.js';
import { assertInternalWorkerToken } from '../../src/auth/internalWorker.js';
import { parseNotificationPart } from '../../src/routes/notifications.js';
import { callNotificationRuntime } from '../../src/services/notifications.js';

function createPool(expectedSql: string, expectedParams: readonly unknown[]): DbPool {
  return {
    query: async (sql: string, params: readonly unknown[]) => {
      expect(sql).toBe(expectedSql);
      expect(params).toEqual(expectedParams);
      return { rows: [{ result: '42' }] };
    }
  } as unknown as DbPool;
}

describe('notification service', () => {
  it('marks notification sent through approved runtime_api', async () => {
    await expect(
      callNotificationRuntime(
        createPool('select app.mark_notification_sent($1, $2) as result', ['99', 'message-id']),
        'mark_notification_sent',
        ['99', 'message-id']
      )
    ).resolves.toEqual({ id: '42' });
  });

  it('scans active downtimes through approved runtime_api', async () => {
    await expect(
      callNotificationRuntime(createPool('select app.scan_active_downtimes_for_notifications() as result', []), 'scan_active_downtimes_for_notifications')
    ).resolves.toEqual({ id: '42' });
  });
});

describe('notification route validation', () => {
  it('maps invalid request parts to API bad request', () => {
    expect(() => parseNotificationPart(z.object({ id: z.string().regex(/^[1-9][0-9]*$/) }), { id: '0' })).toThrow(
      'Invalid notification request'
    );
  });
});

describe('internal worker auth', () => {
  it('accepts matching worker token', () => {
    expect(() => assertInternalWorkerToken('secret-token', 'secret-token')).not.toThrow();
  });

  it('rejects missing worker token', () => {
    expect(() => assertInternalWorkerToken(undefined, 'secret-token')).toThrow('Internal worker token is invalid');
  });

  it('rejects invalid worker token', () => {
    expect(() => assertInternalWorkerToken('wrong-token', 'secret-token')).toThrow('Internal worker token is invalid');
  });
});
