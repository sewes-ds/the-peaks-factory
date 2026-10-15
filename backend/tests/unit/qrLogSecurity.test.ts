import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import {
  createRedactingLogSecurity,
  redactSerializedLogLine
} from '../../src/logging/redactingLogStream.js';
import { errorPlugin } from '../../src/plugins/errors.js';
import { operatorReadModelRoutes } from '../../src/routes/operatorReadModels.js';

describe('QR application log boundary', () => {
  it('redacts Telegram admin start tokens and both challenge hashes', () => {
    const token = randomBytes(32).toString('base64url');
    const confirmationHash = randomBytes(32).toString('hex');
    const browserHash = randomBytes(32).toString('hex');
    const line = JSON.stringify({
      msg: `/start admin_${token}`,
      confirmation_token_hash: confirmationHash,
      browser_token_hash: browserHash
    });
    const redacted = redactSerializedLogLine(line);

    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain(token);
    expect(redacted).not.toContain(confirmationHash);
    expect(redacted).not.toContain(browserHash);
  });

  it.each([
    ['machine', '/operator/machines/resolve-qr', 'peaks-machine:v1:', 'MACHINE_QR_NOT_FOUND'],
    ['SKU', '/operator/skus/resolve-qr', 'peaks-sku:v1:', 'SKU_QR_NOT_FOUND']
  ])('logs only the fixed %s route and never the protected request payload', async (_label, url, prefix, errorCode) => {
    let output = '';
    const logSecurity = createRedactingLogSecurity({
      write(message) {
        output += message;
      }
    });
    const app = Fastify({
      logger: {
        level: 'info',
        serializers: logSecurity.serializers,
        stream: logSecurity.stream
      }
    });
    const actor: ActorContext = { employeeId: 7n, telegramUserId: 1000n };
    app.decorate('db', {
      query: async () => ({ rows: [] })
    } as unknown as DbPool);
    app.decorate('requireActor', async () => actor);
    app.decorate('requireTelegramInitData', () => ({ telegramUserId: actor.telegramUserId, authDate: new Date() }));
    await app.register(errorPlugin);
    await app.register(operatorReadModelRoutes);

    const token = randomBytes(24).toString('base64url');
    const qrPayload = `${prefix}${token}`;
    const response = await app.inject({
      method: 'POST',
      url,
      payload: { qr_payload: qrPayload }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ found: false, error_code: errorCode });
    expect(output).toContain(url);
    expect(output).not.toContain(qrPayload);
    expect(output).not.toContain(token);
  });
});
