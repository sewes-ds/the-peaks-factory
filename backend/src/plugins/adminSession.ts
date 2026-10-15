import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  constantTimeHashMatches,
  hashAdminOpaqueToken
} from '../auth/adminPassword.js';
import { readAdminCookies } from '../auth/adminCookies.js';
import { ApiError } from '../db/errors.js';
import { resolveAdminSession, type AdminSession } from '../services/adminAuth.js';

export type AdminActorContext = Omit<AdminSession, 'csrf_token_hash'> & {
  sessionTokenHash: string;
  csrfTokenHash: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    adminActor?: AdminActorContext;
  }

  interface FastifyInstance {
    requireAdminActor: (
      request: FastifyRequest,
      options?: { mutation?: boolean; allowPasswordChangeRequired?: boolean }
    ) => Promise<AdminActorContext>;
  }
}

export const adminSessionPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorate('requireAdminActor', async (request, options = {}) => {
    if (request.adminActor) {
      assertPasswordState(request.adminActor, options.allowPasswordChangeRequired);
      assertMutationProof(request, request.adminActor.csrfTokenHash, options.mutation);
      return request.adminActor;
    }

    const cookies = readAdminCookies(request);
    if (
      !cookies.sessionToken
      || !cookies.csrfToken
      || !/^[A-Za-z0-9_-]{43}$/.test(cookies.sessionToken)
      || !/^[A-Za-z0-9_-]{43}$/.test(cookies.csrfToken)
    ) {
      throw new ApiError(401, 'unauthenticated', 'Требуется вход в административную панель');
    }

    const sessionTokenHash = hashAdminOpaqueToken(cookies.sessionToken);
    const session = await resolveAdminSession(app.db, sessionTokenHash);
    if (
      !session
      || !session.csrf_token_hash
      || !constantTimeHashMatches(cookies.csrfToken, session.csrf_token_hash)
    ) {
      throw new ApiError(401, 'unauthenticated', 'Сессия недействительна или завершена');
    }

    const { csrf_token_hash: csrfTokenHash, ...publicSession } = session;
    request.adminActor = {
      ...publicSession,
      csrfTokenHash,
      sessionTokenHash
    };

    assertPasswordState(request.adminActor, options.allowPasswordChangeRequired);
    assertMutationProof(request, csrfTokenHash, options.mutation);
    return request.adminActor;
  });
});

function assertPasswordState(actor: AdminActorContext, allowPasswordChangeRequired = false): void {
  if (actor.must_change_password && !allowPasswordChangeRequired) {
    throw new ApiError(
      403,
      'password_change_required',
      'Перед продолжением необходимо изменить временный пароль'
    );
  }
}

function assertMutationProof(
  request: FastifyRequest,
  expectedCsrfHash: string,
  mutation = false
): void {
  if (!mutation) {
    return;
  }

  const csrfHeader = request.headers['x-admin-csrf-token'];
  if (
    typeof csrfHeader !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(csrfHeader)
    || !constantTimeHashMatches(csrfHeader, expectedCsrfHash)
  ) {
    throw new ApiError(403, 'forbidden', 'Проверка безопасности запроса не пройдена');
  }
}
