import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  assertProtectedFile, canonicalNow, readProductionAuthorization, sha256File,
  verifyAuthorizedDeployment,
} from './production-tools.mjs';

const commit = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const inputDigest = 'c'.repeat(64);
const databaseDigest = 'd'.repeat(64);
const currentReleaseId = '20260829T120000Z-111111111111';
const targetReleaseId = '20260829T130000Z-aaaaaaaaaaaa';

function protectedWrite(path, value) {
  writeFileSync(path, value, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'sku-qr-production-tools.'));
  const evidence = resolve(root, 'evidence');
  const deployment = resolve(root, 'deployment');
  mkdirSync(evidence, { mode: 0o700 });
  mkdirSync(resolve(deployment, 'releases', currentReleaseId), { recursive: true });
  mkdirSync(resolve(deployment, 'releases', targetReleaseId), { recursive: true });
  const currentManifestPath = resolve(deployment, 'releases', currentReleaseId, 'release-manifest.json');
  const targetManifestPath = resolve(deployment, 'releases', targetReleaseId, 'release-manifest.json');
  writeFileSync(currentManifestPath, `${JSON.stringify({ release_id: currentReleaseId })}\n`);
  writeFileSync(targetManifestPath, `${JSON.stringify({
    release_id: targetReleaseId,
    source_commit: commit,
    database: { migration_packages: ['20260828_001_machine_sku_qr_catalog', '20260829_001_sku_qr_tokens'] },
    verification: { backup_required: true, backup_manifest_sha256: null },
    rollback: {
      strategy: 'release', previous_release_id: currentReleaseId,
      previous_manifest_sha256: sha256File(currentManifestPath), database_restore_required: false,
    },
  })}\n`);
  symlinkSync(`releases/${currentReleaseId}`, resolve(deployment, 'current'));
  const backupPath = resolve(evidence, 'production-pre-sku-qr.dump');
  protectedWrite(backupPath, 'synthetic backup');
  const completedAt = '2026-08-29T12:00:00Z';
  const restoreVerifiedAt = '2026-08-29T12:01:00Z';
  const backupReceiptPath = resolve(evidence, 'backup-receipt.json');
  const backupReceipt = {
    formatVersion: 1, packageId: '20260829_001_sku_qr_tokens', status: 'PASS', targetCommit: commit,
    packageTreeSha256: digest, databaseIdentitySha256: databaseDigest,
    currentRelease: { releaseId: currentReleaseId, manifestSha256: sha256File(currentManifestPath) },
    backup: { path: backupPath, sha256: sha256File(backupPath), sizeBytes: 16, completedAt, inventorySha256: 'e'.repeat(64) },
    restoreVerification: { verifiedAt: restoreVerifiedAt, preMigrationState: 'PASS', machines: 14, skus: 162, temporaryDatabaseRemoved: true },
  };
  protectedWrite(backupReceiptPath, `${JSON.stringify(backupReceipt, null, 2)}\n`);
  const authorizationPath = resolve(evidence, 'production-authorization.json');
  const authorization = {
    formatVersion: 1, packageId: '20260829_001_sku_qr_tokens', status: 'AUTHORIZED',
    targetCommit: commit, packageTreeSha256: digest, protectedInputManifestSha256: inputDigest,
    databaseIdentitySha256: databaseDigest,
    backup: {
      path: backupPath, sha256: sha256File(backupPath), receiptPath: backupReceiptPath,
      receiptSha256: sha256File(backupReceiptPath), completedAt, restoreVerifiedAt,
    },
    deployment: {
      root: deployment, currentReleaseId, currentManifestSha256: sha256File(currentManifestPath),
      targetReleaseId, targetManifestSha256: sha256File(targetManifestPath),
    },
    evidence: { migrationReceiptPath: resolve(evidence, 'migration-receipt.json') },
    maintenanceWindow: { startsAt: '2026-08-29T12:02:00Z', endsAt: '2026-08-29T13:02:00Z' },
    rollback: { method: 'FULL_BACKUP_RESTORE_BEFORE_TRAFFIC', operator: 'devops' },
    approval: { decision: 'AUTHORIZE_SKU_QR_PRODUCTION_EXECUTION', approvedBy: 'project_owner', approvedAt: '2026-08-29T12:02:00Z' },
  };
  const target = JSON.parse(readFileSync(targetManifestPath, 'utf8'));
  target.verification.backup_manifest_sha256 = authorization.backup.receiptSha256;
  writeFileSync(targetManifestPath, `${JSON.stringify(target)}\n`);
  authorization.deployment.targetManifestSha256 = sha256File(targetManifestPath);
  protectedWrite(authorizationPath, `${JSON.stringify(authorization, null, 2)}\n`);
  return { root, evidence, deployment, authorizationPath, authorization, backupPath, targetManifestPath };
}

test('canonical production timestamps use whole UTC seconds', () => {
  assert.match(canonicalNow(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});

test('protected files require an owner-only parent and exact file mode', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'sku-qr-protected.'));
  try {
    chmodSync(root, 0o700);
    const path = resolve(root, 'value.json');
    protectedWrite(path, '{}\n');
    assert.equal(assertProtectedFile(path, 'FAIL'), path);
    chmodSync(path, 0o644);
    assert.throws(() => assertProtectedFile(path, 'FAIL'), /FAIL/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('production authorization binds backup, release, window, and receipt path', () => {
  const value = fixture();
  try {
    const details = readProductionAuthorization(value.authorizationPath, {
      now: new Date('2026-08-29T12:30:00Z'), head: commit, packageTreeSha256: digest,
      protectedInputManifestSha256: inputDigest, databaseIdentitySha256: databaseDigest,
      backupPath: value.backupPath, backupSha256: sha256File(value.backupPath),
    });
    assert.equal(details.authorization.deployment.targetReleaseId, targetReleaseId);
    verifyAuthorizedDeployment(details.authorization, commit);
    writeFileSync(value.targetManifestPath, '{}\n');
    assert.throws(() => verifyAuthorizedDeployment(details.authorization, commit), /SKU_QR_PRODUCTION_TARGET_MANIFEST_HASH_INVALID/);
  } finally { rmSync(value.root, { recursive: true, force: true }); }
});
