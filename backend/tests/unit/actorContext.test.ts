import { describe, expect, it } from 'vitest';
import { resolveActorEmployeeId } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';

function createPool(rows: Array<{ employee_id: string }>): DbPool {
  return {
    query: async (sql: string, params: unknown[]) => {
      expect(sql).toContain('app.employees');
      expect(sql).toContain('app.employee_statuses');
      expect(sql).toContain('is_active = true');
      expect(sql).toContain('is_active_for_login = true');
      expect(params).toEqual(['123456']);
      return { rows };
    }
  } as unknown as DbPool;
}

describe('actor context', () => {
  it('resolves active employee by Telegram user id', async () => {
    await expect(resolveActorEmployeeId(createPool([{ employee_id: '42' }]), 123456n)).resolves.toBe(42n);
  });

  it('returns null when Telegram user is not bound to active employee', async () => {
    await expect(resolveActorEmployeeId(createPool([]), 123456n)).resolves.toBeNull();
  });
});
