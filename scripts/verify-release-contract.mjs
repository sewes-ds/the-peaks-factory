#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { isAbsolute, normalize, posix } from "node:path";

const args = process.argv.slice(2);
const allowExample = args.includes("--allow-example");
const manifestPaths = args.filter((argument) => argument !== "--allow-example");
const failures = [];

if (manifestPaths.length !== 1) {
  process.stderr.write(
    "usage: node scripts/verify-release-contract.mjs [--allow-example] <release-manifest.json>\n",
  );
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPaths[0], "utf8"));
} catch (error) {
  process.stderr.write(`RELEASE_CONTRACT_VERIFY_FAIL: cannot read JSON: ${error.message}\n`);
  process.exit(1);
}

const fullShaPattern = /^[0-9a-f]{40}$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const releaseIdPattern = /^(\d{8}T\d{6}Z)-([0-9a-f]{12})$/u;
const migrationPattern = /^\d{8}_\d{3}_[a-z0-9]+(?:_[a-z0-9]+)*$/u;
const requiredJobs = ["repository", "database", "backend", "frontend"];
const manifestSchemaVersion = manifest?.schema_version;

function fail(message) {
  failures.push(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireExactKeys(value, expectedKeys, path) {
  if (!isRecord(value)) {
    fail(`${path} must be an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.join("\0") !== expected.join("\0")) {
    fail(`${path} keys must be exactly: ${expected.join(", ")}`);
  }
  return true;
}

function requireString(value, pattern, path) {
  if (typeof value !== "string" || !pattern.test(value)) fail(`${path} has invalid format`);
}

function requirePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${path} must be a positive integer`);
}

function requireAbsoluteNormalizedPath(value, path) {
  if (typeof value !== "string" || !isAbsolute(value) || normalize(value) !== value) {
    fail(`${path} must be a normalized absolute path`);
  }
}

function requireRelativeArtifactPath(value, path) {
  if (
    typeof value !== "string" ||
    value === "" ||
    isAbsolute(value) ||
    value.includes("\\") ||
    posix.normalize(value) !== value ||
    value === ".." ||
    value.startsWith("../")
  ) {
    fail(`${path} must be a normalized release-relative path`);
  }
}

function rejectSensitiveContent(value, path = "manifest") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveContent(item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) {
    if (
      typeof value === "string" &&
      (value.includes("postgresql://") || value.includes("BEGIN PRIVATE KEY") || /bot\d+:/iu.test(value))
    ) {
      fail(`${path} appears to contain a credential or secret value`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (/(?:password|credential|private_key|database_url|bot_token|qr_token)/iu.test(key)) {
      fail(`${path}.${key} is a forbidden sensitive field`);
    }
    rejectSensitiveContent(child, `${path}.${key}`);
  }
}

if (
  requireExactKeys(
    manifest,
    manifestSchemaVersion === 2
      ? [
          "schema_version",
          "example",
          "release_id",
          "source_commit",
          "created_at",
          "assembly",
          "toolchain",
          "artifacts",
          "database",
          "verification",
          "runtime",
          "rollback",
        ]
      : [
          "schema_version",
          "example",
          "release_id",
          "source_commit",
          "created_at",
          "toolchain",
          "artifacts",
          "database",
          "verification",
          "runtime",
          "rollback",
        ],
    "manifest",
  )
) {
  if (![1, 2].includes(manifest.schema_version)) fail("manifest.schema_version must equal 1 or 2");
  if (typeof manifest.example !== "boolean") fail("manifest.example must be boolean");
  if (manifest.example && !allowExample) fail("example manifests cannot be installed or released");

  requireString(manifest.source_commit, fullShaPattern, "manifest.source_commit");
  const releaseMatch =
    typeof manifest.release_id === "string" ? manifest.release_id.match(releaseIdPattern) : null;
  if (!releaseMatch) {
    fail("manifest.release_id has invalid format");
  } else if (fullShaPattern.test(manifest.source_commit) && releaseMatch[2] !== manifest.source_commit.slice(0, 12)) {
    fail("manifest.release_id SHA suffix must match manifest.source_commit");
  }

  if (manifest.schema_version === 2) {
    if (
      requireExactKeys(
        manifest.assembly,
        ["mode", "tool_source_commit", "tool_ci_run_id", "legacy_artifact_evidence_sha256"],
        "manifest.assembly",
      )
    ) {
      if (!["standard", "legacy-runtime-import"].includes(manifest.assembly.mode)) {
        fail("manifest.assembly.mode must equal standard or legacy-runtime-import");
      }
      requireString(
        manifest.assembly.tool_source_commit,
        fullShaPattern,
        "manifest.assembly.tool_source_commit",
      );
      requireString(manifest.assembly.tool_ci_run_id, /^[1-9]\d*$/u, "manifest.assembly.tool_ci_run_id");
      if (manifest.assembly.mode === "standard") {
        if (manifest.assembly.tool_source_commit !== manifest.source_commit) {
          fail("standard assembly tool_source_commit must match manifest.source_commit");
        }
        if (manifest.assembly.tool_ci_run_id !== manifest.verification?.ci_run_id) {
          fail("standard assembly tool_ci_run_id must match manifest.verification.ci_run_id");
        }
        if (manifest.assembly.legacy_artifact_evidence_sha256 !== null) {
          fail("standard assembly legacy_artifact_evidence_sha256 must be null");
        }
      } else {
        requireString(
          manifest.assembly.legacy_artifact_evidence_sha256,
          sha256Pattern,
          "manifest.assembly.legacy_artifact_evidence_sha256",
        );
      }
    }
  }

  const createdAt = new Date(manifest.created_at);
  if (
    typeof manifest.created_at !== "string" ||
    Number.isNaN(createdAt.valueOf()) ||
    createdAt.toISOString().replace(".000Z", "Z") !== manifest.created_at
  ) {
    fail("manifest.created_at must be a canonical UTC timestamp");
  } else if (releaseMatch) {
    const timestampId = manifest.created_at.replaceAll("-", "").replaceAll(":", "");
    if (releaseMatch[1] !== timestampId) fail("manifest.release_id timestamp must match manifest.created_at");
  }

  if (requireExactKeys(manifest.toolchain, ["node", "pnpm", "postgresql"], "manifest.toolchain")) {
    requireString(manifest.toolchain.node, /^\d+\.\d+\.\d+$/u, "manifest.toolchain.node");
    requireString(manifest.toolchain.pnpm, /^\d+\.\d+\.\d+$/u, "manifest.toolchain.pnpm");
    requireString(manifest.toolchain.postgresql, /^\d+$/u, "manifest.toolchain.postgresql");
  }

  if (requireExactKeys(manifest.artifacts, ["backend", "frontend"], "manifest.artifacts")) {
    for (const artifactName of ["backend", "frontend"]) {
      const artifact = manifest.artifacts[artifactName];
      const countKey = manifest.schema_version === 2 ? "entry_count" : "file_count";
      if (
        requireExactKeys(
          artifact,
          ["relative_path", "tree_manifest_sha256", countKey],
          `manifest.artifacts.${artifactName}`,
        )
      ) {
        requireRelativeArtifactPath(artifact.relative_path, `manifest.artifacts.${artifactName}.relative_path`);
        requireString(
          artifact.tree_manifest_sha256,
          sha256Pattern,
          `manifest.artifacts.${artifactName}.tree_manifest_sha256`,
        );
        requirePositiveInteger(artifact[countKey], `manifest.artifacts.${artifactName}.${countKey}`);
      }
    }
    if (manifest.artifacts.backend?.relative_path === manifest.artifacts.frontend?.relative_path) {
      fail("backend and frontend artifact paths must differ");
    }
  }

  if (
    requireExactKeys(
      manifest.database,
      ["baseline_commit", "migration_packages"],
      "manifest.database",
    )
  ) {
    requireString(manifest.database.baseline_commit, fullShaPattern, "manifest.database.baseline_commit");
    if (manifest.database.baseline_commit !== manifest.source_commit) {
      fail("manifest.database.baseline_commit must match manifest.source_commit");
    }
    if (!Array.isArray(manifest.database.migration_packages)) {
      fail("manifest.database.migration_packages must be an array");
    } else {
      const uniqueMigrations = new Set(manifest.database.migration_packages);
      if (uniqueMigrations.size !== manifest.database.migration_packages.length) {
        fail("manifest.database.migration_packages must not contain duplicates");
      }
      manifest.database.migration_packages.forEach((migration, index) =>
        requireString(migration, migrationPattern, `manifest.database.migration_packages[${index}]`),
      );
    }
  }

  if (
    requireExactKeys(
      manifest.verification,
      manifest.schema_version === 2
        ? [
            "source_method",
            "ci_run_id",
            "ci_head_sha",
            "required_jobs",
            "legacy_runtime_evidence_sha256",
            "backup_required",
            "backup_manifest_sha256",
            "rollback_rehearsed",
          ]
        : [
            "ci_run_id",
            "ci_head_sha",
            "required_jobs",
            "backup_required",
            "backup_manifest_sha256",
            "rollback_rehearsed",
          ],
      "manifest.verification",
    )
  ) {
    const sourceMethod =
      manifest.schema_version === 1 ? "github-actions" : manifest.verification.source_method;
    if (!["github-actions", "legacy-runtime-evidence"].includes(sourceMethod)) {
      fail("manifest.verification.source_method must equal github-actions or legacy-runtime-evidence");
    } else if (sourceMethod === "github-actions") {
      requireString(manifest.verification.ci_run_id, /^[1-9]\d*$/u, "manifest.verification.ci_run_id");
      requireString(manifest.verification.ci_head_sha, fullShaPattern, "manifest.verification.ci_head_sha");
      if (manifest.verification.ci_head_sha !== manifest.source_commit) {
        fail("manifest.verification.ci_head_sha must match manifest.source_commit");
      }
      if (
        !Array.isArray(manifest.verification.required_jobs) ||
        manifest.verification.required_jobs.join("\0") !== requiredJobs.join("\0")
      ) {
        fail(`manifest.verification.required_jobs must be exactly: ${requiredJobs.join(", ")}`);
      }
      if (
        manifest.schema_version === 2 &&
        manifest.verification.legacy_runtime_evidence_sha256 !== null
      ) {
        fail("github-actions verification requires null legacy_runtime_evidence_sha256");
      }
    } else {
      if (manifest.verification.ci_run_id !== null || manifest.verification.ci_head_sha !== null) {
        fail("legacy-runtime-evidence verification requires null CI identity");
      }
      if (!Array.isArray(manifest.verification.required_jobs) || manifest.verification.required_jobs.length !== 0) {
        fail("legacy-runtime-evidence verification requires an empty required_jobs array");
      }
      requireString(
        manifest.verification.legacy_runtime_evidence_sha256,
        sha256Pattern,
        "manifest.verification.legacy_runtime_evidence_sha256",
      );
    }
    if (typeof manifest.verification.backup_required !== "boolean") {
      fail("manifest.verification.backup_required must be boolean");
    }
    if (manifest.verification.backup_required) {
      requireString(
        manifest.verification.backup_manifest_sha256,
        sha256Pattern,
        "manifest.verification.backup_manifest_sha256",
      );
    } else if (manifest.verification.backup_manifest_sha256 !== null) {
      fail("backup_manifest_sha256 must be null when backup_required is false");
    }
    if (manifest.verification.rollback_rehearsed !== true) {
      fail("manifest.verification.rollback_rehearsed must equal true");
    }
  }

  if (
    requireExactKeys(
      manifest.runtime,
      ["release_root", "current_link", "previous_link", "environment_file"],
      "manifest.runtime",
    )
  ) {
    for (const key of ["release_root", "current_link", "previous_link", "environment_file"]) {
      requireAbsoluteNormalizedPath(manifest.runtime[key], `manifest.runtime.${key}`);
    }
    if (
      typeof manifest.runtime.release_root === "string" &&
      typeof manifest.release_id === "string" &&
      !manifest.runtime.release_root.endsWith(`/releases/${manifest.release_id}`)
    ) {
      fail("manifest.runtime.release_root must end with /releases/<release_id>");
    }
    if (manifest.runtime.current_link === manifest.runtime.previous_link) {
      fail("manifest.runtime.current_link and previous_link must differ");
    }
  }

  if (
    requireExactKeys(
      manifest.rollback,
      ["strategy", "previous_release_id", "previous_manifest_sha256", "database_restore_required"],
      "manifest.rollback",
    )
  ) {
    if (!["release", "legacy-root"].includes(manifest.rollback.strategy)) {
      fail("manifest.rollback.strategy must equal release or legacy-root");
    }
    requireString(
      manifest.rollback.previous_manifest_sha256,
      sha256Pattern,
      "manifest.rollback.previous_manifest_sha256",
    );
    if (manifest.rollback.strategy === "release") {
      requireString(
        manifest.rollback.previous_release_id,
        releaseIdPattern,
        "manifest.rollback.previous_release_id",
      );
      if (manifest.rollback.previous_release_id === manifest.release_id) {
        fail("rollback previous release must differ from current release");
      }
    } else if (manifest.rollback.previous_release_id !== null) {
      fail("legacy-root rollback must have a null previous_release_id");
    }
    if (typeof manifest.rollback.database_restore_required !== "boolean") {
      fail("manifest.rollback.database_restore_required must be boolean");
    }
  }

  if (manifest.schema_version === 2 && manifest.assembly?.mode === "legacy-runtime-import") {
    if (manifest.verification?.source_method !== "legacy-runtime-evidence") {
      fail("legacy-runtime-import requires legacy-runtime-evidence source verification");
    }
    if (
      manifest.rollback?.strategy === "legacy-root" &&
      manifest.rollback?.previous_manifest_sha256 !==
      manifest.assembly.legacy_artifact_evidence_sha256
    ) {
      fail("legacy-runtime-import evidence must match rollback previous_manifest_sha256");
    }
    if (
      manifest.verification?.legacy_runtime_evidence_sha256 !==
      manifest.assembly.legacy_artifact_evidence_sha256
    ) {
      fail("legacy-runtime-import evidence must match verification legacy_runtime_evidence_sha256");
    }
  } else if (manifest.schema_version === 2 && manifest.assembly?.mode === "standard") {
    if (manifest.verification?.source_method !== "github-actions") {
      fail("standard assembly requires github-actions source verification");
    }
  }
}

rejectSensitiveContent(manifest);

if (failures.length > 0) {
  process.stderr.write(`RELEASE_CONTRACT_VERIFY_FAIL (${failures.length})\n`);
  failures.forEach((failure) => process.stderr.write(`- ${failure}\n`));
  process.exit(1);
}

process.stdout.write(`RELEASE_CONTRACT_VERIFY_PASS ${manifest.release_id}\n`);
