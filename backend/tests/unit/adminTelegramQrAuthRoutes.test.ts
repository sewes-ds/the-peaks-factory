import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { DbPool } from '../../src/db/pool.js';
import { errorPlugin } from '../../src/plugins/errors.js';
import {
  adminTelegramQrAuthRoutes,
  buildAdminTelegramQrDeepLink
} from '../../src/routes/adminTelegramQrAuth.js';

const productionConfig = {
  APP_ENV: 'production',
  TELEGRAM_BOT_USERNAME: 'peaks_factory_bot',
  PUBLIC_BASE_URL: 'https://app.customer.example/peaks/',
  PUBLIC_ORIGIN: 'https://app.customer.example',
  PUBLIC_HOST: 'app.customer.example'
} as const;

describe('admin Telegram QR auth routes', () => {
  it('builds only the bounded native Telegram bot deep link accepted by the webhook parser', () => {
    const token = 'Q'.repeat(43);
    const deepLink = buildAdminTelegramQrDeepLink('peaks_factory_bot', token);
    expect(deepLink).toBe(`tg://resolve?domain=peaks_factory_bot&start=admin_${token}`);
    expect(deepLink).not.toContain('https://t.me');
    expect(() => buildAdminTelegramQrDeepLink('ordinary_user', token)).toThrow();
    expect(() => buildAdminTelegramQrDeepLink('peaks_factory_bot', token.slice(1))).toThrow();
  });

  it('creates an independent browser proof and returns only a rendered QR challenge', async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = Fastify({ logger: false });
    app.decorate('config', productionConfig as never);
    app.decorate('db', {
      query: async (sql: string, params: readonly unknown[]) => {
        calls.push({ sql, params });
        return {
          rows: [{
            result: {
              challenge_id: '41',
              expires_at: '2026-08-30T12:02:00.000Z'
            }
          }]
        };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminTelegramQrAuthRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/auth/telegram-qr/challenge',
      headers: {
        origin: 'https://app.customer.example',
        'x-real-ip': '203.0.113.10',
        'user-agent': 'admin-qr-route-test'
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toMatchObject({
      challenge: {
        challenge_id: '41',
        expires_at: '2026-08-30T12:02:00.000Z',
        poll_after_ms: 1500,
        qr_image_src: expect.stringMatching(/^data:image\/svg\+xml;base64,/)
      }
    });
    expect(response.body).not.toContain('admin_');
    expect(response.body).not.toContain('peaks_factory_bot');
    expect(String(response.headers['set-cookie'])).toMatch(
      /peaks_admin_telegram_qr=[A-Za-z0-9_-]{43}/
    );
    expect(String(response.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(response.headers['set-cookie'])).toContain('SameSite=Strict');
    expect(String(response.headers['set-cookie'])).toContain('Secure');
    expect(String(response.headers['set-cookie'])).toContain('Path=/admin-api/auth/telegram-qr/');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('create_admin_telegram_qr_challenge');
    expect(calls[0]?.params[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0]?.params[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0]?.params[0]).not.toBe(calls[0]?.params[1]);
    expect(calls[0]?.params.slice(2)).toEqual(['203.0.113.10', 'admin-qr-route-test']);
  });

  it('atomically promotes an authenticated claim to the common admin cookies', async () => {
    const browserToken = 'B'.repeat(43);
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = Fastify({ logger: false });
    app.decorate('config', productionConfig as never);
    app.decorate('db', {
      query: async (sql: string, params: readonly unknown[]) => {
        calls.push({ sql, params });
        return {
          rows: [{
            result: {
              status: 'AUTHENTICATED',
              session_id: '51',
              employee_id: '7',
              full_name: 'Иванов Иван Иванович',
              role_name: 'Директор',
              auth_method: 'TELEGRAM_QR',
              must_change_password: false,
              created_at: '2026-08-30T12:00:00.000Z',
              idle_expires_at: '2026-08-30T12:30:00.000Z',
              expires_at: '2026-08-30T20:00:00.000Z'
            }
          }]
        };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminTelegramQrAuthRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/auth/telegram-qr/challenge/41/claim',
      headers: {
        origin: 'https://app.customer.example',
        cookie: `peaks_admin_telegram_qr=${browserToken}`,
        'x-real-ip': '203.0.113.10'
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'AUTHENTICATED',
      session: {
        session_id: '51',
        employee_id: '7',
        full_name: 'Иванов Иван Иванович',
        role_name: 'Директор',
        auth_method: 'TELEGRAM_QR',
        must_change_password: false,
        created_at: '2026-08-30T12:00:00.000Z',
        idle_expires_at: '2026-08-30T12:30:00.000Z',
        expires_at: '2026-08-30T20:00:00.000Z'
      }
    });
    const setCookie = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie'].join('\n')
      : String(response.headers['set-cookie']);
    expect(setCookie).toContain('peaks_admin_session=');
    expect(setCookie).toContain('peaks_admin_csrf=');
    expect(setCookie).toContain('peaks_admin_telegram_qr=;');
    expect(calls[0]?.sql).toContain('claim_admin_telegram_qr_challenge');
    expect(calls[0]?.params[0]).toBe('41');
    expect(calls[0]?.params[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0]?.params[2]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0]?.params[3]).toMatch(/^[a-f0-9]{64}$/);
    expect(response.body).not.toContain(String(calls[0]?.params[1]));
    expect(response.body).not.toContain(String(calls[0]?.params[2]));
  });

  it('keeps a pending challenge anonymous', async () => {
    let queryCount = 0;
    const app = Fastify({ logger: false });
    app.decorate('config', productionConfig as never);
    app.decorate('db', {
      query: async () => {
        queryCount += 1;
        return { rows: [{ result: { status: 'PENDING' } }] };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminTelegramQrAuthRoutes);

    const pending = await app.inject({
      method: 'POST',
      url: '/admin-api/auth/telegram-qr/challenge/41/claim',
      headers: {
        origin: 'https://app.customer.example',
        cookie: `peaks_admin_telegram_qr=${'C'.repeat(43)}`
      }
    });
    await app.close();

    expect(pending.statusCode).toBe(200);
    expect(pending.json()).toEqual({ status: 'PENDING' });
    expect(pending.headers['set-cookie']).toBeUndefined();
    expect(queryCount).toBe(1);
  });
});
