#!/usr/bin/env node

import { closeSync, fsyncSync, openSync, writeFileSync } from 'node:fs';
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
  readProductionAuthorization,
  readProtectedInput,
  runCaptured,
  runPsqlCaptured,
  sha256File,
  verifyProductionQuiescence,
  verifyRollbackDeployment
} from './migration-tools-lib.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '../../..');

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) fail(`R3_REQUIRED_ENV_MISSING_${name}`);
  return value;
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
    { failureCode: 'R3_RESTORE_AUTHORITY_CHECK_FAILED' }
  );
  if (result.stdout.trim() !== 'true') fail('R3_RESTORE_SUPERUSER_REQUIRED');
}

function verifyCanonicalSchema(databaseUrl) {
  const result = runPsqlCaptured(
    databaseUrl,
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
    { failureCode: 'R3_RESTORE_SCHEMA_VERIFY_EXECUTION_FAILED' }
  );
  if (!result.stdout.includes('|PASS|') || result.stdout.split('\n').some((line) => line.split('|')[2] === 'FAIL')) {
    fail('R3_RESTORE_SCHEMA_VERIFY_FAILED');
  }
}

function verifyEmptyCatalog(databaseUrl) {
  const result = runPsqlCaptured(
    databaseUrl,
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
    { failureCode: 'R3_RESTORE_CATALOG_QUERY_FAILED' }
  );
  if (!result.stdout.split('\n').some((line) => line.trim() === '0|0')) fail('R3_RESTORE_CATALOG_NOT_EMPTY');
}

function main() {
  if (requiredEnvironment('PEAKS_R3_RESTORE_MODE') !== 'production-rollback') {
    fail('R3_RESTORE_MODE_INVALID');
  }
  if (requiredEnvironment('PEAKS_R3_ALLOW_DESTRUCTIVE_RESTORE') !== 'I_UNDERSTAND_FULL_DATABASE_RESTORE') {
    fail('R3_RESTORE_DESTRUCTIVE_GUARD_INVALID');
  }
  const databaseUrl = requiredEnvironment('PEAKS_R3_TARGET_DATABASE_URL');
  const protectedInput = readProtectedInput(requiredEnvironment('PEAKS_R3_PROTECTED_INPUT_DIR'));
  assertPathOutside(protectedInput.resolvedDirectory, [repositoryRoot], 'R3_PROTECTED_INPUT_LOCATION_INVALID');
  const backupPath = resolve(requiredEnvironment('PEAKS_R3_TARGET_BACKUP'));
  assertPathOutside(backupPath, [repositoryRoot], 'R3_TARGET_BACKUP_LOCATION_INVALID');
  const expectedBackupHash = requiredEnvironment('PEAKS_R3_TARGET_BACKUP_SHA256');
  if (sha256File(backupPath) !== expectedBackupHash) fail('R3_TARGET_BACKUP_HASH_MISMATCH');
  runCaptured('pg_restore', ['--list', backupPath], { failureCode: 'R3_TARGET_BACKUP_INVENTORY_FAILED' });

  const head = assertCleanExactGit(repositoryRoot);
  const packageDigest = packageTreeSha256(packageRoot);
  if (
    protectedInput.manifest.targetCommit !== head ||
    protectedInput.manifest.packageTreeSha256 !== packageDigest
  ) {
    fail('R3_CODE_OR_PACKAGE_BINDING_MISMATCH');
  }
  verifySuperuser(databaseUrl);
  const identityHash = databaseIdentitySha256(databaseUrl);
  const authorizationDetails = readProductionAuthorization(
    requiredEnvironment('PEAKS_R3_PRODUCTION_AUTHORIZATION'),
    {
      purpose: 'rollback',
      now: new Date(),
      head,
      packageTreeSha256: packageDigest,
      protectedInputManifestSha256: sha256File(
        resolve(protectedInput.resolvedDirectory, 'protected-input-manifest.json')
      ),
      databaseIdentitySha256: identityHash,
      backupPath,
      backupSha256: expectedBackupHash
    }
  );
  assertPathOutside(
    authorizationDetails.authorizationPath,
    [repositoryRoot, authorizationDetails.authorization.deployment.root],
    'R3_PRODUCTION_AUTHORIZATION_LOCATION_INVALID'
  );
  assertPathOutside(
    backupPath,
    [authorizationDetails.authorization.deployment.root],
    'R3_TARGET_BACKUP_LOCATION_INVALID'
  );
  verifyRollbackDeployment(authorizationDetails.authorization, head);
  verifyProductionQuiescence(databaseUrl);

  const rollbackReceiptPath = resolve(authorizationDetails.authorizationPath, '..', 'rollback-receipt.json');
  const receiptFileDescriptor = openSync(rollbackReceiptPath, 'wx', 0o600);
  try {
    const restoreEnvironment = libpqEnvironment(databaseUrl);
    runCaptured(
      'pg_restore',
      [
        '--clean',
        '--if-exists',
        '--exit-on-error',
        '--single-transaction',
        '--no-password',
        '--dbname',
        restoreEnvironment.PGDATABASE,
        backupPath
      ],
      {
        env: restoreEnvironment,
        failureCode: 'R3_PRODUCTION_DATABASE_RESTORE_FAILED'
      }
    );
    verifyCanonicalSchema(databaseUrl);
    verifyEmptyCatalog(databaseUrl);
    const receipt = {
      formatVersion: 1,
      packageId: PACKAGE_ID,
      status: 'PASS',
      completedAt: new Date().toISOString(),
      targetCommit: head,
      productionAuthorizationSha256: sha256File(authorizationDetails.authorizationPath),
      migrationReceiptSha256: sha256File(authorizationDetails.migrationReceiptPath),
      databaseIdentitySha256: identityHash,
      backupSha256: expectedBackupHash,
      schema: 'PASS',
      machines: 0,
      skus: 0
    };
    writeFileSync(receiptFileDescriptor, `${JSON.stringify(receipt, null, 2)}\n`);
    fsyncSync(receiptFileDescriptor);
  } finally {
    closeSync(receiptFileDescriptor);
  }
  console.log('R3_PRODUCTION_RESTORE_PASS|schema=true|machines=0|skus=0');
}

try {
  main();
} catch (error) {
  console.error(error?.code ?? 'R3_PRODUCTION_RESTORE_TOOL_FAILED');
  process.exitCode = 1;
}
