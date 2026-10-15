import { deriveDomain } from './render-peaks-nginx.mjs';

export function buildTelegramWebhookUrl(publicBaseUrl, webhookPathSecret) {
  const domain = deriveDomain(publicBaseUrl);
  if (
    typeof webhookPathSecret !== 'string'
    || webhookPathSecret.length < 32
    || webhookPathSecret.length > 512
    || /[\u0000-\u001f\u007f]/u.test(webhookPathSecret)
  ) {
    throw new Error('Telegram webhook path secret is invalid');
  }

  const normalized = new URL(publicBaseUrl);
  normalized.pathname = '/peaks/';
  return {
    domain,
    normalizedPublicBaseUrl: normalized.toString(),
    webhookUrl: new URL(
      `api/telegram/bot/webhook/${encodeURIComponent(webhookPathSecret)}`,
      normalized
    ).toString()
  };
}
