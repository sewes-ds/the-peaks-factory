import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = join(repositoryRoot, "scripts/verify-release-contract.mjs");
const example = JSON.parse(
  readFileSync(join(repositoryRoot, "deploy/releases/release-manifest.example.json"), "utf8"),
);
const temporaryRoot = mkdtempSync(join(tmpdir(), "the-peaks-release-contract-"));
let caseNumber = 0;

after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

function validate(manifest, ...flags) {
  caseNumber += 1;
  const manifestPath = join(temporaryRoot, `case-${caseNumber}.json`);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return spawnSync(process.execPath, [validatorPath, ...flags, manifestPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

test("accepts the structural example only with the explicit flag", () => {
  const accepted = validate(structuredClone(example), "--allow-example");
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /RELEASE_CONTRACT_VERIFY_PASS/u);

  const rejected = validate(structuredClone(example));
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /example manifests cannot be installed or released/u);
});

test("continues to validate sealed schema 1 manifests", () => {
  const manifest = structuredClone(example);
  manifest.schema_version = 1;
  delete manifest.assembly;
  delete manifest.verification.source_method;
  delete manifest.verification.legacy_runtime_evidence_sha256;
  for (const artifactName of ["backend", "frontend"]) {
    manifest.artifacts[artifactName].file_count = manifest.artifacts[artifactName].entry_count;
    delete manifest.artifacts[artifactName].entry_count;
  }

  const result = validate(manifest, "--allow-example");
  assert.equal(result.status, 0, result.stderr);
});

test("rejects release IDs that do not identify the exact source commit", () => {
  const manifest = structuredClone(example);
  manifest.source_commit = "2222222222222222222222222222222222222222";
  manifest.database.baseline_commit = manifest.source_commit;
  manifest.verification.ci_head_sha = manifest.source_commit;
  manifest.assembly.tool_source_commit = manifest.source_commit;

  const result = validate(manifest, "--allow-example");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release_id SHA suffix must match/u);
});

test("legacy import evidence matches bootstrap rollback but remains independent from release rollback", () => {
  const manifest = structuredClone(example);
  manifest.assembly.mode = "legacy-runtime-import";
  manifest.assembly.tool_source_commit = "2".repeat(40);
  manifest.assembly.legacy_artifact_evidence_sha256 = "c".repeat(64);
  manifest.verification.source_method = "legacy-runtime-evidence";
  manifest.verification.ci_run_id = null;
  manifest.verification.ci_head_sha = null;
  manifest.verification.required_jobs = [];
  manifest.verification.legacy_runtime_evidence_sha256 = "c".repeat(64);
  manifest.rollback.strategy = "legacy-root";
  manifest.rollback.previous_release_id = null;

  const accepted = validate(manifest, "--allow-example");
  assert.equal(accepted.status, 0, accepted.stderr);

  manifest.assembly.legacy_artifact_evidence_sha256 = "d".repeat(64);
  const rejected = validate(manifest, "--allow-example");
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /evidence must match rollback/u);

  manifest.assembly.legacy_artifact_evidence_sha256 = "c".repeat(64);
  manifest.rollback.strategy = "release";
  manifest.rollback.previous_release_id = "20260825T120000Z-000000000000";
  manifest.rollback.previous_manifest_sha256 = "d".repeat(64);
  const releaseRollback = validate(manifest, "--allow-example");
  assert.equal(releaseRollback.status, 0, releaseRollback.stderr);
});

test("rejects an invalid backup contract", () => {
  const manifest = structuredClone(example);
  manifest.verification.backup_required = true;

  const result = validate(manifest, "--allow-example");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /backup_manifest_sha256 has invalid format/u);
});

test("rejects sensitive fields even when the manifest shape is otherwise checked", () => {
  const manifest = structuredClone(example);
  manifest.runtime.database_url = "postgresql://forbidden";

  const result = validate(manifest, "--allow-example");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /forbidden sensitive field/u);
  assert.doesNotMatch(result.stderr, /postgresql:\/\/forbidden/u);
});
