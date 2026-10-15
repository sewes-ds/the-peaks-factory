#!/usr/bin/env node

import {
  ReleaseToolError,
  parseCli,
  requireOptions,
  verifyReleasePackage,
} from "./release-tools-lib.mjs";

try {
  const options = parseCli(process.argv.slice(2), { values: ["package"] });
  requireOptions(options, ["package"]);
  const result = verifyReleasePackage(options.package);
  process.stdout.write(
    `RELEASE_PACKAGE_VERIFY_PASS release_id=${result.manifest.release_id} manifest_sha256=${result.manifestSha256}\n`,
  );
} catch (error) {
  const message = error instanceof ReleaseToolError ? error.message : `unexpected error: ${error.message}`;
  process.stderr.write(`RELEASE_PACKAGE_VERIFY_FAIL: ${message}\n`);
  process.exit(1);
}
