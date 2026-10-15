#!/usr/bin/env node

import { closeSync, fsyncSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PACKAGE_ID,
  assertCleanExactGit,
  assertPathOutside,
  databaseIdentitySha256,
  fail,
  packageTreeSha256,
  readProductionAuthorization,
  readProtectedInput,
  runCaptured,
  runPsqlCaptured,
  sha256File,
  verifyAuthorizedDeployment,
  verifyProductionQuiescence
} from './migration-tools-lib.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '../../..');

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) fail(`R3_REQUIRED_ENV_MISSING_${name}`);
  return value;
}

function sqlLiteral(value) {
  if (/[\0\r\n]/.test(value)) fail('R3_SQL_META_VALUE_INVALID');
  return `'${value.replaceAll("'", "''")}'`;
}

function verifyCanonicalSchema(databaseUrl, stage) {
  const result = runPsqlCaptured(
    databaseUrl,
    ['-X', '-q', '-A', '-t', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-f', resolve(repositoryRoot, 'db/verify/verify_schema.sql')],
    { failureCode: `R3_${stage}_SCHEMA_VERIFY_EXECUTION_FAILED` }
  );
  if (!result.stdout.includes('|PASS|') || result.stdout.split('\n').some((line) => line.split('|')[2] === 'FAIL')) {
    fail(`R3_${stage}_SCHEMA_VERIFY_FAILED`);
  }
}

function verifyDatabaseAuthority(databaseUrl) {
  const sql = String.raw`
select case
  when current_user = 'app_runtime_role' then 'REJECTED'
  when (select rolsuper from pg_catalog.pg_roles where rolname = current_user) then 'AUTHORIZED'
  when current_user = 'migration_role' then 'AUTHORIZED'
  when pg_catalog.pg_has_role(current_user, 'migration_role', 'MEMBER') then 'AUTHORIZED'
  else 'REJECTED'
end;
`;
  const result = runPsqlCaptured(
    databaseUrl,
    ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { failureCode: 'R3_DATABASE_AUTHORITY_CHECK_FAILED' }
  );
  if (result.stdout.trim() !== 'AUTHORIZED') fail('R3_DATABASE_AUTHORITY_REJECTED');
}

function executeTransaction(databaseUrl, protectedInput) {
  const machinePath = resolve(protectedInput.resolvedDirectory, 'machines.csv');
  const skuPath = resolve(protectedInput.resolvedDirectory, 'skus.csv');
  const driver = String.raw`\set ON_ERROR_STOP on
begin;
\set package_id ${sqlLiteral(PACKAGE_ID)}
\set target_commit ${sqlLiteral(protectedInput.manifest.targetCommit)}
\set migration_timestamp ${sqlLiteral(protectedInput.manifest.migrationTimestamp)}
\ir ${sqlLiteral(resolve(packageRoot, 'preflight.sql'))}
\copy _r3_machine_stage (source_machine_id, machine_name, generated_protected_qr_token) from ${sqlLiteral(machinePath)} with (format csv, header true)
\copy _r3_sku_stage (source_sku_id, sku_code, sku_name, source_sku_unit_name, current_sku_tariff_uzs) from ${sqlLiteral(skuPath)} with (format csv, header true)
\ir ${sqlLiteral(resolve(packageRoot, 'validate-input.sql'))}
\ir ${sqlLiteral(resolve(packageRoot, 'apply.sql'))}
\ir ${sqlLiteral(resolve(packageRoot, 'verify.sql'))}
commit;
`;
  const result = runPsqlCaptured(databaseUrl, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
    input: driver,
    failureCode: 'R3_TRANSACTION_FAILED'
  });
  const passLine = result.stdout.split('\n').find((line) => line.startsWith('R3_MIGRATION_PASS|'));
  if (!passLine || !/^R3_MIGRATION_PASS\|mode=(APPLY|NOOP)\|machines=14\|skus=162\|qr_distinct=14$/.test(passLine)) {
    fail('R3_TRANSACTION_PASS_MARKER_MISSING');
  }
  return passLine;
}

function writeProductionReceipt({ receiptFileDescriptor, authorizationDetails, head, packageDigest, protectedInput, backupHash, identityHash, passLine }) {
  const receipt = {
    formatVersion: 1,
    packageId: PACKAGE_ID,
    status: 'PASS',
    completedAt: new Date().toISOString(),
    targetCommit: head,
    packageTreeSha256: packageDigest,
    protectedInputManifestSha256: sha256File(
      resolve(protectedInput.resolvedDirectory, 'protected-input-manifest.json')
    ),
    productionAuthorizationSha256: sha256File(authorizationDetails.authorizationPath),
    databaseIdentitySha256: identityHash,
    backupSha256: backupHash,
    targetReleaseId: authorizationDetails.authorization.deployment.targetReleaseId,
    result: passLine
  };
  writeFileSync(
    receiptFileDescriptor,
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  fsyncSync(receiptFileDescriptor);
}

function main() {
  const executionMode = requiredEnvironment('PEAKS_R3_EXECUTION_MODE');
  if (!['rehearsal', 'production'].includes(executionMode)) fail('R3_EXECUTION_MODE_INVALID');
  const databaseUrl = requiredEnvironment('PEAKS_R3_TARGET_DATABASE_URL');
  const protectedInput = readProtectedInput(requiredEnvironment('PEAKS_R3_PROTECTED_INPUT_DIR'));
  assertPathOutside(protectedInput.resolvedDirectory, [repositoryRoot], 'R3_PROTECTED_INPUT_LOCATION_INVALID');
  const backupPath = resolve(requiredEnvironment('PEAKS_R3_TARGET_BACKUP'));
  assertPathOutside(backupPath, [repositoryRoot], 'R3_TARGET_BACKUP_LOCATION_INVALID');
  const expectedBackupHash = requiredEnvironment('PEAKS_R3_TARGET_BACKUP_SHA256');
  const head = assertCleanExactGit(repositoryRoot);
  const packageDigest = packageTreeSha256(packageRoot);
  if (
    protectedInput.manifest.targetCommit !== head ||
    protectedInput.manifest.packageTreeSha256 !== packageDigest
  ) {
    fail('R3_CODE_OR_PACKAGE_BINDING_MISMATCH');
  }
  if (sha256File(backupPath) !== expectedBackupHash) fail('R3_TARGET_BACKUP_HASH_MISMATCH');
  runCaptured('pg_restore', ['--list', backupPath], { failureCode: 'R3_TARGET_BACKUP_INVENTORY_FAILED' });

  verifyDatabaseAuthority(databaseUrl);
  verifyCanonicalSchema(databaseUrl, 'PRE');
  let production;
  let identityHash;
  let receiptFileDescriptor;
  if (executionMode === 'production') {
    identityHash = databaseIdentitySha256(databaseUrl);
    production = readProductionAuthorization(requiredEnvironment('PEAKS_R3_PRODUCTION_AUTHORIZATION'), {
      now: new Date(),
      head,
      packageTreeSha256: packageDigest,
      protectedInputManifestSha256: sha256File(
        resolve(protectedInput.resolvedDirectory, 'protected-input-manifest.json')
      ),
      databaseIdentitySha256: identityHash,
      backupPath,
      backupSha256: expectedBackupHash
    });
    assertPathOutside(
      production.authorizationPath,
      [repositoryRoot, production.authorization.deployment.root],
      'R3_PRODUCTION_AUTHORIZATION_LOCATION_INVALID'
    );
    assertPathOutside(
      production.migrationReceiptPath,
      [repositoryRoot, production.authorization.deployment.root],
      'R3_PRODUCTION_RECEIPT_LOCATION_INVALID'
    );
    assertPathOutside(
      backupPath,
      [production.authorization.deployment.root],
      'R3_TARGET_BACKUP_LOCATION_INVALID'
    );
    verifyAuthorizedDeployment(production.authorization, head);
    verifyProductionQuiescence(databaseUrl);
    receiptFileDescriptor = openSync(production.migrationReceiptPath, 'wx', 0o600);
  }
  try {
    const passLine = executeTransaction(databaseUrl, protectedInput);
    verifyCanonicalSchema(databaseUrl, 'POST');
    if (executionMode === 'production') {
      writeProductionReceipt({
        receiptFileDescriptor,
        authorizationDetails: production,
        head,
        packageDigest,
        protectedInput,
        backupHash: expectedBackupHash,
        identityHash,
        passLine
      });
    }
    console.log(passLine);
  } finally {
    if (receiptFileDescriptor !== undefined) closeSync(receiptFileDescriptor);
  }
}

try {
  main();
} catch (error) {
  console.error(error?.code ?? 'R3_MIGRATION_RUNNER_FAILED');
  process.exitCode = 1;
}
