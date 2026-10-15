#!/usr/bin/env node

import { closeSync, fsyncSync, openSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PACKAGE_ID, assertCleanGit, fail, readProtectedInput, runPsqlCaptured,
} from './package-tools.mjs';
import {
  assertExactMain, databaseIdentitySha256, readProductionAuthorization, sha256File,
  verifyAuthorizedDeployment, verifyPreMigrationState, verifyProductionQuiescence,
} from './production-tools.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../../..');

function required(name) {
  const value = process.env[name];
  if (!value) fail(`SKU_QR_REQUIRED_ENV_MISSING_${name}`);
  return value;
}

function sqlLiteral(value) {
  if (/[\0\r\n]/.test(value)) fail('SKU_QR_SQL_META_VALUE_INVALID');
  return `'${value.replaceAll("'", "''")}'`;
}

function main() {
  const mode = required('PEAKS_SKU_QR_EXECUTION_MODE');
  if (!['rehearsal', 'production'].includes(mode)) fail('SKU_QR_EXECUTION_MODE_INVALID');
  const databaseUrl = required('PEAKS_SKU_QR_DATABASE_URL');
  const head = mode === 'production' ? assertExactMain(repositoryRoot) : assertCleanGit(repositoryRoot);
  const input = readProtectedInput(required('PEAKS_SKU_QR_PROTECTED_INPUT_DIR'), repositoryRoot, packageRoot);
  if (input.manifest.targetCommit !== head) fail('SKU_QR_CODE_INPUT_BINDING_MISMATCH');
  let production;
  let receiptFileDescriptor;
  let identityHash;
  let backupHash;
  if (mode === 'production') {
    const backupPath = resolve(required('PEAKS_SKU_QR_TARGET_BACKUP'));
    backupHash = required('PEAKS_SKU_QR_TARGET_BACKUP_SHA256');
    if (sha256File(backupPath) !== backupHash) fail('SKU_QR_TARGET_BACKUP_HASH_MISMATCH');
    identityHash = databaseIdentitySha256(databaseUrl);
    production = readProductionAuthorization(required('PEAKS_SKU_QR_PRODUCTION_AUTHORIZATION'), {
      now: new Date(), head, packageTreeSha256: input.manifest.packageTreeSha256,
      protectedInputManifestSha256: sha256File(resolve(input.resolvedDirectory, 'protected-input-manifest.json')),
      databaseIdentitySha256: identityHash, backupPath, backupSha256: backupHash,
    });
    verifyAuthorizedDeployment(production.authorization, head);
    verifyPreMigrationState(databaseUrl);
    verifyProductionQuiescence(databaseUrl);
    receiptFileDescriptor = openSync(production.migrationReceiptPath, 'wx', 0o600);
  }
  const driver = `\\set ON_ERROR_STOP on
begin;
\\set package_id ${sqlLiteral(PACKAGE_ID)}
\\set target_commit ${sqlLiteral(head)}
\\ir ${sqlLiteral(resolve(packageRoot, 'preflight.sql'))}
\\copy _sku_qr_stage (sku_id, sku_code, generated_protected_qr_token) from ${sqlLiteral(input.csvPath)} with (format csv, header true)
\\ir ${sqlLiteral(resolve(packageRoot, 'validate-input.sql'))}
\\ir ${sqlLiteral(resolve(packageRoot, 'apply.sql'))}
\\ir ${sqlLiteral(resolve(packageRoot, 'verify.sql'))}
commit;
`;
  try {
    const result = runPsqlCaptured(databaseUrl, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
      input: driver,
      failureCode: 'SKU_QR_TRANSACTION_FAILED',
    });
    const marker = result.stdout.split('\n').find((line) => line.startsWith('SKU_QR_MIGRATION_PASS|'));
    if (!/^SKU_QR_MIGRATION_PASS\|mode=(APPLY|NOOP)\|skus=162\|qr_distinct=162$/.test(marker ?? '')) {
      fail('SKU_QR_TRANSACTION_PASS_MARKER_MISSING');
    }
    if (mode === 'production') {
      const receipt = {
        formatVersion: 1, packageId: PACKAGE_ID, status: 'PASS', completedAt: new Date().toISOString(),
        targetCommit: head, packageTreeSha256: input.manifest.packageTreeSha256,
        protectedInputManifestSha256: sha256File(resolve(input.resolvedDirectory, 'protected-input-manifest.json')),
        productionAuthorizationSha256: sha256File(production.authorizationPath),
        databaseIdentitySha256: identityHash, backupSha256: backupHash,
        targetReleaseId: production.authorization.deployment.targetReleaseId, result: marker,
      };
      writeFileSync(receiptFileDescriptor, `${JSON.stringify(receipt, null, 2)}\n`);
      fsyncSync(receiptFileDescriptor);
    }
    process.stdout.write(`${marker}\n`);
  } finally {
    if (receiptFileDescriptor !== undefined) closeSync(receiptFileDescriptor);
  }
}

try { main(); } catch (error) {
  process.stderr.write(`${error?.code ?? 'SKU_QR_MIGRATION_RUNNER_FAILED'}\n`);
  process.exitCode = 1;
}
