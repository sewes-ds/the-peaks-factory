import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authPlugin } from '../../src/plugins/auth.js';
import { ApiError } from '../../src/db/errors.js';
import type { DbPool } from '../../src/db/pool.js';

function buildInitData(values: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...values, hash }).toString();
}

async function createRequireActor() {
  const decorators = new Map<string, unknown>();
  const app = {
    config: {
      TELEGRAM_BOT_TOKEN: '123:token',
      TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: 60
    },
    db: {
      query: async () => ({ rows: [{ employee_id: '42' }] })
    } as unknown as DbPool,
    decorate: (name: string, value: unknown) => {
      decorators.set(name, value);
      (app as Record<string, unknown>)[name] = value;
    }
  };

  await authPlugin(app as never, {});
  return decorators.get('requireActor') as (request: { headers: Record<string, string>; actor?: unknown }) => Promise<unknown>;
}

describe('auth plugin', () => {
  it('maps malformed Telegram user JSON to auth failure', async () => {
    const requireActor = await createRequireActor();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const initData = buildInitData({ auth_date: `${nowSeconds}`, user: '{bad-json' }, '123:token');

    await expect(requireActor({ headers: { 'x-telegram-init-data': initData } })).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthenticated',
      message: 'Telegram init data is invalid'
    } satisfies Partial<ApiError>);
  });

  it('maps invalid Telegram user id to auth failure', async () => {
    const requireActor = await createRequireActor();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const initData = buildInitData(
      {
        auth_date: `${nowSeconds}`,
        user: JSON.stringify({ id: 'not-a-number' })
      },
      '123:token'
    );

    await expect(requireActor({ headers: { 'x-telegram-init-data': initData } })).rejects.toMatchObject({
      statusCode: 401,
      code: 'unauthenticated',
      message: 'Telegram init data is invalid'
    } satisfies Partial<ApiError>);
  });
});
