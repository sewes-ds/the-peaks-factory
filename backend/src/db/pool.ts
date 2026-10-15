import pg from 'pg';
import type { RuntimeEnv } from '../config/env.js';

const { Pool } = pg;

export type DbPool = pg.Pool;
export type DbExecutor = Pick<pg.Pool, 'query'>;
export type DbPoolIdleErrorHandler = (error: Error) => void;

export function createDbPool(
  env: Pick<RuntimeEnv, 'DATABASE_URL'>,
  onIdleClientError: DbPoolIdleErrorHandler
): DbPool {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  // The pg driver emits idle-client failures on the Pool itself. Without a
  // listener, EventEmitter treats the event as unhandled and terminates the
  // backend process instead of allowing the pool to discard the failed client.
  pool.on('error', onIdleClientError);
  return pool;
}

export async function verifyRuntimeDbIdentity(pool: DbPool): Promise<void> {
  const result = await pool.query<{ current_user: string }>('select current_user');
  const currentUser = result.rows[0]?.current_user;

  if (currentUser !== 'app_runtime_role') {
    throw new Error('Backend runtime database connection must use app_runtime_role');
  }
}

export async function closeDbPool(pool: DbPool): Promise<void> {
  await pool.end();
}
