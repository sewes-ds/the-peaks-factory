import { buildTelegramWebhookUrl } from './telegram-public-url.mjs';

export async function inspectTelegramDomain({
  botToken,
  fetchImpl = globalThis.fetch
}) {
  assertSecret(botToken, 'Telegram bot token');
  const bot = await callTelegram(fetchImpl, botToken, 'getMe', {});
  const webhook = await callTelegram(fetchImpl, botToken, 'getWebhookInfo', {});
  return {
    botId: bot.id,
    botUsername: typeof bot.username === 'string' ? bot.username : null,
    webhookConfigured: typeof webhook.url === 'string' && webhook.url.length > 0,
    pendingUpdateCount: Number.isSafeInteger(webhook.pending_update_count)
      ? webhook.pending_update_count
      : null,
    lastErrorPresent: typeof webhook.last_error_message === 'string'
      && webhook.last_error_message.length > 0
  };
}

export async function applyTelegramDomain({
  botToken,
  webhookSecretToken,
  webhookPathSecret,
  publicBaseUrl,
  rollbackPublicBaseUrl,
  fetchImpl = globalThis.fetch
}) {
  assertSecret(botToken, 'Telegram bot token');
  assertSecret(webhookSecretToken, 'Telegram webhook header secret', 32);
  assertSecret(webhookPathSecret, 'Telegram webhook path secret', 32);
  const target = domainConfiguration(publicBaseUrl, webhookPathSecret);
  const rollback = domainConfiguration(rollbackPublicBaseUrl, webhookPathSecret);

  await callTelegram(fetchImpl, botToken, 'getMe', {});
  let menuChanged = false;
  let webhookChanged = false;
  try {
    await setMenuButton(fetchImpl, botToken, target.publicBaseUrl);
    menuChanged = true;
    await setWebhook(
      fetchImpl,
      botToken,
      target.webhookUrl,
      webhookSecretToken
    );
    webhookChanged = true;

    const status = await callTelegram(fetchImpl, botToken, 'getWebhookInfo', {});
    if (status.url !== target.webhookUrl) {
      throw new Error('Telegram did not retain the requested webhook URL');
    }
    return {
      domain: target.domain,
      pendingUpdateCount: Number.isSafeInteger(status.pending_update_count)
        ? status.pending_update_count
        : null,
      lastErrorPresent: typeof status.last_error_message === 'string'
        && status.last_error_message.length > 0
    };
  } catch (error) {
    const rollbackFailures = [];
    if (webhookChanged) {
      try {
        await setWebhook(fetchImpl, botToken, rollback.webhookUrl, webhookSecretToken);
      } catch {
        rollbackFailures.push('webhook');
      }
    }
    if (menuChanged) {
      try {
        await setMenuButton(fetchImpl, botToken, rollback.publicBaseUrl);
      } catch {
        rollbackFailures.push('menu');
      }
    }
    if (rollbackFailures.length > 0) {
      throw new Error(`Telegram domain change failed and automatic rollback failed for: ${rollbackFailures.join(', ')}`);
    }
    throw error;
  }
}

function domainConfiguration(publicBaseUrl, webhookPathSecret) {
  const { domain, normalizedPublicBaseUrl, webhookUrl } = buildTelegramWebhookUrl(
    publicBaseUrl,
    webhookPathSecret
  );
  return {
    domain,
    publicBaseUrl: normalizedPublicBaseUrl,
    webhookUrl
  };
}

async function setMenuButton(fetchImpl, botToken, publicBaseUrl) {
  await callTelegram(fetchImpl, botToken, 'setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Открыть приложение',
      web_app: { url: publicBaseUrl }
    }
  });
}

async function setWebhook(fetchImpl, botToken, webhookUrl, webhookSecretToken) {
  await callTelegram(fetchImpl, botToken, 'setWebhook', {
    url: webhookUrl,
    secret_token: webhookSecretToken,
    drop_pending_updates: false
  });
}

async function callTelegram(fetchImpl, botToken, method, payload) {
  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Telegram ${method} request failed`);
  const body = await response.json();
  if (body?.ok !== true) throw new Error(`Telegram ${method} rejected the request`);
  return body.result;
}

function assertSecret(value, description, minimumLength = 1) {
  if (
    typeof value !== 'string'
    || value.length < minimumLength
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`${description} is required and invalid`);
  }
}
