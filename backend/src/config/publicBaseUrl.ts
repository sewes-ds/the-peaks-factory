import { isIP } from 'node:net';

export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';

export type PublicUrlConfig = {
  PUBLIC_BASE_URL: string;
  PUBLIC_ORIGIN: string;
  PUBLIC_HOST: string;
};

const MINI_APP_PATH = '/peaks/';
const PRODUCTION_HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function parsePublicBaseUrl(value: string, appEnvironment: AppEnvironment): PublicUrlConfig {
  if (/[\s\u0000-\u001f\u007f\\]/u.test(value)) {
    throw new Error('PUBLIC_BASE_URL must not contain whitespace, controls or backslashes');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('PUBLIC_BASE_URL must be an absolute URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('PUBLIC_BASE_URL must use HTTPS');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('PUBLIC_BASE_URL must not contain credentials');
  }
  if (parsed.search !== '' || value.includes('?')) {
    throw new Error('PUBLIC_BASE_URL must not contain a query');
  }
  if (parsed.hash !== '' || value.includes('#')) {
    throw new Error('PUBLIC_BASE_URL must not contain a fragment');
  }
  if (parsed.pathname !== '/peaks' && parsed.pathname !== MINI_APP_PATH) {
    throw new Error('PUBLIC_BASE_URL path must be /peaks/');
  }

  if (appEnvironment === 'production') {
    assertProductionHostname(parsed.hostname);
    if (parsed.port !== '') {
      throw new Error('PUBLIC_BASE_URL must use the default HTTPS port in production');
    }
  }

  parsed.pathname = MINI_APP_PATH;
  const publicBaseUrl = parsed.toString();

  return Object.freeze({
    PUBLIC_BASE_URL: publicBaseUrl,
    PUBLIC_ORIGIN: parsed.origin,
    PUBLIC_HOST: parsed.host
  });
}

export function buildTelegramWebhookUrl(publicBaseUrl: string, pathSecret: string): string {
  if (pathSecret.length < 32 || pathSecret.length > 512 || /[\u0000-\u001f\u007f]/u.test(pathSecret)) {
    throw new Error('Telegram webhook path secret is invalid');
  }

  const normalizedPublicBaseUrl = parsePublicBaseUrl(publicBaseUrl, 'production').PUBLIC_BASE_URL;
  return new URL(
    `api/telegram/bot/webhook/${encodeURIComponent(pathSecret)}`,
    normalizedPublicBaseUrl
  ).toString();
}

function assertProductionHostname(hostname: string): void {
  const ipCandidate = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.')
    || isIP(ipCandidate) !== 0
  ) {
    throw new Error('PUBLIC_BASE_URL must use a public DNS hostname in production');
  }

  if (hostname.length > 253 || !hostname.includes('.')) {
    throw new Error('PUBLIC_BASE_URL must use a valid fully-qualified DNS hostname in production');
  }

  const labels = hostname.split('.');
  if (labels.some((label) => !PRODUCTION_HOST_LABEL.test(label))) {
    throw new Error('PUBLIC_BASE_URL must use a valid fully-qualified DNS hostname in production');
  }
}
