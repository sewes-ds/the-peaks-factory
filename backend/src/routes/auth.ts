import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resolveTelegramActorLookup } from '../auth/actorContext.js';
import { createSelfBindingToken, verifySelfBindingToken } from '../auth/selfBindingToken.js';
import { ApiError } from '../db/errors.js';
import {
  confirmEmployeeTelegramSelfBinding,
  finalizeTelegramContactProof,
  identifyEmployeeForTelegramSelfBindingWithProof
} from '../services/authSelfBinding.js';

const identifyBodySchema = z.object({}).strict();

const confirmBodySchema = z
  .object({
    confirmation_token: z.string().min(1)
  })
  .strict();

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/auth/me', async (request) => {
    const telegram = app.requireTelegramInitData(request);
    const actorLookup = await resolveTelegramActorLookup(app.db, telegram.telegramUserId);

    if (actorLookup.status === 'PHONE_BINDING_REQUIRED') {
      return {
        status: 'PHONE_BINDING_REQUIRED'
      };
    }

    if (actorLookup.status === 'FORBIDDEN') {
      throw new ApiError(403, 'forbidden', 'Telegram user is not allowed to login');
    }

    request.actor = {
      employeeId: actorLookup.employeeId,
      telegramUserId: telegram.telegramUserId,
      telegramUsername: telegram.telegramUsername
    };

    return toAuthenticatedResponse(request.actor);
  });

  app.post('/auth/telegram/self-binding/identify-by-phone', async (request) => {
    const telegram = app.requireTelegramInitData(request);
    parseAuthRequestBody(identifyBodySchema, request.body ?? {});

    const identifyResult = await identifyEmployeeForTelegramSelfBindingWithProof(app.db, telegram.telegramUserId);

    if (identifyResult.status !== 'CONFIRM_EMPLOYEE') {
      return {
        status: identifyResult.status
      };
    }

    return {
      status: 'CONFIRM_EMPLOYEE',
      full_name: identifyResult.full_name,
      confirmation_token: createSelfBindingToken({
        telegramContactProofId: identifyResult.telegram_contact_proof_id,
        employeeId: identifyResult.employee_id,
        telegramUserId: telegram.telegramUserId,
        phoneE164: identifyResult.phone_e164,
        secret: app.config.TELEGRAM_SELF_BINDING_TOKEN_SECRET,
        ttlSeconds: app.config.TELEGRAM_SELF_BINDING_TOKEN_TTL_SECONDS
      })
    };
  });

  app.post('/auth/telegram/self-binding/confirm', async (request) => {
    const telegram = app.requireTelegramInitData(request);
    const body = parseAuthRequestBody(confirmBodySchema, request.body);
    const tokenResult = verifySelfBindingToken({
      token: body.confirmation_token,
      telegramUserId: telegram.telegramUserId,
      secret: app.config.TELEGRAM_SELF_BINDING_TOKEN_SECRET
    });

    if (tokenResult.status !== 'VALID') {
      return {
        status: tokenResult.status
      };
    }

    const finalizeResult = await finalizeContactProofBeforeConfirm(app, tokenResult.payload.telegram_contact_proof_id, telegram.telegramUserId);

    if (finalizeResult.status !== 'FINALIZED') {
      return {
        status: 'BINDING_STATE_CHANGED'
      };
    }

    const confirmResult = await confirmEmployeeTelegramSelfBinding(
      app.db,
      tokenResult.payload.employee_id,
      tokenResult.payload.phone_e164,
      telegram.telegramUserId,
      telegram.telegramUsername
    );

    if (confirmResult.status !== 'BOUND') {
      return {
        status: confirmResult.status
      };
    }

    return toAuthenticatedResponse({
      employeeId: BigInt(tokenResult.payload.employee_id),
      telegramUserId: telegram.telegramUserId,
      telegramUsername: telegram.telegramUsername
    });
  });
};

function toAuthenticatedResponse(actor: {
  employeeId: bigint;
  telegramUserId: bigint;
  telegramUsername?: string;
}) {
  return {
    status: 'AUTHENTICATED',
    actor_employee_id: actor.employeeId.toString(),
    telegram_user_id: actor.telegramUserId.toString(),
    telegram_username: actor.telegramUsername ?? null
  };
}

function parseAuthRequestBody<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid auth request');
  }

  return result.data;
}

async function finalizeContactProofBeforeConfirm(
  app: { db: Parameters<typeof finalizeTelegramContactProof>[0] },
  telegramContactProofId: string,
  telegramUserId: bigint
): Promise<{ status: 'FINALIZED' | 'FAILED' }> {
  try {
    await finalizeTelegramContactProof(app.db, telegramContactProofId, telegramUserId);
    return { status: 'FINALIZED' };
  } catch {
    return { status: 'FAILED' };
  }
}
