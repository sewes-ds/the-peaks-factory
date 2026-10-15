#!/usr/bin/env node

import {
  ReleaseToolError,
  assembleRelease,
  parseCli,
  requireOptions,
} from "./release-tools-lib.mjs";

function usage() {
  return "usage: node scripts/releases/assemble-release.mjs --spec <absolute-json> --output-root <existing-absolute-dir> [--legacy-runtime-import] [--rehearsal]\n";
}

try {
  const options = parseCli(process.argv.slice(2), {
    values: ["spec", "output-root"],
    flags: ["legacy-runtime-import", "rehearsal"],
  });
  requireOptions(options, ["spec", "output-root"]);
  const result = assembleRelease({
    specPath: options.spec,
    outputRoot: options["output-root"],
    legacyRuntimeImport: options["legacy-runtime-import"] === true,
    rehearsal: options.rehearsal === true,
  });
  process.stdout.write(
    `RELEASE_ASSEMBLE_PASS release_id=${result.manifest.release_id} package=${result.packageRoot} manifest_sha256=${result.manifestSha256}\n`,
  );
} catch (error) {
  const message = error instanceof ReleaseToolError ? error.message : `unexpected error: ${error.message}`;
  process.stderr.write(`RELEASE_ASSEMBLE_FAIL: ${message}\n${usage()}`);
  process.exit(1);
}
