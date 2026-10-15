import assert from 'node:assert/strict';
import { Client } from 'pg';
import {
  hashAdminPassword,
  hashAdminOpaqueToken
} from '../../src/auth/adminPassword.js';
import { callRuntimeFunction } from '../../src/db/callRuntimeFunction.js';
import type { DbPool } from '../../src/db/pool.js';
import { getOperatorBreakTypes } from '../../src/readModels/operatorReadModels.js';

const databaseUrl = process.env.ADMIN_AUTH_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('ADMIN_AUTH_DATABASE_URL is required');
}

const client = new Client({ connectionString: databaseUrl });
const pool = client as unknown as DbPool;
const employeeId = '-982001';
const credentialId = '-982001';
const sessionToken = 'admin-auth-harness-session-one';
const secondSessionToken = 'admin-auth-harness-session-two';
const csrfToken = 'admin-auth-harness-csrf-one';
const secondCsrfToken = 'admin-auth-harness-csrf-two';
const qrConfirmationToken = 'admin-auth-harness-qr-confirmation';
const qrBrowserToken = 'admin-auth-harness-qr-browser';
const qrSessionToken = 'admin-auth-harness-qr-session';
const qrCsrfToken = 'admin-auth-harness-qr-csrf';
const unboundQrConfirmationToken = 'admin-auth-harness-qr-unbound';
const unboundQrBrowserToken = 'admin-auth-harness-qr-unbound-browser';
const forbiddenQrConfirmationToken = 'admin-auth-harness-qr-forbidden';
const forbiddenQrBrowserToken = 'admin-auth-harness-qr-forbidden-browser';

async function runtime<TResult>(
  functionName: Parameters<typeof callRuntimeFunction<TResult>>[1]['functionName'],
  params: readonly unknown[]
): Promise<TResult> {
  return callRuntimeFunction<TResult>(pool, { functionName, params });
}

async function expectSqlState(action: () => Promise<unknown>, expectedCode: string): Promise<void> {
  await client.query('savepoint expected_failure');
  try {
    await assert.rejects(action, (error: unknown) => (error as { code?: string }).code === expectedCode);
  } finally {
    await client.query('rollback to savepoint expected_failure');
    await client.query('release savepoint expected_failure');
  }
}

async function main(): Promise<void> {
  await client.connect();
  await client.query('begin');

  try {
    const passwordHash = await hashAdminPassword('Harness-Temporary-2026!');
    const replacementHash = await hashAdminPassword('Harness-Replaced-2026!');
    await client.query([
      'insert into app.employees (',
      '  employee_id, full_name, phone_e164, telegram_user_id, position_id, employee_status_id',
      ') overriding system value',
      'select -982001, ' + quote('Admin Auth Harness Director') + ', ' + quote('+998909820001') + ', -982001,',
      '  (select position_id from app.positions where is_active order by position_id limit 1),',
      '  (select employee_status_id from app.employee_statuses',
      '   where is_active and is_active_for_login order by employee_status_id limit 1)'
    ].join('\n'));
    await client.query([
      'insert into app.employee_roles (',
      '  employee_role_id, employee_id, role_id, assigned_by_employee_id',
      ') overriding system value',
      'select -982001, -982001, role_id, -982001',
      'from app.roles',
      'where role_name = ' + quote('Директор') + ' and is_active and can_access_admin_panel'
    ].join('\n'));
    await client.query([
      'insert into app.employees (',
      '  employee_id, full_name, phone_e164, telegram_user_id, position_id, employee_status_id',
      ') overriding system value',
      'select -982002, ' + quote('Admin Auth Harness Worker') + ', ' + quote('+998909820002') + ', -982002,',
      '  (select position_id from app.positions where is_active order by position_id limit 1),',
      '  (select employee_status_id from app.employee_statuses',
      '   where is_active and is_active_for_login order by employee_status_id limit 1)'
    ].join('\n'));
    await client.query([
      'insert into app.employee_roles (',
      '  employee_role_id, employee_id, role_id, assigned_by_employee_id',
      ') overriding system value',
      'select -982002, -982002, role_id, -982001',
      'from app.roles',
      'where role_name = ' + quote('Рабочий') + ' and is_active and not can_access_admin_panel'
    ].join('\n'));
    await client.query([
      'insert into app.admin_password_credentials (',
      '  admin_password_credential_id, employee_id, login_name, password_hash, must_change_password',
      ') overriding system value',
      'values (-982001, -982001, ' + quote('harness.director') + ', $1, true)'
    ].join('\n'), [passwordHash]);

    await client.query('set local role app_runtime_role');
    const identity = await client.query<{ current_user: string }>('select current_user');
    assert.equal(identity.rows[0]?.current_user, 'app_runtime_role');

    await expectSqlState(
      () => client.query('select * from app.admin_password_credentials'),
      '42501'
    );
    await expectSqlState(
      () => client.query('select * from app.admin_sessions'),
      '42501'
    );
    await expectSqlState(
      () => client.query('select * from app.admin_telegram_qr_challenges'),
      '42501'
    );

    const unboundChallenge = await runtime<{ challenge_id: string }>(
      'create_admin_telegram_qr_challenge',
      [
        hashAdminOpaqueToken(unboundQrConfirmationToken),
        hashAdminOpaqueToken(unboundQrBrowserToken),
        '127.0.0.2',
        'admin-auth-postgres-harness-unbound'
      ]
    );
    assert.match(unboundChallenge.challenge_id, /^[1-9][0-9]*$/);
    assert.equal(
      (await runtime<{ status: string }>('confirm_admin_telegram_qr_challenge', [
        hashAdminOpaqueToken(unboundQrConfirmationToken),
        '-982099'
      ])).status,
      'NOT_BOUND'
    );

    await client.query('reset role');
    const forbiddenIdentity = await client.query<{ telegram_user_id: string }>([
      'select telegram_user_id::text',
      'from app.employees',
      'where employee_id = -982002'
    ].join('\n'));
    assert.equal(forbiddenIdentity.rows[0]?.telegram_user_id, '-982002');
    const unknownIdentity = await client.query<{ count: string }>([
      'select count(*)::text as count',
      'from app.employees',
      'where telegram_user_id = -982099'
    ].join('\n'));
    assert.equal(unknownIdentity.rows[0]?.count, '0');
    await client.query('set local role app_runtime_role');

    const forbiddenChallenge = await runtime<{ challenge_id: string }>(
      'create_admin_telegram_qr_challenge',
      [
        hashAdminOpaqueToken(forbiddenQrConfirmationToken),
        hashAdminOpaqueToken(forbiddenQrBrowserToken),
        '127.0.0.3',
        'admin-auth-postgres-harness-forbidden'
      ]
    );
    assert.match(forbiddenChallenge.challenge_id, /^[1-9][0-9]*$/);
    assert.equal(
      (await runtime<{ status: string }>('confirm_admin_telegram_qr_challenge', [
        hashAdminOpaqueToken(forbiddenQrConfirmationToken),
        '-982002'
      ])).status,
      'FORBIDDEN'
    );

    const qrChallenge = await runtime<{ challenge_id: string; expires_at: string }>(
      'create_admin_telegram_qr_challenge',
      [
        hashAdminOpaqueToken(qrConfirmationToken),
        hashAdminOpaqueToken(qrBrowserToken),
        '127.0.0.1',
        'admin-auth-postgres-harness'
      ]
    );
    assert.match(qrChallenge.challenge_id, /^[1-9][0-9]*$/);

    const qrConfirmed = await runtime<{ status: string }>('confirm_admin_telegram_qr_challenge', [
      hashAdminOpaqueToken(qrConfirmationToken),
      employeeId
    ]);
    assert.equal(qrConfirmed.status, 'CONFIRMED');

    const qrClaimed = await runtime<{
      status: string;
      session_id: string;
      employee_id: string;
      auth_method: string;
      must_change_password: boolean;
    }>('claim_admin_telegram_qr_challenge', [
      qrChallenge.challenge_id,
      hashAdminOpaqueToken(qrBrowserToken),
      hashAdminOpaqueToken(qrSessionToken),
      hashAdminOpaqueToken(qrCsrfToken),
      '127.0.0.1',
      'admin-auth-postgres-harness'
    ]);
    assert.equal(qrClaimed.status, 'AUTHENTICATED');
    assert.equal(qrClaimed.employee_id, employeeId);
    assert.equal(qrClaimed.auth_method, 'TELEGRAM_QR');
    assert.equal(qrClaimed.must_change_password, false);

    const resolvedQrSession = await runtime<{
      session_id: string;
      employee_id: string;
      auth_method: string;
    }>('resolve_admin_session', [hashAdminOpaqueToken(qrSessionToken)]);
    assert.equal(resolvedQrSession.session_id, qrClaimed.session_id);
    assert.equal(resolvedQrSession.employee_id, employeeId);
    assert.equal(resolvedQrSession.auth_method, 'TELEGRAM_QR');

    assert.equal(
      (await runtime<{ status: string }>('confirm_admin_telegram_qr_challenge', [
        hashAdminOpaqueToken(qrConfirmationToken),
        employeeId
      ])).status,
      'ALREADY_USED'
    );
    assert.equal(
      (await runtime<{ status: string }>('claim_admin_telegram_qr_challenge', [
        qrChallenge.challenge_id,
        hashAdminOpaqueToken(qrBrowserToken),
        hashAdminOpaqueToken('unused-retry-session'),
        hashAdminOpaqueToken('unused-retry-csrf'),
        null,
        null
      ])).status,
      'ALREADY_USED'
    );

    const credential = await runtime<{
      credential_id: string;
      employee_id: string;
      password_hash: string;
      must_change_password: boolean;
    }>('read_admin_password_credential', ['harness.director']);
    assert.equal(credential.credential_id, credentialId);
    assert.equal(credential.employee_id, employeeId);
    assert.equal(credential.password_hash, passwordHash);
    assert.equal(credential.must_change_password, true);

    const started = await runtime<{
      session_id: string;
      employee_id: string;
      role_name: string;
      must_change_password: boolean;
    }>('start_admin_password_session', [
      credentialId,
      hashAdminOpaqueToken(sessionToken),
      hashAdminOpaqueToken(csrfToken),
      '127.0.0.1',
      'admin-auth-postgres-harness'
    ]);
    assert.equal(started.employee_id, employeeId);
    assert.equal(started.role_name, 'Директор');
    assert.equal(started.must_change_password, true);

    const resolved = await runtime<{
      session_id: string;
      employee_id: string;
      csrf_token_hash: string;
      must_change_password: boolean;
    }>('resolve_admin_session', [hashAdminOpaqueToken(sessionToken)]);
    assert.equal(resolved.session_id, started.session_id);
    assert.equal(resolved.employee_id, employeeId);
    assert.equal(resolved.csrf_token_hash, hashAdminOpaqueToken(csrfToken));
    assert.equal(resolved.must_change_password, true);

    await expectSqlState(
      () => runtime('read_admin_overview', [hashAdminOpaqueToken(sessionToken)]),
      '42501'
    );

    const changed = await runtime<{ employee_id: string; must_change_password: boolean }>(
      'change_admin_password',
      [hashAdminOpaqueToken(sessionToken), replacementHash]
    );
    assert.deepEqual(changed, { employee_id: employeeId, must_change_password: false });

    const overview = await runtime<{
      counts: { employees: number };
      attention: unknown[];
      recent_actions: unknown[];
    }>('read_admin_overview', [hashAdminOpaqueToken(sessionToken)]);
    assert.ok(overview.counts.employees >= 1);
    assert.ok(Array.isArray(overview.attention));
    assert.ok(Array.isArray(overview.recent_actions));

    const directory = await runtime<Record<string, unknown>>(
      'read_admin_directory',
      [hashAdminOpaqueToken(sessionToken)]
    );
    for (const collection of [
      'employees',
      'positions',
      'machines',
      'skus',
      'additional_work_types',
      'activity_profiles',
      'activity_types',
      'audit_events'
    ]) {
      assert.ok(Array.isArray(directory[collection]), collection);
    }
    assert.equal(hasForbiddenDirectoryKey(directory), false);

    const catalogs = directory as {
      employee_statuses: Array<{ employee_status_id: string; is_active_for_login: boolean }>;
      machine_use_statuses: Array<{ machine_use_status_id: string; is_active: boolean }>;
      sku_units: Array<{ sku_unit_id: string; is_active: boolean }>;
      activity_profiles: Array<{
        activity_class: 'BREAK' | 'OPERATIONAL' | 'CRITICAL';
        profile_id: string;
        is_active: boolean;
      }>;
    };
    const activeEmployeeStatusId = catalogs.employee_statuses.find(
      (status) => status.is_active_for_login
    )?.employee_status_id;
    const activeMachineUseStatusId = catalogs.machine_use_statuses.find(
      (status) => status.is_active
    )?.machine_use_status_id;
    const activeSkuUnitId = catalogs.sku_units.find((unit) => unit.is_active)?.sku_unit_id;
    const activeBreakProfileId = catalogs.activity_profiles.find(
      (profile) => profile.activity_class === 'BREAK' && profile.is_active
    )?.profile_id;
    const activeOperationalProfileId = catalogs.activity_profiles.find(
      (profile) => profile.activity_class === 'OPERATIONAL' && profile.is_active
    )?.profile_id;
    const activeCriticalProfileId = catalogs.activity_profiles.find(
      (profile) => profile.activity_class === 'CRITICAL' && profile.is_active
    )?.profile_id;
    assert.ok(activeEmployeeStatusId);
    assert.ok(activeMachineUseStatusId);
    assert.ok(activeSkuUnitId);
    assert.ok(activeBreakProfileId);
    assert.ok(activeOperationalProfileId);
    assert.ok(activeCriticalProfileId);

    const position = await runtime<{ position_id: string; created: boolean }>('save_admin_position', [
      hashAdminOpaqueToken(sessionToken),
      null,
      'Harness position',
      'Temporary integration row',
      true,
      true,
      'Harness creates a position'
    ]);
    assert.equal(position.created, true);

    const employee = await runtime<{ employee_id: string; created: boolean }>('save_admin_employee', [
      hashAdminOpaqueToken(sessionToken),
      null,
      'Harness Catalog Employee',
      '+998909820099',
      position.position_id,
      activeEmployeeStatusId,
      'Harness creates an employee'
    ]);
    assert.equal(employee.created, true);

    const machineQrToken = 'M'.repeat(32);
    const machine = await runtime<{ machine_id: string; created: boolean; qr_rotated: boolean }>(
      'save_admin_machine',
      [
        hashAdminOpaqueToken(sessionToken),
        null,
        'Harness machine',
        'Harness workshop',
        activeMachineUseStatusId,
        machineQrToken,
        'Harness creates a machine'
      ]
    );
    assert.deepEqual(
      { created: machine.created, qr_rotated: machine.qr_rotated },
      { created: true, qr_rotated: true }
    );

    const skuQrToken = 'S'.repeat(32);
    const sku = await runtime<{ sku_id: string; created: boolean; qr_rotated: boolean }>('save_admin_sku', [
      hashAdminOpaqueToken(sessionToken),
      null,
      'HARNESS-SKU',
      'Harness SKU',
      activeSkuUnitId,
      '12.500',
      '1500.2500',
      true,
      skuQrToken,
      'Harness creates an SKU'
    ]);
    assert.deepEqual(
      { created: sku.created, qr_rotated: sku.qr_rotated },
      { created: true, qr_rotated: true }
    );

    const machineLabel = await runtime<{ resource_id: string; payload: string }>('prepare_admin_qr_label', [
      hashAdminOpaqueToken(sessionToken),
      'MACHINE',
      machine.machine_id
    ]);
    assert.equal(machineLabel.resource_id, machine.machine_id);
    assert.equal(machineLabel.payload, `peaks-machine:v1:${machineQrToken}`);
    const skuLabel = await runtime<{ resource_id: string; payload: string }>('prepare_admin_qr_label', [
      hashAdminOpaqueToken(sessionToken),
      'SKU',
      sku.sku_id
    ]);
    assert.equal(skuLabel.resource_id, sku.sku_id);
    assert.equal(skuLabel.payload, `peaks-sku:v1:${skuQrToken}`);

    const additionalWorkType = await runtime<{
      additional_work_type_id: string;
      created: boolean;
    }>('save_admin_additional_work_type', [
      hashAdminOpaqueToken(sessionToken),
      null,
      'Harness additional work',
      true,
      'Harness creates an additional work type'
    ]);
    assert.equal(additionalWorkType.created, true);

    const activity = await runtime<{
      activity_type_id: string;
      activity_class: string;
      technical_code: string;
      display_order: number;
    }>(
      'create_admin_activity_type',
      [
        hashAdminOpaqueToken(sessionToken),
        'BREAK',
        null,
        'Проверка обеда',
        null,
        activeBreakProfileId,
        'Harness creates an automatically coded activity type'
      ]
    );
    assert.equal(activity.activity_class, 'BREAK');
    assert.equal(activity.technical_code, 'proverka_obeda');
    const sameNameDowntime = await runtime<{
      activity_type_id: string;
      activity_class: string;
      technical_code: string;
    }>('create_admin_activity_type', [
      hashAdminOpaqueToken(sessionToken),
      'OPERATIONAL',
      null,
      'Проверка обеда',
      null,
      activeOperationalProfileId,
      'Harness checks the cross-class technical suffix'
    ]);
    assert.equal(sameNameDowntime.technical_code, 'proverka_obeda_operatsionnyy_prostoy');
    const sameNameCriticalDowntime = await runtime<{
      activity_type_id: string;
      activity_class: string;
      technical_code: string;
    }>('create_admin_activity_type', [
      hashAdminOpaqueToken(sessionToken),
      'CRITICAL',
      null,
      'Проверка обеда',
      null,
      activeCriticalProfileId,
      'Harness checks the critical class technical suffix'
    ]);
    assert.equal(sameNameCriticalDowntime.technical_code, 'proverka_obeda_kriticheskiy_prostoy');
    const movedActivity = await runtime<{ moved: boolean; display_order: number }>(
      'move_admin_activity_type',
      [hashAdminOpaqueToken(sessionToken), 'BREAK', activity.activity_type_id, 'UP']
    );
    assert.equal(movedActivity.moved, true);
    assert.ok(movedActivity.display_order < activity.display_order);
    const miniAppBreakCatalog = await getOperatorBreakTypes(pool);
    const movedMiniAppIndex = miniAppBreakCatalog.break_types.findIndex(
      (item) => item.break_type_id === activity.activity_type_id
    );
    assert.equal(movedMiniAppIndex, 1);
    assert.equal(miniAppBreakCatalog.break_types[movedMiniAppIndex]?.display_name, 'Проверка обеда');
    const deactivatedActivity = await runtime<{ is_active: boolean }>('deactivate_admin_activity_type', [
      hashAdminOpaqueToken(sessionToken),
      'BREAK',
      activity.activity_type_id,
      'Harness deactivates an activity type'
    ]);
    assert.equal(deactivatedActivity.is_active, false);
    const deactivatedDowntime = await runtime<{ is_active: boolean }>('deactivate_admin_activity_type', [
      hashAdminOpaqueToken(sessionToken),
      'OPERATIONAL',
      sameNameDowntime.activity_type_id,
      'Harness deactivates the same-name downtime type'
    ]);
    assert.equal(deactivatedDowntime.is_active, false);
    const deactivatedCriticalDowntime = await runtime<{ is_active: boolean }>('deactivate_admin_activity_type', [
      hashAdminOpaqueToken(sessionToken),
      'CRITICAL',
      sameNameCriticalDowntime.activity_type_id,
      'Harness deactivates the same-name critical downtime type'
    ]);
    assert.equal(deactivatedCriticalDowntime.is_active, false);

    await runtime('save_admin_employee', [
      hashAdminOpaqueToken(sessionToken),
      employee.employee_id,
      'Harness Catalog Employee Updated',
      '+998909820099',
      position.position_id,
      activeEmployeeStatusId,
      'Harness updates an employee'
    ]);
    await runtime('save_admin_position', [
      hashAdminOpaqueToken(sessionToken),
      position.position_id,
      'Harness position updated',
      'Temporary integration row updated',
      true,
      true,
      'Harness updates a position'
    ]);
    await runtime('save_admin_machine', [
      hashAdminOpaqueToken(sessionToken),
      machine.machine_id,
      'Harness machine updated',
      null,
      activeMachineUseStatusId,
      null,
      'Harness updates a machine'
    ]);
    await runtime('save_admin_sku', [
      hashAdminOpaqueToken(sessionToken),
      sku.sku_id,
      'HARNESS-SKU-UPDATED',
      'Harness SKU updated',
      activeSkuUnitId,
      '15.000',
      '1600.0000',
      true,
      null,
      'Harness updates an SKU'
    ]);
    await runtime('save_admin_additional_work_type', [
      hashAdminOpaqueToken(sessionToken),
      additionalWorkType.additional_work_type_id,
      'Harness additional work updated',
      true,
      'Harness updates an additional work type'
    ]);

    await client.query('reset role');
    const mutationAudit = await client.query<{
      actor_employee_id: string;
      action_name: string;
      protected_payload: string;
    }>([
      'select actor_employee_id::text, action_name,',
      "       coalesce(before_data_json::text, '') || coalesce(after_data_json::text, '') as protected_payload",
      'from app.audit_events',
      'where actor_employee_id = -982001'
    ].join('\n'));
    assert.ok(mutationAudit.rows.length >= 14);
    assert.ok(mutationAudit.rows.every((row) => row.actor_employee_id === employeeId));
    assert.ok(mutationAudit.rows.some((row) => row.action_name === 'admin_download_machine_qr_label'));
    assert.ok(mutationAudit.rows.some((row) => row.action_name === 'admin_download_sku_qr_label'));
    assert.ok(mutationAudit.rows.some((row) => row.action_name === 'admin_move_activity_type'));
    assert.ok(mutationAudit.rows.every((row) => !row.protected_payload.includes(machineQrToken)));
    assert.ok(mutationAudit.rows.every((row) => !row.protected_payload.includes(skuQrToken)));
    await client.query('set local role app_runtime_role');

    const revoked = await runtime<{ revoked: boolean }>('revoke_admin_session', [
      hashAdminOpaqueToken(sessionToken),
      'HARNESS_LOGOUT'
    ]);
    assert.equal(revoked.revoked, true);
    assert.equal(
      await runtime('resolve_admin_session', [hashAdminOpaqueToken(sessionToken)]),
      null
    );

    await runtime('start_admin_password_session', [
      credentialId,
      hashAdminOpaqueToken(secondSessionToken),
      hashAdminOpaqueToken(secondCsrfToken),
      null,
      'admin-auth-postgres-harness'
    ]);

    await client.query('reset role');
    await client.query([
      'update app.employee_roles',
      'set revoked_at = now(),',
      '    revoked_by_employee_id = employee_id,',
      '    revoke_reason = ' + quote('Admin auth harness authorization revocation'),
      'where employee_id = -982001 and revoked_at is null'
    ].join('\n'));
    await client.query('set local role app_runtime_role');
    assert.equal(
      await runtime('resolve_admin_session', [hashAdminOpaqueToken(secondSessionToken)]),
      null
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await runtime('record_admin_password_failure', [credentialId]);
    }
    const lockedCredential = await runtime<{
      failed_attempt_count: number;
      locked_until: string | null;
    }>('read_admin_password_credential', ['harness.director']);
    assert.equal(lockedCredential.failed_attempt_count, 5);
    assert.ok(lockedCredential.locked_until);

    console.log('ADMIN_AUTH_POSTGRES_HARNESS_PASS');
    console.log('runtime_role_direct_private_table_access=DENIED');
    console.log('unknown_telegram_identity_auto_binding=DENIED');
    console.log('non_admin_telegram_identity_login=DENIED');
    console.log('password_change_required_boundary=PASS');
    console.log('safe_admin_directory_projection=PASS');
    console.log('attributable_admin_catalog_mutations=PASS');
    console.log('admin_qr_tokens_redacted_from_audit=PASS');
    console.log('protected_admin_qr_label_delivery=PASS');
    console.log('role_revocation_invalidates_session=PASS');
    console.log('lockout_after_five_failures=PASS');
  } finally {
    await client.query('rollback');
    await client.end();
  }
}

function quote(value: string): string {
  return "'" + value.replaceAll("'", "''") + "'";
}

function hasForbiddenDirectoryKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenDirectoryKey);
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  const forbiddenKeys = new Set([
    'password_hash',
    'session_token_hash',
    'csrf_token_hash',
    'machine_qr_token',
    'sku_qr_token',
    'before_data_json',
    'after_data_json',
    'tariff_category'
  ]);
  return Object.entries(value).some(
    ([key, nested]) => forbiddenKeys.has(key) || hasForbiddenDirectoryKey(nested)
  );
}

await main();
