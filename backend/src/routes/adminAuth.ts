import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  clearAdminAuthCookies,
  setAdminAuthCookies,
  setAdminNoStore
} from '../auth/adminCookies.js';
import {
  createAdminOpaqueToken,
  hashAdminOpaqueToken,
  hashAdminPassword,
  normalizeAdminLogin,
  validateNewAdminPassword,
  verifyAdminPassword
} from '../auth/adminPassword.js';
import { ApiError } from '../db/errors.js';
import {
  changeAdminPassword,
  readAdminDirectory,
  readAdminOverview,
  readAdminPasswordCredential,
  readAdminPasswordCredentialForSession,
  recordAdminPasswordFailure,
  revokeAdminSession,
  startAdminPasswordSession,
  type AdminSession
} from '../services/adminAuth.js';

const loginSchema = z.object({
  login: z.string().max(64),
  password: z.string().max(128)
}).strict();

const passwordChangeSchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: z.string().min(1).max(128)
}).strict();

const ADMIN_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;
const GENERIC_LOGIN_ERROR = 'Неверный логин или пароль';

export const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  const dummyPasswordHash = await hashAdminPassword('Timing-pad-only-credential-2026!');

  app.post('/admin-api/auth/login', async (request, reply) => {
    setAdminNoStore(reply);
    const parsed = loginSchema.safeParse(request.body);
    const loginName = parsed.success ? normalizeAdminLogin(parsed.data.login) : null;
    const suppliedPassword = parsed.success ? parsed.data.password : '';
    const credential = loginName
      ? await readAdminPasswordCredential(app.db, loginName)
      : null;
    const passwordMatches = await verifyAdminPassword(
      suppliedPassword,
      credential?.password_hash ?? dummyPasswordHash
    );
    const locked = credential?.locked_until
      ? new Date(credential.locked_until).getTime() > Date.now()
      : false;

    if (
      !parsed.success
      || !loginName
      || !credential
      || !credential.is_active
      || locked
      || !passwordMatches
    ) {
      if (credential?.is_active && !locked && !passwordMatches) {
        await recordAdminPasswordFailure(app.db, credential.credential_id);
      }
      throw new ApiError(401, 'unauthenticated', GENERIC_LOGIN_ERROR);
    }

    const sessionToken = createAdminOpaqueToken();
    const csrfToken = createAdminOpaqueToken();
    let session: AdminSession;
    try {
      session = await startAdminPasswordSession(app.db, {
        credentialId: credential.credential_id,
        sessionTokenHash: hashAdminOpaqueToken(sessionToken),
        csrfTokenHash: hashAdminOpaqueToken(csrfToken),
        createdIp: request.ip || null,
        userAgent: normalizeUserAgent(request.headers['user-agent'])
      });
    } catch {
      throw new ApiError(401, 'unauthenticated', GENERIC_LOGIN_ERROR);
    }

    setAdminAuthCookies(reply, sessionToken, csrfToken, {
      secure: app.config.APP_ENV === 'production',
      maxAgeSeconds: ADMIN_COOKIE_MAX_AGE_SECONDS
    });

    return { session: toPublicSession(session) };
  });

  app.get('/admin-api/auth/session', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { allowPasswordChangeRequired: true });
    return { session: toPublicSession(actor) };
  });

  app.post('/admin-api/auth/change-password', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, {
      mutation: true,
      allowPasswordChangeRequired: true
    });
    const parsed = passwordChangeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiError(400, 'bad_request', 'Проверьте заполнение полей пароля');
    }

    const credential = await readAdminPasswordCredentialForSession(app.db, actor.sessionTokenHash);
    if (!credential || !await verifyAdminPassword(parsed.data.current_password, credential.password_hash)) {
      throw new ApiError(401, 'unauthenticated', 'Текущий пароль неверен');
    }
    const validationError = validateNewAdminPassword(
      parsed.data.new_password,
      credential.login_name
    );
    if (validationError) {
      throw new ApiError(400, 'bad_request', validationError);
    }
    if (await verifyAdminPassword(parsed.data.new_password, credential.password_hash)) {
      throw new ApiError(400, 'bad_request', 'Новый пароль должен отличаться от текущего');
    }

    const newPasswordHash = await hashAdminPassword(parsed.data.new_password);
    await changeAdminPassword(app.db, actor.sessionTokenHash, newPasswordHash);

    return {
      session: toPublicSession({
        ...actor,
        must_change_password: false
      })
    };
  });

  app.post('/admin-api/auth/logout', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, {
      mutation: true,
      allowPasswordChangeRequired: true
    });
    await revokeAdminSession(app.db, actor.sessionTokenHash, 'USER_LOGOUT');
    clearAdminAuthCookies(reply, app.config.APP_ENV === 'production');
    return { status: 'LOGGED_OUT' };
  });

  app.get('/admin-api/overview', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request);
    return {
      overview: await readAdminOverview(app.db, actor.sessionTokenHash)
    };
  });

  app.get('/admin-api/directory', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request);
    return {
      directory: await readAdminDirectory(app.db, actor.sessionTokenHash)
    };
  });
};

function normalizeUserAgent(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 512) : null;
}

function toPublicSession(session: AdminSession | (AdminSession & { sessionTokenHash?: string })) {
  return {
    session_id: session.session_id,
    employee_id: session.employee_id,
    full_name: session.full_name,
    role_name: session.role_name,
    auth_method: session.auth_method,
    must_change_password: session.must_change_password,
    created_at: session.created_at,
    last_seen_at: session.last_seen_at,
    idle_expires_at: session.idle_expires_at,
    expires_at: session.expires_at
  };
}
