import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync
} from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

export const PACKAGE_ID = '20260828_001_machine_sku_qr_catalog';
export const TARGET_BASELINE_COMMIT = '2d487df089b148ae3e6ad5166ba0f70fc63f931f';
export const SOURCE_DUMP_SHA256 = '6d0a86a9946d76e33aa975269a15f9bbdb32ad4650b0b1433176b89c0a929d82';
export const MACHINE_HEADER = ['source_machine_id', 'machine_name', 'generated_protected_qr_token'];
export const SKU_HEADER = [
  'source_sku_id',
  'sku_code',
  'sku_name',
  'source_sku_unit_name',
  'current_sku_tariff_uzs'
];

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const RELEASE_ID_PATTERN = /^\d{8}T\d{6}Z-[a-f0-9]{12}$/;
const OPERATOR_PATTERN = /^[A-Za-z0-9._@-]{1,80}$/;
const CANONICAL_SECOND_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

export function assertPathOutside(path, forbiddenRoots, code) {
  const resolvedPath = resolve(path);
  if (resolvedPath !== path) fail(code);
  for (const root of forbiddenRoots.map((value) => resolve(value))) {
    if (resolvedPath === root || resolvedPath.startsWith(`${root}${sep}`)) fail(code);
  }
  return resolvedPath;
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

function assertProtectedFile(path, code) {
  const resolvedPath = resolve(path);
  if (resolvedPath !== path) fail(code);
  const parent = resolve(resolvedPath, '..');
  const parentStats = lstatSync(parent);
  const fileStats = lstatSync(resolvedPath);
  if (
    !parentStats.isDirectory() ||
    parentStats.isSymbolicLink() ||
    realpathSync(parent) !== parent ||
    (parentStats.mode & 0o777) !== 0o700
  ) {
    fail(code);
  }
  if (
    !fileStats.isFile() ||
    fileStats.isSymbolicLink() ||
    realpathSync(resolvedPath) !== resolvedPath ||
    (fileStats.mode & 0o777) !== 0o600
  ) {
    fail(code);
  }
  return resolvedPath;
}

function verifyBackupReceipt(path, authorization) {
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail('R3_PRODUCTION_BACKUP_RECEIPT_JSON_INVALID');
  }
  requireExactKeys(
    receipt,
    [
      'backup',
      'currentRelease',
      'databaseIdentitySha256',
      'formatVersion',
      'packageId',
      'packageTreeSha256',
      'restoreVerification',
      'status',
      'targetCommit'
    ],
    'R3_PRODUCTION_BACKUP_RECEIPT_SHAPE_INVALID'
  );
  requireExactKeys(
    receipt.currentRelease,
    ['manifestSha256', 'releaseId'],
    'R3_PRODUCTION_BACKUP_RECEIPT_SHAPE_INVALID'
  );
  requireExactKeys(
    receipt.backup,
    ['completedAt', 'inventorySha256', 'path', 'sha256', 'sizeBytes'],
    'R3_PRODUCTION_BACKUP_RECEIPT_SHAPE_INVALID'
  );
  requireExactKeys(
    receipt.restoreVerification,
    ['machines', 'schema', 'skus', 'temporaryDatabaseRemoved', 'verifiedAt'],
    'R3_PRODUCTION_BACKUP_RECEIPT_SHAPE_INVALID'
  );
  if (
    receipt.formatVersion !== 1 ||
    receipt.packageId !== PACKAGE_ID ||
    receipt.status !== 'PASS' ||
    receipt.targetCommit !== authorization.targetCommit ||
    receipt.packageTreeSha256 !== authorization.packageTreeSha256 ||
    receipt.databaseIdentitySha256 !== authorization.databaseIdentitySha256 ||
    receipt.currentRelease.releaseId !== authorization.deployment.currentReleaseId ||
    receipt.currentRelease.manifestSha256 !== authorization.deployment.currentManifestSha256 ||
    receipt.backup.path !== authorization.backup.path ||
    receipt.backup.sha256 !== authorization.backup.sha256 ||
    receipt.backup.completedAt !== authorization.backup.completedAt ||
    !Number.isSafeInteger(receipt.backup.sizeBytes) ||
    receipt.backup.sizeBytes <= 0 ||
    !SHA256_PATTERN.test(receipt.backup.inventorySha256) ||
    receipt.restoreVerification.verifiedAt !== authorization.backup.restoreVerifiedAt ||
    receipt.restoreVerification.schema !== 'PASS' ||
    receipt.restoreVerification.machines !== 0 ||
    receipt.restoreVerification.skus !== 0 ||
    receipt.restoreVerification.temporaryDatabaseRemoved !== true
  ) {
    fail('R3_PRODUCTION_BACKUP_RECEIPT_BINDING_INVALID');
  }
}

export function runCaptured(command, args, options = {}) {
  const { failureCode = 'R3_COMMAND_FAILED', ...spawnOptions } = options;
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...spawnOptions
  });
  if (result.error || result.status !== 0) {
    fail(failureCode);
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function libpqEnvironment(databaseUrl, inheritedEnvironment = process.env) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('R3_DATABASE_URL_INVALID');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.hash !== '') {
    fail('R3_DATABASE_URL_INVALID');
  }

  const environment = { ...inheritedEnvironment };
  for (const name of [
    'PGAPPNAME',
    'PGCONNECT_TIMEOUT',
    'PGDATABASE',
    'PGHOST',
    'PGOPTIONS',
    'PGPASSWORD',
    'PGPORT',
    'PGSSLMODE',
    'PGTARGETSESSIONATTRS',
    'PGUSER'
  ]) {
    delete environment[name];
  }

  let databaseName;
  let user;
  let password;
  try {
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    user = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    fail('R3_DATABASE_URL_ENCODING_INVALID');
  }
  let host = parsed.hostname.replace(/^\[|\]$/g, '');
  let port = parsed.port || '5432';
  if (databaseName === '' || user === '') fail('R3_DATABASE_URL_IDENTITY_MISSING');

  const parameterMap = new Map([
    ['application_name', 'PGAPPNAME'],
    ['connect_timeout', 'PGCONNECT_TIMEOUT'],
    ['options', 'PGOPTIONS'],
    ['sslmode', 'PGSSLMODE'],
    ['target_session_attrs', 'PGTARGETSESSIONATTRS']
  ]);
  const seen = new Set();
  for (const [name, value] of parsed.searchParams) {
    if (seen.has(name)) fail('R3_DATABASE_URL_DUPLICATE_PARAMETER');
    seen.add(name);
    if (name === 'host') host = value;
    else if (name === 'port') port = value;
    else {
      const environmentName = parameterMap.get(name);
      if (!environmentName) fail('R3_DATABASE_URL_PARAMETER_UNSUPPORTED');
      environment[environmentName] = value;
    }
  }
  if (host === '' || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    fail('R3_DATABASE_URL_NETWORK_IDENTITY_INVALID');
  }

  environment.PGDATABASE = databaseName;
  environment.PGHOST = host;
  environment.PGPORT = port;
  environment.PGUSER = user;
  if (password !== '') environment.PGPASSWORD = password;
  return environment;
}

export function runPsqlCaptured(databaseUrl, args, options = {}) {
  const { env = process.env, ...remainingOptions } = options;
  return runCaptured('psql', args, {
    ...remainingOptions,
    env: libpqEnvironment(databaseUrl, env)
  });
}

export function databaseIdentitySha256(databaseUrl, options = {}) {
  const { databaseOverride } = options;
  const environment = libpqEnvironment(databaseUrl);
  if (databaseOverride !== undefined) environment.PGDATABASE = databaseOverride;
  const result = runCaptured(
    'psql',
    [
      '-X',
      '-q',
      '-A',
      '-t',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      String.raw`select json_build_object(
        'database', current_database(),
        'server_version_num', current_setting('server_version_num'),
        'system_identifier', (select system_identifier::text from pg_catalog.pg_control_system())
      )::text;`
    ],
    { env: environment, failureCode: 'R3_DATABASE_IDENTITY_FAILED' }
  );
  const identity = result.stdout.trim();
  if (!identity.startsWith('{') || !identity.endsWith('}')) fail('R3_DATABASE_IDENTITY_INVALID');
  return sha256Buffer(identity);
}

export function readProductionAuthorization(path, context) {
  if (resolve(path) !== path) fail('R3_PRODUCTION_AUTHORIZATION_FILE_INVALID');
  const resolvedPath = assertProtectedFile(path, 'R3_PRODUCTION_AUTHORIZATION_FILE_INVALID');
  let authorization;
  try {
    authorization = JSON.parse(readFileSync(resolvedPath, 'utf8'));
  } catch {
    fail('R3_PRODUCTION_AUTHORIZATION_JSON_INVALID');
  }

  requireExactKeys(
    authorization,
    [
      'approval',
      'backup',
      'databaseIdentitySha256',
      'deployment',
      'evidence',
      'formatVersion',
      'maintenanceWindow',
      'packageId',
      'packageTreeSha256',
      'protectedInputManifestSha256',
      'rollback',
      'status',
      'targetCommit'
    ],
    'R3_PRODUCTION_AUTHORIZATION_SHAPE_INVALID'
  );
  requireExactKeys(
    authorization.approval,
    ['approvedAt', 'approvedBy', 'decision'],
    'R3_PRODUCTION_AUTHORIZATION_APPROVAL_INVALID'
  );
  requireExactKeys(
    authorization.backup,
    ['completedAt', 'path', 'receiptPath', 'receiptSha256', 'restoreVerifiedAt', 'sha256'],
    'R3_PRODUCTION_AUTHORIZATION_BACKUP_INVALID'
  );
  requireExactKeys(
    authorization.deployment,
    ['currentManifestSha256', 'currentReleaseId', 'root', 'targetManifestSha256', 'targetReleaseId'],
    'R3_PRODUCTION_AUTHORIZATION_DEPLOYMENT_INVALID'
  );
  requireExactKeys(
    authorization.evidence,
    ['migrationReceiptPath'],
    'R3_PRODUCTION_AUTHORIZATION_EVIDENCE_INVALID'
  );
  requireExactKeys(
    authorization.maintenanceWindow,
    ['endsAt', 'startsAt'],
    'R3_PRODUCTION_AUTHORIZATION_WINDOW_INVALID'
  );
  requireExactKeys(
    authorization.rollback,
    ['method', 'operator'],
    'R3_PRODUCTION_AUTHORIZATION_ROLLBACK_INVALID'
  );

  if (
    authorization.formatVersion !== 1 ||
    authorization.packageId !== PACKAGE_ID ||
    authorization.status !== 'AUTHORIZED' ||
    authorization.targetCommit !== context.head ||
    !COMMIT_PATTERN.test(authorization.targetCommit) ||
    authorization.packageTreeSha256 !== context.packageTreeSha256 ||
    !SHA256_PATTERN.test(authorization.packageTreeSha256) ||
    authorization.protectedInputManifestSha256 !== context.protectedInputManifestSha256 ||
    !SHA256_PATTERN.test(authorization.protectedInputManifestSha256) ||
    authorization.databaseIdentitySha256 !== context.databaseIdentitySha256 ||
    !SHA256_PATTERN.test(authorization.databaseIdentitySha256)
  ) {
    fail('R3_PRODUCTION_AUTHORIZATION_BINDING_INVALID');
  }

  if (resolve(authorization.backup.path) !== authorization.backup.path) {
    fail('R3_PRODUCTION_AUTHORIZATION_BACKUP_FILE_INVALID');
  }
  const backupPath = assertProtectedFile(authorization.backup.path, 'R3_PRODUCTION_AUTHORIZATION_BACKUP_FILE_INVALID');
  if (resolve(authorization.backup.receiptPath) !== authorization.backup.receiptPath) {
    fail('R3_PRODUCTION_AUTHORIZATION_BACKUP_RECEIPT_INVALID');
  }
  const backupReceiptPath = assertProtectedFile(
    authorization.backup.receiptPath,
    'R3_PRODUCTION_AUTHORIZATION_BACKUP_RECEIPT_INVALID'
  );
  if (
    backupPath !== context.backupPath ||
    authorization.backup.sha256 !== context.backupSha256 ||
    !SHA256_PATTERN.test(authorization.backup.sha256) ||
    !SHA256_PATTERN.test(authorization.backup.receiptSha256) ||
    sha256File(backupReceiptPath) !== authorization.backup.receiptSha256
  ) {
    fail('R3_PRODUCTION_AUTHORIZATION_BACKUP_BINDING_INVALID');
  }
  verifyBackupReceipt(backupReceiptPath, authorization);

  const completedAt = parseCanonicalSecond(
    authorization.backup.completedAt,
    'R3_PRODUCTION_AUTHORIZATION_BACKUP_TIME_INVALID'
  );
  const restoreVerifiedAt = parseCanonicalSecond(
    authorization.backup.restoreVerifiedAt,
    'R3_PRODUCTION_AUTHORIZATION_BACKUP_TIME_INVALID'
  );
  const approvedAt = parseCanonicalSecond(
    authorization.approval.approvedAt,
    'R3_PRODUCTION_AUTHORIZATION_APPROVAL_TIME_INVALID'
  );
  const startsAt = parseCanonicalSecond(
    authorization.maintenanceWindow.startsAt,
    'R3_PRODUCTION_AUTHORIZATION_WINDOW_INVALID'
  );
  const endsAt = parseCanonicalSecond(
    authorization.maintenanceWindow.endsAt,
    'R3_PRODUCTION_AUTHORIZATION_WINDOW_INVALID'
  );
  const purpose = context.purpose ?? 'execution';
  if (!['execution', 'rollback'].includes(purpose)) fail('R3_PRODUCTION_AUTHORIZATION_PURPOSE_INVALID');
  const now = context.now instanceof Date ? context.now.getTime() : Date.now();
  if (
    !(completedAt <= restoreVerifiedAt && restoreVerifiedAt <= approvedAt && approvedAt <= endsAt) ||
    !(startsAt < endsAt) ||
    (purpose === 'execution' && !(startsAt <= now && now <= endsAt)) ||
    (purpose === 'rollback' && !(startsAt <= now && now <= endsAt + 24 * 60 * 60 * 1000)) ||
    startsAt - completedAt > 24 * 60 * 60 * 1000
  ) {
    fail('R3_PRODUCTION_AUTHORIZATION_TIME_ORDER_INVALID');
  }

  if (
    !OPERATOR_PATTERN.test(authorization.approval.approvedBy) ||
    authorization.approval.decision !== 'AUTHORIZE_R3_PRODUCTION_EXECUTION' ||
    !OPERATOR_PATTERN.test(authorization.rollback.operator) ||
    authorization.rollback.method !== 'FULL_BACKUP_RESTORE_BEFORE_TRAFFIC'
  ) {
    fail('R3_PRODUCTION_AUTHORIZATION_DECISION_INVALID');
  }

  const deploymentRoot = resolve(authorization.deployment.root);
  if (
    deploymentRoot !== authorization.deployment.root ||
    !RELEASE_ID_PATTERN.test(authorization.deployment.currentReleaseId) ||
    !RELEASE_ID_PATTERN.test(authorization.deployment.targetReleaseId) ||
    authorization.deployment.currentReleaseId === authorization.deployment.targetReleaseId ||
    !SHA256_PATTERN.test(authorization.deployment.currentManifestSha256) ||
    !SHA256_PATTERN.test(authorization.deployment.targetManifestSha256)
  ) {
    fail('R3_PRODUCTION_AUTHORIZATION_DEPLOYMENT_INVALID');
  }

  const receiptPath = resolve(authorization.evidence.migrationReceiptPath);
  const receiptExists = existsSync(receiptPath);
  if (
    receiptPath !== authorization.evidence.migrationReceiptPath ||
    resolve(receiptPath, '..') !== resolve(resolvedPath, '..') ||
    (purpose === 'execution' && receiptExists) ||
    (purpose === 'rollback' && !receiptExists)
  ) {
    fail('R3_PRODUCTION_AUTHORIZATION_EVIDENCE_INVALID');
  }

  return { authorization, authorizationPath: resolvedPath, migrationReceiptPath: receiptPath };
}

export function verifyAuthorizedDeployment(authorization, expectedHead) {
  const root = authorization.deployment.root;
  const currentLink = resolve(root, 'current');
  const currentStats = lstatSync(currentLink);
  if (!currentStats.isSymbolicLink()) fail('R3_PRODUCTION_CURRENT_RELEASE_INVALID');
  const expectedCurrentRelative = `releases/${authorization.deployment.currentReleaseId}`;
  if (readlinkSync(currentLink) !== expectedCurrentRelative) fail('R3_PRODUCTION_CURRENT_RELEASE_INVALID');
  if (realpathSync(currentLink) !== resolve(root, expectedCurrentRelative)) fail('R3_PRODUCTION_CURRENT_RELEASE_INVALID');

  const currentManifest = resolve(root, expectedCurrentRelative, 'release-manifest.json');
  const targetManifest = resolve(root, 'releases', authorization.deployment.targetReleaseId, 'release-manifest.json');
  if (
    sha256File(currentManifest) !== authorization.deployment.currentManifestSha256
  ) {
    fail('R3_PRODUCTION_RELEASE_MANIFEST_HASH_INVALID');
  }

  verifyTargetReleaseManifest(authorization, expectedHead, targetManifest);
}

function verifyTargetReleaseManifest(authorization, expectedHead, targetManifest) {
  const targetRoot = resolve(targetManifest, '..');
  if (realpathSync(targetRoot) !== targetRoot) fail('R3_PRODUCTION_TARGET_RELEASE_INVALID');
  if (sha256File(targetManifest) !== authorization.deployment.targetManifestSha256) {
    fail('R3_PRODUCTION_RELEASE_MANIFEST_HASH_INVALID');
  }

  let target;
  try {
    target = JSON.parse(readFileSync(targetManifest, 'utf8'));
  } catch {
    fail('R3_PRODUCTION_TARGET_MANIFEST_INVALID');
  }
  if (
    target.release_id !== authorization.deployment.targetReleaseId ||
    target.source_commit !== expectedHead ||
    !Array.isArray(target.database?.migration_packages) ||
    !target.database.migration_packages.includes(PACKAGE_ID) ||
    target.verification?.backup_required !== true ||
    target.verification.backup_manifest_sha256 !== authorization.backup.receiptSha256 ||
    target.rollback?.strategy !== 'release' ||
    target.rollback.previous_release_id !== authorization.deployment.currentReleaseId ||
    target.rollback.previous_manifest_sha256 !== authorization.deployment.currentManifestSha256 ||
    target.rollback.database_restore_required !== true
  ) {
    fail('R3_PRODUCTION_TARGET_MANIFEST_CONTRACT_INVALID');
  }
}

export function verifyRollbackDeployment(authorization, expectedHead) {
  const root = authorization.deployment.root;
  const currentLink = resolve(root, 'current');
  if (!lstatSync(currentLink).isSymbolicLink()) fail('R3_ROLLBACK_CURRENT_RELEASE_INVALID');
  const currentTarget = readlinkSync(currentLink);
  const oldRelative = `releases/${authorization.deployment.currentReleaseId}`;
  const targetRelative = `releases/${authorization.deployment.targetReleaseId}`;
  if (![oldRelative, targetRelative].includes(currentTarget)) fail('R3_ROLLBACK_CURRENT_RELEASE_INVALID');
  if (realpathSync(currentLink) !== resolve(root, currentTarget)) fail('R3_ROLLBACK_CURRENT_RELEASE_INVALID');

  const oldManifest = resolve(root, oldRelative, 'release-manifest.json');
  if (sha256File(oldManifest) !== authorization.deployment.currentManifestSha256) {
    fail('R3_ROLLBACK_CURRENT_MANIFEST_INVALID');
  }
  verifyTargetReleaseManifest(
    authorization,
    expectedHead,
    resolve(root, targetRelative, 'release-manifest.json')
  );

  if (currentTarget === targetRelative) {
    const previousLink = resolve(root, 'previous');
    if (
      !lstatSync(previousLink).isSymbolicLink() ||
      readlinkSync(previousLink) !== oldRelative ||
      realpathSync(previousLink) !== resolve(root, oldRelative)
    ) {
      fail('R3_ROLLBACK_PREVIOUS_RELEASE_INVALID');
    }
  }
}

export function verifyProductionQuiescence(databaseUrl, serviceName = 'peaks-backend.service') {
  const service = spawnSync('systemctl', ['is-active', serviceName], { encoding: 'utf8' });
  if (service.stdout.trim() === 'active' || !['inactive', 'failed'].includes(service.stdout.trim())) {
    fail('R3_PRODUCTION_BACKEND_NOT_STOPPED');
  }
  const result = runPsqlCaptured(
    databaseUrl,
    [
      '-X',
      '-q',
      '-A',
      '-t',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      String.raw`select count(*)
        from pg_catalog.pg_stat_activity
        where datname = current_database()
          and pid <> pg_backend_pid()
          and backend_type = 'client backend';`
    ],
    { failureCode: 'R3_PRODUCTION_QUIESCENCE_QUERY_FAILED' }
  );
  if (result.stdout.trim() !== '0') fail('R3_PRODUCTION_DATABASE_NOT_QUIESCENT');
}

export function assertCleanExactGit(repositoryRoot) {
  const head = runCaptured('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    failureCode: 'R3_GIT_HEAD_UNAVAILABLE'
  }).stdout.trim();
  const status = runCaptured('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: repositoryRoot,
    failureCode: 'R3_GIT_STATUS_UNAVAILABLE'
  }).stdout;
  if (status !== '') fail('R3_GIT_WORKTREE_NOT_CLEAN');
  runCaptured('git', ['merge-base', '--is-ancestor', TARGET_BASELINE_COMMIT, head], {
    cwd: repositoryRoot,
    failureCode: 'R3_TARGET_BASELINE_NOT_ANCESTOR'
  });
  return head;
}

function packageFiles(packageRoot, current = packageRoot) {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isSymbolicLink()) fail('R3_PACKAGE_SYMLINK_FORBIDDEN');
    if (entry.isDirectory()) files.push(...packageFiles(packageRoot, path));
    else if (entry.isFile()) files.push(path);
    else fail('R3_PACKAGE_SPECIAL_FILE_FORBIDDEN');
  }
  return files;
}

export function packageTreeSha256(packageRoot) {
  const canonical = packageFiles(packageRoot)
    .map((path) => `${relative(packageRoot, path).split(sep).join('/')}\0${sha256File(path)}\0`)
    .sort()
    .join('');
  return sha256Buffer(canonical);
}

export function encodeCsv(rows, header) {
  const quote = (value) => {
    const stringValue = String(value);
    return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
  };
  return `${[header, ...rows].map((row) => row.map(quote).join(',')).join('\n')}\n`;
}

export function parseCsv(contents) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (quoted) {
      if (character === '"' && contents[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      if (field !== '') fail('R3_CSV_INVALID_QUOTE');
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) fail('R3_CSV_UNTERMINATED_QUOTE');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function assertHeader(actual, expected) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    fail('R3_CSV_HEADER_MISMATCH');
  }
}

function exactSequentialIds(rows, expectedCount) {
  if (rows.length !== expectedCount) return false;
  const ids = rows.map((row) => Number(row[0])).sort((left, right) => left - right);
  return ids.every((id, index) => Number.isSafeInteger(id) && id === index + 1);
}

function normalizedUnique(values) {
  return new Set(values.map((value) => value.toLocaleLowerCase('ru-RU'))).size === values.length;
}

export function validateMachineRows(rows) {
  if (!exactSequentialIds(rows, 14)) fail('R3_MACHINE_ID_CONTRACT_FAILED');
  if (
    rows.some(
      (row) =>
        row.length !== MACHINE_HEADER.length ||
        row[1] === '' ||
        row[1] !== row[1].trim() ||
        !/^[A-Za-z0-9_-]{32}$/.test(row[2])
    ) ||
    !normalizedUnique(rows.map((row) => row[1])) ||
    new Set(rows.map((row) => row[2])).size !== 14
  ) {
    fail('R3_MACHINE_VALUE_CONTRACT_FAILED');
  }
}

export function validateSkuRows(rows) {
  if (!exactSequentialIds(rows, 162)) fail('R3_SKU_ID_CONTRACT_FAILED');
  if (
    rows.some((row) => {
      if (
        row.length !== SKU_HEADER.length ||
        row[1] === '' ||
        row[1] !== row[1].trim() ||
        row[2] === '' ||
        row[2] !== row[2].trim() ||
        row[3] !== 'шт' ||
        !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(row[4])
      ) {
        return true;
      }
      return Number(row[4]) <= 0;
    }) ||
    !normalizedUnique(rows.map((row) => row[1])) ||
    !normalizedUnique(rows.map((row) => row[2]))
  ) {
    fail('R3_SKU_VALUE_CONTRACT_FAILED');
  }
}

export function readProtectedInput(directory) {
  const resolvedDirectory = resolve(directory);
  if (resolvedDirectory !== directory) fail('R3_PROTECTED_DIRECTORY_PATH_INVALID');
  const directoryStats = lstatSync(resolvedDirectory);
  const directoryMode = directoryStats.mode & 0o777;
  if (
    !directoryStats.isDirectory() ||
    directoryStats.isSymbolicLink() ||
    realpathSync(resolvedDirectory) !== resolvedDirectory ||
    directoryMode !== 0o700
  ) {
    fail('R3_PROTECTED_DIRECTORY_MODE_INVALID');
  }
  const expected = ['machines.csv', 'protected-input-manifest.json', 'skus.csv'];
  const actual = readdirSync(resolvedDirectory).sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    fail('R3_PROTECTED_DIRECTORY_CONTENT_INVALID');
  }
  for (const name of expected) {
    const path = resolve(resolvedDirectory, name);
    const stats = lstatSync(path);
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      realpathSync(path) !== path ||
      (stats.mode & 0o777) !== 0o600
    ) {
      fail('R3_PROTECTED_FILE_MODE_INVALID');
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(resolvedDirectory, 'protected-input-manifest.json'), 'utf8'));
  } catch {
    fail('R3_MANIFEST_INVALID_JSON');
  }
  const machineDocument = readFileSync(resolve(resolvedDirectory, 'machines.csv'), 'utf8');
  const skuDocument = readFileSync(resolve(resolvedDirectory, 'skus.csv'), 'utf8');
  const machineCsv = parseCsv(machineDocument);
  const skuCsv = parseCsv(skuDocument);
  assertHeader(machineCsv.shift() ?? [], MACHINE_HEADER);
  assertHeader(skuCsv.shift() ?? [], SKU_HEADER);
  validateMachineRows(machineCsv);
  validateSkuRows(skuCsv);

  if (
    manifest?.formatVersion !== 1 ||
    manifest?.packageId !== PACKAGE_ID ||
    manifest?.sourceDump?.sha256 !== SOURCE_DUMP_SHA256 ||
    manifest?.files?.['machines.csv']?.rowCount !== 14 ||
    manifest?.files?.['machines.csv']?.sha256 !== sha256Buffer(machineDocument) ||
    manifest?.files?.['skus.csv']?.rowCount !== 162 ||
    manifest?.files?.['skus.csv']?.sha256 !== sha256Buffer(skuDocument) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(manifest?.migrationTimestamp ?? '')
  ) {
    fail('R3_MANIFEST_CONTRACT_FAILED');
  }
  return { resolvedDirectory, manifest, machineRows: machineCsv, skuRows: skuCsv };
}
