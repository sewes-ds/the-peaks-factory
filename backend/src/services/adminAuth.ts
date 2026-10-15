import { callRuntimeFunction } from '../db/callRuntimeFunction.js';
import { mapPostgresError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';

export type AdminPasswordCredential = {
  credential_id: string;
  employee_id: string;
  password_hash: string;
  must_change_password: boolean;
  failed_attempt_count: number;
  locked_until: string | null;
  is_active: boolean;
};

export type AdminSession = {
  session_id: string;
  employee_id: string;
  full_name: string;
  role_name: string;
  auth_method: 'PASSWORD' | 'TELEGRAM_QR';
  must_change_password: boolean;
  csrf_token_hash?: string;
  created_at: string;
  last_seen_at?: string;
  idle_expires_at: string;
  expires_at: string;
};

export type AdminTelegramQrChallenge = {
  challenge_id: string;
  expires_at: string;
};

export type AdminTelegramQrConfirmationStatus =
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'NOT_BOUND'
  | 'FORBIDDEN'
  | 'UNAVAILABLE';

export type AdminTelegramQrClaimResult =
  | { status: 'PENDING' | 'EXPIRED' | 'ALREADY_USED' | 'FORBIDDEN' | 'UNAVAILABLE' }
  | ({ status: 'AUTHENTICATED' } & AdminSession);

export type AdminOverview = {
  counts: {
    employees: number;
    machines: number;
    skus: number;
    active_sessions: number;
  };
  attention: Array<{
    code: 'BROKEN_MACHINES' | 'SKU_PRODUCTIVITY_MISSING' | 'ADDITIONAL_WORK_OPEN';
    count: number;
  }>;
  recent_actions: Array<{
    audit_event_id: string;
    action_name: string;
    entity_table_name: string;
    entity_record_id: string;
    actor_full_name: string;
    created_at: string;
  }>;
};

export type AdminDirectory = {
  employees: Array<{
    employee_id: string;
    full_name: string;
    phone_e164: string;
    position_id: string;
    position_name: string;
    employee_status_id: string;
    employee_status_name: string;
    is_active_for_login: boolean;
    telegram_is_bound: boolean;
    role_names: string[];
  }>;
  positions: Array<{
    position_id: string;
    position_name: string;
    position_description: string | null;
    is_production_position: boolean;
    is_active: boolean;
    employee_count: number;
  }>;
  employee_statuses: Array<{
    employee_status_id: string;
    employee_status_name: string;
    is_active_for_login: boolean;
    is_final: boolean;
    is_active: boolean;
  }>;
  machines: Array<{
    machine_id: string;
    machine_name: string;
    workshop_name: string | null;
    machine_status_id: string;
    machine_status_name: string;
    machine_use_status_id: string;
    machine_use_status_name: string;
    machine_use_is_decommissioned: boolean;
    qr_is_assigned: boolean;
  }>;
  machine_use_statuses: Array<{
    machine_use_status_id: string;
    machine_use_status_name: string;
    is_decommissioned: boolean;
    is_active: boolean;
  }>;
  skus: Array<{
    sku_id: string;
    sku_code: string;
    sku_name: string | null;
    sku_unit_id: string;
    sku_unit_name: string;
    planned_productivity_per_hour: string | null;
    current_sku_tariff_uzs: string;
    is_active: boolean;
    qr_is_assigned: boolean;
  }>;
  sku_units: Array<{
    sku_unit_id: string;
    sku_unit_name: string;
    allows_fractional_quantity: boolean;
    is_active: boolean;
  }>;
  additional_work_types: Array<{
    additional_work_type_id: string;
    additional_work_type_name: string;
    is_active: boolean;
  }>;
  activity_profiles: Array<{
    activity_class: 'BREAK' | 'OPERATIONAL' | 'CRITICAL';
    profile_id: string;
    technical_code: string;
    profile_name: string;
    is_active: boolean;
  }>;
  activity_types: Array<{
    activity_class: 'BREAK' | 'OPERATIONAL' | 'CRITICAL';
    activity_type_id: string;
    technical_code: string;
    display_name: string;
    display_order: number;
    profile_id: string;
    profile_name: string;
    is_active: boolean;
  }>;
  audit_events: Array<{
    audit_event_id: string;
    action_name: string;
    entity_table_name: string;
    entity_record_id: string;
    actor_full_name: string;
    reason: string | null;
    created_at: string;
  }>;
};

export async function readAdminPasswordCredential(
  pool: DbPool,
  loginName: string
): Promise<AdminPasswordCredential | null> {
  return callAdminRuntime<AdminPasswordCredential | null>(
    pool,
    'read_admin_password_credential',
    [loginName]
  );
}

export async function recordAdminPasswordFailure(pool: DbPool, credentialId: string): Promise<void> {
  await callAdminRuntime(pool, 'record_admin_password_failure', [credentialId]);
}

export async function startAdminPasswordSession(
  pool: DbPool,
  input: {
    credentialId: string;
    sessionTokenHash: string;
    csrfTokenHash: string;
    createdIp: string | null;
    userAgent: string | null;
  }
): Promise<AdminSession> {
  return callAdminRuntime<AdminSession>(pool, 'start_admin_password_session', [
    input.credentialId,
    input.sessionTokenHash,
    input.csrfTokenHash,
    input.createdIp,
    input.userAgent
  ]);
}

export async function createAdminTelegramQrChallenge(
  pool: DbPool,
  input: {
    confirmationTokenHash: string;
    browserTokenHash: string;
    createdIp: string | null;
    userAgent: string | null;
  }
): Promise<AdminTelegramQrChallenge> {
  return callAdminRuntime<AdminTelegramQrChallenge>(pool, 'create_admin_telegram_qr_challenge', [
    input.confirmationTokenHash,
    input.browserTokenHash,
    input.createdIp,
    input.userAgent
  ]);
}

export async function confirmAdminTelegramQrChallenge(
  pool: DbPool,
  confirmationTokenHash: string,
  telegramUserId: bigint
): Promise<{ status: AdminTelegramQrConfirmationStatus }> {
  return callAdminRuntime(pool, 'confirm_admin_telegram_qr_challenge', [
    confirmationTokenHash,
    telegramUserId
  ]);
}

export async function claimAdminTelegramQrChallenge(
  pool: DbPool,
  input: {
    challengeId: string;
    browserTokenHash: string;
    sessionTokenHash: string;
    csrfTokenHash: string;
    createdIp: string | null;
    userAgent: string | null;
  }
): Promise<AdminTelegramQrClaimResult> {
  return callAdminRuntime<AdminTelegramQrClaimResult>(pool, 'claim_admin_telegram_qr_challenge', [
    input.challengeId,
    input.browserTokenHash,
    input.sessionTokenHash,
    input.csrfTokenHash,
    input.createdIp,
    input.userAgent
  ]);
}

export async function resolveAdminSession(
  pool: DbPool,
  sessionTokenHash: string
): Promise<AdminSession | null> {
  return callAdminRuntime<AdminSession | null>(pool, 'resolve_admin_session', [sessionTokenHash]);
}

export async function readAdminPasswordCredentialForSession(
  pool: DbPool,
  sessionTokenHash: string
): Promise<{ credential_id: string; login_name: string; password_hash: string } | null> {
  return callAdminRuntime(pool, 'read_admin_password_credential_for_session', [sessionTokenHash]);
}

export async function changeAdminPassword(
  pool: DbPool,
  sessionTokenHash: string,
  newPasswordHash: string
): Promise<{ employee_id: string; must_change_password: false }> {
  return callAdminRuntime(pool, 'change_admin_password', [sessionTokenHash, newPasswordHash]);
}

export async function revokeAdminSession(
  pool: DbPool,
  sessionTokenHash: string,
  reason: string
): Promise<{ revoked: boolean; session_id?: string }> {
  return callAdminRuntime(pool, 'revoke_admin_session', [sessionTokenHash, reason]);
}

export async function readAdminOverview(
  pool: DbPool,
  sessionTokenHash: string
): Promise<AdminOverview> {
  return callAdminRuntime(pool, 'read_admin_overview', [sessionTokenHash]);
}

export async function readAdminDirectory(
  pool: DbPool,
  sessionTokenHash: string
): Promise<AdminDirectory> {
  return callAdminRuntime(pool, 'read_admin_directory', [sessionTokenHash]);
}

async function callAdminRuntime<TResult>(
  pool: DbPool,
  functionName:
    | 'read_admin_password_credential'
    | 'record_admin_password_failure'
    | 'start_admin_password_session'
    | 'create_admin_telegram_qr_challenge'
    | 'confirm_admin_telegram_qr_challenge'
    | 'claim_admin_telegram_qr_challenge'
    | 'resolve_admin_session'
    | 'read_admin_password_credential_for_session'
    | 'change_admin_password'
    | 'revoke_admin_session'
    | 'read_admin_overview'
    | 'read_admin_directory',
  params: readonly unknown[]
): Promise<TResult> {
  try {
    return await callRuntimeFunction<TResult>(pool, { functionName, params });
  } catch (error) {
    throw mapPostgresError(error);
  }
}
