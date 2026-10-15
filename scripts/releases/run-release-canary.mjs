#!/usr/bin/env node

import { ReleaseToolError, parseCli, requireOptions } from "./release-tools-lib.mjs";
import { runReleaseCanary } from "./release-canary-lib.mjs";

try {
  const options = parseCli(process.argv.slice(2), { values: ["spec"] });
  requireOptions(options, ["spec"]);
  const result = await runReleaseCanary(options.spec);
  for (const check of result.results) {
    process.stdout.write(
      `RELEASE_CANARY_CHECK_PASS name=${check.name} status=${check.status} bytes=${check.response_bytes} sha256=${check.response_body_sha256} duration_ms=${check.duration_ms}\n`,
    );
  }
  process.stdout.write(`RELEASE_CANARY_PASS release_id=${result.releaseId}\n`);
} catch (error) {
  const message = error instanceof ReleaseToolError ? error.message : `unexpected error: ${error.message}`;
  process.stderr.write(`RELEASE_CANARY_FAIL: ${message}\n`);
  process.exit(1);
}
