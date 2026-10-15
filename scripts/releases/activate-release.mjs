#!/usr/bin/env node

import {
  ReleaseToolError,
  parseCli,
  performActivation,
  requireOptions,
} from "./release-tools-lib.mjs";

function usage() {
  return "usage: PEAKS_ALLOW_RELEASE_ACTIVATION=1 node scripts/releases/activate-release.mjs --deployment-root <absolute-dir> --release-id <id> --recorded-at <UTC> (--rehearsal|--production) [--allow-legacy-bootstrap] [--database-backup-verified]\n";
}

try {
  const options = parseCli(process.argv.slice(2), {
    values: ["deployment-root", "release-id", "recorded-at"],
    flags: ["rehearsal", "production", "allow-legacy-bootstrap", "database-backup-verified"],
  });
  requireOptions(options, ["deployment-root", "release-id", "recorded-at"]);
  if ((options.rehearsal === true) === (options.production === true)) {
    throw new ReleaseToolError("choose exactly one of --rehearsal or --production");
  }
  const result = performActivation({
    deploymentRoot: options["deployment-root"],
    releaseId: options["release-id"],
    action: "ACTIVATE",
    recordedAt: options["recorded-at"],
    rehearsal: options.rehearsal === true,
    allowLegacyBootstrap: options["allow-legacy-bootstrap"] === true,
    databaseBackupVerified: options["database-backup-verified"] === true,
  });
  process.stdout.write(
    `RELEASE_ACTIVATE_PASS release_id=${options["release-id"]} current=${result.current} receipt=${result.receiptPath}\n`,
  );
} catch (error) {
  const message = error instanceof ReleaseToolError ? error.message : `unexpected error: ${error.message}`;
  process.stderr.write(`RELEASE_ACTIVATE_FAIL: ${message}\n${usage()}`);
  process.exit(1);
}
