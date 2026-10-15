import QRCode from 'qrcode';
import { ApiError } from '../db/errors.js';
import type { AdminQrLabel } from '../services/adminWebCatalog.js';

const PAYLOAD_PATTERNS = {
  MACHINE: /^peaks-machine:v1:[A-Za-z0-9_-]{32}$/,
  SKU: /^peaks-sku:v1:[A-Za-z0-9_-]{32}$/
} as const;

export async function renderAdminQrLabelSvg(label: AdminQrLabel): Promise<string> {
  if (!PAYLOAD_PATTERNS[label.resource_kind].test(label.payload)) {
    throw new ApiError(500, 'database_error', 'Не удалось подготовить QR-ярлык');
  }
  const qrSvg = await renderQrCode(label.payload);
  return composeAdminQrLabelSvg(label, qrSvg);
}

export function composeAdminQrLabelSvg(label: Omit<AdminQrLabel, 'payload'>, qrSvg: string): string {
  const match = /<svg\b[^>]*\bviewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>\s*$/u.exec(qrSvg);
  if (!match?.[1] || !match[2]) {
    throw new ApiError(500, 'database_error', 'Не удалось сформировать QR-ярлык');
  }

  const title = escapeXml(shorten(label.title, 42));
  const subtitle = label.subtitle && label.subtitle !== label.title
    ? escapeXml(shorten(label.subtitle, 54))
    : null;
  const kindLabel = label.resource_kind === 'MACHINE' ? 'QR станка' : 'QR SKU';
  const qrY = subtitle ? 135 : 105;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="70mm" viewBox="0 0 600 700" role="img" aria-label="${escapeXml(kindLabel + ' ' + label.title)}">
  <rect x="4" y="4" width="592" height="692" rx="22" fill="#fff" stroke="#111" stroke-width="8"/>
  <text x="300" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#111">${title}</text>
  ${subtitle ? `<text x="300" y="94" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#333">${subtitle}</text>` : ''}
  <svg x="65" y="${qrY}" width="470" height="470" viewBox="${escapeXml(match[1])}" preserveAspectRatio="xMidYMid meet">
    ${match[2]}
  </svg>
  <text x="300" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#111">Сканируйте в приложении</text>
</svg>`;
}

async function renderQrCode(payload: string): Promise<string> {
  try {
    return await QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2
    });
  } catch {
    throw new ApiError(500, 'database_error', 'Не удалось сформировать QR-ярлык');
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function shorten(value: string, length: number): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized.length <= length ? normalized : normalized.slice(0, length - 1) + '…';
}
