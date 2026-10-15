#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MACHINE_HEADER,
  PACKAGE_ID,
  SKU_HEADER,
  SOURCE_DUMP_SHA256,
  assertCleanExactGit,
  assertPathOutside,
  encodeCsv,
  fail,
  packageTreeSha256,
  runPsqlCaptured,
  sha256Buffer,
  sha256File,
  validateMachineRows,
  validateSkuRows
} from './migration-tools-lib.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '../../..');

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) fail(`R3_REQUIRED_ENV_MISSING_${name}`);
  return value;
}

function queryAcceptedSource(databaseUrl) {
  const sql = String.raw`
select json_build_object(
  'machines', coalesce((
    select json_agg(json_build_object(
      'source_machine_id', m.machine_id,
      'machine_name', m.machine_name
    ) order by m.machine_id)
    from app.machines m
  ), '[]'::json),
  'skus', coalesce((
    select json_agg(json_build_object(
      'source_sku_id', s.sku_id,
      'sku_code', s.sku_code,
      'sku_name', s.sku_name,
      'source_sku_unit_name', u.sku_unit_name,
      'current_sku_tariff_uzs', s.current_sku_tariff_uzs::text
    ) order by s.sku_id)
    from app.skus s
    join app.sku_units u on u.sku_unit_id = s.sku_unit_id
  ), '[]'::json)
)::text;
`;
  const result = runPsqlCaptured(databaseUrl, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    failureCode: 'R3_SOURCE_QUERY_FAILED'
  });
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    fail('R3_SOURCE_QUERY_RESULT_INVALID');
  }
}

function main() {
  const databaseUrl = requiredEnvironment('PEAKS_R3_SOURCE_DATABASE_URL');
  const dumpPath = resolve(requiredEnvironment('PEAKS_R3_SOURCE_DUMP'));
  const outputDirectory = assertPathOutside(
    requiredEnvironment('PEAKS_R3_PROTECTED_OUTPUT_DIR'),
    [repositoryRoot],
    'R3_PROTECTED_OUTPUT_PATH_INVALID'
  );
  const head = assertCleanExactGit(repositoryRoot);
  if (sha256File(dumpPath) !== SOURCE_DUMP_SHA256) fail('R3_SOURCE_DUMP_HASH_MISMATCH');

  const source = queryAcceptedSource(databaseUrl);
  const machineRows = (source.machines ?? []).map((machine) => [
    String(machine.source_machine_id),
    String(machine.machine_name),
    randomBytes(24).toString('base64url')
  ]);
  const skuRows = (source.skus ?? []).map((sku) => [
    String(sku.source_sku_id),
    String(sku.sku_code),
    String(sku.sku_name ?? ''),
    String(sku.source_sku_unit_name),
    String(sku.current_sku_tariff_uzs)
  ]);
  validateMachineRows(machineRows);
  validateSkuRows(skuRows);

  mkdirSync(outputDirectory, { mode: 0o700, recursive: false });
  chmodSync(outputDirectory, 0o700);
  const machineDocument = encodeCsv(machineRows, MACHINE_HEADER);
  const skuDocument = encodeCsv(skuRows, SKU_HEADER);
  const machinePath = resolve(outputDirectory, 'machines.csv');
  const skuPath = resolve(outputDirectory, 'skus.csv');
  writeFileSync(machinePath, machineDocument, { mode: 0o600, flag: 'wx' });
  writeFileSync(skuPath, skuDocument, { mode: 0o600, flag: 'wx' });
  chmodSync(machinePath, 0o600);
  chmodSync(skuPath, 0o600);

  const manifest = {
    formatVersion: 1,
    packageId: PACKAGE_ID,
    targetCommit: head,
    targetBaselineCommit: '2d487df089b148ae3e6ad5166ba0f70fc63f931f',
    packageTreeSha256: packageTreeSha256(packageRoot),
    migrationTimestamp: new Date().toISOString(),
    sourceDump: { sha256: SOURCE_DUMP_SHA256 },
    decisions: [
      'R3_MACHINE_STATUS_AVAILABLE',
      'R3_MACHINE_USE_STATUS_IN_USE',
      'R3_NEW_QR_TOKENS',
      'R3_NO_OPERATIONAL_HISTORY',
      'R3_SKU_D5_SCOPE'
    ],
    files: {
      'machines.csv': { rowCount: 14, sha256: sha256Buffer(machineDocument) },
      'skus.csv': { rowCount: 162, sha256: sha256Buffer(skuDocument) }
    }
  };
  const manifestPath = resolve(outputDirectory, 'protected-input-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  chmodSync(manifestPath, 0o600);
  console.log('R3_PROTECTED_INPUT_GENERATION_PASS|machines=14|skus=162|qr_generated=14');
}

try {
  main();
} catch (error) {
  console.error(error?.code ?? 'R3_PROTECTED_INPUT_GENERATION_FAILED');
  process.exitCode = 1;
}
