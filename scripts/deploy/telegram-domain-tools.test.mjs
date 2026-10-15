import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTelegramDomain } from './telegram-domain-tools.mjs';

const secrets = {
  botToken: 'test-bot-token',
  webhookSecretToken: 'h'.repeat(32),
  webhookPathSecret: 'p'.repeat(32)
};

test('updates menu and webhook without dropping pending updates', async () => {
  const calls = [];
  const result = await applyTelegramDomain({
    ...secrets,
    publicBaseUrl: 'https://factory.example/peaks/',
    rollbackPublicBaseUrl: 'https://old.factory.example/peaks/',
    fetchImpl: fakeTelegram(calls)
  });

  assert.equal(result.domain, 'factory.example');
  assert.deepEqual(calls.map((call) => call.method), [
    'getMe',
    'setChatMenuButton',
    'setWebhook',
    'getWebhookInfo'
  ]);
  const webhook = calls.find((call) => call.method === 'setWebhook').payload;
  assert.equal(webhook.drop_pending_updates, false);
  assert.equal(webhook.secret_token, secrets.webhookSecretToken);
  assert.match(webhook.url, /^https:\/\/factory\.example\/peaks\/api\/telegram\/bot\/webhook\//);
});

test('restores the old menu if webhook cutover fails', async () => {
  const calls = [];
  await assert.rejects(() => applyTelegramDomain({
    ...secrets,
    publicBaseUrl: 'https://app.customer.example/peaks/',
    rollbackPublicBaseUrl: 'https://old.factory.example/peaks/',
    fetchImpl: fakeTelegram(calls, { failMethod: 'setWebhook' })
  }));

  assert.deepEqual(calls.map((call) => call.method), [
    'getMe',
    'setChatMenuButton',
    'setWebhook',
    'setChatMenuButton'
  ]);
  assert.equal(
    calls.at(-1).payload.menu_button.web_app.url,
    'https://old.factory.example/peaks/'
  );
});

function fakeTelegram(calls, options = {}) {
  let failed = false;
  return async (url, request) => {
    const method = new URL(url).pathname.split('/').at(-1);
    const payload = JSON.parse(request.body);
    calls.push({ method, payload });
    if (method === options.failMethod && !failed) {
      failed = true;
      return { ok: false, json: async () => ({ ok: false }) };
    }
    const result = method === 'getMe'
      ? { id: 1, username: 'factory_bot' }
      : method === 'getWebhookInfo'
        ? {
            url: `https://factory.example/peaks/api/telegram/bot/webhook/${'p'.repeat(32)}`,
            pending_update_count: 0
          }
        : true;
    return { ok: true, json: async () => ({ ok: true, result }) };
  };
}
