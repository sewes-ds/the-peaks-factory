import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createDbPool, verifyRuntimeDbIdentity, type DbPool } from '../db/pool.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: DbPool;
  }
}

export const dbPlugin: FastifyPluginAsync = fp(async (app) => {
  const pool = createDbPool(app.config, (error) => {
    const databaseErrorCode = readDatabaseErrorCode(error);
    app.log.error(
      { database_error_code: databaseErrorCode },
      'PostgreSQL idle client connection failed; the pool removed the affected client'
    );
  });
  await verifyRuntimeDbIdentity(pool);

  app.decorate('db', pool);
  app.addHook('onClose', async () => {
    await pool.end();
  });
});

function readDatabaseErrorCode(error: Error): string {
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 ? code : 'unknown';
}
