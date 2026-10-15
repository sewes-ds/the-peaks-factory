import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateTelegramInitData } from '../../src/auth/telegramInitData.js';

function buildInitData(values: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const params = new URLSearchParams({ ...values, hash });
  return params.toString();
}

describe('Telegram init data validation', () => {
  it('validates signed init data and extracts Telegram user', () => {
    const botToken = '123:token';
    const now = new Date('2026-06-02T12:00:00.000Z');
    const initData = buildInitData(
      {
        auth_date: `${Math.floor(now.getTime() / 1000)}`,
        query_id: 'abc',
        user: JSON.stringify({ id: 123456, username: 'operator' })
      },
      botToken
    );

    const result = validateTelegramInitData(initData, {
      botToken,
      maxAgeSeconds: 60,
      now
    });

    expect(result.telegramUserId).toBe(123456n);
    expect(result.telegramUsername).toBe('operator');
  });

  it('rejects invalid hash', () => {
    expect(() =>
      validateTelegramInitData('auth_date=1&user=%7B%22id%22%3A1%7D&hash=bad', {
        botToken: '123:token',
        maxAgeSeconds: 60,
        now: new Date('2026-06-02T12:00:00.000Z')
      })
    ).toThrow('hash is invalid');
  });

  it('rejects malformed user JSON', () => {
    const botToken = '123:token';
    const now = new Date('2026-06-02T12:00:00.000Z');
    const initData = buildInitData(
      {
        auth_date: `${Math.floor(now.getTime() / 1000)}`,
        user: '{bad-json'
      },
      botToken
    );

    expect(() =>
      validateTelegramInitData(initData, {
        botToken,
        maxAgeSeconds: 60,
        now
      })
    ).toThrow('user is invalid');
  });

  it('rejects missing user', () => {
    const botToken = '123:token';
    const now = new Date('2026-06-02T12:00:00.000Z');
    const initData = buildInitData(
      {
        auth_date: `${Math.floor(now.getTime() / 1000)}`
      },
      botToken
    );

    expect(() =>
      validateTelegramInitData(initData, {
        botToken,
        maxAgeSeconds: 60,
        now
      })
    ).toThrow('user is missing');
  });

  it('rejects invalid user id', () => {
    const botToken = '123:token';
    const now = new Date('2026-06-02T12:00:00.000Z');
    const initData = buildInitData(
      {
        auth_date: `${Math.floor(now.getTime() / 1000)}`,
        user: JSON.stringify({ id: 'not-a-number' })
      },
      botToken
    );

    expect(() =>
      validateTelegramInitData(initData, {
        botToken,
        maxAgeSeconds: 60,
        now
      })
    ).toThrow('user is invalid');
  });

  it('rejects expired init data', () => {
    const botToken = '123:token';
    const initData = buildInitData(
      {
        auth_date: '1',
        user: JSON.stringify({ id: 123456 })
      },
      botToken
    );

    expect(() =>
      validateTelegramInitData(initData, {
        botToken,
        maxAgeSeconds: 60,
        now: new Date('2026-06-02T12:00:00.000Z')
      })
    ).toThrow('expired');
  });
});
