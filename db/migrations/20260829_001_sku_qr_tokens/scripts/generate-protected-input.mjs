#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PACKAGE_ID, SKU_HEADER, assertCleanGit, assertPathOutside, encodeCsv, fail,
  packageTreeSha256, runPsqlCaptured, sha256Buffer, validateSkuRows,
} from './package-tools.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../../..');

function required(name) {
  const value = process.env[name];
  if (!value) fail(`SKU_QR_REQUIRED_ENV_MISSING_${name}`);
  return value;
}

function main() {
  process.umask(0o077);
  const databaseUrl = required('PEAKS_SKU_QR_DATABASE_URL');
  const output = assertPathOutside(required('PEAKS_SKU_QR_PROTECTED_OUTPUT_DIR'), [repositoryRoot, '/srv/the-peaks-factory'], 'SKU_QR_PROTECTED_OUTPUT_INVALID');
  const head = assertCleanGit(repositoryRoot);
  const query = runPsqlCaptured(databaseUrl, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `
    begin read only;
    select json_build_object(
      'current_user', current_user,
      'skus', json_agg(json_build_object('sku_id', sku_id::text, 'sku_code', sku_code) order by sku_id)
    )::text from app.skus;
    commit;
  `], { failureCode: 'SKU_QR_SOURCE_QUERY_FAILED' });
  let source;
  try { source = JSON.parse(query.stdout.split('\n').find((line) => line.trim().startsWith('{')) ?? ''); }
  catch { fail('SKU_QR_SOURCE_RESULT_INVALID'); }
  if (source.current_user !== 'app_runtime_role' || !Array.isArray(source.skus)) fail('SKU_QR_SOURCE_AUTHORITY_INVALID');
  const rows = validateSkuRows(source.skus.map((sku) => [String(sku.sku_id), String(sku.sku_code), randomBytes(24).toString('base64url')]));
  mkdirSync(output, { mode: 0o700, recursive: false });
  chmodSync(output, 0o700);
  const csv = encodeCsv(rows, SKU_HEADER);
  const csvPath = resolve(output, 'skus.csv');
  writeFileSync(csvPath, csv, { mode: 0o600, flag: 'wx' });
  chmodSync(csvPath, 0o600);
  const manifest = {
    formatVersion: 1,
    packageId: PACKAGE_ID,
    targetCommit: head,
    packageTreeSha256: packageTreeSha256(packageRoot),
    generatedAt: new Date().toISOString(),
    payloadFormat: 'peaks-sku:v1:<protected-token>',
    files: { 'skus.csv': { rowCount: 162, sha256: sha256Buffer(csv) } },
  };
  const manifestPath = resolve(output, 'protected-input-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  chmodSync(manifestPath, 0o600);
  process.stdout.write('SKU_QR_PROTECTED_INPUT_GENERATION_PASS|skus=162|qr_generated=162\n');
}

try { main(); } catch (error) {
  process.stderr.write(`${error?.code ?? 'SKU_QR_PROTECTED_INPUT_GENERATION_FAILED'}\n`);
  process.exitCode = 1;
}
