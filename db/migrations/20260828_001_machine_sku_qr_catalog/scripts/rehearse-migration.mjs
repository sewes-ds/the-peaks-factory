#!/usr/bin/env node

import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  SOURCE_DUMP_SHA256,
  assertCleanExactGit,
  fail,
  runCaptured,
  sha256File
} from './migration-tools-lib.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(packageRoot, '../../..');
const postgresBin = '/usr/lib/postgresql/16/bin';
const sourceDump = resolve(process.env.PEAKS_R3_SOURCE_DUMP ?? '');
const evidenceDirectory = resolve(process.env.PEAKS_R3_REHEARSAL_EVIDENCE_DIR ?? '');
const clusterRoot = mkdtempSync(resolve(tmpdir(), 'peaks-r3-rehearsal-'));
const dataDirectory = resolve(clusterRoot, 'data');
const socketDirectory = resolve(clusterRoot, 'socket');
const port = 32000 + Math.floor(Math.random() * 20000);
const operatingSystemUser = userInfo().username;
let clusterStarted = false;

function databaseUrl(database, user = operatingSystemUser) {
  return `postgresql://${encodeURIComponent(user)}@localhost/${database}?host=${encodeURIComponent(socketDirectory)}&port=${port}`;
}

function databaseCommand(command, args, failureCode, options = {}) {
  return runCaptured(resolve(postgresBin, command), ['-h', socketDirectory, '-p', String(port), '-U', operatingSystemUser, ...args], {
    failureCode,
    ...options
  });
}

function psql(database, sql, failureCode) {
  return databaseCommand('psql', ['-d', database, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], failureCode)
    .stdout.trim();
}

function runNodeScript(path, environment, failureCode) {
  return runCaptured(process.execPath, [path], {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment },
    failureCode
  }).stdout.trim();
}

function runNodeScriptExpectFailure(path, environment, expectedCode) {
  const result = spawnSync(process.execPath, [path], {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.error || result.status === 0) fail(`R3_EXPECTED_FAILURE_NOT_OBSERVED_${expectedCode}`);
  const observedCode = String(result.stderr)
    .split(/\r?\n/)
    .find((line) => /^R3_[A-Z0-9_]+$/.test(line));
  if (observedCode !== expectedCode) {
    fail(`R3_EXPECTED_FAILURE_MISMATCH_${observedCode ?? 'NO_SAFE_CODE'}`);
  }
  return observedCode;
}

function runnerEnvironment(database, backupPath, backupHash, protectedDirectory, user = operatingSystemUser) {
  return {
    PEAKS_R3_EXECUTION_MODE: 'rehearsal',
    PEAKS_R3_TARGET_DATABASE_URL: databaseUrl(database, user),
    PEAKS_R3_PROTECTED_INPUT_DIR: protectedDirectory,
    PEAKS_R3_TARGET_BACKUP: backupPath,
    PEAKS_R3_TARGET_BACKUP_SHA256: backupHash
  };
}

function verifySchema(database) {
  const result = databaseCommand(
    'psql',
    ['-d', database, '-X', '-q', '-A', '-t', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-f', resolve(repositoryRoot, 'db/verify/verify_schema.sql')],
    'R3_REHEARSAL_SCHEMA_VERIFY_EXECUTION_FAILED'
  ).stdout;
  if (!result.includes('|PASS|') || result.split('\n').some((line) => line.split('|')[2] === 'FAIL')) {
    fail('R3_REHEARSAL_SCHEMA_VERIFY_FAILED');
  }
}

function cleanup() {
  if (clusterStarted) {
    try {
      runCaptured(resolve(postgresBin, 'pg_ctl'), ['-D', dataDirectory, '-m', 'fast', '-w', 'stop'], {
        failureCode: 'R3_REHEARSAL_CLUSTER_STOP_FAILED',
        stdio: 'ignore'
      });
    } catch {
      // Preserve the original rehearsal result; the explicit temporary root is still removed below.
    }
  }
  if (!clusterRoot.startsWith(`${resolve(tmpdir())}/peaks-r3-rehearsal-`)) fail('R3_TEMPORARY_ROOT_GUARD_FAILED');
  rmSync(clusterRoot, { recursive: true, force: true });
}

try {
  if (!process.env.PEAKS_R3_SOURCE_DUMP) fail('R3_SOURCE_DUMP_REQUIRED');
  if (!process.env.PEAKS_R3_REHEARSAL_EVIDENCE_DIR) fail('R3_REHEARSAL_EVIDENCE_DIR_REQUIRED');
  const head = assertCleanExactGit(repositoryRoot);
  if (sha256File(sourceDump) !== SOURCE_DUMP_SHA256) fail('R3_SOURCE_DUMP_HASH_MISMATCH');
  mkdirSync(evidenceDirectory, { mode: 0o700, recursive: false });
  chmodSync(evidenceDirectory, 0o700);
  mkdirSync(socketDirectory, { mode: 0o700 });

  runCaptured(resolve(postgresBin, 'initdb'), ['-D', dataDirectory, '--auth=trust', '--encoding=UTF8', '--no-locale'], {
    failureCode: 'R3_REHEARSAL_INITDB_FAILED'
  });
  runCaptured(
    resolve(postgresBin, 'pg_ctl'),
    [
      '-D',
      dataDirectory,
      '-o',
      `-F -k ${socketDirectory} -p ${port} -c listen_addresses=''`,
      '-w',
      'start'
    ],
    { failureCode: 'R3_REHEARSAL_CLUSTER_START_FAILED', stdio: 'ignore' }
  );
  clusterStarted = true;

  databaseCommand('createdb', ['r3_source'], 'R3_REHEARSAL_SOURCE_DATABASE_CREATE_FAILED');
  databaseCommand('createdb', ['r3_target'], 'R3_REHEARSAL_TARGET_DATABASE_CREATE_FAILED');
  databaseCommand(
    'pg_restore',
    ['--no-owner', '--no-privileges', '-d', 'r3_source', sourceDump],
    'R3_REHEARSAL_SOURCE_RESTORE_FAILED'
  );
  const sourceCounts = psql(
    'r3_source',
    "select (select count(*) from app.machines) || '|' || (select count(*) from app.skus);",
    'R3_REHEARSAL_SOURCE_COUNT_FAILED'
  );
  if (sourceCounts !== '14|162') fail('R3_REHEARSAL_SOURCE_COUNT_MISMATCH');

  runCaptured(resolve(repositoryRoot, 'scripts/verify-database-baseline.sh'), [], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      PEAKS_ALLOW_EPHEMERAL_DATABASE_VERIFY: '1',
      PEAKS_DB_ADMIN_URL: databaseUrl('r3_target')
    },
    failureCode: 'R3_REHEARSAL_TARGET_BASELINE_BUILD_FAILED'
  });

  const deploymentRoot = resolve(clusterRoot, 'deployment');
  const currentReleaseId = `20260827T000000Z-${head.slice(0, 12)}`;
  const currentReleaseRoot = resolve(deploymentRoot, 'releases', currentReleaseId);
  mkdirSync(currentReleaseRoot, { recursive: true });
  writeFileSync(
    resolve(currentReleaseRoot, 'release-manifest.json'),
    `${JSON.stringify({ release_id: currentReleaseId })}\n`
  );
  symlinkSync(`releases/${currentReleaseId}`, resolve(deploymentRoot, 'current'));
  const productionBackupDirectory = resolve(evidenceDirectory, 'production-backup-tool');
  const productionBackupResult = runNodeScript(
    resolve(scriptDirectory, 'create-production-backup.mjs'),
    {
      PEAKS_R3_BACKUP_MODE: 'production-backup-verify',
      PEAKS_R3_TARGET_DATABASE_URL: databaseUrl('r3_target'),
      PEAKS_R3_BACKUP_OUTPUT_DIR: productionBackupDirectory,
      PEAKS_R3_DEPLOYMENT_ROOT: deploymentRoot,
      PEAKS_R3_EXPECTED_CURRENT_RELEASE_ID: currentReleaseId
    },
    'R3_REHEARSAL_PRODUCTION_BACKUP_TOOL_FAILED'
  );
  if (!productionBackupResult.includes('R3_PRODUCTION_BACKUP_PASS|')) {
    fail('R3_REHEARSAL_PRODUCTION_BACKUP_MARKER_MISSING');
  }

  const protectedDirectory = resolve(evidenceDirectory, 'protected-input');
  const generationResult = runNodeScript(
    resolve(scriptDirectory, 'generate-protected-input.mjs'),
    {
      PEAKS_R3_SOURCE_DATABASE_URL: databaseUrl('r3_source'),
      PEAKS_R3_SOURCE_DUMP: sourceDump,
      PEAKS_R3_PROTECTED_OUTPUT_DIR: protectedDirectory
    },
    'R3_REHEARSAL_PROTECTED_INPUT_GENERATION_FAILED'
  );
  if (!generationResult.includes('R3_PROTECTED_INPUT_GENERATION_PASS')) fail('R3_REHEARSAL_GENERATION_MARKER_MISSING');

  const backupPath = resolve(evidenceDirectory, 'target-pre-migration.dump');
  databaseCommand('pg_dump', ['-Fc', '-f', backupPath, 'r3_target'], 'R3_REHEARSAL_TARGET_BACKUP_FAILED');
  chmodSync(backupPath, 0o600);
  databaseCommand('pg_restore', ['--list', backupPath], 'R3_REHEARSAL_TARGET_BACKUP_INVENTORY_FAILED');
  const backupHash = sha256File(backupPath);
  const runnerPath = resolve(scriptDirectory, 'run-migration.mjs');
  const runnerEnv = runnerEnvironment('r3_target', backupPath, backupHash, protectedDirectory);

  const firstRun = runNodeScript(runnerPath, runnerEnv, 'R3_REHEARSAL_FIRST_APPLY_FAILED');
  if (!firstRun.includes('R3_MIGRATION_PASS|mode=APPLY|')) fail('R3_REHEARSAL_FIRST_APPLY_MARKER_MISSING');
  const rowVersionsBeforeNoop = psql(
    'r3_target',
    "select json_build_object('machines', (select json_agg(xmin::text order by machine_id) from app.machines), 'skus', (select json_agg(xmin::text order by sku_id) from app.skus))::text;",
    'R3_REHEARSAL_NOOP_BEFORE_SNAPSHOT_FAILED'
  );
  const secondRun = runNodeScript(runnerPath, runnerEnv, 'R3_REHEARSAL_SECOND_NOOP_FAILED');
  if (!secondRun.includes('R3_MIGRATION_PASS|mode=NOOP|')) fail('R3_REHEARSAL_SECOND_NOOP_MARKER_MISSING');
  const rowVersionsAfterNoop = psql(
    'r3_target',
    "select json_build_object('machines', (select json_agg(xmin::text order by machine_id) from app.machines), 'skus', (select json_agg(xmin::text order by sku_id) from app.skus))::text;",
    'R3_REHEARSAL_NOOP_AFTER_SNAPSHOT_FAILED'
  );
  if (rowVersionsBeforeNoop !== rowVersionsAfterNoop) fail('R3_REHEARSAL_NOOP_WROTE_CATALOG_ROWS');

  databaseCommand('createdb', ['-T', 'r3_target', 'r3_divergent'], 'R3_REHEARSAL_DIVERGENT_DATABASE_CREATE_FAILED');
  psql('r3_divergent', "update app.machines set machine_name = machine_name || ' divergent' where machine_id = 1;", 'R3_REHEARSAL_DIVERGENCE_INJECTION_FAILED');
  const divergentVersionsBefore = psql(
    'r3_divergent',
    "select json_agg(xmin::text order by machine_id)::text from app.machines;",
    'R3_REHEARSAL_DIVERGENT_BEFORE_SNAPSHOT_FAILED'
  );
  runNodeScriptExpectFailure(
    runnerPath,
    runnerEnvironment('r3_divergent', backupPath, backupHash, protectedDirectory),
    'R3_TRANSACTION_FAILED'
  );
  const divergentVersionsAfter = psql(
    'r3_divergent',
    "select json_agg(xmin::text order by machine_id)::text from app.machines;",
    'R3_REHEARSAL_DIVERGENT_AFTER_SNAPSHOT_FAILED'
  );
  if (divergentVersionsBefore !== divergentVersionsAfter) fail('R3_REHEARSAL_DIVERGENT_RUN_WROTE_ROWS');

  psql('postgres', 'create role r3_runtime_probe login in role app_runtime_role;', 'R3_REHEARSAL_RUNTIME_PROBE_CREATE_FAILED');
  runNodeScriptExpectFailure(
    runnerPath,
    runnerEnvironment('r3_target', backupPath, backupHash, protectedDirectory, 'r3_runtime_probe'),
    'R3_DATABASE_AUTHORITY_REJECTED'
  );

  const harnessResult = runCaptured(
    'pnpm',
    ['--dir', resolve(repositoryRoot, 'backend'), 'run', 'test:r3-catalog:postgres'],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PEAKS_R3_READMODEL_DATABASE_URL: databaseUrl('r3_target'),
        PEAKS_R3_PROTECTED_INPUT_DIR: protectedDirectory
      },
      failureCode: 'R3_REHEARSAL_READMODEL_HARNESS_FAILED'
    }
  ).stdout;
  if (!harnessResult.includes('R3_CATALOG_READMODEL_HARNESS_PASS')) fail('R3_REHEARSAL_READMODEL_MARKER_MISSING');

  databaseCommand(
    'pg_restore',
    ['--clean', '--if-exists', '--exit-on-error', '--single-transaction', '-d', 'r3_target', backupPath],
    'R3_REHEARSAL_TARGET_RESTORE_FAILED'
  );
  verifySchema('r3_target');
  const restoredCounts = psql(
    'r3_target',
    "select (select count(*) from app.machines) || '|' || (select count(*) from app.skus);",
    'R3_REHEARSAL_RESTORED_COUNT_FAILED'
  );
  if (restoredCounts !== '0|0') fail('R3_REHEARSAL_RESTORE_NOT_EMPTY');

  const report = {
    formatVersion: 1,
    status: 'PASS',
    commit: head,
    sourceDumpSha256: SOURCE_DUMP_SHA256,
    targetBackupSha256: backupHash,
    checks: {
      sourceRestore: 'PASS_14_MACHINES_162_SKUS',
      targetBaseline: 'PASS',
      productionBackupTool: 'PASS_FULL_RESTORE_AND_TEMPORARY_DATABASE_REMOVED',
      firstApply: 'PASS',
      exactRepeatNoop: 'PASS_NO_CATALOG_ROW_VERSION_CHANGE',
      divergentTarget: 'PASS_REFUSED_NO_ROW_VERSION_CHANGE',
      runtimeCredential: 'PASS_REFUSED',
      backendReadModels: 'PASS_LISTS_AND_PROTECTED_QR_LOOKUP',
      fullBackupRestore: 'PASS_IN_PLACE_EMPTY_CATALOG_AND_SCHEMA_VERIFY'
    }
  };
  const reportPath = resolve(evidenceDirectory, 'sanitized-rehearsal-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  chmodSync(reportPath, 0o600);
  console.log('R3_ISOLATED_REHEARSAL_PASS|apply=true|noop=true|divergence_refused=true|runtime_refused=true|readmodels=true|restore=true');
} catch (error) {
  console.error(error?.code ?? 'R3_ISOLATED_REHEARSAL_FAILED');
  process.exitCode = 1;
} finally {
  cleanup();
}
