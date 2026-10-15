import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { errorPlugin } from '../../src/plugins/errors.js';
import { publicRequestSecurityPlugin } from '../../src/plugins/publicRequestSecurity.js';

describe('production public request security', () => {
  it('accepts the configured Host and ignores X-Forwarded-Host', async () => {
    const app = await createSecurityApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        host: 'app.customer.example',
        'x-forwarded-host': 'attacker.example'
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('rejects an arbitrary or missing production Host before route handling', async () => {
    const app = await createSecurityApp();
    const wrongHost = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { host: 'attacker.example' }
    });
    const implicitHost = await app.inject({ method: 'GET', url: '/health' });
    await app.close();

    expect(wrongHost.statusCode).toBe(421);
    expect(implicitHost.statusCode).toBe(421);
  });

  it('allows only the exact Origin for every administrative mutation', async () => {
    const app = await createSecurityApp();
    const accepted = await app.inject({
      method: 'POST',
      url: '/admin-api/auth/login',
      headers: {
        host: 'app.customer.example',
        origin: 'https://app.customer.example'
      }
    });
    const rejected = await app.inject({
      method: 'POST',
      url: '/admin-api/auth/login',
      headers: {
        host: 'app.customer.example',
        origin: 'https://attacker.example'
      }
    });
    const missing = await app.inject({
      method: 'DELETE',
      url: '/admin-api/catalog/item',
      headers: { host: 'app.customer.example' }
    });
    await app.close();

    expect(accepted.statusCode).toBe(200);
    expect(rejected.statusCode).toBe(403);
    expect(missing.statusCode).toBe(403);
  });

  it('does not require browser Origin for Telegram or Mini App mutation routes', async () => {
    const app = await createSecurityApp();
    const response = await app.inject({
      method: 'POST',
      url: '/telegram/bot/webhook/path-secret',
      headers: { host: 'app.customer.example' }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
  });
});

async function createSecurityApp() {
  const app = Fastify({ logger: false });
  app.decorate('config', {
    APP_ENV: 'production',
    PUBLIC_HOST: 'app.customer.example',
    PUBLIC_ORIGIN: 'https://app.customer.example'
  } as never);
  await app.register(errorPlugin);
  await app.register(publicRequestSecurityPlugin);
  app.all('*', async () => ({ ok: true }));
  await app.ready();
  return app;
}
