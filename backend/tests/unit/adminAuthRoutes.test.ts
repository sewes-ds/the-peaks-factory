import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { hashAdminPassword } from '../../src/auth/adminPassword.js';
import { errorPlugin } from '../../src/plugins/errors.js';
import { adminAuthRoutes } from '../../src/routes/adminAuth.js';
import type { DbPool } from '../../src/db/pool.js';

const TEST_SCRYPT = {
  cost: 1024,
  blockSize: 8,
  parallelization: 1,
  keyLength: 32,
  maxMemoryBytes: 32 * 1024 * 1024
};

describe('admin auth routes', () => {
  it('creates secure paired cookies without returning credential material', async () => {
    const passwordHash = await hashAdminPassword('Secure-Manager-2026!', TEST_SCRYPT);
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const app = Fastify({ logger: false });
    app.decorate('config', { APP_ENV: 'production' } as never);
    app.decorate('db', {
      query: async (sql: string, params: readonly unknown[]) => {
        calls.push({ sql, params });
        if (sql.includes('read_admin_password_credential(')) {
          return {
            rows: [{
              result: {
                credential_id: '3',
                employee_id: '7',
                password_hash: passwordHash,
                must_change_password: true,
                failed_attempt_count: 0,
                locked_until: null,
                is_active: true
              }
            }]
          };
        }
        if (sql.includes('start_admin_password_session(')) {
          return {
            rows: [{
              result: {
                session_id: '11',
                employee_id: '7',
                full_name: 'Иванов И.И.',
                role_name: 'Директор',
                auth_method: 'PASSWORD',
                must_change_password: true,
                created_at: '2026-08-29T12:00:00.000Z',
                idle_expires_at: '2026-08-29T12:30:00.000Z',
                expires_at: '2026-08-29T20:00:00.000Z'
              }
            }]
          };
        }
        throw new Error('unexpected query');
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminAuthRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/auth/login',
      payload: {
        login: ' Director.One ',
        password: 'Secure-Manager-2026!'
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: {
        session_id: '11',
        employee_id: '7',
        full_name: 'Иванов И.И.',
        role_name: 'Директор',
        auth_method: 'PASSWORD',
        must_change_password: true,
        created_at: '2026-08-29T12:00:00.000Z',
        idle_expires_at: '2026-08-29T12:30:00.000Z',
        expires_at: '2026-08-29T20:00:00.000Z'
      }
    });
    expect(response.body).not.toContain(passwordHash);
    expect(response.headers['cache-control']).toBe('no-store');
    const setCookie = response.headers['set-cookie'];
    const serializedCookies = Array.isArray(setCookie) ? setCookie.join('\n') : String(setCookie);
    expect(serializedCookies).toContain('peaks_admin_session=');
    expect(serializedCookies).toContain('peaks_admin_csrf=');
    expect(serializedCookies).toContain('peaks_admin_telegram_qr=;');
    expect(serializedCookies).toContain('HttpOnly');
    expect(serializedCookies.match(/Secure/g)?.length).toBe(3);
    expect(calls[0]?.params).toEqual(['director.one']);
    expect(calls[1]?.params[0]).toBe('3');
    expect(calls[1]?.params[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[1]?.params[2]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the same external error for an unknown and a malformed login', async () => {
    const app = Fastify({ logger: false });
    app.decorate('config', { APP_ENV: 'test' } as never);
    app.decorate('db', {
      query: async () => ({ rows: [{ result: null }] })
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminAuthRoutes);

    const unknown = await app.inject({
      method: 'POST',
      url: '/admin-api/auth/login',
      payload: { login: 'unknown.user', password: 'Wrong-Password-2026!' }
    });
    const malformed = await app.inject({
      method: 'POST',
      url: '/admin-api/auth/login',
      payload: { login: 123, password: null }
    });
    await app.close();

    expect(unknown.statusCode).toBe(401);
    expect(malformed.statusCode).toBe(401);
    expect(unknown.json()).toEqual(malformed.json());
    expect(unknown.json()).toEqual({
      error: {
        code: 'unauthenticated',
        message: 'Неверный логин или пароль'
      }
    });
  });

  it('loads the safe directory through the resolved administrative session hash', async () => {
    const directory = {
      employees: [],
      positions: [],
      employee_statuses: [],
      machines: [],
      machine_use_statuses: [],
      skus: [],
      sku_units: [],
      additional_work_types: [],
      activity_profiles: [],
      activity_types: [],
      audit_events: []
    };
    const app = Fastify({ logger: false });
    app.decorate('config', { APP_ENV: 'test' } as never);
    app.decorate('requireAdminActor', async () => ({
      session_id: '11',
      employee_id: '7',
      full_name: 'Иванов И.И.',
      role_name: 'Директор',
      auth_method: 'PASSWORD',
      must_change_password: false,
      created_at: '2026-08-29T12:00:00.000Z',
      idle_expires_at: '2026-08-29T12:30:00.000Z',
      expires_at: '2026-08-29T20:00:00.000Z',
      sessionTokenHash: 'a'.repeat(64),
      csrfTokenHash: 'b'.repeat(64)
    }));
    app.decorate('db', {
      query: async (sql: string, params: readonly unknown[]) => {
        expect(sql).toContain('read_admin_directory(');
        expect(params).toEqual(['a'.repeat(64)]);
        return { rows: [{ result: directory }] };
      }
    } as unknown as DbPool);
    await app.register(errorPlugin);
    await app.register(adminAuthRoutes);

    const response = await app.inject({ method: 'GET', url: '/admin-api/directory' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ directory });
  });
});
