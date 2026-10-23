#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ReleaseToolError,
  assembleRelease,
  assertSafeManagedRoot,
  installRelease,
  makeTreeReadOnly,
  makeTreeWritable,
  parseCli,
  performActivation,
  readJson,
  requireOptions,
  sha256File,
  verifyReleasePackage,
  writeJson,
} from "./release-tools-lib.mjs";
import { validateDeploymentReceipt } from "./deployment-receipt-contract.mjs";

function expectFailure(label, operation, pattern) {
  try {
    operation();
  } catch (error) {
    if (!pattern.test(error.message)) {
      throw new ReleaseToolError(`${label} failed for an unexpected reason: ${error.message}`);
    }
    return label;
  }
  throw new ReleaseToolError(`${label} unexpectedly succeeded`);
}

function writeArtifact(root, component, version) {
  mkdirSync(root, { mode: 0o700 });
  writeFileSync(join(root, `${component}.txt`), `${component} ${version}\n`, { mode: 0o600 });
  mkdirSync(join(root, "runtime"), { mode: 0o700 });
  writeFileSync(join(root, "runtime", "entrypoint.txt"), `${version}\n`, { mode: 0o600 });
}

function assemblySpec({ root, deploymentRoot, sourceCommit, createdAt, artifacts, rollback }) {
  return {
    schema_version: 2,
    source_commit: sourceCommit,
    created_at: createdAt,
    ci_run_id: "123456789",
    assembly: {
      mode: "standard",
      tool_source_commit: sourceCommit,
      tool_ci_run_id: "123456789",
      legacy_artifact_evidence_sha256: null,
    },
    toolchain: { node: "24.22.1", pnpm: "10.33.0", postgresql: "16" },
    artifacts: {
      backend_source: artifacts.backend,
      frontend_source: artifacts.frontend,
    },
    database: { migration_packages: [] },
    verification: {
      backup_required: false,
      backup_manifest_sha256: null,
      rollback_rehearsed: true,
    },
    runtime: {
      deployment_root: deploymentRoot,
      environment_file: join(root, "config", "backend.env"),
    },
    rollback,
  };
}

try {
  const options = parseCli(process.argv.slice(2), { values: ["root"] });
  requireOptions(options, ["root"]);
  const root = options.root;
  assertSafeManagedRoot(root, "rehearsal root");
  if (readdirSync(root).length !== 0) throw new ReleaseToolError("rehearsal root must be empty");

  const inputsRoot = join(root, "inputs");
  const outputRoot = join(root, "packages");
  const deploymentRoot = join(root, "deployment");
  const configRoot = join(root, "config");
  for (const directory of [inputsRoot, outputRoot, deploymentRoot, configRoot]) mkdirSync(directory, { mode: 0o700 });

  const firstArtifacts = {
    backend: join(inputsRoot, "first-backend"),
    frontend: join(inputsRoot, "first-frontend"),
  };
  const secondArtifacts = {
    backend: join(inputsRoot, "second-backend"),
    frontend: join(inputsRoot, "second-frontend"),
  };
  const thirdArtifacts = {
    backend: join(inputsRoot, "third-backend"),
    frontend: join(inputsRoot, "third-frontend"),
  };
  writeArtifact(firstArtifacts.backend, "backend", "first");
  writeArtifact(firstArtifacts.frontend, "frontend", "first");
  writeArtifact(secondArtifacts.backend, "backend", "second");
  writeArtifact(secondArtifacts.frontend, "frontend", "second");
  writeArtifact(thirdArtifacts.backend, "backend", "divergent");
  writeArtifact(thirdArtifacts.frontend, "frontend", "divergent");

  const firstSpecPath = join(inputsRoot, "first-spec.json");
  writeJson(
    firstSpecPath,
    assemblySpec({
      root,
      deploymentRoot,
      sourceCommit: "a".repeat(40),
      createdAt: "2026-08-27T00:00:00Z",
      artifacts: firstArtifacts,
      rollback: {
        strategy: "legacy-root",
        previous_manifest_sha256: "c".repeat(64),
        database_restore_required: false,
      },
    }),
  );
  const first = assembleRelease({ specPath: firstSpecPath, outputRoot, rehearsal: true });
  installRelease({ packageRoot: first.packageRoot, deploymentRoot });

  const oldActivationGuard = process.env.PEAKS_ALLOW_RELEASE_ACTIVATION;
  delete process.env.PEAKS_ALLOW_RELEASE_ACTIVATION;
  const refusalChecks = [
    expectFailure(
      "activation-without-explicit-guard",
      () =>
        performActivation({
          deploymentRoot,
          releaseId: first.manifest.release_id,
          action: "ACTIVATE",
          recordedAt: "2026-08-27T00:01:00Z",
          rehearsal: true,
          allowLegacyBootstrap: true,
        }),
      /PEAKS_ALLOW_RELEASE_ACTIVATION/u,
    ),
  ];
  process.env.PEAKS_ALLOW_RELEASE_ACTIVATION = "1";
  performActivation({
    deploymentRoot,
    releaseId: first.manifest.release_id,
    action: "ACTIVATE",
    recordedAt: "2026-08-27T00:01:00Z",
    rehearsal: true,
    allowLegacyBootstrap: true,
  });

  const secondSpecPath = join(inputsRoot, "second-spec.json");
  writeJson(
    secondSpecPath,
    assemblySpec({
      root,
      deploymentRoot,
      sourceCommit: "b".repeat(40),
      createdAt: "2026-08-27T00:02:00Z",
      artifacts: secondArtifacts,
      rollback: {
        strategy: "release",
        previous_manifest: first.manifestPath,
        database_restore_required: false,
      },
    }),
  );
  const second = assembleRelease({ specPath: secondSpecPath, outputRoot, rehearsal: true });
  installRelease({ packageRoot: second.packageRoot, deploymentRoot });
  performActivation({
    deploymentRoot,
    releaseId: second.manifest.release_id,
    action: "ACTIVATE",
    recordedAt: "2026-08-27T00:03:00Z",
    rehearsal: true,
  });

  const missingPackage = join(root, "missing-release-package");
  refusalChecks.push(
    expectFailure("missing-package", () => verifyReleasePackage(missingPackage), /does not exist/u),
  );
  const tamperedPackage = join(root, "tampered-package");
  cpSync(second.packageRoot, tamperedPackage, { recursive: true });
  makeTreeWritable(tamperedPackage);
  writeFileSync(join(tamperedPackage, "backend", "backend.txt"), "tampered\n", { encoding: "utf8" });
  makeTreeReadOnly(tamperedPackage);
  refusalChecks.push(
    expectFailure("corrupt-package", () => verifyReleasePackage(tamperedPackage), /tree hash differs/u),
  );

  const thirdSpecPath = join(inputsRoot, "divergent-spec.json");
  writeJson(
    thirdSpecPath,
    assemblySpec({
      root,
      deploymentRoot,
      sourceCommit: "d".repeat(40),
      createdAt: "2026-08-27T00:04:00Z",
      artifacts: thirdArtifacts,
      rollback: {
        strategy: "release",
        previous_manifest: first.manifestPath,
        database_restore_required: false,
      },
    }),
  );
  const divergent = assembleRelease({ specPath: thirdSpecPath, outputRoot, rehearsal: true });
  installRelease({ packageRoot: divergent.packageRoot, deploymentRoot });
  refusalChecks.push(
    expectFailure(
      "divergent-rollback-contract",
      () =>
        performActivation({
          deploymentRoot,
          releaseId: divergent.manifest.release_id,
          action: "ACTIVATE",
          recordedAt: "2026-08-27T00:05:00Z",
          rehearsal: true,
        }),
      /does not identify the current release/u,
    ),
  );
  if (readlinkSync(join(deploymentRoot, "current")) !== `releases/${second.manifest.release_id}`) {
    throw new ReleaseToolError("failed activation changed the current pointer");
  }

  performActivation({
    deploymentRoot,
    releaseId: first.manifest.release_id,
    action: "ROLLBACK",
    recordedAt: "2026-08-27T00:06:00Z",
    rehearsal: true,
  });
  const finalCurrent = readlinkSync(join(deploymentRoot, "current"));
  const finalPrevious = readlinkSync(join(deploymentRoot, "previous"));
  if (
    finalCurrent !== `releases/${first.manifest.release_id}` ||
    finalPrevious !== `releases/${second.manifest.release_id}`
  ) {
    throw new ReleaseToolError("rollback did not atomically swap current and previous releases");
  }

  const receiptsRoot = join(deploymentRoot, "receipts");
  const receiptFiles = readdirSync(receiptsRoot).sort();
  if (receiptFiles.length !== 3) throw new ReleaseToolError("expected exactly three lifecycle receipts");
  const receipts = receiptFiles.map((name) => {
    const receiptPath = join(receiptsRoot, name);
    const receipt = readJson(receiptPath, "deployment receipt");
    const failures = validateDeploymentReceipt(receipt);
    if (failures.length > 0) throw new ReleaseToolError(`invalid deployment receipt: ${failures.join("; ")}`);
    return { name, sha256: sha256File(receiptPath), action: receipt.action };
  });

  const summary = {
    schema_version: 1,
    result: "PASS",
    production_touched: false,
    releases: {
      first: first.manifest.release_id,
      second: second.manifest.release_id,
      divergent_rejected: divergent.manifest.release_id,
    },
    final_pointers: { current: finalCurrent, previous: finalPrevious },
    refusal_checks: refusalChecks,
    receipts,
  };
  const summaryPath = join(root, "rehearsal-summary.json");
  writeJson(summaryPath, summary, 0o444);
  if (oldActivationGuard === undefined) delete process.env.PEAKS_ALLOW_RELEASE_ACTIVATION;
  else process.env.PEAKS_ALLOW_RELEASE_ACTIVATION = oldActivationGuard;
  process.stdout.write(`RELEASE_LIFECYCLE_REHEARSAL_PASS summary=${summaryPath}\n`);
} catch (error) {
  const message = error instanceof ReleaseToolError ? error.message : `unexpected error: ${error.message}`;
  process.stderr.write(`RELEASE_LIFECYCLE_REHEARSAL_FAIL: ${message}\n`);
  process.exit(1);
}
