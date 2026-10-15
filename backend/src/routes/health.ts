import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    return {
      status: 'ok'
    };
  });

  app.get('/health/db', async () => {
    const dbResult = await app.db.query<{ current_user: string }>('select current_user');

    return {
      status: 'ok',
      database: {
        currentUser: dbResult.rows[0]?.current_user ?? null
      }
    };
  });
};
