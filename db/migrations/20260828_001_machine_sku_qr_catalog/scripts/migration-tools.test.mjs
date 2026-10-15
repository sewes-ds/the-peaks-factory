import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  MACHINE_HEADER,
  SKU_HEADER,
  encodeCsv,
  libpqEnvironment,
  parseCsv,
  readProductionAuthorization,
  sha256File,
  validateMachineRows,
  validateSkuRows
} from './migration-tools-lib.mjs';

test('CSV codec preserves commas, quotes, and Cyrillic text', () => {
  const rows = [['1', 'Станок, "A"', 'A_23456789012345678901234567890']];
  assert.deepEqual(parseCsv(encodeCsv(rows, MACHINE_HEADER)), [MACHINE_HEADER, ...rows]);
});

test('accepted protected input shapes pass', () => {
  const machines = Array.from({ length: 14 }, (_, index) => [
    String(index + 1),
    `Станок ${index + 1}`,
    `token_${String(index + 1).padStart(26, '0')}`
  ]);
  const skus = Array.from({ length: 162 }, (_, index) => [
    String(index + 1),
    `SKU-${index + 1}`,
    `Изделие ${index + 1}`,
    'шт',
    '100.0000'
  ]);
  validateMachineRows(machines);
  validateSkuRows(skus);
  assert.deepEqual(parseCsv(encodeCsv(skus, SKU_HEADER)), [SKU_HEADER, ...skus]);
});

test('duplicate protected QR is rejected', () => {
  const machines = Array.from({ length: 14 }, (_, index) => [
    String(index + 1),
    `Machine ${index + 1}`,
    'same_token_123456789012345678901'
  ]);
  assert.throws(() => validateMachineRows(machines), /R3_MACHINE_VALUE_CONTRACT_FAILED/);
});

test('database URI becomes libpq environment without an argv connection string', () => {
  const environment = libpqEnvironment(
    'postgresql://migration_role@database.internal:5433/factory?sslmode=require&application_name=r3',
    { PGPASSWORD: 'inherited-value', KEEP: 'yes' }
  );
  assert.deepEqual(
    {
      PGAPPNAME: environment.PGAPPNAME,
      PGDATABASE: environment.PGDATABASE,
      PGHOST: environment.PGHOST,
      PGPASSWORD: environment.PGPASSWORD,
      PGPORT: environment.PGPORT,
      PGSSLMODE: environment.PGSSLMODE,
      PGUSER: environment.PGUSER,
      KEEP: environment.KEEP
    },
    {
      PGAPPNAME: 'r3',
      PGDATABASE: 'factory',
      PGHOST: 'database.internal',
      PGPASSWORD: undefined,
      PGPORT: '5433',
      PGSSLMODE: 'require',
      PGUSER: 'migration_role',
      KEEP: 'yes'
    }
  );
  assert.throws(
    () => libpqEnvironment('postgresql://migration_role@database.internal:5433/factory?unknown=value'),
    /R3_DATABASE_URL_PARAMETER_UNSUPPORTED/
  );
});

test('production authorization is bound to code, input, backup, database, release, window, and receipt path', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'r3-production-authorization-'));
  chmodSync(directory, 0o700);
  try {
    const backupPath = resolve(directory, 'production-pre-r3.dump');
    const backupReceiptPath = resolve(directory, 'backup-receipt.json');
    const authorizationPath = resolve(directory, 'production-authorization.json');
    const migrationReceiptPath = resolve(directory, 'migration-receipt.json');
    writeFileSync(backupPath, 'backup', { mode: 0o600 });
    chmodSync(backupPath, 0o600);

    const context = {
      now: new Date('2026-08-28T12:30:00Z'),
      head: 'a'.repeat(40),
      packageTreeSha256: 'b'.repeat(64),
      protectedInputManifestSha256: 'c'.repeat(64),
      databaseIdentitySha256: 'd'.repeat(64),
      backupPath,
      backupSha256: sha256File(backupPath)
    };
    const backupReceipt = {
      formatVersion: 1,
      packageId: '20260828_001_machine_sku_qr_catalog',
      status: 'PASS',
      targetCommit: context.head,
      packageTreeSha256: context.packageTreeSha256,
      databaseIdentitySha256: context.databaseIdentitySha256,
      currentRelease: {
        releaseId: '20260827T052628Z-eb5d6c42ab23',
        manifestSha256: 'e'.repeat(64)
      },
      backup: {
        path: backupPath,
        sha256: context.backupSha256,
        sizeBytes: 6,
        completedAt: '2026-08-28T11:00:00Z',
        inventorySha256: '1'.repeat(64)
      },
      restoreVerification: {
        verifiedAt: '2026-08-28T11:10:00Z',
        schema: 'PASS',
        machines: 0,
        skus: 0,
        temporaryDatabaseRemoved: true
      }
    };
    writeFileSync(backupReceiptPath, `${JSON.stringify(backupReceipt)}\n`, { mode: 0o600 });
    chmodSync(backupReceiptPath, 0o600);
    const authorization = {
      formatVersion: 1,
      packageId: '20260828_001_machine_sku_qr_catalog',
      status: 'AUTHORIZED',
      targetCommit: context.head,
      packageTreeSha256: context.packageTreeSha256,
      protectedInputManifestSha256: context.protectedInputManifestSha256,
      databaseIdentitySha256: context.databaseIdentitySha256,
      backup: {
        path: backupPath,
        sha256: context.backupSha256,
        receiptPath: backupReceiptPath,
        receiptSha256: sha256File(backupReceiptPath),
        completedAt: '2026-08-28T11:00:00Z',
        restoreVerifiedAt: '2026-08-28T11:10:00Z'
      },
      deployment: {
        root: '/srv/the-peaks-factory',
        currentReleaseId: '20260827T052628Z-eb5d6c42ab23',
        currentManifestSha256: 'e'.repeat(64),
        targetReleaseId: '20260828T120000Z-aaaaaaaaaaaa',
        targetManifestSha256: 'f'.repeat(64)
      },
      evidence: { migrationReceiptPath },
      maintenanceWindow: {
        startsAt: '2026-08-28T12:00:00Z',
        endsAt: '2026-08-28T13:00:00Z'
      },
      rollback: {
        method: 'FULL_BACKUP_RESTORE_BEFORE_TRAFFIC',
        operator: 'release-operator'
      },
      approval: {
        decision: 'AUTHORIZE_R3_PRODUCTION_EXECUTION',
        approvedBy: 'project-owner',
        approvedAt: '2026-08-28T11:30:00Z'
      }
    };
    writeFileSync(authorizationPath, `${JSON.stringify(authorization)}\n`, { mode: 0o600 });
    chmodSync(authorizationPath, 0o600);

    const result = readProductionAuthorization(authorizationPath, context);
    assert.equal(result.migrationReceiptPath, migrationReceiptPath);
    assert.equal(result.authorization.deployment.targetReleaseId, '20260828T120000Z-aaaaaaaaaaaa');

    writeFileSync(migrationReceiptPath, '', { mode: 0o600 });
    assert.throws(
      () => readProductionAuthorization(authorizationPath, context),
      /R3_PRODUCTION_AUTHORIZATION_EVIDENCE_INVALID/
    );
    const rollbackResult = readProductionAuthorization(authorizationPath, {
      ...context,
      purpose: 'rollback',
      now: new Date('2026-08-29T12:00:00Z')
    });
    assert.equal(rollbackResult.migrationReceiptPath, migrationReceiptPath);
    unlinkSync(migrationReceiptPath);

    authorization.unexpected = true;
    writeFileSync(authorizationPath, `${JSON.stringify(authorization)}\n`);
    assert.throws(
      () => readProductionAuthorization(authorizationPath, context),
      /R3_PRODUCTION_AUTHORIZATION_SHAPE_INVALID/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
