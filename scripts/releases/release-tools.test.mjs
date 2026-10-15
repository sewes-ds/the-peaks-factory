import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  ReleaseToolError,
  assembleRelease,
  installRelease,
  makeTreeReadOnly,
  makeTreeWritable,
  readJson,
  repositoryRoot,
  verifyReleasePackage,
  writeJson,
} from "./release-tools-lib.mjs";
import { validateDeploymentReceipt } from "./deployment-receipt-contract.mjs";
import { runReleaseCanary } from "./release-canary-lib.mjs";

function cleanup(root) {
  makeTreeWritable(root);
  rmSync(root, { recursive: true, force: true });
}

test("rehearses bootstrap, forward activation, fail-closed checks, and complete rollback", () => {
  const root = mkdtempSync(join(tmpdir(), "the-peaks-release-rehearsal-test-"));
  try {
    const result = spawnSync(
      process.execPath,
      [join(repositoryRoot, "scripts/releases/rehearse-release-lifecycle.mjs"), "--root", root],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /RELEASE_LIFECYCLE_REHEARSAL_PASS/u);
    const summary = readJson(join(root, "rehearsal-summary.json"), "rehearsal summary");
    assert.equal(summary.result, "PASS");
    assert.equal(summary.production_touched, false);
    assert.deepEqual(summary.refusal_checks, [
      "activation-without-explicit-guard",
      "missing-package",
      "corrupt-package",
      "divergent-rollback-contract",
    ]);
    assert.deepEqual(
      summary.receipts.map((receipt) => receipt.action),
      ["ACTIVATE", "ACTIVATE", "ROLLBACK"],
    );
    assert.match(summary.final_pointers.current, /aaaaaaaaaaaa$/u);
    assert.match(summary.final_pointers.previous, /bbbbbbbbbbbb$/u);
  } finally {
    cleanup(root);
  }
});

test("assembler and installer preserve safe internal artifact symbolic links", () => {
  const root = mkdtempSync(join(tmpdir(), "the-peaks-release-symlink-test-"));
  try {
    const outputRoot = join(root, "packages");
    const deploymentRoot = join(root, "deployment");
    const backendRoot = join(root, "backend");
    const frontendRoot = join(root, "frontend");
    for (const directory of [outputRoot, deploymentRoot, backendRoot, frontendRoot]) {
      mkdirSync(directory, { mode: 0o700 });
    }
    mkdirSync(join(backendRoot, "runtime"));
    writeFileSync(join(backendRoot, "runtime", "entrypoint.txt"), "backend\n");
    writeFileSync(join(backendRoot, "runtime", "alternate.txt"), "backend\n");
    symlinkSync("runtime/entrypoint.txt", join(backendRoot, "entrypoint.txt"));
    writeFileSync(join(frontendRoot, "index.html"), "ok\n");
    const specPath = join(root, "spec.json");
    writeJson(specPath, {
      schema_version: 2,
      source_commit: "e".repeat(40),
      created_at: "2026-08-27T01:00:00Z",
      ci_run_id: "1",
      assembly: {
        mode: "standard",
        tool_source_commit: "e".repeat(40),
        tool_ci_run_id: "1",
        legacy_artifact_evidence_sha256: null,
      },
      toolchain: { node: "20.20.0", pnpm: "10.33.0", postgresql: "16" },
      artifacts: { backend_source: backendRoot, frontend_source: frontendRoot },
      database: { migration_packages: [] },
      verification: {
        backup_required: false,
        backup_manifest_sha256: null,
        rollback_rehearsed: true,
      },
      runtime: {
        deployment_root: deploymentRoot,
        environment_file: join(root, "backend.env"),
      },
      rollback: {
        strategy: "legacy-root",
        previous_manifest_sha256: "f".repeat(64),
        database_restore_required: false,
      },
    });
    const assembled = assembleRelease({ specPath, outputRoot, rehearsal: true });
    assert.equal(readlinkSync(join(assembled.packageRoot, "backend", "entrypoint.txt")), "runtime/entrypoint.txt");
    const installed = installRelease({ packageRoot: assembled.packageRoot, deploymentRoot });
    assert.equal(readlinkSync(join(installed.installedRoot, "backend", "entrypoint.txt")), "runtime/entrypoint.txt");
    makeTreeWritable(assembled.packageRoot);
    rmSync(join(assembled.packageRoot, "backend", "entrypoint.txt"));
    symlinkSync("runtime/alternate.txt", join(assembled.packageRoot, "backend", "entrypoint.txt"));
    makeTreeReadOnly(assembled.packageRoot);
    assert.throws(
      () => verifyReleasePackage(assembled.packageRoot),
      (error) => error instanceof ReleaseToolError && /tree hash differs/u.test(error.message),
    );
  } finally {
    cleanup(root);
  }
});

test("composite frontend staging preserves Mini App root and isolates admin under its route", () => {
  const root = mkdtempSync(join(tmpdir(), "the-peaks-composite-frontend-test-"));
  try {
    const miniappRoot = join(root, "miniapp");
    const adminRoot = join(root, "admin");
    const outputRoot = join(root, "frontend");
    mkdirSync(miniappRoot, { mode: 0o700 });
    mkdirSync(adminRoot, { mode: 0o700 });
    mkdirSync(join(miniappRoot, "assets"));
    mkdirSync(join(adminRoot, "assets"));
    writeFileSync(join(miniappRoot, "index.html"), "miniapp\n");
    writeFileSync(join(miniappRoot, "assets", "miniapp.js"), "miniapp\n");
    writeFileSync(join(adminRoot, "index.html"), "admin\n");
    writeFileSync(join(adminRoot, "assets", "admin.js"), "admin\n");

    const result = spawnSync(
      process.execPath,
      [
        join(repositoryRoot, "scripts/releases/stage-frontend-bundle.mjs"),
        "--miniapp-dist",
        miniappRoot,
        "--admin-dist",
        adminRoot,
        "--output",
        outputRoot,
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /FRONTEND_BUNDLE_STAGE_PASS/u);
    assert.equal(readFileSync(join(outputRoot, "index.html"), "utf8"), "miniapp\n");
    assert.equal(readFileSync(join(outputRoot, "admin", "index.html"), "utf8"), "admin\n");
    assert.equal(existsSync(join(outputRoot, "assets", "miniapp.js")), true);
    assert.equal(existsSync(join(outputRoot, "admin", "assets", "admin.js")), true);
  } finally {
    cleanup(root);
  }
});

test("legacy runtime import separates protected runtime evidence from later release rollback identity", () => {
  const root = mkdtempSync(join(tmpdir(), "the-peaks-legacy-runtime-import-test-"));
  try {
    const outputRoot = join(root, "packages");
    const deploymentRoot = join(root, "deployment");
    const backendRoot = join(root, "backend");
    const frontendRoot = join(root, "frontend");
    for (const directory of [outputRoot, deploymentRoot, backendRoot, frontendRoot]) {
      mkdirSync(directory, { mode: 0o700 });
    }
    writeFileSync(join(backendRoot, "server.js"), "backend\n");
    writeFileSync(join(frontendRoot, "index.html"), "frontend\n");
    const evidenceSha256 = "f".repeat(64);
    const specPath = join(root, "spec.json");
    writeJson(specPath, {
      schema_version: 2,
      source_commit: "d".repeat(40),
      created_at: "2026-08-27T02:00:00Z",
      ci_run_id: null,
      assembly: {
        mode: "legacy-runtime-import",
        tool_source_commit: "e".repeat(40),
        tool_ci_run_id: "2",
        legacy_artifact_evidence_sha256: evidenceSha256,
      },
      toolchain: { node: "20.20.0", pnpm: "10.33.0", postgresql: "16" },
      artifacts: { backend_source: backendRoot, frontend_source: frontendRoot },
      database: { migration_packages: [] },
      verification: {
        backup_required: false,
        backup_manifest_sha256: null,
        rollback_rehearsed: true,
      },
      runtime: {
        deployment_root: deploymentRoot,
        environment_file: join(root, "backend.env"),
      },
      rollback: {
        strategy: "legacy-root",
        previous_manifest_sha256: evidenceSha256,
        database_restore_required: false,
      },
    });
    assert.throws(
      () => assembleRelease({ specPath, outputRoot, rehearsal: true }),
      (error) => error instanceof ReleaseToolError && /requires --legacy-runtime-import/u.test(error.message),
    );
    const assembled = assembleRelease({
      specPath,
      outputRoot,
      legacyRuntimeImport: true,
      rehearsal: true,
    });
    assert.equal(assembled.manifest.assembly.mode, "legacy-runtime-import");
    assert.equal(assembled.manifest.source_commit, "d".repeat(40));
    assert.equal(assembled.manifest.assembly.tool_source_commit, "e".repeat(40));
    assert.equal(assembled.manifest.assembly.tool_ci_run_id, "2");

    const forwardSpec = readJson(specPath, "bootstrap assembly spec");
    forwardSpec.created_at = "2026-08-27T02:01:00Z";
    forwardSpec.rollback = {
      strategy: "release",
      previous_manifest: assembled.manifestPath,
      database_restore_required: false,
    };
    const forwardSpecPath = join(root, "forward-spec.json");
    writeJson(forwardSpecPath, forwardSpec);
    const forward = assembleRelease({
      specPath: forwardSpecPath,
      outputRoot,
      legacyRuntimeImport: true,
      rehearsal: true,
    });
    assert.equal(forward.manifest.assembly.legacy_artifact_evidence_sha256, evidenceSha256);
    assert.equal(forward.manifest.rollback.strategy, "release");
    assert.equal(forward.manifest.rollback.previous_release_id, assembled.manifest.release_id);
    assert.equal(forward.manifest.rollback.previous_manifest_sha256, assembled.manifestSha256);
  } finally {
    cleanup(root);
  }
});

test("assembler rejects artifact symbolic links that escape the artifact tree", () => {
  const root = mkdtempSync(join(tmpdir(), "the-peaks-release-escape-link-test-"));
  try {
    const outputRoot = join(root, "packages");
    const deploymentRoot = join(root, "deployment");
    const backendRoot = join(root, "backend");
    const frontendRoot = join(root, "frontend");
    for (const directory of [outputRoot, deploymentRoot, backendRoot, frontendRoot]) {
      mkdirSync(directory, { mode: 0o700 });
    }
    writeFileSync(join(root, "outside.txt"), "outside\n");
    symlinkSync("../outside.txt", join(backendRoot, "entrypoint.txt"));
    writeFileSync(join(frontendRoot, "index.html"), "ok\n");
    const specPath = join(root, "spec.json");
    writeJson(specPath, {
      schema_version: 2,
      source_commit: "e".repeat(40),
      created_at: "2026-08-27T01:00:00Z",
      ci_run_id: "1",
      assembly: {
        mode: "standard",
        tool_source_commit: "e".repeat(40),
        tool_ci_run_id: "1",
        legacy_artifact_evidence_sha256: null,
      },
      toolchain: { node: "20.20.0", pnpm: "10.33.0", postgresql: "16" },
      artifacts: { backend_source: backendRoot, frontend_source: frontendRoot },
      database: { migration_packages: [] },
      verification: {
        backup_required: false,
        backup_manifest_sha256: null,
        rollback_rehearsed: true,
      },
      runtime: {
        deployment_root: deploymentRoot,
        environment_file: join(root, "backend.env"),
      },
      rollback: {
        strategy: "legacy-root",
        previous_manifest_sha256: "f".repeat(64),
        database_restore_required: false,
      },
    });
    assert.throws(
      () => assembleRelease({ specPath, outputRoot, rehearsal: true }),
      (error) => error instanceof ReleaseToolError && /escapes its artifact tree/u.test(error.message),
    );
  } finally {
    cleanup(root);
  }
});

test("deployment receipt contract rejects sensitive fields without echoing values", () => {
  const receipt = {
    schema_version: 1,
    receipt_id: "20260827T000100Z-activate-20260827T000000Z-aaaaaaaaaaaa",
    action: "ACTIVATE",
    rehearsal: true,
    recorded_at: "2026-08-27T00:01:00Z",
    deployment_root: "/tmp/the-peaks",
    from: null,
    to: {
      release_id: "20260827T000000Z-aaaaaaaaaaaa",
      manifest_sha256: "a".repeat(64),
    },
    pointers: { current: "releases/20260827T000000Z-aaaaaaaaaaaa", previous: null },
    database: {
      backup_required: false,
      backup_verified: false,
      backup_manifest_sha256: null,
      restore_required: false,
      restore_completed: false,
    },
    result: "SUCCEEDED",
    database_url: "postgresql://forbidden",
  };
  const failures = validateDeploymentReceipt(receipt);
  assert.ok(failures.some((failure) => /forbidden sensitive field/u.test(failure)));
  assert.ok(failures.every((failure) => !failure.includes("postgresql://forbidden")));
});

test("read-only canary verifies health and unauthenticated denial without logging bodies", async () => {
  const root = mkdtempSync(join(tmpdir(), "the-peaks-release-canary-test-"));
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("healthy\n");
      return;
    }
    response.writeHead(401, { "content-type": "application/json" });
    response.end('{"error":"unauthorized"}\n');
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  try {
    const address = server.address();
    assert.notEqual(address, null);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const specPath = join(root, "canary.json");
    writeJson(specPath, {
      schema_version: 1,
      release_id: "20260827T000000Z-aaaaaaaaaaaa",
      source_commit: "a".repeat(40),
      checks: [
        {
          name: "local-health",
          url: `${baseUrl}/health`,
          expected_status: 200,
          response_body_sha256: null,
          timeout_ms: 1000,
          max_response_bytes: 1024,
        },
        {
          name: "unauthenticated-api",
          url: `${baseUrl}/api/private`,
          expected_status: 401,
          response_body_sha256: null,
          timeout_ms: 1000,
          max_response_bytes: 1024,
        },
      ],
    });
    const result = await runReleaseCanary(specPath);
    assert.deepEqual(
      result.results.map((check) => [check.name, check.status]),
      [
        ["local-health", 200],
        ["unauthenticated-api", 401],
      ],
    );
  } finally {
    await new Promise((resolvePromise, rejectPromise) =>
      server.close((error) => (error ? rejectPromise(error) : resolvePromise())),
    );
    cleanup(root);
  }
});

test("schema 2 canary sends an explicit production Host to a loopback backend", async () => {
  const root = mkdtempSync(join(tmpdir(), "the-peaks-release-canary-host-test-"));
  const expectedHost = "app.customer.example";
  const server = createServer((request, response) => {
    if (request.headers.host !== expectedHost) {
      response.writeHead(421, { "content-type": "text/plain" });
      response.end("wrong host\n");
      return;
    }
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("healthy\n");
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  try {
    const address = server.address();
    assert.notEqual(address, null);
    const specPath = join(root, "canary.json");
    writeJson(specPath, {
      schema_version: 2,
      release_id: "20260827T000000Z-aaaaaaaaaaaa",
      source_commit: "a".repeat(40),
      checks: [{
        name: "canonical-host-health",
        url: `http://127.0.0.1:${address.port}/health`,
        request_host: expectedHost,
        expected_status: 200,
        response_body_sha256: null,
        timeout_ms: 1000,
        max_response_bytes: 1024,
      }],
    });
    const result = await runReleaseCanary(specPath);
    assert.equal(result.results[0].status, 200);
  } finally {
    await new Promise((resolvePromise, rejectPromise) =>
      server.close((error) => (error ? rejectPromise(error) : resolvePromise())),
    );
    cleanup(root);
  }
});
