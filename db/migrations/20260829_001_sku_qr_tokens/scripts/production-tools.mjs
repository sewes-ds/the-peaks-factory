import { randomBytes } from 'node:crypto';
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync,
  realpathSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  PACKAGE_ID, assertPathOutside, fail, libpqEnvironment, packageTreeSha256,
  runPsqlCaptured, sha256Buffer,
} from './package-tools.mjs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const RELEASE_ID_PATTERN = /^\d{8}T\d{6}Z-[a-f0-9]{12}$/;
const OPERATOR_PATTERN = /^[A-Za-z0-9._@-]{1,80}$/;
const CANONICAL_SECOND_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

export function runCaptured(command, args, options = {}) {
  const { failureCode = 'SKU_QR_COMMAND_FAILED', ...spawnOptions } = options;
  const result = spawnSync(command, args, {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...spawnOptions,
  });
  if (result.error || result.status !== 0) fail(failureCode);
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function requireExactKeys(value, expected, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code);
}

function parseCanonicalSecond(value, code) {
  if (typeof value !== 'string' || !CANONICAL_SECOND_PATTERN.test(value)) fail(code);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value.replace('Z', '.000Z')) fail(code);
  return timestamp;
}

export function canonicalNow() {
  return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace('.000Z', 'Z');
}

export function assertProtectedFile(path, code, { mustExist = true } = {}) {
  const resolved = resolve(path);
  if (resolved !== path) fail(code);
  const parent = dirname(resolved);
  const parentStat = lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || realpathSync(parent) !== parent || (parentStat.mode & 0o777) !== 0o700) fail(code);
  if (!mustExist) {
    if (existsSync(resolved)) fail(code);
    return resolved;
  }
  const fileStat = lstatSync(resolved);
  if (!fileStat.isFile() || fileStat.isSymbolicLink() || realpathSync(resolved) !== resolved || (fileStat.mode & 0o777) !== 0o600) fail(code);
  return resolved;
}

export function assertExactMain(repositoryRoot) {
  const head = runCaptured('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot, failureCode: 'SKU_QR_GIT_HEAD_UNAVAILABLE',
  }).stdout.trim();
  const status = runCaptured('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: repositoryRoot, failureCode: 'SKU_QR_GIT_STATUS_UNAVAILABLE',
  }).stdout;
  if (!COMMIT_PATTERN.test(head) || status !== '') fail('SKU_QR_GIT_NOT_CLEAN_EXACT');
  runCaptured('git', ['merge-base', '--is-ancestor', head, 'origin/main'], {
    cwd: repositoryRoot, failureCode: 'SKU_QR_HEAD_NOT_REACHABLE_FROM_ORIGIN_MAIN',
  });
  return head;
}

export function databaseIdentitySha256(databaseUrl, databaseOverride) {
  const environment = libpqEnvironment(databaseUrl);
  if (databaseOverride !== undefined) environment.PGDATABASE = databaseOverride;
  const result = runCaptured('psql', [
    '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', String.raw`select json_build_object(
      'database', current_database(),
      'server_version_num', current_setting('server_version_num'),
      'system_identifier', (select system_identifier::text from pg_catalog.pg_control_system())
    )::text;`,
  ], { env: environment, failureCode: 'SKU_QR_DATABASE_IDENTITY_FAILED' });
  const identity = result.stdout.trim();
  if (!identity.startsWith('{') || !identity.endsWith('}')) fail('SKU_QR_DATABASE_IDENTITY_INVALID');
  return sha256Buffer(identity);
}

export function verifySuperuser(databaseUrl) {
  const result = runPsqlCaptured(databaseUrl, [
    '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
    "select coalesce((select rolsuper::text from pg_catalog.pg_roles where rolname = current_user), 'false');",
  ], { failureCode: 'SKU_QR_SUPERUSER_CHECK_FAILED' });
  if (result.stdout.trim() !== 'true') fail('SKU_QR_SUPERUSER_REQUIRED');
}

export function verifyPreMigrationState(databaseUrl, databaseOverride) {
  const environment = libpqEnvironment(databaseUrl);
  if (databaseOverride !== undefined) environment.PGDATABASE = databaseOverride;
  const result = runCaptured('psql', [
    '-X', '-q', '-A', '-t', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', String.raw`
      begin transaction read only;
      select
        (select count(*) from app.machines),
        (select count(*) from app.skus),
        exists (select 1 from information_schema.columns where table_schema='app' and table_name='skus' and column_name='sku_qr_token'),
        to_regprocedure('app.rotate_sku_qr_token(bigint,bigint,text,text)') is not null,
        to_regprocedure('app._assert_nonempty_text(text,text)') is not null,
        to_regprocedure('app._assert_actor_has_any_permission(bigint,text[])') is not null,
        to_regprocedure('app._insert_audit_event(bigint,text,text,bigint,jsonb,jsonb,text)') is not null;
      commit;`,
  ], { env: environment, failureCode: 'SKU_QR_PRE_MIGRATION_STATE_QUERY_FAILED' });
  if (!result.stdout.split('\n').some((line) => line.trim() === '14|162|f|f|t|t|t')) fail('SKU_QR_PRE_MIGRATION_STATE_INVALID');
}

export function verifyCurrentRelease(deploymentRoot, expectedReleaseId) {
  if (resolve(deploymentRoot) !== deploymentRoot || !RELEASE_ID_PATTERN.test(expectedReleaseId)) fail('SKU_QR_CURRENT_RELEASE_INPUT_INVALID');
  const currentLink = resolve(deploymentRoot, 'current');
  if (!lstatSync(currentLink).isSymbolicLink()) fail('SKU_QR_CURRENT_RELEASE_INVALID');
  const expectedRelative = `releases/${expectedReleaseId}`;
  if (readlinkSync(currentLink) !== expectedRelative || realpathSync(currentLink) !== resolve(deploymentRoot, expectedRelative)) fail('SKU_QR_CURRENT_RELEASE_INVALID');
  const manifestPath = resolve(deploymentRoot, expectedRelative, 'release-manifest.json');
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { fail('SKU_QR_CURRENT_MANIFEST_INVALID'); }
  if (manifest.release_id !== expectedReleaseId) fail('SKU_QR_CURRENT_MANIFEST_INVALID');
  return sha256File(manifestPath);
}

export function createVerifiedBackup({ databaseUrl, outputDirectory, repositoryRoot, packageRoot, deploymentRoot, currentReleaseId }) {
  const output = assertPathOutside(outputDirectory, [repositoryRoot, deploymentRoot], 'SKU_QR_BACKUP_OUTPUT_INVALID');
  if (existsSync(output)) fail('SKU_QR_BACKUP_OUTPUT_ALREADY_EXISTS');
  const head = assertExactMain(repositoryRoot);
  const packageDigest = packageTreeSha256(packageRoot);
  const currentManifestSha256 = verifyCurrentRelease(deploymentRoot, currentReleaseId);
  verifySuperuser(databaseUrl);
  verifyPreMigrationState(databaseUrl);
  const identityHash = databaseIdentitySha256(databaseUrl);

  mkdirSync(output, { mode: 0o700, recursive: false });
  chmodSync(output, 0o700);
  const backupPath = resolve(output, 'production-pre-sku-qr.dump');
  const environment = libpqEnvironment(databaseUrl);
  runCaptured('pg_dump', ['--format=custom', '--serializable-deferrable', '--no-password', '--file', backupPath], {
    env: environment, failureCode: 'SKU_QR_PRODUCTION_BACKUP_FAILED',
  });
  chmodSync(backupPath, 0o600);
  const completedAt = canonicalNow();
  const inventory = runCaptured('pg_restore', ['--list', backupPath], { failureCode: 'SKU_QR_BACKUP_INVENTORY_FAILED' });
  const restoreDatabase = `sku_qr_restore_verify_${randomBytes(8).toString('hex')}`;
  let restoreCreated = false;
  try {
    runCaptured('createdb', ['--maintenance-db=postgres', '--template=template0', restoreDatabase], {
      env: environment, failureCode: 'SKU_QR_BACKUP_RESTORE_DATABASE_CREATE_FAILED',
    });
    restoreCreated = true;
    const restoreEnvironment = { ...environment, PGDATABASE: restoreDatabase };
    runCaptured('pg_restore', ['--exit-on-error', '--single-transaction', '--dbname', restoreDatabase, backupPath], {
      env: restoreEnvironment, failureCode: 'SKU_QR_BACKUP_RESTORE_FAILED',
    });
    verifyPreMigrationState(databaseUrl, restoreDatabase);
  } finally {
    if (restoreCreated) runCaptured('dropdb', ['--maintenance-db=postgres', restoreDatabase], {
      env: environment, failureCode: 'SKU_QR_BACKUP_RESTORE_DATABASE_DROP_FAILED',
    });
  }
  const restoreVerifiedAt = canonicalNow();
  const receipt = {
    formatVersion: 1, packageId: PACKAGE_ID, status: 'PASS', targetCommit: head,
    packageTreeSha256: packageDigest, databaseIdentitySha256: identityHash,
    currentRelease: { releaseId: currentReleaseId, manifestSha256: currentManifestSha256 },
    backup: {
      path: backupPath, sha256: sha256File(backupPath), sizeBytes: statSync(backupPath).size,
      completedAt, inventorySha256: sha256Buffer(inventory.stdout),
    },
    restoreVerification: {
      verifiedAt: restoreVerifiedAt, preMigrationState: 'PASS', machines: 14, skus: 162,
      temporaryDatabaseRemoved: true,
    },
  };
  const receiptPath = resolve(output, 'backup-receipt.json');
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  chmodSync(receiptPath, 0o600);
  return { receipt, receiptPath, receiptSha256: sha256File(receiptPath) };
}

function verifyBackupReceipt(path, authorization) {
  let receipt;
  try { receipt = JSON.parse(readFileSync(path, 'utf8')); } catch { fail('SKU_QR_BACKUP_RECEIPT_JSON_INVALID'); }
  if (
    receipt?.formatVersion !== 1 || receipt?.packageId !== PACKAGE_ID || receipt?.status !== 'PASS'
    || receipt?.targetCommit !== authorization.targetCommit
    || receipt?.packageTreeSha256 !== authorization.packageTreeSha256
    || receipt?.databaseIdentitySha256 !== authorization.databaseIdentitySha256
    || receipt?.currentRelease?.releaseId !== authorization.deployment.currentReleaseId
    || receipt?.currentRelease?.manifestSha256 !== authorization.deployment.currentManifestSha256
    || receipt?.backup?.path !== authorization.backup.path
    || receipt?.backup?.sha256 !== authorization.backup.sha256
    || receipt?.backup?.completedAt !== authorization.backup.completedAt
    || receipt?.restoreVerification?.verifiedAt !== authorization.backup.restoreVerifiedAt
    || receipt?.restoreVerification?.preMigrationState !== 'PASS'
    || receipt?.restoreVerification?.machines !== 14 || receipt?.restoreVerification?.skus !== 162
    || receipt?.restoreVerification?.temporaryDatabaseRemoved !== true
  ) fail('SKU_QR_BACKUP_RECEIPT_BINDING_INVALID');
}

export function readProductionAuthorization(path, context) {
  const authorizationPath = assertProtectedFile(path, 'SKU_QR_PRODUCTION_AUTHORIZATION_FILE_INVALID');
  let authorization;
  try { authorization = JSON.parse(readFileSync(authorizationPath, 'utf8')); } catch { fail('SKU_QR_PRODUCTION_AUTHORIZATION_JSON_INVALID'); }
  requireExactKeys(authorization, ['approval','backup','databaseIdentitySha256','deployment','evidence','formatVersion','maintenanceWindow','packageId','packageTreeSha256','protectedInputManifestSha256','rollback','status','targetCommit'], 'SKU_QR_PRODUCTION_AUTHORIZATION_SHAPE_INVALID');
  requireExactKeys(authorization.approval, ['approvedAt','approvedBy','decision'], 'SKU_QR_PRODUCTION_AUTHORIZATION_SHAPE_INVALID');
  requireExactKeys(authorization.backup, ['completedAt','path','receiptPath','receiptSha256','restoreVerifiedAt','sha256'], 'SKU_QR_PRODUCTION_AUTHORIZATION_SHAPE_INVALID');
  requireExactKeys(authorization.deployment, ['currentManifestSha256','currentReleaseId','root','targetManifestSha256','targetReleaseId'], 'SKU_QR_PRODUCTION_AUTHORIZATION_SHAPE_INVALID');
  requireExactKeys(authorization.evidence, ['migrationReceiptPath'], 'SKU_QR_PRODUCTION_AUTHORIZATION_SHAPE_INVALID');
  requireExactKeys(authorization.maintenanceWindow, ['endsAt','startsAt'], 'SKU_QR_PRODUCTION_AUTHORIZATION_SHAPE_INVALID');
  requireExactKeys(authorization.rollback, ['method','operator'], 'SKU_QR_PRODUCTION_AUTHORIZATION_SHAPE_INVALID');
  if (
    authorization.formatVersion !== 1 || authorization.packageId !== PACKAGE_ID || authorization.status !== 'AUTHORIZED'
    || authorization.targetCommit !== context.head || !COMMIT_PATTERN.test(authorization.targetCommit)
    || authorization.packageTreeSha256 !== context.packageTreeSha256 || !SHA256_PATTERN.test(authorization.packageTreeSha256)
    || authorization.protectedInputManifestSha256 !== context.protectedInputManifestSha256
    || authorization.databaseIdentitySha256 !== context.databaseIdentitySha256
  ) fail('SKU_QR_PRODUCTION_AUTHORIZATION_BINDING_INVALID');
  const backupPath = assertProtectedFile(authorization.backup.path, 'SKU_QR_PRODUCTION_BACKUP_FILE_INVALID');
  const backupReceiptPath = assertProtectedFile(authorization.backup.receiptPath, 'SKU_QR_PRODUCTION_BACKUP_RECEIPT_INVALID');
  if (
    backupPath !== context.backupPath || authorization.backup.sha256 !== context.backupSha256
    || sha256File(backupPath) !== authorization.backup.sha256
    || sha256File(backupReceiptPath) !== authorization.backup.receiptSha256
  ) fail('SKU_QR_PRODUCTION_BACKUP_BINDING_INVALID');
  verifyBackupReceipt(backupReceiptPath, authorization);
  const completedAt = parseCanonicalSecond(authorization.backup.completedAt, 'SKU_QR_PRODUCTION_TIME_INVALID');
  const restoredAt = parseCanonicalSecond(authorization.backup.restoreVerifiedAt, 'SKU_QR_PRODUCTION_TIME_INVALID');
  const approvedAt = parseCanonicalSecond(authorization.approval.approvedAt, 'SKU_QR_PRODUCTION_TIME_INVALID');
  const startsAt = parseCanonicalSecond(authorization.maintenanceWindow.startsAt, 'SKU_QR_PRODUCTION_TIME_INVALID');
  const endsAt = parseCanonicalSecond(authorization.maintenanceWindow.endsAt, 'SKU_QR_PRODUCTION_TIME_INVALID');
  const purpose = context.purpose ?? 'execution';
  if (!['execution', 'rollback'].includes(purpose)) fail('SKU_QR_PRODUCTION_PURPOSE_INVALID');
  const now = context.now instanceof Date ? context.now.getTime() : Date.now();
  const timeAuthorized = purpose === 'execution'
    ? startsAt <= now && now <= endsAt
    : startsAt <= now && now <= endsAt + 86400000;
  if (!(completedAt <= restoredAt && restoredAt <= approvedAt && approvedAt <= endsAt) || !timeAuthorized || startsAt >= endsAt || startsAt - completedAt > 86400000) fail('SKU_QR_PRODUCTION_TIME_ORDER_INVALID');
  if (!OPERATOR_PATTERN.test(authorization.approval.approvedBy) || authorization.approval.decision !== 'AUTHORIZE_SKU_QR_PRODUCTION_EXECUTION' || !OPERATOR_PATTERN.test(authorization.rollback.operator) || authorization.rollback.method !== 'FULL_BACKUP_RESTORE_BEFORE_TRAFFIC') fail('SKU_QR_PRODUCTION_DECISION_INVALID');
  const root = authorization.deployment.root;
  if (resolve(root) !== root || !RELEASE_ID_PATTERN.test(authorization.deployment.currentReleaseId) || !RELEASE_ID_PATTERN.test(authorization.deployment.targetReleaseId) || authorization.deployment.currentReleaseId === authorization.deployment.targetReleaseId || !SHA256_PATTERN.test(authorization.deployment.currentManifestSha256) || !SHA256_PATTERN.test(authorization.deployment.targetManifestSha256)) fail('SKU_QR_PRODUCTION_DEPLOYMENT_INVALID');
  const receiptPath = assertProtectedFile(authorization.evidence.migrationReceiptPath, 'SKU_QR_PRODUCTION_RECEIPT_INVALID', { mustExist: purpose === 'rollback' });
  if (dirname(receiptPath) !== dirname(authorizationPath)) fail('SKU_QR_PRODUCTION_RECEIPT_INVALID');
  return { authorization, authorizationPath, migrationReceiptPath: receiptPath };
}

export function verifyAuthorizedDeployment(authorization, expectedHead) {
  const root = authorization.deployment.root;
  if (verifyCurrentRelease(root, authorization.deployment.currentReleaseId) !== authorization.deployment.currentManifestSha256) fail('SKU_QR_PRODUCTION_CURRENT_MANIFEST_HASH_INVALID');
  const targetManifestPath = resolve(root, 'releases', authorization.deployment.targetReleaseId, 'release-manifest.json');
  if (sha256File(targetManifestPath) !== authorization.deployment.targetManifestSha256) fail('SKU_QR_PRODUCTION_TARGET_MANIFEST_HASH_INVALID');
  let target;
  try { target = JSON.parse(readFileSync(targetManifestPath, 'utf8')); } catch { fail('SKU_QR_PRODUCTION_TARGET_MANIFEST_INVALID'); }
  if (
    target.release_id !== authorization.deployment.targetReleaseId || target.source_commit !== expectedHead
    || !target.database?.migration_packages?.includes(PACKAGE_ID)
    || target.verification?.backup_required !== true
    || target.verification.backup_manifest_sha256 !== authorization.backup.receiptSha256
    || target.rollback?.strategy !== 'release'
    || target.rollback.previous_release_id !== authorization.deployment.currentReleaseId
    || target.rollback.previous_manifest_sha256 !== authorization.deployment.currentManifestSha256
    || target.rollback.database_restore_required !== false
  ) fail('SKU_QR_PRODUCTION_TARGET_MANIFEST_CONTRACT_INVALID');
}

export function verifyRollbackDeployment(authorization, expectedHead) {
  const root = authorization.deployment.root;
  const currentLink = resolve(root, 'current');
  if (!lstatSync(currentLink).isSymbolicLink()) fail('SKU_QR_ROLLBACK_CURRENT_RELEASE_INVALID');
  const oldRelative = `releases/${authorization.deployment.currentReleaseId}`;
  const targetRelative = `releases/${authorization.deployment.targetReleaseId}`;
  const currentTarget = readlinkSync(currentLink);
  if (![oldRelative, targetRelative].includes(currentTarget) || realpathSync(currentLink) !== resolve(root, currentTarget)) fail('SKU_QR_ROLLBACK_CURRENT_RELEASE_INVALID');
  const oldManifest = resolve(root, oldRelative, 'release-manifest.json');
  if (sha256File(oldManifest) !== authorization.deployment.currentManifestSha256) fail('SKU_QR_ROLLBACK_CURRENT_MANIFEST_INVALID');
  const targetManifest = resolve(root, targetRelative, 'release-manifest.json');
  if (sha256File(targetManifest) !== authorization.deployment.targetManifestSha256) fail('SKU_QR_ROLLBACK_TARGET_MANIFEST_INVALID');
  let target;
  try { target = JSON.parse(readFileSync(targetManifest, 'utf8')); } catch { fail('SKU_QR_ROLLBACK_TARGET_MANIFEST_INVALID'); }
  if (target.source_commit !== expectedHead || target.rollback?.previous_release_id !== authorization.deployment.currentReleaseId || target.rollback?.database_restore_required !== false) fail('SKU_QR_ROLLBACK_TARGET_MANIFEST_INVALID');
  if (currentTarget === targetRelative) {
    const previousLink = resolve(root, 'previous');
    if (!lstatSync(previousLink).isSymbolicLink() || readlinkSync(previousLink) !== oldRelative || realpathSync(previousLink) !== resolve(root, oldRelative)) fail('SKU_QR_ROLLBACK_PREVIOUS_RELEASE_INVALID');
  }
}

export function verifyProductionQuiescence(databaseUrl) {
  const service = spawnSync('systemctl', ['is-active', 'peaks-backend.service'], { encoding: 'utf8' });
  if (!['inactive', 'failed'].includes(service.stdout.trim())) fail('SKU_QR_PRODUCTION_BACKEND_NOT_STOPPED');
  const result = runPsqlCaptured(databaseUrl, [
    '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', String.raw`select count(*) from pg_catalog.pg_stat_activity
      where datname=current_database() and pid<>pg_backend_pid() and backend_type='client backend';`,
  ], { failureCode: 'SKU_QR_PRODUCTION_QUIESCENCE_QUERY_FAILED' });
  if (result.stdout.trim() !== '0') fail('SKU_QR_PRODUCTION_DATABASE_NOT_QUIESCENT');
}

export function restoreVerifiedBackup({ databaseUrl, backupPath, expectedBackupSha256 }) {
  verifySuperuser(databaseUrl);
  verifyProductionQuiescence(databaseUrl);
  if (sha256File(backupPath) !== expectedBackupSha256) fail('SKU_QR_RESTORE_BACKUP_HASH_INVALID');
  runCaptured('pg_restore', ['--list', backupPath], { failureCode: 'SKU_QR_RESTORE_BACKUP_INVENTORY_FAILED' });
  const environment = libpqEnvironment(databaseUrl);
  runCaptured('pg_restore', ['--clean', '--if-exists', '--exit-on-error', '--single-transaction', '--no-password', '--dbname', environment.PGDATABASE, backupPath], {
    env: environment, failureCode: 'SKU_QR_PRODUCTION_DATABASE_RESTORE_FAILED',
  });
  verifyPreMigrationState(databaseUrl);
}
