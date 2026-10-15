import { isIP } from 'node:net';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import QRCode from 'qrcode';
import { z } from 'zod';
import {
  clearAdminTelegramQrBrowserCookie,
  readAdminTelegramQrBrowserCookie,
  setAdminNoStore,
  setAdminTelegramQrAuthenticatedCookies,
  setAdminTelegramQrBrowserCookie
} from '../auth/adminCookies.js';
import { createAdminOpaqueToken, hashAdminOpaqueToken } from '../auth/adminPassword.js';
import {
  claimAdminTelegramQrChallenge,
  createAdminTelegramQrChallenge,
  type AdminSession
} from '../services/adminAuth.js';

const challengeParamsSchema = z.object({
  challenge_id: z.string().regex(/^[1-9][0-9]{0,18}$/)
});

const ADMIN_QR_COOKIE_MAX_AGE_SECONDS = 2 * 60;
const ADMIN_SESSION_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;
const ADMIN_QR_POLL_AFTER_MS = 1_500;
const ADMIN_QR_START_PREFIX = 'admin_';

export const adminTelegramQrAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post('/admin-api/auth/telegram-qr/challenge', async (request, reply) => {
    setAdminNoStore(reply);

    const confirmationToken = createAdminOpaqueToken();
    const browserToken = createAdminOpaqueToken();
    const challenge = await createAdminTelegramQrChallenge(app.db, {
      confirmationTokenHash: hashAdminOpaqueToken(confirmationToken),
      browserTokenHash: hashAdminOpaqueToken(browserToken),
      createdIp: readTrustedClientIp(request),
      userAgent: normalizeUserAgent(request.headers['user-agent'])
    });
    const startPayload = ADMIN_QR_START_PREFIX + confirmationToken;
    const telegramUrl = buildAdminTelegramQrDeepLink(app.config.TELEGRAM_BOT_USERNAME, confirmationToken);
    const qrSvg = await QRCode.toString(telegramUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 288
    });

    setAdminTelegramQrBrowserCookie(reply, browserToken, {
      secure: app.config.APP_ENV === 'production',
      maxAgeSeconds: ADMIN_QR_COOKIE_MAX_AGE_SECONDS
    });

    return {
      challenge: {
        challenge_id: challenge.challenge_id,
        expires_at: challenge.expires_at,
        poll_after_ms: ADMIN_QR_POLL_AFTER_MS,
        qr_image_src: 'data:image/svg+xml;base64,' + Buffer.from(qrSvg, 'utf8').toString('base64')
      }
    };
  });

  app.post('/admin-api/auth/telegram-qr/challenge/:challenge_id/claim', async (request, reply) => {
    setAdminNoStore(reply);
    const params = challengeParamsSchema.safeParse(request.params);
    if (!params.success) {
      return { status: 'UNAVAILABLE' };
    }

    const browserToken = readAdminTelegramQrBrowserCookie(request);
    if (!browserToken || !/^[A-Za-z0-9_-]{43}$/.test(browserToken)) {
      return { status: 'UNAVAILABLE' };
    }

    const sessionToken = createAdminOpaqueToken();
    const csrfToken = createAdminOpaqueToken();
    const result = await claimAdminTelegramQrChallenge(app.db, {
      challengeId: params.data.challenge_id,
      browserTokenHash: hashAdminOpaqueToken(browserToken),
      sessionTokenHash: hashAdminOpaqueToken(sessionToken),
      csrfTokenHash: hashAdminOpaqueToken(csrfToken),
      createdIp: readTrustedClientIp(request),
      userAgent: normalizeUserAgent(request.headers['user-agent'])
    });

    if (result.status !== 'AUTHENTICATED') {
      if (result.status !== 'PENDING') {
        clearAdminTelegramQrBrowserCookie(reply, app.config.APP_ENV === 'production');
      }
      return { status: result.status };
    }

    setAdminTelegramQrAuthenticatedCookies(reply, sessionToken, csrfToken, {
      secure: app.config.APP_ENV === 'production',
      maxAgeSeconds: ADMIN_SESSION_COOKIE_MAX_AGE_SECONDS
    });
    return { status: result.status, session: toPublicSession(result) };
  });
};

export function buildAdminTelegramQrDeepLink(botUsername: string, confirmationToken: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]{1,28}bot$/i.test(botUsername)) {
    throw new Error('Invalid Telegram bot username');
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(confirmationToken)) {
    throw new Error('Invalid admin Telegram QR confirmation token');
  }

  const telegramUrl = new URL('tg://resolve');
  telegramUrl.searchParams.set('domain', botUsername);
  telegramUrl.searchParams.set('start', ADMIN_QR_START_PREFIX + confirmationToken);
  return telegramUrl.toString();
}

function readTrustedClientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers['x-real-ip'];
  if (
    (request.ip === '127.0.0.1' || request.ip === '::1')
    && typeof forwarded === 'string'
    && isIP(forwarded) !== 0
  ) {
    return forwarded;
  }
  return isIP(request.ip) !== 0 ? request.ip : null;
}

function normalizeUserAgent(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 512) : null;
}

function toPublicSession(session: AdminSession) {
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
