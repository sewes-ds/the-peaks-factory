#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PACKAGE_ID,
  assertCleanExactGit,
  assertPathOutside,
  databaseIdentitySha256,
  fail,
  libpqEnvironment,
  packageTreeSha256,
  runCaptured,
  runPsqlCaptured,
  sha256Buffer,
  sha256File
} from './migration-tools-lib.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '../../..');

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) fail(`R3_REQUIRED_ENV_MISSING_${name}`);
  return value;
}

function canonicalNow() {
  return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace('.000Z', 'Z');
}

function verifySuperuser(databaseUrl) {
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
      "select coalesce((select rolsuper::text from pg_catalog.pg_roles where rolname = current_user), 'false');"
    ],
    { failureCode: 'R3_BACKUP_AUTHORITY_CHECK_FAILED' }
  );
  if (result.stdout.trim() !== 'true') fail('R3_BACKUP_SUPERUSER_REQUIRED');
}

function verifyCanonicalSchema(databaseUrl, databaseOverride, stage) {
  const environment = libpqEnvironment(databaseUrl);
  if (databaseOverride !== undefined) environment.PGDATABASE = databaseOverride;
  const result = runCaptured(
    'psql',
    [
      '-X',
      '-q',
      '-A',
      '-t',
      '-F',
      '|',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      resolve(repositoryRoot, 'db/verify/verify_schema.sql')
    ],
    { env: environment, failureCode: `R3_BACKUP_${stage}_SCHEMA_VERIFY_EXECUTION_FAILED` }
  );
  if (!result.stdout.includes('|PASS|') || result.stdout.split('\n').some((line) => line.split('|')[2] === 'FAIL')) {
    fail(`R3_BACKUP_${stage}_SCHEMA_VERIFY_FAILED`);
  }
}

function verifyEmptyCatalog(databaseUrl, databaseOverride, stage) {
  const environment = libpqEnvironment(databaseUrl);
  if (databaseOverride !== undefined) environment.PGDATABASE = databaseOverride;
  const result = runCaptured(
    'psql',
    [
      '-X',
      '-q',
      '-A',
      '-t',
      '-F',
      '|',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'begin transaction read only; select count(*), (select count(*) from app.skus) from app.machines; commit;'
    ],
    { env: environment, failureCode: `R3_BACKUP_${stage}_CATALOG_QUERY_FAILED` }
  );
  if (!result.stdout.split('\n').some((line) => line.trim() === '0|0')) fail(`R3_BACKUP_${stage}_CATALOG_NOT_EMPTY`);
}

function verifyCurrentRelease(deploymentRoot, expectedReleaseId) {
  if (resolve(deploymentRoot) !== deploymentRoot || !/^\d{8}T\d{6}Z-[a-f0-9]{12}$/.test(expectedReleaseId)) {
    fail('R3_BACKUP_CURRENT_RELEASE_INPUT_INVALID');
  }
  const currentLink = resolve(deploymentRoot, 'current');
  if (!lstatSync(currentLink).isSymbolicLink()) fail('R3_BACKUP_CURRENT_RELEASE_INVALID');
  const expectedRelative = `releases/${expectedReleaseId}`;
  if (
    readlinkSync(currentLink) !== expectedRelative ||
    realpathSync(currentLink) !== resolve(deploymentRoot, expectedRelative)
  ) {
    fail('R3_BACKUP_CURRENT_RELEASE_INVALID');
  }
  const manifestPath = resolve(deploymentRoot, expectedRelative, 'release-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    fail('R3_BACKUP_CURRENT_MANIFEST_INVALID');
  }
  if (manifest.release_id !== expectedReleaseId) fail('R3_BACKUP_CURRENT_MANIFEST_INVALID');
  return sha256File(manifestPath);
}

function main() {
  process.umask(0o077);
  if (requiredEnvironment('PEAKS_R3_BACKUP_MODE') !== 'production-backup-verify') {
    fail('R3_BACKUP_MODE_INVALID');
  }
  const databaseUrl = requiredEnvironment('PEAKS_R3_TARGET_DATABASE_URL');
  const outputDirectoryInput = requiredEnvironment('PEAKS_R3_BACKUP_OUTPUT_DIR');
  const deploymentRoot = requiredEnvironment('PEAKS_R3_DEPLOYMENT_ROOT');
  const currentReleaseId = requiredEnvironment('PEAKS_R3_EXPECTED_CURRENT_RELEASE_ID');
  const outputDirectory = assertPathOutside(
    outputDirectoryInput,
    [repositoryRoot, deploymentRoot],
    'R3_BACKUP_OUTPUT_PATH_INVALID'
  );
  if (existsSync(outputDirectory)) fail('R3_BACKUP_OUTPUT_ALREADY_EXISTS');

  const head = assertCleanExactGit(repositoryRoot);
  const packageDigest = packageTreeSha256(packageRoot);
  const currentManifestSha256 = verifyCurrentRelease(deploymentRoot, currentReleaseId);
  verifySuperuser(databaseUrl);
  verifyCanonicalSchema(databaseUrl, undefined, 'SOURCE');
  verifyEmptyCatalog(databaseUrl, undefined, 'SOURCE');
  const identityHash = databaseIdentitySha256(databaseUrl);

  mkdirSync(outputDirectory, { mode: 0o700, recursive: false });
  chmodSync(outputDirectory, 0o700);
  const backupPath = resolve(outputDirectory, 'production-pre-r3.dump');
  const backupEnvironment = libpqEnvironment(databaseUrl);
  runCaptured(
    'pg_dump',
    [
      '--format=custom',
      '--serializable-deferrable',
      '--no-password',
      '--file',
      backupPath
    ],
    { env: backupEnvironment, failureCode: 'R3_PRODUCTION_BACKUP_FAILED' }
  );
  chmodSync(backupPath, 0o600);
  const completedAt = canonicalNow();
  const inventory = runCaptured('pg_restore', ['--list', backupPath], {
    failureCode: 'R3_PRODUCTION_BACKUP_INVENTORY_FAILED'
  });

  const restoreDatabase = `r3_restore_verify_${randomBytes(8).toString('hex')}`;
  let restoreCreated = false;
  try {
    runCaptured(
      'createdb',
      ['--maintenance-db=postgres', '--template=template0', restoreDatabase],
      { env: backupEnvironment, failureCode: 'R3_PRODUCTION_BACKUP_RESTORE_DATABASE_CREATE_FAILED' }
    );
    restoreCreated = true;
    const restoreEnvironment = { ...backupEnvironment, PGDATABASE: restoreDatabase };
    runCaptured(
      'pg_restore',
      ['--exit-on-error', '--single-transaction', '--dbname', restoreDatabase, backupPath],
      { env: restoreEnvironment, failureCode: 'R3_PRODUCTION_BACKUP_RESTORE_FAILED' }
    );
    verifyCanonicalSchema(databaseUrl, restoreDatabase, 'RESTORE');
    verifyEmptyCatalog(databaseUrl, restoreDatabase, 'RESTORE');
  } finally {
    if (restoreCreated) {
      runCaptured(
        'dropdb',
        ['--maintenance-db=postgres', restoreDatabase],
        { env: backupEnvironment, failureCode: 'R3_PRODUCTION_BACKUP_RESTORE_DATABASE_DROP_FAILED' }
      );
    }
  }
  const restoreVerifiedAt = canonicalNow();

  const receipt = {
    formatVersion: 1,
    packageId: PACKAGE_ID,
    status: 'PASS',
    targetCommit: head,
    packageTreeSha256: packageDigest,
    databaseIdentitySha256: identityHash,
    currentRelease: {
      releaseId: currentReleaseId,
      manifestSha256: currentManifestSha256
    },
    backup: {
      path: backupPath,
      sha256: sha256File(backupPath),
      sizeBytes: statSync(backupPath).size,
      completedAt,
      inventorySha256: sha256Buffer(inventory.stdout)
    },
    restoreVerification: {
      verifiedAt: restoreVerifiedAt,
      schema: 'PASS',
      machines: 0,
      skus: 0,
      temporaryDatabaseRemoved: true
    }
  };
  const receiptPath = resolve(outputDirectory, 'backup-receipt.json');
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  chmodSync(receiptPath, 0o600);
  console.log(
    `R3_PRODUCTION_BACKUP_PASS|backup_sha256=${receipt.backup.sha256}|receipt_sha256=${sha256File(receiptPath)}`
  );
}

try {
  main();
} catch (error) {
  console.error(error?.code ?? 'R3_PRODUCTION_BACKUP_TOOL_FAILED');
  process.exitCode = 1;
}
