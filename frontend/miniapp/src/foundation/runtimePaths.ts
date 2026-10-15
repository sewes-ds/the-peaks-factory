function normalizeBaseUrl(baseUrl: string): string {
  if (!baseUrl || baseUrl === '/') {
    return '';
  }

  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function getMiniAppBaseUrl(): string {
  return normalizeBaseUrl(import.meta.env.BASE_URL);
}

export function getDefaultApiBaseUrl(): string {
  return `${getMiniAppBaseUrl()}/api`;
}

export function assetUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = import.meta.env.BASE_URL || '/';

  return `${baseUrl}${normalizedPath}`;
}
