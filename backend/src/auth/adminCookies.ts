import type { FastifyReply, FastifyRequest } from 'fastify';

export const ADMIN_SESSION_COOKIE = 'peaks_admin_session';
export const ADMIN_CSRF_COOKIE = 'peaks_admin_csrf';
export const ADMIN_TELEGRAM_QR_BROWSER_COOKIE = 'peaks_admin_telegram_qr';

type AdminCookieOptions = {
  secure: boolean;
  maxAgeSeconds: number;
};

export function readAdminCookies(request: FastifyRequest): {
  sessionToken: string | null;
  csrfToken: string | null;
} {
  const cookies = parseCookieHeader(request.headers.cookie);
  return {
    sessionToken: cookies.get(ADMIN_SESSION_COOKIE) ?? null,
    csrfToken: cookies.get(ADMIN_CSRF_COOKIE) ?? null
  };
}

export function setAdminAuthCookies(
  reply: FastifyReply,
  sessionToken: string,
  csrfToken: string,
  options: AdminCookieOptions
): void {
  reply.header('set-cookie', [
    serializeCookie(ADMIN_SESSION_COOKIE, sessionToken, {
      ...options,
      httpOnly: true
    }),
    serializeCookie(ADMIN_CSRF_COOKIE, csrfToken, {
      ...options,
      httpOnly: false
    }),
    serializeCookie(ADMIN_TELEGRAM_QR_BROWSER_COOKIE, '', {
      secure: options.secure,
      maxAgeSeconds: 0,
      httpOnly: true,
      path: '/admin-api/auth/telegram-qr/'
    })
  ]);
}

export function readAdminTelegramQrBrowserCookie(request: FastifyRequest): string | null {
  return parseCookieHeader(request.headers.cookie).get(ADMIN_TELEGRAM_QR_BROWSER_COOKIE) ?? null;
}

export function setAdminTelegramQrBrowserCookie(
  reply: FastifyReply,
  browserToken: string,
  options: AdminCookieOptions
): void {
  reply.header('set-cookie', serializeCookie(ADMIN_TELEGRAM_QR_BROWSER_COOKIE, browserToken, {
    ...options,
    httpOnly: true,
    path: '/admin-api/auth/telegram-qr/'
  }));
}

export function clearAdminTelegramQrBrowserCookie(reply: FastifyReply, secure: boolean): void {
  reply.header('set-cookie', serializeCookie(ADMIN_TELEGRAM_QR_BROWSER_COOKIE, '', {
    secure,
    maxAgeSeconds: 0,
    httpOnly: true,
    path: '/admin-api/auth/telegram-qr/'
  }));
}

export function setAdminTelegramQrAuthenticatedCookies(
  reply: FastifyReply,
  sessionToken: string,
  csrfToken: string,
  options: AdminCookieOptions
): void {
  reply.header('set-cookie', [
    serializeCookie(ADMIN_SESSION_COOKIE, sessionToken, {
      ...options,
      httpOnly: true
    }),
    serializeCookie(ADMIN_CSRF_COOKIE, csrfToken, {
      ...options,
      httpOnly: false
    }),
    serializeCookie(ADMIN_TELEGRAM_QR_BROWSER_COOKIE, '', {
      secure: options.secure,
      maxAgeSeconds: 0,
      httpOnly: true,
      path: '/admin-api/auth/telegram-qr/'
    })
  ]);
}

export function clearAdminAuthCookies(reply: FastifyReply, secure: boolean): void {
  reply.header('set-cookie', [
    serializeCookie(ADMIN_SESSION_COOKIE, '', { secure, maxAgeSeconds: 0, httpOnly: true }),
    serializeCookie(ADMIN_CSRF_COOKIE, '', { secure, maxAgeSeconds: 0, httpOnly: false }),
    serializeCookie(ADMIN_TELEGRAM_QR_BROWSER_COOKIE, '', {
      secure,
      maxAgeSeconds: 0,
      httpOnly: true,
      path: '/admin-api/auth/telegram-qr/'
    })
  ]);
}

export function setAdminNoStore(reply: FastifyReply): void {
  reply.header('cache-control', 'no-store');
  reply.header('pragma', 'no-cache');
}

function parseCookieHeader(header: string | undefined): Map<string, string> {
  const result = new Map<string, string>();
  if (!header) {
    return result;
  }

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const encodedValue = part.slice(separatorIndex + 1).trim();
    if (!name || !encodedValue) {
      continue;
    }

    try {
      result.set(name, decodeURIComponent(encodedValue));
    } catch {
      continue;
    }
  }

  return result;
}

function serializeCookie(
  name: string,
  value: string,
  options: AdminCookieOptions & { httpOnly: boolean; path?: string }
): string {
  const attributes = [
    name + '=' + encodeURIComponent(value),
    'Path=' + (options.path ?? '/'),
    'Max-Age=' + options.maxAgeSeconds,
    'SameSite=Strict'
  ];

  if (options.httpOnly) {
    attributes.push('HttpOnly');
  }
  if (options.secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}
