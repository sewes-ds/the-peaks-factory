import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const PACKAGE_ID = '20260829_001_sku_qr_tokens';
export const SKU_HEADER = Object.freeze(['sku_id', 'sku_code', 'generated_protected_qr_token']);
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

export function encodeCsv(rows, header = SKU_HEADER) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return `${[header, ...rows].map((row) => row.map(quote).join(',')).join('\n')}\n`;
}

export function parseCsv(document) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < document.length; index += 1) {
    const character = document[index];
    if (quoted) {
      if (character === '"' && document[index + 1] === '"') {
        field += '"'; index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (character !== '\r') field += character;
  }
  if (quoted || field !== '' || row.length > 0) fail('SKU_QR_CSV_INVALID');
  return rows;
}

export function validateSkuRows(rows, expectedCount = 162) {
  if (rows.length !== expectedCount) fail('SKU_QR_INPUT_COUNT_FAILED');
  const ids = new Set();
  const codes = new Set();
  const tokens = new Set();
  for (const row of rows) {
    if (row.length !== 3 || !/^[1-9][0-9]*$/.test(row[0]) || row[1].trim() !== row[1] || row[1] === '' || !TOKEN_PATTERN.test(row[2])) {
      fail('SKU_QR_INPUT_VALUE_FAILED');
    }
    if (ids.has(row[0]) || codes.has(row[1]) || tokens.has(row[2])) fail('SKU_QR_INPUT_UNIQUENESS_FAILED');
    ids.add(row[0]); codes.add(row[1]); tokens.add(row[2]);
  }
  return rows;
}

export function packageTreeSha256(packageRoot) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
      else fail('SKU_QR_PACKAGE_TREE_UNSAFE');
    }
  };
  visit(packageRoot);
  files.sort();
  const hash = createHash('sha256');
  for (const path of files) {
    hash.update(relative(packageRoot, path));
    hash.update('\0');
    hash.update(readFileSync(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function assertPathOutside(candidate, forbiddenRoots, code) {
  if (!isAbsolute(candidate)) fail(code);
  const resolved = resolve(candidate);
  for (const root of forbiddenRoots.map((value) => resolve(value))) {
    const relation = relative(root, resolved);
    if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) fail(code);
  }
  return resolved;
}

export function assertCleanGit(repositoryRoot) {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: repositoryRoot, encoding: 'utf8' });
  if (head.status !== 0 || status.status !== 0 || status.stdout !== '') fail('SKU_QR_GIT_NOT_CLEAN_EXACT');
  const commit = head.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) fail('SKU_QR_GIT_HEAD_INVALID');
  return commit;
}

export function libpqEnvironment(databaseUrl, inherited = process.env) {
  let parsed;
  try { parsed = new URL(databaseUrl); } catch { fail('SKU_QR_DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.pathname.length < 2) fail('SKU_QR_DATABASE_URL_INVALID');
  const supported = new Set(['sslmode', 'application_name']);
  for (const key of parsed.searchParams.keys()) if (!supported.has(key)) fail('SKU_QR_DATABASE_URL_PARAMETER_UNSUPPORTED');
  const environment = { ...inherited };
  delete environment.DATABASE_URL;
  Object.assign(environment, {
    PGHOST: decodeURIComponent(parsed.hostname),
    PGPORT: parsed.port || '5432',
    PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
  });
  if (parsed.searchParams.has('sslmode')) environment.PGSSLMODE = parsed.searchParams.get('sslmode');
  if (parsed.searchParams.has('application_name')) environment.PGAPPNAME = parsed.searchParams.get('application_name');
  return environment;
}

export function runPsqlCaptured(databaseUrl, args, { input, failureCode }) {
  const result = spawnSync('psql', args, {
    encoding: 'utf8', input, maxBuffer: 8 * 1024 * 1024,
    env: libpqEnvironment(databaseUrl),
  });
  if (result.status !== 0) fail(failureCode);
  return result;
}

export function readProtectedInput(directory, repositoryRoot, packageRoot) {
  const resolvedDirectory = assertPathOutside(directory, [repositoryRoot, '/srv/the-peaks-factory'], 'SKU_QR_PROTECTED_INPUT_LOCATION_INVALID');
  const directoryStat = lstatSync(resolvedDirectory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink() || (directoryStat.mode & 0o077) !== 0) fail('SKU_QR_PROTECTED_INPUT_PERMISSIONS_INVALID');
  const manifestPath = resolve(resolvedDirectory, 'protected-input-manifest.json');
  const csvPath = resolve(resolvedDirectory, 'skus.csv');
  if (JSON.stringify(readdirSync(resolvedDirectory).sort()) !== JSON.stringify(['protected-input-manifest.json', 'skus.csv'])) {
    fail('SKU_QR_PROTECTED_INPUT_FILE_SET_INVALID');
  }
  for (const path of [manifestPath, csvPath]) {
    const fileStat = lstatSync(path);
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || (fileStat.mode & 0o077) !== 0) fail('SKU_QR_PROTECTED_INPUT_PERMISSIONS_INVALID');
    if (realpathSync(path) !== path) fail('SKU_QR_PROTECTED_INPUT_PATH_INVALID');
  }
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { fail('SKU_QR_PROTECTED_MANIFEST_INVALID'); }
  const document = readFileSync(csvPath, 'utf8');
  const parsed = parseCsv(document);
  if (JSON.stringify(parsed[0]) !== JSON.stringify(SKU_HEADER)) fail('SKU_QR_INPUT_HEADER_FAILED');
  validateSkuRows(parsed.slice(1));
  if (
    manifest?.formatVersion !== 1 || manifest?.packageId !== PACKAGE_ID
    || !/^[0-9a-f]{40}$/.test(manifest?.targetCommit ?? '')
    || !/^[0-9a-f]{64}$/.test(manifest?.packageTreeSha256 ?? '')
    || manifest?.files?.['skus.csv']?.rowCount !== 162
    || manifest?.files?.['skus.csv']?.sha256 !== sha256Buffer(document)
    || manifest.packageTreeSha256 !== packageTreeSha256(packageRoot)
  ) fail('SKU_QR_PROTECTED_MANIFEST_BINDING_FAILED');
  return { resolvedDirectory, manifest, csvPath };
}
