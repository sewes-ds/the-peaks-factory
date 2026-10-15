#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync
} from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repositoryRoot = resolve(import.meta.dirname, '..');
const forbiddenHostname = ['44433', 'koara', 'live'].join('.');
const allowedFrontendAbsoluteHosts = new Set([
  'github.com',
  'openfontlicense.org',
  'react.dev',
  'telegram.org',
  'www.w3.org'
]);

function fail(message) {
  throw new Error(message);
}

function parseArguments(arguments_) {
  const options = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail('Every option requires one value');
    options[key.slice(2)] = value;
  }
  const allowed = new Set(['backend-dist', 'miniapp-dist', 'admin-dist']);
  if (Object.keys(options).some((key) => !allowed.has(key)) || Object.keys(options).length === 0) {
    fail('Use one or more of --backend-dist, --miniapp-dist and --admin-dist');
  }
  return options;
}

function resolveDirectory(path, description) {
  const absolutePath = resolve(path);
  if (!isAbsolute(absolutePath) || !existsSync(absolutePath) || !lstatSync(absolutePath).isDirectory()) {
    fail(`${description} must be an existing directory`);
  }
  return realpathSync(absolutePath);
}

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) fail(`Artifact must not contain symbolic links: ${relative(root, path)}`);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
      else fail(`Artifact contains an unsupported entry: ${relative(root, path)}`);
    }
  };
  visit(root);
  return files;
}

function treeHash(root) {
  const digest = createHash('sha256');
  const files = walkFiles(root);
  for (const path of files) {
    const fileDigest = createHash('sha256').update(readFileSync(path)).digest('hex');
    digest.update(`${relative(root, path)}\0${fileDigest}\n`);
  }
  return { sha256: digest.digest('hex'), entries: files.length };
}

function assertForbiddenHostnameAbsent(root, description) {
  const needle = Buffer.from(forbiddenHostname, 'utf8');
  const matches = walkFiles(root)
    .filter((path) => readFileSync(path).includes(needle))
    .map((path) => relative(root, path));
  if (matches.length > 0) fail(`${description} contains the retired hostname: ${matches.join(', ')}`);
}

function verifySourceBoundary() {
  const sourcePaths = [
    'backend/src',
    'frontend/miniapp/src',
    'frontend/admin/src',
    'deploy/vds/nginx',
    'scripts/deploy'
  ];
  for (const sourcePath of sourcePaths) {
    assertForbiddenHostnameAbsent(resolve(repositoryRoot, sourcePath), sourcePath);
  }
  if (readFileSync(resolve(repositoryRoot, '.env.example'), 'utf8').includes(forbiddenHostname)) {
    fail('.env.example contains the retired hostname');
  }
}

async function verifyBackend(backendDist) {
  if (existsSync(join(backendDist, 'tests'))) {
    fail('Production backend build must not contain compiled tests');
  }
  const entrypoint = join(backendDist, 'src/server.js');
  const envModulePath = join(backendDist, 'src/config/env.js');
  if (!existsSync(entrypoint) || !existsSync(envModulePath)) fail('Backend build entrypoints are incomplete');

  const before = treeHash(backendDist);
  assertForbiddenHostnameAbsent(backendDist, 'backend build');
  const { parseRuntimeEnv } = await import(pathToFileURL(envModulePath).href);
  const common = {
    APP_ENV: 'production',
    DATABASE_URL: 'postgresql://app_runtime_role@localhost:5432/app',
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_BOT_USERNAME: 'portability_test_bot',
    TELEGRAM_BOT_WEBHOOK_SECRET_TOKEN: 'x'.repeat(32),
    TELEGRAM_BOT_WEBHOOK_PATH_SECRET: 'y'.repeat(32),
    TELEGRAM_SELF_BINDING_TOKEN_SECRET: 'z'.repeat(32),
    INTERNAL_WORKER_TOKEN: 'test-worker-token'
  };
  for (const publicBaseUrl of [
    'https://factory.example/peaks/',
    'https://app.customer.example/peaks/'
  ]) {
    const parsed = parseRuntimeEnv({ ...common, PUBLIC_BASE_URL: publicBaseUrl });
    if (parsed.PUBLIC_BASE_URL !== publicBaseUrl) fail(`Backend rejected canonical URL: ${publicBaseUrl}`);
  }
  const after = treeHash(backendDist);
  if (before.sha256 !== after.sha256 || before.entries !== after.entries) {
    fail('Backend artifact changed while switching runtime domains');
  }
  return before;
}

function verifyFrontend(frontendDist, expectedBase, description) {
  const indexPath = join(frontendDist, 'index.html');
  if (!existsSync(indexPath)) fail(`${description} has no index.html`);
  assertForbiddenHostnameAbsent(frontendDist, description);
  const index = readFileSync(indexPath, 'utf8');
  const assetReferences = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const applicationReferences = assetReferences.filter((value) => !value.startsWith('https://telegram.org/'));
  if (applicationReferences.some((value) => !value.startsWith(expectedBase))) {
    fail(`${description} index contains a non-relative application asset URL`);
  }
  const unexpectedAbsoluteHosts = new Set();
  for (const path of walkFiles(frontendDist)) {
    const content = readFileSync(path, 'utf8');
    for (const match of content.matchAll(/https?:\/\/([a-z0-9.-]+)/giu)) {
      const host = match[1].toLowerCase();
      if (!allowedFrontendAbsoluteHosts.has(host)) unexpectedAbsoluteHosts.add(host);
    }
  }
  if (unexpectedAbsoluteHosts.size > 0) {
    fail(`${description} embeds unexpected absolute hosts: ${[...unexpectedAbsoluteHosts].sort().join(', ')}`);
  }
  return treeHash(frontendDist);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  verifySourceBoundary();
  const evidence = {};
  if (options['backend-dist']) {
    evidence.backend = await verifyBackend(resolveDirectory(options['backend-dist'], 'backend dist'));
  }
  if (options['miniapp-dist']) {
    evidence.miniapp = verifyFrontend(
      resolveDirectory(options['miniapp-dist'], 'Mini App dist'),
      '/peaks/',
      'Mini App build'
    );
  }
  if (options['admin-dist']) {
    evidence.admin = verifyFrontend(
      resolveDirectory(options['admin-dist'], 'admin dist'),
      '/admin/',
      'admin build'
    );
  }

  const summary = Object.entries(evidence)
    .map(([name, value]) => `${name}_sha256=${value.sha256} ${name}_entries=${value.entries}`)
    .join(' ');
  process.stdout.write(`DOMAIN_PORTABILITY_VERIFY_PASS domains=2 ${summary}\n`);
}

main().catch((error) => {
  process.stderr.write(`DOMAIN_PORTABILITY_VERIFY_FAIL: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exitCode = 1;
});
