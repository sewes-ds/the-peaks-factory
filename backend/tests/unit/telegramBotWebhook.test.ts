import { describe, expect, it } from 'vitest';
import {
  parseAdminTelegramQrStartToken,
  telegramBotRoutes
} from '../../src/routes/telegramBot.js';
import { ApiError } from '../../src/db/errors.js';
import type { DbPool } from '../../src/db/pool.js';

type Handler = (request: {
  params?: unknown;
  headers: Record<string, string | undefined>;
  body?: unknown;
}) => Promise<unknown>;

async function registerTelegramBotHandler(dbQuery: (sql?: unknown, params?: unknown[]) => Promise<{ rows: unknown[] }>) {
  const handlers = new Map<string, Handler>();
  const app = {
    config: {
      TELEGRAM_BOT_WEBHOOK_SECRET_TOKEN: '12345678901234567890123456789012',
      TELEGRAM_BOT_WEBHOOK_PATH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
      PUBLIC_BASE_URL: 'https://app.customer.example/peaks/'
    },
    db: {
      query: dbQuery
    } as unknown as DbPool,
    post: (path: string, handler: Handler) => {
      handlers.set(`POST ${path}`, handler);
    }
  };

  await telegramBotRoutes(app as never, {});
  return handlers.get('POST /telegram/bot/webhook/:path_secret') as Handler;
}

const validRequest = {
  params: { path_secret: 'abcdefghijklmnopqrstuvwxyz123456' },
  headers: {
    'x-telegram-bot-api-secret-token': '12345678901234567890123456789012'
  },
  body: {
    update_id: 555,
    message: {
      message_id: 44,
      chat: { type: 'private' },
      from: { id: 777, username: 'worker' },
      contact: { phone_number: '998 90 123-45-67', user_id: 777 }
    }
  }
};

function demoRequest(overrides: Record<string, unknown> = {}) {
  return {
    params: validRequest.params,
    headers: validRequest.headers,
    body: {
      update_id: 556,
      message: {
        message_id: 45,
        chat: { type: 'private' },
        from: { id: 777, username: 'worker' },
        text: '/demo',
        ...overrides
      }
    }
  };
}

function adminQrRequest(token: string, overrides: Record<string, unknown> = {}) {
  return demoRequest({
    text: `/start admin_${token}`,
    ...overrides
  });
}

function roleAwareDb(section: 'section02' | 'section03' | 'section04') {
  const queries: string[] = [];
  const query = async (sqlValue?: unknown) => {
    const sql = String(sqlValue);
    queries.push(sql);
    if (sql.includes('where e.telegram_user_id = $1')) return { rows: [{ employee_id: '42' }] };
    if (sql.includes('can_manage_production')) {
      return section === 'section03'
        ? { rows: [{ manager_employee_id: '42', manager_full_name: 'Manager' }] }
        : { rows: [] };
    }
    if (sql.includes('join app.positions')) {
      if (section === 'section04') return { rows: [{ code: 'director', name: '', display_name: '' }] };
      return { rows: [{ code: section === 'section03' ? 'production_manager' : 'operator', name: '', display_name: '' }] };
    }
    if (sql.includes('join app.roles')) return { rows: [] };
    return { rows: [] };
  };
  return { query, queries };
}

describe('telegram bot webhook route', () => {
  it('confirms a bounded private admin QR start token without returning protected material', async () => {
    const token = 'Q'.repeat(43);
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const handler = await registerTelegramBotHandler(async (sql, params = []) => {
      calls.push({ sql: String(sql), params });
      return { rows: [{ result: { status: 'CONFIRMED' } }] };
    });

    const response = await handler(adminQrRequest(token));
    const serialized = JSON.stringify(response);

    expect(response).toEqual({
      method: 'sendMessage',
      chat_id: 777,
      text: 'Вход подтвержден. Вернитесь в браузер — административная панель откроется автоматически.'
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain('confirm_admin_telegram_qr_challenge');
    expect(calls[0]?.params[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0]?.params[0]).not.toBe(token);
    expect(calls[0]?.params[1]).toBe(777n);
    expect(serialized).not.toContain(token);
  });

  it('returns safe QR outcomes and ignores group or malformed start payloads', async () => {
    const token = 'R'.repeat(43);
    let queryCount = 0;
    const handler = await registerTelegramBotHandler(async () => {
      queryCount += 1;
      return { rows: [{ result: { status: 'NOT_BOUND' } }] };
    });

    await expect(handler(adminQrRequest(token))).resolves.toEqual({
      method: 'sendMessage',
      chat_id: 777,
      text: 'Telegram-учётная запись не привязана к активному сотруднику. Обратитесь к администратору системы.'
    });
    await expect(handler(adminQrRequest(token, { chat: { type: 'group' } }))).resolves.toEqual({
      ok: true,
      ignored: true
    });
    await expect(handler(adminQrRequest(token.slice(1)))).resolves.toEqual({ ok: true, ignored: true });
    expect(queryCount).toBe(1);
  });

  it('parses only the exact Telegram admin QR deep-link command', () => {
    const token = 'S'.repeat(43);
    expect(parseAdminTelegramQrStartToken(`/start admin_${token}`)).toBe(token);
    expect(parseAdminTelegramQrStartToken(`/start@peaks_factory_bot admin_${token}`)).toBe(token);
    expect(parseAdminTelegramQrStartToken(`/start admin_${token}extra`)).toBeNull();
    expect(parseAdminTelegramQrStartToken(`/start other_${token}`)).toBeNull();
  });

  it('returns one native web_app button for a private operator /demo command', async () => {
    const db = roleAwareDb('section02');
    const handler = await registerTelegramBotHandler(db.query);

    await expect(handler(demoRequest())).resolves.toEqual({
      method: 'sendMessage',
      chat_id: 777,
      text: 'Тестовый вход готов. Откройте кабинет оператора.',
      reply_markup: {
        inline_keyboard: [[{
          text: 'Открыть Раздел 02',
          web_app: { url: 'https://app.customer.example/peaks/' }
        }]]
      }
    });
    expect(db.queries.some((sql) => sql.includes('where e.telegram_user_id = $1'))).toBe(true);
  });

  it('recognizes /demo@bot_username and returns only the manager base-URL button', async () => {
    const db = roleAwareDb('section03');
    const handler = await registerTelegramBotHandler(db.query);

    await expect(handler(demoRequest({ text: '/demo@peaks_factory_bot' }))).resolves.toEqual({
      method: 'sendMessage',
      chat_id: 777,
      text: 'Тестовый вход готов. Откройте кабинет начальника производства.',
      reply_markup: {
        inline_keyboard: [[{
          text: 'Открыть Раздел 03',
          web_app: { url: 'https://app.customer.example/peaks/' }
        }]]
      }
    });
  });

  it('returns no button for an unbound or inactive actor', async () => {
    const handler = await registerTelegramBotHandler(async () => ({ rows: [] }));

    await expect(handler(demoRequest())).resolves.toEqual({
      method: 'sendMessage',
      chat_id: 777,
      text: 'Telegram-учётная запись не привязана к активному сотруднику.'
    });
  });

  it('does not substitute Section 04 with a Section 02/03 button', async () => {
    const db = roleAwareDb('section04');
    const handler = await registerTelegramBotHandler(db.query);

    await expect(handler(demoRequest())).resolves.toEqual({
      method: 'sendMessage',
      chat_id: 777,
      text: 'Кабинет директора не входит в текущую демонстрацию.'
    });
  });

  it('ignores group /demo and malformed updates without an actor read', async () => {
    let dbCalled = false;
    const handler = await registerTelegramBotHandler(async () => {
      dbCalled = true;
      return { rows: [] };
    });

    await expect(handler(demoRequest({ chat: { type: 'group' } }))).resolves.toEqual({ ok: true, ignored: true });
    await expect(handler({ ...demoRequest(), body: { update_id: 557, message: { text: '/demo' } } })).resolves.toEqual({ ok: true, ignored: true });
    await expect(handler(demoRequest({ text: '/demonstration' }))).resolves.toEqual({ ok: true, ignored: true });
    expect(dbCalled).toBe(false);
  });

  it('does not leak webhook credentials or private update fields in demo responses', async () => {
    const db = roleAwareDb('section02');
    const handler = await registerTelegramBotHandler(db.query);
    const response = await handler(demoRequest());
    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain(validRequest.headers['x-telegram-bot-api-secret-token']);
    expect(serialized).not.toContain(validRequest.params.path_secret);
    expect(serialized).not.toContain('worker');
    expect(serialized).not.toContain('update_id');
  });

  it('rejects missing or invalid webhook token before recording proof', async () => {
    let dbCalled = false;
    const handler = await registerTelegramBotHandler(async () => {
      dbCalled = true;
      return { rows: [] };
    });

    await expect(
      handler({
        ...validRequest,
        headers: {}
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthenticated'
    } satisfies Partial<ApiError>);
    expect(dbCalled).toBe(false);

    await expect(
      handler({
        ...validRequest,
        headers: {
          'x-telegram-bot-api-secret-token': 'wrong'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthenticated'
    } satisfies Partial<ApiError>);
    expect(dbCalled).toBe(false);

    await expect(
      handler({
        ...validRequest,
        params: { path_secret: 'wrong' }
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthenticated'
    } satisfies Partial<ApiError>);
    expect(dbCalled).toBe(false);
  });

  it('rejects Telegram contact mismatch and missing contact user id', async () => {
    const handler = await registerTelegramBotHandler(async () => ({ rows: [] }));

    await expect(
      handler({
        ...validRequest,
        body: {
          ...validRequest.body,
          message: {
            ...validRequest.body.message,
            contact: { phone_number: '+998901234567', user_id: 778 }
          }
        }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'bad_request'
    } satisfies Partial<ApiError>);

    await expect(
      handler({
        ...validRequest,
        body: {
          ...validRequest.body,
          message: {
            ...validRequest.body.message,
            contact: { phone_number: '+998901234567' }
          }
        }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'bad_request'
    } satisfies Partial<ApiError>);
  });

  it('rejects non-private contact update', async () => {
    const handler = await registerTelegramBotHandler(async () => ({ rows: [] }));

    await expect(
      handler({
        ...validRequest,
        body: {
          ...validRequest.body,
          message: {
            ...validRequest.body.message,
            chat: { type: 'group' }
          }
        }
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'bad_request'
    } satisfies Partial<ApiError>);
  });

  it('records valid Telegram contact proof through runtime function only', async () => {
    const calls: unknown[][] = [];
    const handler = await registerTelegramBotHandler(async (_sql: unknown, params?: unknown[]) => {
      calls.push(params ?? []);
      return { rows: [{ telegram_contact_proof_id: '1001' }] };
    });

    await expect(handler(validRequest)).resolves.toEqual({ ok: true });
    expect(calls).toEqual([['777', '+998901234567', 'worker', '555', '44']]);
  });
});
