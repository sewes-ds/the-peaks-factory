import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeDbPool, createDbPool, type DbPool } from '../../src/db/pool.js';

const openPools: DbPool[] = [];

afterEach(async () => {
  await Promise.all(openPools.splice(0).map((pool) => closeDbPool(pool)));
});

describe('database pool lifecycle', () => {
  it('installs the idle-client error handler before the pool is returned', () => {
    const onIdleClientError = vi.fn();
    const pool = createDbPool(
      { DATABASE_URL: 'postgresql://127.0.0.1:1/unused' },
      onIdleClientError
    );
    openPools.push(pool);
    const failure = Object.assign(new Error('terminating connection due to administrator command'), {
      code: '57P01'
    });

    pool.emit('error', failure, undefined as never);

    expect(onIdleClientError).toHaveBeenCalledOnce();
    expect(onIdleClientError.mock.calls[0]?.[0]).toBe(failure);
  });
});
