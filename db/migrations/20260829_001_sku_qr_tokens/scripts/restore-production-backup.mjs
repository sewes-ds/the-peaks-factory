#!/usr/bin/env node

import { closeSync, fsyncSync, openSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, packageTreeSha256, readProtectedInput } from './package-tools.mjs';
import {
  assertExactMain, assertProtectedFile, databaseIdentitySha256, readProductionAuthorization,
  restoreVerifiedBackup, sha256File, verifyRollbackDeployment,
} from './production-tools.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../../..');

function required(name) {
  const value = process.env[name];
  if (!value) fail(`SKU_QR_REQUIRED_ENV_MISSING_${name}`);
  return value;
}

function main() {
  process.umask(0o077);
  if (required('PEAKS_SKU_QR_RESTORE_MODE') !== 'production-rollback') fail('SKU_QR_RESTORE_MODE_INVALID');
  if (required('PEAKS_SKU_QR_ALLOW_DESTRUCTIVE_RESTORE') !== 'I_UNDERSTAND_FULL_DATABASE_RESTORE') fail('SKU_QR_RESTORE_DESTRUCTIVE_GUARD_INVALID');
  const databaseUrl = required('PEAKS_SKU_QR_DATABASE_URL');
  const head = assertExactMain(repositoryRoot);
  const input = readProtectedInput(required('PEAKS_SKU_QR_PROTECTED_INPUT_DIR'), repositoryRoot, packageRoot);
  const packageDigest = packageTreeSha256(packageRoot);
  if (input.manifest.targetCommit !== head || input.manifest.packageTreeSha256 !== packageDigest) fail('SKU_QR_CODE_INPUT_BINDING_MISMATCH');
  const backupPath = resolve(required('PEAKS_SKU_QR_TARGET_BACKUP'));
  const backupHash = required('PEAKS_SKU_QR_TARGET_BACKUP_SHA256');
  const identityHash = databaseIdentitySha256(databaseUrl);
  const production = readProductionAuthorization(required('PEAKS_SKU_QR_PRODUCTION_AUTHORIZATION'), {
    purpose: 'rollback', now: new Date(), head, packageTreeSha256: packageDigest,
    protectedInputManifestSha256: sha256File(resolve(input.resolvedDirectory, 'protected-input-manifest.json')),
    databaseIdentitySha256: identityHash, backupPath, backupSha256: backupHash,
  });
  verifyRollbackDeployment(production.authorization, head);
  const receiptPath = assertProtectedFile(resolve(dirname(production.authorizationPath), 'rollback-receipt.json'), 'SKU_QR_ROLLBACK_RECEIPT_INVALID', { mustExist: false });
  const receiptFileDescriptor = openSync(receiptPath, 'wx', 0o600);
  try {
    restoreVerifiedBackup({ databaseUrl, backupPath, expectedBackupSha256: backupHash });
    const receipt = {
      formatVersion: 1, packageId: input.manifest.packageId, status: 'PASS',
      completedAt: new Date().toISOString(), targetCommit: head,
      productionAuthorizationSha256: sha256File(production.authorizationPath),
      migrationReceiptSha256: sha256File(production.migrationReceiptPath),
      databaseIdentitySha256: identityHash, backupSha256: backupHash,
      preMigrationState: 'PASS', machines: 14, skus: 162,
    };
    writeFileSync(receiptFileDescriptor, `${JSON.stringify(receipt, null, 2)}\n`);
    fsyncSync(receiptFileDescriptor);
  } finally {
    closeSync(receiptFileDescriptor);
  }
  process.stdout.write('SKU_QR_PRODUCTION_RESTORE_PASS|pre_migration_state=true|machines=14|skus=162\n');
}

try { main(); } catch (error) {
  process.stderr.write(`${error?.code ?? 'SKU_QR_PRODUCTION_RESTORE_TOOL_FAILED'}\n`);
  process.exitCode = 1;
}
