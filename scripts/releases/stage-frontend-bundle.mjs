#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ReleaseToolError,
  assertExistingRealDirectory,
  assertNormalizedAbsolute,
  assertOutsideFrozenProduction,
  isWithin,
  legacyProductionRoot,
  parseCli,
  requireOptions,
  walkArtifactEntries
} from './release-tools-lib.mjs';

try {
  const options = parseCli(process.argv.slice(2), {
    values: ['miniapp-dist', 'admin-dist', 'output']
  });
  requireOptions(options, ['miniapp-dist', 'admin-dist', 'output']);

  const miniappDist = options['miniapp-dist'];
  const adminDist = options['admin-dist'];
  const output = options.output;
  assertExistingRealDirectory(miniappDist, 'Mini App dist');
  assertExistingRealDirectory(adminDist, 'admin dist');
  assertNormalizedAbsolute(output, 'frontend bundle output');
  assertOutsideFrozenProduction(dirname(output), 'frontend bundle output parent');

  if (
    isWithin(legacyProductionRoot, output)
    || isWithin(output, legacyProductionRoot)
    || isWithin(miniappDist, output)
    || isWithin(output, miniappDist)
    || isWithin(adminDist, output)
    || isWithin(output, adminDist)
  ) {
    throw new ReleaseToolError('frontend bundle output overlaps a protected or source tree');
  }
  if (existsSync(output)) {
    throw new ReleaseToolError('frontend bundle output already exists');
  }

  mkdirSync(output, { mode: 0o700 });
  let completed = false;
  try {
    for (const entry of readdirSync(miniappDist, { withFileTypes: true })) {
      cpSync(join(miniappDist, entry.name), join(output, entry.name), {
        recursive: true,
        errorOnExist: true,
        force: false,
        verbatimSymlinks: true
      });
    }
    cpSync(adminDist, join(output, 'admin'), {
      recursive: true,
      errorOnExist: true,
      force: false,
      verbatimSymlinks: true
    });

    if (!existsSync(join(output, 'index.html')) || !existsSync(join(output, 'admin', 'index.html'))) {
      throw new ReleaseToolError('frontend bundle must contain Mini App and admin entrypoints');
    }

    const entries = walkArtifactEntries(output);
    completed = true;
    process.stdout.write('FRONTEND_BUNDLE_STAGE_PASS\n');
    process.stdout.write('entry_count=' + entries.length + '\n');
    process.stdout.write('layout=miniapp-root+admin-subdirectory\n');
  } finally {
    if (!completed && existsSync(output)) {
      rmSync(output, { recursive: true, force: true });
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'unknown staging error';
  process.stderr.write('FRONTEND_BUNDLE_STAGE_FAIL: ' + message + '\n');
  process.exit(1);
}
