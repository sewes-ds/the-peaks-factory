import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import {
  getOperatorMachineByQr,
  getOperatorMachines,
  getOperatorSkus
} from '../../src/readModels/operatorReadModels.js';

const { Client } = pg;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`R3_HARNESS_REQUIRED_ENV_MISSING_${name}`);
  return value;
}

function readFirstProtectedToken(directory: string): string {
  const resolvedDirectory = resolve(directory);
  assert.equal(statSync(resolvedDirectory).mode & 0o777, 0o700, 'protected directory mode');
  const csvPath = resolve(resolvedDirectory, 'machines.csv');
  assert.equal(statSync(csvPath).mode & 0o777, 0o600, 'protected machine CSV mode');
  const csv = readFileSync(csvPath, 'utf8');
  const match = csv.match(/(?:^|\n)1,(?:"(?:[^"]|"")*"|[^\r\n,]*),([A-Za-z0-9_-]{32})\r?(?:\n|$)/);
  assert.ok(match, 'protected first machine row contract');
  return match[1];
}

const actor: ActorContext = {
  employeeId: -930001n,
  telegramUserId: -930001n
};

const client = new Client({ connectionString: requiredEnvironment('PEAKS_R3_READMODEL_DATABASE_URL') });
const pool = client as unknown as DbPool;
const token = readFirstProtectedToken(requiredEnvironment('PEAKS_R3_PROTECTED_INPUT_DIR'));

try {
  await client.connect();
  await client.query('set role app_runtime_role');

  const machines = await getOperatorMachines(pool, actor);
  assert.equal(machines.machines.length, 14);
  assert.ok(
    machines.machines.every(
      (machine) =>
        machine.workshop_name === null &&
        machine.machine_status === 'Свободен' &&
        machine.machine_use_status === 'Используется' &&
        machine.is_selectable_for_production
    )
  );

  const found = await getOperatorMachineByQr(pool, actor, token);
  assert.equal(found.found, true);
  if (found.found) assert.equal(found.machine.machine_id, '1');
  assert.deepEqual(await getOperatorMachineByQr(pool, actor, 'R3_missing_token_00000000000000'), {
    found: false,
    error_code: 'MACHINE_QR_NOT_FOUND'
  });

  const skus = await getOperatorSkus(pool);
  assert.equal(skus.skus.length, 162);
  assert.ok(
    skus.skus.every(
      (sku) =>
        sku.sku_unit_name === 'шт' &&
        sku.is_active &&
        typeof sku.current_sku_tariff_uzs === 'number'
    )
  );

  console.log('R3_CATALOG_READMODEL_HARNESS_PASS|machines=14|skus=162|qr_found=true|qr_missing=true');
} catch {
  console.error('R3_CATALOG_READMODEL_HARNESS_FAILED');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
