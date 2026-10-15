import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveActorEmployeeId, type ActorContext } from '../auth/actorContext.js';
import {
  validateTelegramInitData,
  type TelegramInitDataValidation
} from '../auth/telegramInitData.js';
import { ApiError } from '../db/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor?: ActorContext;
  }

  interface FastifyInstance {
    requireActor: (request: FastifyRequest) => Promise<ActorContext>;
    requireTelegramInitData: (request: FastifyRequest) => TelegramInitDataValidation;
  }
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorate('requireTelegramInitData', (request) => {
    const initData = request.headers['x-telegram-init-data'];
    if (typeof initData !== 'string' || initData.length === 0) {
      throw new ApiError(401, 'unauthenticated', 'Telegram init data is required');
    }

    try {
      return validateTelegramInitData(initData, {
        botToken: app.config.TELEGRAM_BOT_TOKEN,
        maxAgeSeconds: app.config.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS
      });
    } catch {
      throw new ApiError(401, 'unauthenticated', 'Telegram init data is invalid');
    }
  });

  app.decorate('requireActor', async (request) => {
    if (request.actor) {
      return request.actor;
    }

    const telegram = app.requireTelegramInitData(request);

    const employeeId = await resolveActorEmployeeId(app.db, telegram.telegramUserId);
    if (!employeeId) {
      throw new ApiError(403, 'forbidden', 'Telegram user is not bound to an active employee');
    }

    request.actor = {
      employeeId,
      telegramUserId: telegram.telegramUserId,
      telegramUsername: telegram.telegramUsername
    };

    return request.actor;
  });
});
