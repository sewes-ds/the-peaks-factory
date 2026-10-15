#!/usr/bin/env node

import {
  ReleaseToolError,
  parseCli,
  performActivation,
  readManagedLink,
  requireOptions,
} from "./release-tools-lib.mjs";

function usage() {
  return "usage: PEAKS_ALLOW_RELEASE_ACTIVATION=1 node scripts/releases/rollback-release.mjs --deployment-root <absolute-dir> --recorded-at <UTC> (--rehearsal|--production) [--database-restore-completed]\n";
}

try {
  const options = parseCli(process.argv.slice(2), {
    values: ["deployment-root", "recorded-at"],
    flags: ["rehearsal", "production", "database-restore-completed"],
  });
  requireOptions(options, ["deployment-root", "recorded-at"]);
  if ((options.rehearsal === true) === (options.production === true)) {
    throw new ReleaseToolError("choose exactly one of --rehearsal or --production");
  }
  const previous = readManagedLink(options["deployment-root"], "previous");
  const result = performActivation({
    deploymentRoot: options["deployment-root"],
    releaseId: previous.releaseId,
    action: "ROLLBACK",
    recordedAt: options["recorded-at"],
    rehearsal: options.rehearsal === true,
    databaseRestoreCompleted: options["database-restore-completed"] === true,
  });
  process.stdout.write(
    `RELEASE_ROLLBACK_PASS release_id=${previous.releaseId} current=${result.current} receipt=${result.receiptPath}\n`,
  );
} catch (error) {
  const message = error instanceof ReleaseToolError ? error.message : `unexpected error: ${error.message}`;
  process.stderr.write(`RELEASE_ROLLBACK_FAIL: ${message}\n${usage()}`);
  process.exit(1);
}
