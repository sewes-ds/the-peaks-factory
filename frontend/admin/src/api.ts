import type {
  ActivityClass,
  ActivityOrderDirection,
  AdminDirectory,
  AdminMutationResult,
  AdminOverview,
  AdminSession,
  AdminTelegramQrChallenge,
  AdminTelegramQrClaim
} from './contracts';

export class AdminApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export async function loginAdmin(login: string, password: string): Promise<AdminSession> {
  const result = await request<{ session: AdminSession }>('/admin-api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password })
  });
  return result.session;
}

export async function createAdminTelegramQrChallenge(): Promise<AdminTelegramQrChallenge> {
  const result = await request<{ challenge: AdminTelegramQrChallenge }>(
    '/admin-api/auth/telegram-qr/challenge',
    { method: 'POST' }
  );
  return result.challenge;
}

export async function claimAdminTelegramQrChallenge(challengeId: string): Promise<AdminTelegramQrClaim> {
  return request<AdminTelegramQrClaim>(
    '/admin-api/auth/telegram-qr/challenge/' + encodeURIComponent(challengeId) + '/claim',
    { method: 'POST' }
  );
}

export async function readAdminSession(): Promise<AdminSession> {
  const result = await request<{ session: AdminSession }>('/admin-api/auth/session');
  return result.session;
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<AdminSession> {
  const result = await request<{ session: AdminSession }>('/admin-api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  });
  return result.session;
}

export async function logoutAdmin(): Promise<void> {
  await request('/admin-api/auth/logout', { method: 'POST' });
}

export async function readAdminOverview(): Promise<AdminOverview> {
  const result = await request<{ overview: AdminOverview }>('/admin-api/overview');
  return result.overview;
}

export async function readAdminDirectory(): Promise<AdminDirectory> {
  const result = await request<{ directory: AdminDirectory }>('/admin-api/directory');
  return result.directory;
}

export async function saveAdminEmployee(input: {
  employee_id?: string | null;
  full_name: string;
  phone_e164: string;
  position_id: string;
  employee_status_id: string;
  reason: string;
}): Promise<AdminMutationResult> {
  return mutateCatalog('/admin-api/catalog/employees', input);
}

export async function saveAdminPosition(input: {
  position_id?: string | null;
  position_name: string;
  position_description?: string | null;
  is_production_position: boolean;
  is_active: boolean;
  reason: string;
}): Promise<AdminMutationResult> {
  return mutateCatalog('/admin-api/catalog/positions', input);
}

export async function saveAdminMachine(input: {
  machine_id?: string | null;
  machine_name: string;
  workshop_name?: string | null;
  machine_use_status_id: string;
  rotate_qr: boolean;
  reason: string;
}): Promise<AdminMutationResult> {
  return mutateCatalog('/admin-api/catalog/machines', input);
}

export async function saveAdminSku(input: {
  sku_id?: string | null;
  sku_code: string;
  sku_name?: string | null;
  sku_unit_id: string;
  planned_productivity_per_hour?: string | null;
  current_sku_tariff_uzs: string;
  is_active: boolean;
  rotate_qr: boolean;
  reason: string;
}): Promise<AdminMutationResult> {
  return mutateCatalog('/admin-api/catalog/skus', input);
}

export async function saveAdminAdditionalWorkType(input: {
  additional_work_type_id?: string | null;
  additional_work_type_name: string;
  is_active: boolean;
  reason: string;
}): Promise<AdminMutationResult> {
  return mutateCatalog('/admin-api/catalog/additional-work-types', input);
}

export async function createAdminActivityType(input: {
  activity_class: ActivityClass;
  display_name: string;
  profile_id: string;
  reason: string;
}): Promise<AdminMutationResult> {
  return mutateCatalog('/admin-api/catalog/activity-types', input);
}

export async function moveAdminActivityType(input: {
  activity_class: ActivityClass;
  activity_type_id: string;
  direction: ActivityOrderDirection;
}): Promise<AdminMutationResult> {
  return mutateCatalog('/admin-api/catalog/activity-types/move', input);
}

export async function deactivateAdminActivityType(input: {
  activity_class: ActivityClass;
  activity_type_id: string;
  reason: string;
}): Promise<AdminMutationResult> {
  return mutateCatalog('/admin-api/catalog/activity-types/deactivate', input);
}

export async function downloadAdminQrLabel(
  resourceKind: 'MACHINE' | 'SKU',
  resourceId: string
): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers({
    accept: 'image/svg+xml',
    'content-type': 'application/json'
  });
  const csrfToken = readCookie('peaks_admin_csrf');
  if (csrfToken) headers.set('x-admin-csrf-token', csrfToken);
  const response = await fetch('/admin-api/catalog/qr-label', {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify({ resource_kind: resourceKind, resource_id: resourceId })
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const apiError = readApiError(payload);
    throw new AdminApiError(
      response.status,
      apiError?.code ?? 'request_failed',
      apiError?.message ?? 'Не удалось получить QR-ярлык'
    );
  }
  return {
    blob: await response.blob(),
    filename: readDownloadFilename(response.headers.get('content-disposition'))
      ?? `${resourceKind === 'MACHINE' ? 'machine' : 'sku'}-${resourceId}-qr.svg`
  };
}

async function mutateCatalog(path: string, body: unknown): Promise<AdminMutationResult> {
  const response = await request<{ result: AdminMutationResult }>(path, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return response.result;
}

async function request<TResult = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<TResult> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCookie('peaks_admin_csrf');
    if (csrfToken) {
      headers.set('x-admin-csrf-token', csrfToken);
    }
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin'
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const apiError = readApiError(payload);
    throw new AdminApiError(
      response.status,
      apiError?.code ?? 'request_failed',
      apiError?.message ?? 'Не удалось выполнить запрос'
    );
  }

  return payload as TResult;
}

function readApiError(payload: unknown): { code?: string; message?: string } | undefined {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) {
    return undefined;
  }
  const error = payload.error;
  return error && typeof error === 'object'
    ? error as { code?: string; message?: string }
    : undefined;
}

function readCookie(name: string): string | null {
  const prefix = name + '=';
  for (const part of document.cookie.split(';')) {
    const normalized = part.trim();
    if (normalized.startsWith(prefix)) {
      try {
        return decodeURIComponent(normalized.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function readDownloadFilename(contentDisposition: string | null): string | null {
  const match = contentDisposition?.match(/filename="([A-Za-z0-9._-]+)"/u);
  return match?.[1] ?? null;
}
