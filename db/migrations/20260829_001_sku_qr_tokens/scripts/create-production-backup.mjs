#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from './package-tools.mjs';
import { createVerifiedBackup } from './production-tools.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../../..');

function required(name) {
  const value = process.env[name];
  if (!value) fail(`SKU_QR_REQUIRED_ENV_MISSING_${name}`);
  return value;
}

function main() {
  process.umask(0o077);
  if (required('PEAKS_SKU_QR_BACKUP_MODE') !== 'production-backup-verify') fail('SKU_QR_BACKUP_MODE_INVALID');
  const result = createVerifiedBackup({
    databaseUrl: required('PEAKS_SKU_QR_DATABASE_URL'),
    outputDirectory: required('PEAKS_SKU_QR_BACKUP_OUTPUT_DIR'),
    repositoryRoot,
    packageRoot,
    deploymentRoot: required('PEAKS_SKU_QR_DEPLOYMENT_ROOT'),
    currentReleaseId: required('PEAKS_SKU_QR_EXPECTED_CURRENT_RELEASE_ID'),
  });
  process.stdout.write(`SKU_QR_PRODUCTION_BACKUP_PASS|backup_sha256=${result.receipt.backup.sha256}|receipt_sha256=${result.receiptSha256}\n`);
}

try { main(); } catch (error) {
  process.stderr.write(`${error?.code ?? 'SKU_QR_PRODUCTION_BACKUP_TOOL_FAILED'}\n`);
  process.exitCode = 1;
}
