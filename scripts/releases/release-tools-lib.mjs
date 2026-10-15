import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, normalize, posix, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { validateDeploymentReceipt } from "./deployment-receipt-contract.mjs";

export const repositoryRoot = resolve(import.meta.dirname, "../..");
export const legacyProductionRoot = resolve(
  process.env.PEAKS_LEGACY_PRODUCTION_ROOT ?? join(repositoryRoot, ".legacy-production"),
);
export const releaseIdPattern = /^(\d{8}T\d{6}Z)-([0-9a-f]{12})$/u;
export const fullShaPattern = /^[0-9a-f]{40}$/u;
export const sha256Pattern = /^[0-9a-f]{64}$/u;

const validatorPath = join(repositoryRoot, "scripts/verify-release-contract.mjs");
const broadManagedRoots = new Set(["/", "/home", "/srv", homedir(), repositoryRoot]);

export class ReleaseToolError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReleaseToolError";
  }
}

export function parseCli(argv, { values = [], flags = [], repeatable = [] } = {}) {
  const valueNames = new Set(values);
  const flagNames = new Set(flags);
  const repeatableNames = new Set(repeatable);
  const result = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      result._.push(argument);
      continue;
    }
    const name = argument.slice(2);
    if (flagNames.has(name)) {
      if (result[name] !== undefined) throw new ReleaseToolError(`duplicate option --${name}`);
      result[name] = true;
      continue;
    }
    if (!valueNames.has(name) && !repeatableNames.has(name)) {
      throw new ReleaseToolError(`unknown option --${name}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new ReleaseToolError(`option --${name} requires a value`);
    }
    index += 1;
    if (repeatableNames.has(name)) {
      result[name] ??= [];
      result[name].push(value);
    } else {
      if (result[name] !== undefined) throw new ReleaseToolError(`duplicate option --${name}`);
      result[name] = value;
    }
  }

  return result;
}

export function requireOptions(options, names) {
  for (const name of names) {
    if (typeof options[name] !== "string" || options[name] === "") {
      throw new ReleaseToolError(`missing required option --${name}`);
    }
  }
  if (options._.length > 0) {
    throw new ReleaseToolError(`unexpected positional arguments: ${options._.join(", ")}`);
  }
}

export function readJson(path, description = "JSON") {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ReleaseToolError(`cannot read ${description} ${path}: ${error.message}`);
  }
}

export function writeJson(path, value, mode = 0o600) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode });
}

export function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

export function isWithin(parent, candidate) {
  const delta = relative(parent, candidate);
  return delta === "" || (!delta.startsWith("..") && !isAbsolute(delta));
}

export function assertNormalizedAbsolute(path, description) {
  if (typeof path !== "string" || !isAbsolute(path) || normalize(path) !== path) {
    throw new ReleaseToolError(`${description} must be a normalized absolute path`);
  }
}

export function assertExistingRealDirectory(path, description) {
  assertNormalizedAbsolute(path, description);
  let metadata;
  try {
    metadata = lstatSync(path);
  } catch (error) {
    throw new ReleaseToolError(`${description} does not exist: ${error.message}`);
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new ReleaseToolError(`${description} must be a real directory, not a link`);
  }
  if (realpathSync(path) !== path) {
    throw new ReleaseToolError(`${description} must not traverse symbolic-link path components`);
  }
}

export function assertSafeManagedRoot(path, description = "deployment root") {
  assertExistingRealDirectory(path, description);
  if (broadManagedRoots.has(path)) {
    throw new ReleaseToolError(`${description} is too broad: ${path}`);
  }
  if (isWithin(legacyProductionRoot, path) || isWithin(path, legacyProductionRoot)) {
    throw new ReleaseToolError(`${description} overlaps the frozen legacy production root`);
  }
}

export function assertOutsideFrozenProduction(path, description) {
  assertExistingRealDirectory(path, description);
  if (broadManagedRoots.has(path)) {
    throw new ReleaseToolError(`${description} is too broad: ${path}`);
  }
  if (isWithin(legacyProductionRoot, path) || isWithin(path, legacyProductionRoot)) {
    throw new ReleaseToolError(`${description} overlaps the frozen legacy production root`);
  }
}

function safeRelativePath(root, absolutePath) {
  const relativePath = relative(root, absolutePath).split("\\").join("/");
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    posix.normalize(relativePath) !== relativePath ||
    /[\r\n]/u.test(relativePath)
  ) {
    throw new ReleaseToolError(`unsafe artifact path: ${relativePath}`);
  }
  return relativePath;
}

export function walkArtifactEntries(root, { allowInternalSymlinks = true } = {}) {
  assertExistingRealDirectory(root, "artifact directory");
  const entries = [];
  const realRoot = realpathSync(root);

  function walk(directory) {
    const directoryEntries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name, "en"),
    );
    for (const entry of directoryEntries) {
      if (/\r|\n/u.test(entry.name)) throw new ReleaseToolError("artifact names cannot contain newlines");
      const absolutePath = join(directory, entry.name);
      const metadata = lstatSync(absolutePath);
      if (metadata.isSymbolicLink()) {
        const relativePath = safeRelativePath(root, absolutePath);
        if (!allowInternalSymlinks) {
          throw new ReleaseToolError(`artifact symbolic links are forbidden by manifest schema 1: ${relativePath}`);
        }
        const target = readlinkSync(absolutePath);
        if (
          target === "" ||
          isAbsolute(target) ||
          target.includes("\\") ||
          /[\r\n]/u.test(target) ||
          posix.normalize(target) !== target
        ) {
          throw new ReleaseToolError(`artifact symbolic link target is not a normalized relative path: ${relativePath}`);
        }
        const resolvedTarget = resolve(dirname(absolutePath), target);
        if (!isWithin(root, resolvedTarget)) {
          throw new ReleaseToolError(`artifact symbolic link escapes its artifact tree: ${relativePath}`);
        }
        let realTarget;
        try {
          realTarget = realpathSync(absolutePath);
        } catch (error) {
          throw new ReleaseToolError(`artifact symbolic link is broken or cyclic: ${relativePath}: ${error.message}`);
        }
        if (!isWithin(realRoot, realTarget)) {
          throw new ReleaseToolError(`artifact symbolic link resolves outside its artifact tree: ${relativePath}`);
        }
        entries.push({
          absolutePath,
          relativePath,
          kind: "symlink",
          target,
          sha256: sha256Buffer(`symlink\0${target}`),
        });
      } else if (metadata.isDirectory()) {
        walk(absolutePath);
      } else if (metadata.isFile()) {
        entries.push({
          absolutePath,
          relativePath: safeRelativePath(root, absolutePath),
          kind: "file",
          mode: metadata.mode,
          sha256: sha256File(absolutePath),
        });
      } else {
        throw new ReleaseToolError(`artifact special files are forbidden: ${safeRelativePath(root, absolutePath)}`);
      }
    }
  }

  walk(root);
  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath, "en"));
}

export function artifactTree(root, { schemaVersion = 2 } = {}) {
  const artifactEntries = walkArtifactEntries(root, { allowInternalSymlinks: schemaVersion >= 2 });
  if (artifactEntries.length === 0) throw new ReleaseToolError(`artifact directory is empty: ${root}`);
  const entries = artifactEntries.map((entry) => ({
    path: entry.relativePath,
    kind: entry.kind,
    sha256: entry.sha256,
  }));
  const checksumText = entries
    .map((entry) =>
      schemaVersion >= 2
        ? `${entry.kind}\0${entry.sha256}  ${entry.path}\n`
        : `${entry.sha256}  ${entry.path}\n`,
    )
    .join("");
  return { entries, entryCount: entries.length, treeManifestSha256: sha256Buffer(checksumText) };
}

export function makeTreeReadOnly(root) {
  const directories = [];
  function walk(directory) {
    directories.push(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) walk(absolutePath);
      else if (entry.isFile()) chmodSync(absolutePath, (lstatSync(absolutePath).mode & 0o111) === 0 ? 0o444 : 0o555);
      else if (entry.isSymbolicLink()) continue;
      else throw new ReleaseToolError(`cannot seal non-regular path: ${absolutePath}`);
    }
  }
  walk(root);
  directories.sort((left, right) => right.length - left.length).forEach((directory) => chmodSync(directory, 0o555));
}

export function makeTreeWritable(root) {
  if (!existsSync(root)) return;
  function walk(directory) {
    chmodSync(directory, 0o755);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) walk(absolutePath);
      else if (entry.isFile()) chmodSync(absolutePath, 0o644);
      else if (entry.isSymbolicLink()) continue;
    }
  }
  walk(root);
}

export function validateReleaseManifest(manifestPath) {
  const result = spawnSync(process.execPath, [validatorPath, manifestPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new ReleaseToolError(`release manifest validation failed:\n${result.stderr.trim()}`);
  }
}

function parseChecksums(path) {
  const content = readFileSync(path, "utf8");
  const entries = new Map();
  for (const line of content.split("\n")) {
    if (line === "") continue;
    const match = line.match(/^([0-9a-f]{64})  (.+)$/u);
    if (!match) throw new ReleaseToolError("checksums.sha256 contains an invalid line");
    const artifactPath = match[2];
    if (
      artifactPath === "" ||
      artifactPath.includes("\\") ||
      artifactPath === ".." ||
      artifactPath.startsWith("../") ||
      posix.normalize(artifactPath) !== artifactPath
    ) {
      throw new ReleaseToolError(`checksums.sha256 contains an unsafe path: ${artifactPath}`);
    }
    if (entries.has(artifactPath)) throw new ReleaseToolError(`duplicate checksum path: ${artifactPath}`);
    entries.set(artifactPath, match[1]);
  }
  return entries;
}

export function verifyReleasePackage(packageRoot, { requireReadOnly = true } = {}) {
  assertExistingRealDirectory(packageRoot, "release package");
  const manifestPath = join(packageRoot, "release-manifest.json");
  const checksumsPath = join(packageRoot, "checksums.sha256");
  if (!existsSync(manifestPath) || !existsSync(checksumsPath)) {
    throw new ReleaseToolError("release package must contain release-manifest.json and checksums.sha256");
  }
  validateReleaseManifest(manifestPath);
  const manifest = readJson(manifestPath, "release manifest");
  const allowedTopLevel = new Set([
    "release-manifest.json",
    "checksums.sha256",
    manifest.artifacts.backend.relative_path,
    manifest.artifacts.frontend.relative_path,
  ]);
  for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
    if (!allowedTopLevel.has(entry.name)) throw new ReleaseToolError(`unexpected package entry: ${entry.name}`);
  }

  const checksumEntries = parseChecksums(checksumsPath);
  const actualEntries = new Map();
  actualEntries.set("release-manifest.json", sha256File(manifestPath));

  for (const artifactName of ["backend", "frontend"]) {
    const artifact = manifest.artifacts[artifactName];
    const artifactRoot = join(packageRoot, artifact.relative_path);
    const tree = artifactTree(artifactRoot, { schemaVersion: manifest.schema_version });
    const expectedEntryCount = manifest.schema_version >= 2 ? artifact.entry_count : artifact.file_count;
    if (tree.entryCount !== expectedEntryCount) {
      throw new ReleaseToolError(`${artifactName} entry count differs from the manifest`);
    }
    if (tree.treeManifestSha256 !== artifact.tree_manifest_sha256) {
      throw new ReleaseToolError(`${artifactName} tree hash differs from the manifest`);
    }
    for (const entry of tree.entries) {
      actualEntries.set(`${artifact.relative_path}/${entry.path}`, entry.sha256);
    }
  }

  if (checksumEntries.size !== actualEntries.size) {
    throw new ReleaseToolError("checksums.sha256 entry count differs from package contents");
  }
  for (const [path, digest] of actualEntries) {
    if (checksumEntries.get(path) !== digest) throw new ReleaseToolError(`checksum mismatch: ${path}`);
  }

  if (requireReadOnly) {
    const paths = [packageRoot, manifestPath, checksumsPath];
    for (const artifactName of ["backend", "frontend"]) {
      const artifactRoot = join(packageRoot, manifest.artifacts[artifactName].relative_path);
      paths.push(
        artifactRoot,
        ...walkArtifactEntries(artifactRoot, { allowInternalSymlinks: manifest.schema_version >= 2 })
          .filter((entry) => entry.kind === "file")
          .map((entry) => entry.absolutePath),
      );
    }
    for (const path of paths) {
      if ((statSync(path).mode & 0o222) !== 0) throw new ReleaseToolError(`package path is writable: ${path}`);
    }
  }

  return { manifest, manifestPath, manifestSha256: sha256File(manifestPath) };
}

function runGit(arguments_) {
  const result = spawnSync("git", arguments_, { cwd: repositoryRoot, encoding: "utf8" });
  if (result.status !== 0) throw new ReleaseToolError(`git ${arguments_.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function verifyReachableCommit(commit, description) {
  if (!fullShaPattern.test(commit)) throw new ReleaseToolError(`${description} must be a full lowercase SHA`);
  runGit(["cat-file", "-e", `${commit}^{commit}`]);
  const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", commit, "origin/main"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (ancestry.status !== 0) throw new ReleaseToolError(`${description} must be reachable from origin/main`);
}

export function verifyGitProvenance({ sourceCommit, toolSourceCommit, mode }) {
  const head = runGit(["rev-parse", "HEAD"]);
  if (head !== toolSourceCommit) {
    throw new ReleaseToolError("assembly.tool_source_commit must equal the clean assembler worktree HEAD");
  }
  if (runGit(["status", "--porcelain"]) !== "") throw new ReleaseToolError("assembler worktree must be clean");
  verifyReachableCommit(toolSourceCommit, "assembly.tool_source_commit");
  verifyReachableCommit(sourceCommit, "source_commit");
  if (mode === "standard" && sourceCommit !== toolSourceCommit) {
    throw new ReleaseToolError("standard assembly requires source_commit to equal assembly.tool_source_commit");
  }
}

export function validateCanonicalTimestamp(value, description) {
  const date = new Date(value);
  if (typeof value !== "string" || Number.isNaN(date.valueOf()) || date.toISOString().replace(".000Z", "Z") !== value) {
    throw new ReleaseToolError(`${description} must be a canonical whole-second UTC timestamp`);
  }
}

export function canonicalReleaseIdentity(createdAt, sourceCommit) {
  if (!fullShaPattern.test(sourceCommit)) throw new ReleaseToolError("source_commit must be a full lowercase SHA");
  validateCanonicalTimestamp(createdAt, "created_at");
  const timestamp = createdAt.replaceAll("-", "").replaceAll(":", "");
  return `${timestamp}-${sourceCommit.slice(0, 12)}`;
}

export function assembleRelease({ specPath, outputRoot, legacyRuntimeImport = false, rehearsal = false }) {
  assertExistingRealDirectory(outputRoot, "assembly output root");
  assertSafeManagedRoot(outputRoot, "assembly output root");
  const spec = readJson(specPath, "assembly spec");
  const exactKeys = [
    "schema_version",
    "source_commit",
    "created_at",
    "ci_run_id",
    "assembly",
    "toolchain",
    "artifacts",
    "database",
    "verification",
    "runtime",
    "rollback",
  ];
  if (
    spec === null ||
    typeof spec !== "object" ||
    Array.isArray(spec) ||
    Object.keys(spec).sort().join("\0") !== exactKeys.sort().join("\0")
  ) {
    throw new ReleaseToolError(`assembly spec keys must be exactly: ${exactKeys.join(", ")}`);
  }
  if (spec.schema_version !== 2) throw new ReleaseToolError("assembly spec schema_version must equal 2");
  const requireExactSpecKeys = (value, keys, description) => {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")
    ) {
      throw new ReleaseToolError(`${description} keys must be exactly: ${keys.join(", ")}`);
    }
  };
  requireExactSpecKeys(spec.toolchain, ["node", "pnpm", "postgresql"], "toolchain");
  requireExactSpecKeys(
    spec.assembly,
    ["mode", "tool_source_commit", "tool_ci_run_id", "legacy_artifact_evidence_sha256"],
    "assembly",
  );
  requireExactSpecKeys(spec.artifacts, ["backend_source", "frontend_source"], "artifacts");
  requireExactSpecKeys(spec.database, ["migration_packages"], "database");
  requireExactSpecKeys(
    spec.verification,
    ["backup_required", "backup_manifest_sha256", "rollback_rehearsed"],
    "verification",
  );
  requireExactSpecKeys(spec.runtime, ["deployment_root", "environment_file"], "runtime");
  if (spec.rollback?.strategy === "release") {
    requireExactSpecKeys(
      spec.rollback,
      ["strategy", "previous_manifest", "database_restore_required"],
      "rollback",
    );
  } else if (spec.rollback?.strategy === "legacy-root") {
    requireExactSpecKeys(
      spec.rollback,
      ["strategy", "previous_manifest_sha256", "database_restore_required"],
      "rollback",
    );
  }
  if (!["standard", "legacy-runtime-import"].includes(spec.assembly.mode)) {
    throw new ReleaseToolError("assembly.mode must equal standard or legacy-runtime-import");
  }
  if (!fullShaPattern.test(spec.assembly.tool_source_commit)) {
    throw new ReleaseToolError("assembly.tool_source_commit must be a full lowercase SHA");
  }
  if (!/^[1-9]\d*$/u.test(spec.assembly.tool_ci_run_id)) {
    throw new ReleaseToolError("assembly.tool_ci_run_id must contain a positive decimal run id");
  }
  if (spec.assembly.mode === "standard") {
    if (legacyRuntimeImport) {
      throw new ReleaseToolError("--legacy-runtime-import is forbidden for standard assembly");
    }
    if (spec.assembly.tool_source_commit !== spec.source_commit) {
      throw new ReleaseToolError("standard assembly requires source_commit to equal assembly.tool_source_commit");
    }
    if (!/^[1-9]\d*$/u.test(spec.ci_run_id)) {
      throw new ReleaseToolError("standard assembly ci_run_id must contain a positive decimal run id");
    }
    if (spec.assembly.tool_ci_run_id !== spec.ci_run_id) {
      throw new ReleaseToolError("standard assembly requires ci_run_id to equal assembly.tool_ci_run_id");
    }
    if (spec.assembly.legacy_artifact_evidence_sha256 !== null) {
      throw new ReleaseToolError("standard assembly requires null legacy_artifact_evidence_sha256");
    }
  } else {
    if (!legacyRuntimeImport) {
      throw new ReleaseToolError("legacy-runtime-import assembly requires --legacy-runtime-import");
    }
    if (!sha256Pattern.test(spec.assembly.legacy_artifact_evidence_sha256)) {
      throw new ReleaseToolError("legacy-runtime-import requires a SHA-256 artifact evidence digest");
    }
    if (spec.ci_run_id !== null) {
      throw new ReleaseToolError("legacy-runtime-import requires null ci_run_id for an unverified historical CI run");
    }
    if (
      spec.rollback?.strategy === "legacy-root" &&
      spec.rollback.previous_manifest_sha256 !== spec.assembly.legacy_artifact_evidence_sha256
    ) {
      throw new ReleaseToolError("legacy-runtime-import evidence must match the legacy rollback evidence digest");
    }
  }
  if (!rehearsal) {
    verifyGitProvenance({
      sourceCommit: spec.source_commit,
      toolSourceCommit: spec.assembly.tool_source_commit,
      mode: spec.assembly.mode,
    });
  }
  const releaseId = canonicalReleaseIdentity(spec.created_at, spec.source_commit);

  const deploymentRoot = spec.runtime?.deployment_root;
  const environmentFile = spec.runtime?.environment_file;
  assertSafeManagedRoot(deploymentRoot, "manifest deployment root");
  if (isWithin(deploymentRoot, outputRoot) || isWithin(outputRoot, deploymentRoot)) {
    throw new ReleaseToolError("assembly output root and deployment root must not overlap");
  }
  assertNormalizedAbsolute(environmentFile, "environment_file");
  const backendSource = spec.artifacts?.backend_source;
  const frontendSource = spec.artifacts?.frontend_source;
  assertOutsideFrozenProduction(backendSource, "backend artifact source");
  assertOutsideFrozenProduction(frontendSource, "frontend artifact source");
  if (isWithin(backendSource, frontendSource) || isWithin(frontendSource, backendSource)) {
    throw new ReleaseToolError("backend and frontend artifact sources must not overlap");
  }
  if (isWithin(deploymentRoot, backendSource) || isWithin(deploymentRoot, frontendSource)) {
    throw new ReleaseToolError("artifact sources must be outside the deployment root");
  }

  const packageRoot = join(outputRoot, releaseId);
  if (existsSync(packageRoot)) throw new ReleaseToolError(`release package already exists: ${packageRoot}`);
  mkdirSync(packageRoot, { mode: 0o700 });
  let completed = false;
  try {
    const backendTarget = join(packageRoot, "backend");
    const frontendTarget = join(packageRoot, "frontend");
    cpSync(backendSource, backendTarget, {
      recursive: true,
      errorOnExist: true,
      force: false,
      verbatimSymlinks: true,
    });
    cpSync(frontendSource, frontendTarget, {
      recursive: true,
      errorOnExist: true,
      force: false,
      verbatimSymlinks: true,
    });
    const backendTree = artifactTree(backendTarget);
    const frontendTree = artifactTree(frontendTarget);

    let rollback;
    if (spec.rollback?.strategy === "release") {
      assertNormalizedAbsolute(spec.rollback.previous_manifest, "previous_manifest");
      validateReleaseManifest(spec.rollback.previous_manifest);
      const previous = readJson(spec.rollback.previous_manifest, "previous release manifest");
      if (
        previous.runtime.current_link !== `${deploymentRoot}/current` ||
        previous.runtime.previous_link !== `${deploymentRoot}/previous` ||
        previous.runtime.release_root !== `${deploymentRoot}/releases/${previous.release_id}`
      ) {
        throw new ReleaseToolError("previous release manifest belongs to a different deployment root");
      }
      if (previous.runtime.release_root === `${deploymentRoot}/releases/${releaseId}`) {
        throw new ReleaseToolError("previous release must differ from the new release");
      }
      rollback = {
        strategy: "release",
        previous_release_id: previous.release_id,
        previous_manifest_sha256: sha256File(spec.rollback.previous_manifest),
        database_restore_required: spec.rollback.database_restore_required,
      };
    } else if (spec.rollback?.strategy === "legacy-root") {
      if (!sha256Pattern.test(spec.rollback.previous_manifest_sha256)) {
        throw new ReleaseToolError("legacy-root rollback requires a SHA-256 evidence-manifest digest");
      }
      rollback = {
        strategy: "legacy-root",
        previous_release_id: null,
        previous_manifest_sha256: spec.rollback.previous_manifest_sha256,
        database_restore_required: spec.rollback.database_restore_required,
      };
    } else {
      throw new ReleaseToolError("rollback.strategy must equal release or legacy-root");
    }
    if (typeof rollback.database_restore_required !== "boolean") {
      throw new ReleaseToolError("rollback.database_restore_required must be boolean");
    }

    const manifest = {
      schema_version: 2,
      example: false,
      release_id: releaseId,
      source_commit: spec.source_commit,
      created_at: spec.created_at,
      assembly: {
        mode: spec.assembly.mode,
        tool_source_commit: spec.assembly.tool_source_commit,
        tool_ci_run_id: spec.assembly.tool_ci_run_id,
        legacy_artifact_evidence_sha256: spec.assembly.legacy_artifact_evidence_sha256,
      },
      toolchain: spec.toolchain,
      artifacts: {
        backend: {
          relative_path: "backend",
          tree_manifest_sha256: backendTree.treeManifestSha256,
          entry_count: backendTree.entryCount,
        },
        frontend: {
          relative_path: "frontend",
          tree_manifest_sha256: frontendTree.treeManifestSha256,
          entry_count: frontendTree.entryCount,
        },
      },
      database: {
        baseline_commit: spec.source_commit,
        migration_packages: spec.database?.migration_packages,
      },
      verification: {
        source_method:
          spec.assembly.mode === "legacy-runtime-import" ? "legacy-runtime-evidence" : "github-actions",
        ci_run_id: spec.ci_run_id,
        ci_head_sha: spec.assembly.mode === "legacy-runtime-import" ? null : spec.source_commit,
        required_jobs:
          spec.assembly.mode === "legacy-runtime-import"
            ? []
            : ["repository", "database", "backend", "frontend"],
        legacy_runtime_evidence_sha256:
          spec.assembly.mode === "legacy-runtime-import"
            ? spec.assembly.legacy_artifact_evidence_sha256
            : null,
        backup_required: spec.verification?.backup_required,
        backup_manifest_sha256: spec.verification?.backup_manifest_sha256,
        rollback_rehearsed: spec.verification?.rollback_rehearsed,
      },
      runtime: {
        release_root: `${deploymentRoot}/releases/${releaseId}`,
        current_link: `${deploymentRoot}/current`,
        previous_link: `${deploymentRoot}/previous`,
        environment_file: environmentFile,
      },
      rollback,
    };

    const manifestPath = join(packageRoot, "release-manifest.json");
    writeJson(manifestPath, manifest);
    validateReleaseManifest(manifestPath);
    const packageChecksums = [
      { path: "release-manifest.json", sha256: sha256File(manifestPath) },
      ...backendTree.entries.map((entry) => ({ path: `backend/${entry.path}`, sha256: entry.sha256 })),
      ...frontendTree.entries.map((entry) => ({ path: `frontend/${entry.path}`, sha256: entry.sha256 })),
    ].sort((left, right) => left.path.localeCompare(right.path, "en"));
    writeFileSync(
      join(packageRoot, "checksums.sha256"),
      packageChecksums.map((entry) => `${entry.sha256}  ${entry.path}\n`).join(""),
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    makeTreeReadOnly(packageRoot);
    const verified = verifyReleasePackage(packageRoot);
    completed = true;
    return { packageRoot, ...verified };
  } finally {
    if (!completed && existsSync(packageRoot)) {
      makeTreeWritable(packageRoot);
      rmSync(packageRoot, { recursive: true, force: true });
    }
  }
}

export function installRelease({ packageRoot, deploymentRoot }) {
  assertSafeManagedRoot(deploymentRoot);
  assertOutsideFrozenProduction(packageRoot, "release package");
  if (isWithin(deploymentRoot, packageRoot)) {
    throw new ReleaseToolError("release package must be outside the deployment root");
  }
  const source = verifyReleasePackage(packageRoot);
  const releasesRoot = join(deploymentRoot, "releases");
  if (existsSync(releasesRoot)) {
    assertExistingRealDirectory(releasesRoot, "releases directory");
  } else {
    mkdirSync(releasesRoot, { recursive: false, mode: 0o755 });
  }
  const finalRoot = join(releasesRoot, source.manifest.release_id);
  if (source.manifest.runtime.release_root !== finalRoot) {
    throw new ReleaseToolError("release manifest target does not match --deployment-root");
  }
  if (existsSync(finalRoot)) throw new ReleaseToolError(`installed release already exists: ${finalRoot}`);
  const stageRoot = join(releasesRoot, `.install-${source.manifest.release_id}-${randomBytes(6).toString("hex")}`);
  let completed = false;
  try {
    cpSync(packageRoot, stageRoot, {
      recursive: true,
      errorOnExist: true,
      force: false,
      verbatimSymlinks: true,
    });
    verifyReleasePackage(stageRoot);
    mkdirSync(join(deploymentRoot, "receipts"), { recursive: true, mode: 0o700 });
    renameSync(stageRoot, finalRoot);
    const installed = verifyReleasePackage(finalRoot);
    completed = true;
    return { installedRoot: finalRoot, ...installed };
  } finally {
    if (!completed && existsSync(stageRoot)) {
      makeTreeWritable(stageRoot);
      rmSync(stageRoot, { recursive: true, force: true });
    }
  }
}

export function readManagedLink(deploymentRoot, linkName, { allowMissing = false } = {}) {
  const linkPath = join(deploymentRoot, linkName);
  let metadata;
  try {
    metadata = lstatSync(linkPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    if (allowMissing) return null;
    throw new ReleaseToolError(`${linkName} release pointer is missing`);
  }
  if (!metadata.isSymbolicLink()) throw new ReleaseToolError(`${linkName} must be a symbolic link`);
  const target = readlinkSync(linkPath);
  const match = target.match(/^releases\/(\d{8}T\d{6}Z-[0-9a-f]{12})$/u);
  if (!match) throw new ReleaseToolError(`${linkName} has an unmanaged target: ${target}`);
  const installedRoot = join(deploymentRoot, target);
  const verified = verifyReleasePackage(installedRoot);
  if (verified.manifest.release_id !== match[1]) {
    throw new ReleaseToolError(`${linkName} target and manifest identities differ`);
  }
  return { linkPath, target, releaseId: match[1], installedRoot, ...verified };
}

function replaceManagedLink(deploymentRoot, name, target) {
  const temporary = join(deploymentRoot, `.${name}-${process.pid}-${randomBytes(6).toString("hex")}`);
  symlinkSync(target, temporary);
  renameSync(temporary, join(deploymentRoot, name));
}

function restoreManagedLink(deploymentRoot, name, oldTarget) {
  const path = join(deploymentRoot, name);
  if (oldTarget === null) {
    try {
      lstatSync(path);
      rmSync(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  } else {
    replaceManagedLink(deploymentRoot, name, oldTarget);
  }
}

export function performActivation({
  deploymentRoot,
  releaseId,
  action,
  recordedAt,
  rehearsal,
  allowLegacyBootstrap = false,
  databaseBackupVerified = false,
  databaseRestoreCompleted = false,
}) {
  if (process.env.PEAKS_ALLOW_RELEASE_ACTIVATION !== "1") {
    throw new ReleaseToolError("set PEAKS_ALLOW_RELEASE_ACTIVATION=1 for an explicit pointer mutation");
  }
  assertSafeManagedRoot(deploymentRoot);
  if (!releaseIdPattern.test(releaseId)) throw new ReleaseToolError("release-id has invalid format");
  if (!["ACTIVATE", "ROLLBACK"].includes(action)) throw new ReleaseToolError("invalid activation action");
  if (typeof rehearsal !== "boolean") throw new ReleaseToolError("rehearsal flag must be explicit");
  validateCanonicalTimestamp(recordedAt, "recorded-at");

  const targetRoot = join(deploymentRoot, "releases", releaseId);
  const target = verifyReleasePackage(targetRoot);
  if (target.manifest.release_id !== releaseId) throw new ReleaseToolError("target release identity mismatch");
  const current = readManagedLink(deploymentRoot, "current", { allowMissing: true });
  const previous = readManagedLink(deploymentRoot, "previous", { allowMissing: true });
  if (current?.releaseId === releaseId) throw new ReleaseToolError("target release is already current");
  if (current === null && previous !== null) {
    throw new ReleaseToolError("previous pointer cannot exist when current is missing");
  }

  if (action === "ACTIVATE") {
    if (current === null) {
      if (target.manifest.rollback.strategy !== "legacy-root" || !allowLegacyBootstrap) {
        throw new ReleaseToolError("first activation requires legacy-root rollback and --allow-legacy-bootstrap");
      }
    } else {
      if (
        target.manifest.rollback.strategy !== "release" ||
        target.manifest.rollback.previous_release_id !== current.releaseId ||
        target.manifest.rollback.previous_manifest_sha256 !== current.manifestSha256
      ) {
        throw new ReleaseToolError("target rollback contract does not identify the current release");
      }
    }
    if (target.manifest.verification.backup_required && !databaseBackupVerified) {
      throw new ReleaseToolError("release requires a verified database backup before activation");
    }
  } else {
    if (current === null || previous === null || previous.releaseId !== releaseId) {
      throw new ReleaseToolError("rollback target must be the installed previous pointer");
    }
    if (
      current.manifest.rollback.strategy !== "release" ||
      current.manifest.rollback.previous_release_id !== previous.releaseId ||
      current.manifest.rollback.previous_manifest_sha256 !== previous.manifestSha256
    ) {
      throw new ReleaseToolError("current release does not authorize rollback to previous");
    }
    if (current.manifest.rollback.database_restore_required && !databaseRestoreCompleted) {
      throw new ReleaseToolError("rollback requires completed database restore evidence");
    }
  }

  const oldCurrentTarget = current?.target ?? null;
  const oldPreviousTarget = previous?.target ?? null;
  const newCurrentTarget = `releases/${releaseId}`;
  const newPreviousTarget = oldCurrentTarget;
  const receiptDirectory = join(deploymentRoot, "receipts");
  assertExistingRealDirectory(receiptDirectory, "receipt directory");
  if (isWithin(join(deploymentRoot, "releases"), receiptDirectory)) {
    throw new ReleaseToolError("receipt directory must be outside immutable releases");
  }
  const compactTimestamp = recordedAt.replaceAll("-", "").replaceAll(":", "");
  const receiptName = `${compactTimestamp}-${action.toLowerCase()}-${releaseId}.json`;
  const receiptPath = join(receiptDirectory, receiptName);
  if (existsSync(receiptPath)) throw new ReleaseToolError(`deployment receipt already exists: ${receiptPath}`);
  const receiptTemporary = join(receiptDirectory, `.${receiptName}.${randomBytes(6).toString("hex")}`);
  const receipt = {
    schema_version: 1,
    receipt_id: receiptName.slice(0, -5),
    action,
    rehearsal,
    recorded_at: recordedAt,
    deployment_root: deploymentRoot,
    from: current === null ? null : { release_id: current.releaseId, manifest_sha256: current.manifestSha256 },
    to: { release_id: releaseId, manifest_sha256: target.manifestSha256 },
    pointers: { current: newCurrentTarget, previous: newPreviousTarget },
    database: {
      backup_required: action === "ACTIVATE" && target.manifest.verification.backup_required,
      backup_verified:
        action === "ACTIVATE" && target.manifest.verification.backup_required ? databaseBackupVerified : false,
      backup_manifest_sha256:
        action === "ACTIVATE" ? target.manifest.verification.backup_manifest_sha256 : null,
      restore_required: action === "ROLLBACK" && current?.manifest.rollback.database_restore_required === true,
      restore_completed:
        action === "ROLLBACK" && current?.manifest.rollback.database_restore_required === true
          ? databaseRestoreCompleted
          : false,
    },
    result: "SUCCEEDED",
  };
  const receiptFailures = validateDeploymentReceipt(receipt);
  if (receiptFailures.length > 0) {
    throw new ReleaseToolError(`deployment receipt contract failed: ${receiptFailures.join("; ")}`);
  }

  writeFileSync(receiptTemporary, `${JSON.stringify(receipt, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  let currentChanged = false;
  let previousChanged = false;
  try {
    if (newPreviousTarget !== null) {
      replaceManagedLink(deploymentRoot, "previous", newPreviousTarget);
      previousChanged = true;
    }
    replaceManagedLink(deploymentRoot, "current", newCurrentTarget);
    currentChanged = true;
    renameSync(receiptTemporary, receiptPath);
    chmodSync(receiptPath, 0o444);
  } catch (error) {
    if (currentChanged) restoreManagedLink(deploymentRoot, "current", oldCurrentTarget);
    if (previousChanged) restoreManagedLink(deploymentRoot, "previous", oldPreviousTarget);
    if (existsSync(receiptTemporary)) rmSync(receiptTemporary);
    throw error;
  }

  return { receipt, receiptPath, current: newCurrentTarget, previous: newPreviousTarget };
}
