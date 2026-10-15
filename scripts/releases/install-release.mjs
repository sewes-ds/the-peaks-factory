#!/usr/bin/env node

import {
  ReleaseToolError,
  installRelease,
  parseCli,
  requireOptions,
} from "./release-tools-lib.mjs";

function usage() {
  return "usage: node scripts/releases/install-release.mjs --package <absolute-release-dir> --deployment-root <existing-absolute-dir>\n";
}

try {
  const options = parseCli(process.argv.slice(2), { values: ["package", "deployment-root"] });
  requireOptions(options, ["package", "deployment-root"]);
  const result = installRelease({ packageRoot: options.package, deploymentRoot: options["deployment-root"] });
  process.stdout.write(
    `RELEASE_INSTALL_PASS release_id=${result.manifest.release_id} installed=${result.installedRoot} manifest_sha256=${result.manifestSha256}\n`,
  );
} catch (error) {
  const message = error instanceof ReleaseToolError ? error.message : `unexpected error: ${error.message}`;
  process.stderr.write(`RELEASE_INSTALL_FAIL: ${message}\n${usage()}`);
  process.exit(1);
}
