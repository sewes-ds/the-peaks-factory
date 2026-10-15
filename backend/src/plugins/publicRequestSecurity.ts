import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { ApiError } from '../db/errors.js';

const SAFE_BROWSER_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const publicRequestSecurityPlugin: FastifyPluginAsync = fp(async (app) => {
  if (app.config.APP_ENV !== 'production') {
    return;
  }

  app.addHook('onRequest', async (request) => {
    assertExpectedHost(request, app.config.PUBLIC_HOST);

    if (isAdminMutation(request)) {
      assertExpectedOrigin(request, app.config.PUBLIC_ORIGIN);
    }
  });
});

export function assertExpectedHost(request: FastifyRequest, expectedHost: string): void {
  const requestHost = request.headers.host;
  if (typeof requestHost !== 'string' || requestHost.toLowerCase() !== expectedHost.toLowerCase()) {
    throw new ApiError(421, 'forbidden', 'Запрос направлен на недопустимый домен');
  }
}

export function assertExpectedOrigin(request: FastifyRequest, expectedOrigin: string): void {
  if (request.headers.origin !== expectedOrigin) {
    throw new ApiError(403, 'forbidden', 'Проверка источника запроса не пройдена');
  }
}

function isAdminMutation(request: FastifyRequest): boolean {
  if (SAFE_BROWSER_METHODS.has(request.method.toUpperCase())) {
    return false;
  }

  const path = request.raw.url?.split('?', 1)[0] ?? '';
  return path === '/admin-api' || path.startsWith('/admin-api/');
}
