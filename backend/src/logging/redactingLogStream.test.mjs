import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../db/errors.ts';
import { errorPlugin } from '../plugins/errors.ts';
import { authRoutes } from '../routes/auth.ts';
import { createRedactingLogSecurity, redactSerializedLogLine } from './redactingLogStream.ts';

function createSentinels() {
  const suffix = randomBytes(12).toString('hex');
  return {
    path: `A3_PATH_SECRET_SENTINEL_${suffix}`,
    telegramHeader: `A3_HEADER_SECRET_SENTINEL_${suffix}`,
    initData: `A3_INITDATA_SENTINEL_${suffix}`,
    authorization: `A3_AUTH_SENTINEL_${suffix}`,
    cookie: `A3_COOKIE_SENTINEL_${suffix}`
  };
}

function createCapture() {
  let output = '';
  return {
    destination: {
      write(message) {
        output += message;
      }
    },
    read: () => output
  };
}

describe('application log redaction', () => {
  it('redacts the complete webhook request, response, and error lifecycle', async () => {
    const sentinels = createSentinels();
    const capture = createCapture();
    const logSecurity = createRedactingLogSecurity(capture.destination);
    const app = Fastify({
      logger: {
        level: 'info',
        serializers: logSecurity.serializers,
        stream: logSecurity.stream
      }
    });

    app.post('/telegram/bot/webhook/:path_secret', async (request, reply) => {
      const params = request.params;
      const header = request.headers['x-telegram-bot-api-secret-token'];
      if (params.path_secret !== sentinels.path || header !== sentinels.telegramHeader) {
        return reply.status(401).send({ error: { code: 'unauthenticated', message: 'invalid' } });
      }

      if (request.headers['x-a3-force-error'] === 'yes') {
        const error = new Error(`synthetic failure at ${request.url}`);
        request.log.error(
          {
            err: error,
            headers: request.headers,
            rawHeaders: request.raw.rawHeaders,
            context: { url: request.url, request: { headers: request.headers } }
          },
          `authorization=${sentinels.authorization} cookie=${sentinels.cookie}`
        );
        throw error;
      }

      return { ok: true };
    });

    const headers = {
      'x-telegram-bot-api-secret-token': sentinels.telegramHeader,
      'x-telegram-init-data': sentinels.initData,
      authorization: sentinels.authorization,
      cookie: sentinels.cookie
    };
    const webhookUrl = `/telegram/bot/webhook/${sentinels.path}`;

    const valid = await app.inject({ method: 'POST', url: webhookUrl, headers });
    const invalidHeader = await app.inject({
      method: 'POST',
      url: webhookUrl,
      headers: { ...headers, 'x-telegram-bot-api-secret-token': 'synthetic-invalid' }
    });
    const failed = await app.inject({
      method: 'POST',
      url: webhookUrl,
      headers: { ...headers, 'x-a3-force-error': 'yes' }
    });
    const wrongPath = await app.inject({ method: 'POST', url: '/telegram/bot/not-webhook/safe' });
    await app.close();

    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toEqual({ ok: true });
    expect(invalidHeader.statusCode).toBe(401);
    expect(invalidHeader.json()).toEqual({ error: { code: 'unauthenticated', message: 'invalid' } });
    expect(failed.statusCode).toBe(500);
    expect(wrongPath.statusCode).toBe(404);

    const fullLog = capture.read();
    for (const sentinel of Object.values(sentinels)) {
      expect(fullLog).not.toContain(sentinel);
    }
    expect(fullLog).toContain('/telegram/bot/webhook/[REDACTED]');

    const records = fullLog.trim().split('\n').map((line) => JSON.parse(line));
    const incoming = records.filter((record) => record.msg === 'incoming request');
    const completed = records.filter((record) => record.msg === 'request completed');
    const error = records.find((record) => record.level === 50 && record.err !== undefined);

    expect(incoming.some((record) =>
      record.reqId !== undefined &&
      record.req.method === 'POST' &&
      record.req.url === '/telegram/bot/webhook/[REDACTED]'
    )).toBe(true);
    expect(completed.map((record) => record.res.statusCode)).toEqual(
      expect.arrayContaining([200, 401, 404, 500])
    );
    expect(completed.every((record) => record.reqId !== undefined && typeof record.responseTime === 'number')).toBe(true);
    expect(error).toBeDefined();
    expect(JSON.stringify(error)).toContain('/telegram/bot/webhook/[REDACTED]');
  });

  it('matches sensitive header names case-insensitively throughout a serialized line', () => {
    const sentinels = createSentinels();
    const line = JSON.stringify({
      reqId: 'case-test',
      headers: {
        'x-telegram-init-data': sentinels.initData,
        Authorization: sentinels.authorization,
        COOKIE: sentinels.cookie
      },
      nested: {
        headers: { 'X-Telegram-Bot-Api-Secret-Token': sentinels.telegramHeader },
        password: 'A3_PASSWORD_SENTINEL',
        csrf_token_hash: 'A3_CSRF_HASH_SENTINEL'
      },
      rawHeaders: ['SET-COOKIE', sentinels.cookie],
      msg: `authorization=${sentinels.authorization} cookie=${sentinels.cookie}`
    });

    const redacted = redactSerializedLogLine(line);
    for (const sentinel of Object.values(sentinels)) {
      expect(redacted).not.toContain(sentinel);
    }
    expect(redacted).not.toContain('A3_PASSWORD_SENTINEL');
    expect(redacted).not.toContain('A3_CSRF_HASH_SENTINEL');
    expect(redacted.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it('preserves logging and the URL for an ordinary non-webhook route', async () => {
    const capture = createCapture();
    const logSecurity = createRedactingLogSecurity(capture.destination);
    const app = Fastify({
      logger: {
        level: 'info',
        serializers: logSecurity.serializers,
        stream: logSecurity.stream
      }
    });
    app.get('/diagnostic-visible', async () => ({ ok: true }));

    const response = await app.inject({ method: 'GET', url: '/diagnostic-visible?mode=safe' });
    await app.close();

    expect(response.statusCode).toBe(200);
    const records = capture.read().trim().split('\n').map((line) => JSON.parse(line));
    const incoming = records.find((record) => record.msg === 'incoming request');
    const completed = records.find((record) => record.msg === 'request completed');
    expect(incoming?.req.method).toBe('GET');
    expect(incoming?.req.url).toBe('/diagnostic-visible?mode=safe');
    expect(incoming?.reqId).toBeDefined();
    expect(completed?.res.statusCode).toBe(200);
    expect(completed?.reqId).toBeDefined();
  });

  it('preserves the unauthenticated JSON 401 contract for /auth/me', async () => {
    const app = Fastify({ logger: false });
    app.decorate('config', {});
    app.decorate('db', { query: async () => ({ rows: [] }) });
    app.decorate('requireTelegramInitData', () => {
      throw new ApiError(401, 'unauthenticated', 'Telegram Mini App authentication is required');
    });
    app.decorate('requireActor', async () => {
      throw new ApiError(401, 'unauthenticated', 'Telegram Mini App authentication is required');
    });
    await app.register(errorPlugin);
    await app.register(authRoutes);

    const response = await app.inject({ method: 'GET', url: '/auth/me' });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({
      error: {
        code: 'unauthenticated',
        message: 'Telegram Mini App authentication is required'
      }
    });
  });
});
