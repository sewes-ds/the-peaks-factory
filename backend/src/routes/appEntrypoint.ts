import type { FastifyPluginAsync } from 'fastify';
import { getAppEntrypoint } from '../readModels/appEntrypoint.js';

export const appEntrypointRoutes: FastifyPluginAsync = async (app) => {
  app.get('/auth/app-entrypoint', async (request) => {
    const actor = await app.requireActor(request);
    return getAppEntrypoint(app.db, actor);
  });
};
