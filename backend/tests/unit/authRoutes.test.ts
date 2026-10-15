import { describe, expect, it } from 'vitest';
import { createSelfBindingToken } from '../../src/auth/selfBindingToken.js';
import { authRoutes } from '../../src/routes/auth.js';
import { ApiError } from '../../src/db/errors.js';
import type { DbPool } from '../../src/db/pool.js';

type Handler = (request: { body?: unknown; headers?: Record<string, string>; actor?: unknown }) => Promise<unknown>;
type MockQuery = (sql?: unknown, params?: unknown[]) => Promise<{ rows: unknown[] }>;

async function registerAuthHandlers(options: {
  dbQuery: MockQuery;
  telegramUserId?: bigint;
  telegramUsername?: string;
}) {
  const handlers = new Map<string, Handler>();
  const app = {
    config: {
      TELEGRAM_SELF_BINDING_TOKEN_SECRET: '12345678901234567890123456789012',
      TELEGRAM_SELF_BINDING_TOKEN_TTL_SECONDS: 600
    },
    db: {
      query: options.dbQuery
    } as unknown as DbPool,
    requireTelegramInitData: () => ({
      telegramUserId: options.telegramUserId ?? 777n,
      telegramUsername: options.telegramUsername,
      authDate: new Date()
    }),
    get: (path: string, handler: Handler) => {
      handlers.set(`GET ${path}`, handler);
    },
    post: (path: string, handler: Handler) => {
      handlers.set(`POST ${path}`, handler);
    }
  };

  await authRoutes(app as never, {});
  return handlers;
}

describe('auth routes', () => {
  it('returns AUTHENTICATED from /auth/me for bound active employee', async () => {
    const handlers = await registerAuthHandlers({
      telegramUserId: 777n,
      telegramUsername: 'worker',
      dbQuery: async () => ({
        rows: [{ employee_id: '42', is_active: true, is_active_for_login: true }]
      })
    });

    await expect(handlers.get('GET /auth/me')?.({})).resolves.toEqual({
      status: 'AUTHENTICATED',
      actor_employee_id: '42',
      telegram_user_id: '777',
      telegram_username: 'worker'
    });
  });

  it('returns PHONE_BINDING_REQUIRED from /auth/me for valid unbound Telegram user', async () => {
    const handlers = await registerAuthHandlers({
      dbQuery: async () => ({ rows: [] })
    });

    await expect(handlers.get('GET /auth/me')?.({})).resolves.toEqual({
      status: 'PHONE_BINDING_REQUIRED'
    });
  });

  it('returns forbidden from /auth/me for bound inactive employee', async () => {
    const handlers = await registerAuthHandlers({
      dbQuery: async () => ({
        rows: [{ employee_id: '42', is_active: true, is_active_for_login: false }]
      })
    });

    await expect(handlers.get('GET /auth/me')?.({})).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden'
    } satisfies Partial<ApiError>);
  });

  it('rejects raw Mini App phone body and does not consume proof', async () => {
    let dbCalled = false;
    const handlers = await registerAuthHandlers({
      dbQuery: async () => {
        dbCalled = true;
        return { rows: [] };
      }
    });

    await expect(
      handlers.get('POST /auth/telegram/self-binding/identify-by-phone')?.({
        body: { phone_e164: '+998901234567' }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'bad_request'
    } satisfies Partial<ApiError>);
    expect(dbCalled).toBe(false);
  });

  it('rejects raw Mini App contact body and does not consume proof', async () => {
    let dbCalled = false;
    const handlers = await registerAuthHandlers({
      telegramUserId: 777n,
      dbQuery: async () => {
        dbCalled = true;
        return { rows: [] };
      }
    });

    await expect(
      handlers.get('POST /auth/telegram/self-binding/identify-by-phone')?.({
        body: {
          contact: {
            phone_number: '+998901234567',
            user_id: 777
          }
        }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'bad_request'
    } satisfies Partial<ApiError>);
    expect(dbCalled).toBe(false);
  });

  it('returns CONTACT_PROOF_REQUIRED when identify has no server-side proof', async () => {
    const handlers = await registerAuthHandlers({
      telegramUserId: 777n,
      dbQuery: async (_sql: unknown, params?: unknown[]) => {
        expect(params).toEqual(['777']);
        return {
          rows: [{ status: 'CONTACT_PROOF_REQUIRED', telegram_contact_proof_id: null, phone_e164: null }]
        };
      }
    });

    await expect(
      handlers.get('POST /auth/telegram/self-binding/identify-by-phone')?.({
        body: {}
      })
    ).resolves.toEqual({
      status: 'CONTACT_PROOF_REQUIRED'
    });
  });

  it('uses server-side proof for identify and returns token with proof id', async () => {
    const queries: unknown[][] = [];
    const handlers = await registerAuthHandlers({
      telegramUserId: 777n,
      dbQuery: async (_sql: unknown, params?: unknown[]) => {
        queries.push(params ?? []);
        if (queries.length === 1) {
          return {
            rows: [{ status: 'CONTACT_PROOF_READY', telegram_contact_proof_id: '1001', phone_e164: '+998901234567' }]
          };
        }

        return {
          rows: [{ status: 'CONFIRM_EMPLOYEE', employee_id: '42', full_name: 'Worker One' }]
        };
      }
    });

    const response = await handlers.get('POST /auth/telegram/self-binding/identify-by-phone')?.({
      body: {}
    });

    expect(response).toMatchObject({
      status: 'CONFIRM_EMPLOYEE',
      full_name: 'Worker One'
    });
    expect(typeof (response as { confirmation_token?: unknown }).confirmation_token).toBe('string');
    expect(queries).toEqual([['777'], ['+998901234567', '777']]);
  });

  it('maps invalid confirm token to TOKEN_INVALID without DB write call', async () => {
    let dbCalled = false;
    const handlers = await registerAuthHandlers({
      dbQuery: async () => {
        dbCalled = true;
        return { rows: [] };
      }
    });

    await expect(
      handlers.get('POST /auth/telegram/self-binding/confirm')?.({
        body: { confirmation_token: 'invalid' }
      })
    ).resolves.toEqual({
      status: 'TOKEN_INVALID'
    });
    expect(dbCalled).toBe(false);
  });

  it('maps expired confirm token to TOKEN_EXPIRED without DB write call', async () => {
    const token = createSelfBindingToken({
      telegramContactProofId: '1001',
      employeeId: '42',
      telegramUserId: 777n,
      phoneE164: '+998901234567',
      secret: '12345678901234567890123456789012',
      ttlSeconds: 60,
      now: new Date('2020-01-01T00:00:00.000Z')
    });
    let dbCalled = false;
    const handlers = await registerAuthHandlers({
      dbQuery: async () => {
        dbCalled = true;
        return { rows: [] };
      }
    });

    await expect(
      handlers.get('POST /auth/telegram/self-binding/confirm')?.({
        body: { confirmation_token: token }
      })
    ).resolves.toEqual({
      status: 'TOKEN_EXPIRED'
    });
    expect(dbCalled).toBe(false);
  });

  it('maps mismatched token Telegram user to TOKEN_INVALID without DB write call', async () => {
    const token = createSelfBindingToken({
      telegramContactProofId: '1001',
      employeeId: '42',
      telegramUserId: 778n,
      phoneE164: '+998901234567',
      secret: '12345678901234567890123456789012',
      ttlSeconds: 600
    });
    let dbCalled = false;
    const handlers = await registerAuthHandlers({
      telegramUserId: 777n,
      dbQuery: async () => {
        dbCalled = true;
        return { rows: [] };
      }
    });

    await expect(
      handlers.get('POST /auth/telegram/self-binding/confirm')?.({
        body: { confirmation_token: token }
      })
    ).resolves.toEqual({
      status: 'TOKEN_INVALID'
    });
    expect(dbCalled).toBe(false);
  });

  it('runs finalizer before binding confirm for successful binding', async () => {
    const token = createSelfBindingToken({
      telegramContactProofId: '1001',
      employeeId: '42',
      telegramUserId: 777n,
      phoneE164: '+998901234567',
      secret: '12345678901234567890123456789012',
      ttlSeconds: 600
    });
    const calls: unknown[][] = [];
    const handlers = await registerAuthHandlers({
      telegramUserId: 777n,
      telegramUsername: 'worker',
      dbQuery: async (_sql: unknown, params?: unknown[]) => {
        calls.push(params ?? []);
        if (calls.length === 1) {
          return { rows: [{ telegram_contact_proof_id: '1001' }] };
        }

        return { rows: [{ status: 'BOUND', employee_id: '42' }] };
      }
    });

    await expect(
      handlers.get('POST /auth/telegram/self-binding/confirm')?.({
        body: { confirmation_token: token }
      })
    ).resolves.toEqual({
      status: 'AUTHENTICATED',
      actor_employee_id: '42',
      telegram_user_id: '777',
      telegram_username: 'worker'
    });
    expect(calls).toEqual([
      ['1001', '777'],
      ['42', '+998901234567', '777', 'worker']
    ]);
  });

  it('blocks binding confirm when finalizer fails', async () => {
    const token = createSelfBindingToken({
      telegramContactProofId: '1001',
      employeeId: '42',
      telegramUserId: 777n,
      phoneE164: '+998901234567',
      secret: '12345678901234567890123456789012',
      ttlSeconds: 600
    });
    const calls: unknown[][] = [];
    const handlers = await registerAuthHandlers({
      telegramUserId: 777n,
      telegramUsername: 'worker',
      dbQuery: async (_sql: unknown, params?: unknown[]) => {
        calls.push(params ?? []);
        throw new ApiError(409, 'conflict', 'proof finalizer failed');
      }
    });

    await expect(
      handlers.get('POST /auth/telegram/self-binding/confirm')?.({
        body: { confirmation_token: token }
      })
    ).resolves.toEqual({
      status: 'BINDING_STATE_CHANGED'
    });
    expect(calls).toEqual([['1001', '777']]);
  });
});
