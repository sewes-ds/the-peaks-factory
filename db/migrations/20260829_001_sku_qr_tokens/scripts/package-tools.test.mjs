import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SKU_HEADER, encodeCsv, libpqEnvironment, parseCsv, validateSkuRows,
} from './package-tools.mjs';

function rows(count = 162) {
  return Array.from({ length: count }, (_, index) => [
    String(index + 1),
    `SKU-${index + 1}`,
    `token_${String(index + 1).padStart(26, '0')}`,
  ]);
}

test('protected CSV preserves punctuation and Cyrillic without disclosure helpers', () => {
  const input = rows();
  input[0][1] = 'SKU, «Особый»';
  const document = encodeCsv(input, SKU_HEADER);
  assert.deepEqual(parseCsv(document), [SKU_HEADER, ...input]);
  assert.equal(validateSkuRows(parseCsv(document).slice(1)).length, 162);
});

test('SKU QR tokens must be exactly unique base64url values', () => {
  const input = rows();
  input[1][2] = input[0][2];
  assert.throws(() => validateSkuRows(input), /SKU_QR_INPUT_UNIQUENESS_FAILED/);
  assert.throws(() => validateSkuRows(rows(161)), /SKU_QR_INPUT_COUNT_FAILED/);
  const invalid = rows(); invalid[0][2] = 'not valid';
  assert.throws(() => validateSkuRows(invalid), /SKU_QR_INPUT_VALUE_FAILED/);
});

test('database URL is converted to libpq environment and unknown weakening parameters fail', () => {
  const environment = libpqEnvironment('postgresql://migration_role:change-me@db.internal:5433/factory?sslmode=require&application_name=sku_qr', { KEEP: 'yes' });
  assert.deepEqual({
    host: environment.PGHOST, port: environment.PGPORT, database: environment.PGDATABASE,
    user: environment.PGUSER, password: environment.PGPASSWORD, ssl: environment.PGSSLMODE,
    app: environment.PGAPPNAME, keep: environment.KEEP,
  }, {
    host: 'db.internal', port: '5433', database: 'factory', user: 'migration_role',
    password: 'change-me', ssl: 'require', app: 'sku_qr', keep: 'yes',
  });
  assert.throws(() => libpqEnvironment('postgresql://role@db/factory?connect_timeout=1'), /SKU_QR_DATABASE_URL_PARAMETER_UNSUPPORTED/);
});
