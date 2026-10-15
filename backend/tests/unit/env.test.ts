import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertPublicBaseUrl,
  assertRuntimeDatabaseUrl,
  parseRuntimeEnv
} from '../../src/config/env.js';
import { buildTelegramWebhookUrl } from '../../src/config/publicBaseUrl.js';

const requiredEnv = {
  DATABASE_URL: 'postgresql://app_runtime_role@localhost:5432/app',
  APP_ENV: 'production',
  TELEGRAM_BOT_TOKEN: '123:token',
  TELEGRAM_BOT_USERNAME: 'peaks_test_bot',
  TELEGRAM_BOT_WEBHOOK_SECRET_TOKEN: '12345678901234567890123456789012',
  TELEGRAM_BOT_WEBHOOK_PATH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
  TELEGRAM_SELF_BINDING_TOKEN_SECRET: '12345678901234567890123456789012',
  INTERNAL_WORKER_TOKEN: 'worker-token'
} satisfies NodeJS.ProcessEnv;

describe('runtime env', () => {
  it.each([
    'https://factory.example/peaks/',
    'https://app.customer.example/peaks/'
  ])('starts production configuration for %s without changing executable code', (publicBaseUrl) => {
    const env = parseRuntimeEnv({ ...requiredEnv, PUBLIC_BASE_URL: publicBaseUrl });

    expect(env.PUBLIC_BASE_URL).toBe(publicBaseUrl);
    expect(env.PUBLIC_ORIGIN).toBe(new URL(publicBaseUrl).origin);
    expect(env.PUBLIC_HOST).toBe(new URL(publicBaseUrl).host);
  });

  it('normalizes only the missing trailing slash', () => {
    const env = parseRuntimeEnv({
      ...requiredEnv,
      PUBLIC_BASE_URL: 'https://APP.Customer.Example/peaks'
    });

    expect(env.PUBLIC_BASE_URL).toBe('https://app.customer.example/peaks/');
    expect(env.PUBLIC_ORIGIN).toBe('https://app.customer.example');
    expect(env.PUBLIC_HOST).toBe('app.customer.example');
  });

  it('requires PUBLIC_BASE_URL and refuses the retired environment variable', () => {
    expect(() => parseRuntimeEnv(requiredEnv)).toThrow();
    expect(() => parseRuntimeEnv({
      ...requiredEnv,
      PUBLIC_BASE_URL: 'https://app.customer.example/peaks/',
      TELEGRAM_MINI_APP_PUBLIC_URL: 'https://app.customer.example/peaks/'
    })).toThrow('PUBLIC_BASE_URL only');
  });

  it.each([
    ['HTTP', 'http://app.customer.example/peaks/', 'HTTPS'],
    ['localhost', 'https://localhost/peaks/', 'public DNS'],
    ['localhost subdomain', 'https://factory.localhost/peaks/', 'public DNS'],
    ['IPv4', 'https://127.0.0.1/peaks/', 'public DNS'],
    ['IPv6', 'https://[::1]/peaks/', 'public DNS'],
    ['query', 'https://app.customer.example/peaks/?mode=legacy', 'query'],
    ['empty query', 'https://app.customer.example/peaks/?', 'query'],
    ['fragment', 'https://app.customer.example/peaks/#admin', 'fragment'],
    ['empty fragment', 'https://app.customer.example/peaks/#', 'fragment'],
    ['wrong path', 'https://app.customer.example/admin/', '/peaks/'],
    ['credentials', 'https://user:pass@app.customer.example/peaks/', 'credentials'],
    ['non-default port', 'https://app.customer.example:8443/peaks/', 'default HTTPS port'],
    ['single-label host', 'https://factory/peaks/', 'fully-qualified']
  ])('rejects production %s', (_name, publicBaseUrl, message) => {
    expect(() => assertPublicBaseUrl(publicBaseUrl, 'production')).toThrow(message);
  });

  it('accepts app_runtime_role database url and rejects other runtime users', () => {
    const env = parseRuntimeEnv({
      ...requiredEnv,
      PUBLIC_BASE_URL: 'https://app.customer.example/peaks/'
    });

    expect(env.DATABASE_URL).toContain('app_runtime_role');
    expect(() => assertRuntimeDatabaseUrl('postgresql://migration_role@localhost:5432/app')).toThrow(
      'app_runtime_role'
    );
  });

  it('requires the configured Telegram username to be a bot username', () => {
    expect(() => parseRuntimeEnv({
      ...requiredEnv,
      PUBLIC_BASE_URL: 'https://app.customer.example/peaks/',
      TELEGRAM_BOT_USERNAME: 'ordinary_user'
    })).toThrow();
  });

  it('derives an encoded webhook URL below the canonical Mini App base', () => {
    expect(buildTelegramWebhookUrl(
      'https://app.customer.example/peaks/',
      'abcdefghijklmnopqrstuvwxyz123456'
    )).toBe(
      'https://app.customer.example/peaks/api/telegram/bot/webhook/abcdefghijklmnopqrstuvwxyz123456'
    );
  });

  it('keeps .env.example aligned with runtime env validation', () => {
    const exampleEnv = parseEnvExample(readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8'));

    expect(() => parseRuntimeEnv(exampleEnv)).not.toThrow();
  });
});

function parseEnvExample(content: string): NodeJS.ProcessEnv {
  return Object.fromEntries(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');

        if (separatorIndex === -1) {
          return [line, ''];
        }

        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      })
  );
}
