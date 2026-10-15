import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';

const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const QR_PAYLOAD_PREFIX = 'peaks-sku:v1:';

export type SkuLabelRow = Readonly<{
  sku_id: string;
  sku_code: string;
  sku_name: string;
  sku_qr_token: string;
}>;

export function buildSkuQrPayload(token: string): string {
  if (!QR_TOKEN_PATTERN.test(token)) throw new Error('SKU QR token contract is invalid.');
  return `${QR_PAYLOAD_PREFIX}${token}`;
}

export function validateSkuLabelRows(value: readonly SkuLabelRow[], expectedCount = 162): readonly SkuLabelRow[] {
  if (value.length !== expectedCount) throw new Error(`SKU label row count mismatch: expected ${expectedCount}.`);
  const ids = new Set<string>();
  const codes = new Set<string>();
  const tokens = new Set<string>();
  for (const row of value) {
    if (!/^[1-9][0-9]*$/.test(row.sku_id) || row.sku_code.trim().length === 0 || row.sku_name.trim().length === 0) {
      throw new Error('SKU label identity contract is invalid.');
    }
    buildSkuQrPayload(row.sku_qr_token);
    if (ids.has(row.sku_id) || codes.has(row.sku_code) || tokens.has(row.sku_qr_token)) {
      throw new Error('Duplicate SKU label identity or QR token.');
    }
    ids.add(row.sku_id); codes.add(row.sku_code); tokens.add(row.sku_qr_token);
  }
  return Object.freeze([...value].sort((left, right) => left.sku_code.localeCompare(right.sku_code, 'ru', { numeric: true })));
}

function parseOutputArgument(argv: readonly string[]): string {
  const index = argv.indexOf('--output');
  const output = index < 0 ? undefined : argv[index + 1];
  if (output === undefined || !isAbsolute(output)) throw new Error('--output must be an absolute protected directory.');
  return resolve(output);
}

function isInside(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function gitRoot(): string | null {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function assertProtectedOutput(output: string): void {
  const repository = gitRoot();
  if (repository !== null && isInside(repository, output)) throw new Error('SKU QR labels cannot be written inside Git.');
  if (isInside('/srv/the-peaks-factory/releases', output) || isInside('/srv/the-peaks-factory/current', output)) {
    throw new Error('SKU QR labels cannot be written inside an immutable release.');
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function runProtected(command: string, args: readonly string[], input?: string): void {
  const result = spawnSync(command, [...args], { encoding: 'utf8', input, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Protected label renderer failed: ${command}.`);
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function renderLabels(rows: readonly SkuLabelRow[], output: string): Promise<void> {
  const qrDirectory = resolve(output, 'qr');
  await mkdir(qrDirectory, { mode: 0o700 });
  await chmod(qrDirectory, 0o700);
  const items: string[] = [];
  const labels: Array<Record<string, unknown>> = [];
  for (const [index, row] of rows.entries()) {
    const stem = `${String(index + 1).padStart(3, '0')}-sku-${row.sku_id}`;
    const qrPath = resolve(qrDirectory, `${stem}.svg`);
    runProtected('/usr/bin/qrencode', ['-l', 'M', '-m', '2', '-t', 'SVG', '-o', qrPath], buildSkuQrPayload(row.sku_qr_token));
    await chmod(qrPath, 0o600);
    items.push(`<section class="label"><h2>${escapeHtml(row.sku_code)}</h2><p class="name">${escapeHtml(row.sku_name)}</p><img alt="QR SKU" src="qr/${stem}.svg"></section>`);
    labels.push({ sequence: index + 1, sku_id: row.sku_id, sku_code: row.sku_code, sku_name: row.sku_name, qr_svg: `qr/${stem}.svg` });
  }

  const htmlPath = resolve(output, 'sku-qr-labels-a4.html');
  const pdfPath = resolve(output, 'sku-qr-labels-a4.pdf');
  const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><style>
    @page{size:A4;margin:7mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;display:grid;grid-template-columns:repeat(3,60mm);grid-auto-rows:60mm;gap:4mm;align-content:start}
    .label{width:60mm;height:60mm;border:.45mm solid #111;border-radius:2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm;break-inside:avoid;background:#fff;overflow:hidden}
    h2{font-size:10pt;line-height:1;margin:0 0 1mm;text-align:center}.name{font-size:6.5pt;line-height:1.05;height:8mm;margin:0 0 1mm;text-align:center;overflow:hidden}img{width:40mm;height:40mm}
  </style><body>${items.join('')}</body></html>`;
  await writeFile(htmlPath, html, { mode: 0o600 });
  const chrome = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
    .find((candidate) => spawnSync('test', ['-x', candidate]).status === 0);
  if (chrome === undefined) throw new Error('Protected label renderer failed: Chrome is unavailable.');
  runProtected(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
    '--disable-sync', '--no-first-run', '--disable-default-apps', '--disable-extensions',
    `--print-to-pdf=${pdfPath}`, '--no-pdf-header-footer', pathToFileURL(htmlPath).href,
  ]);
  await chmod(pdfPath, 0o600);
  const files = [htmlPath, pdfPath, ...labels.map((label) => resolve(output, String(label.qr_svg)))];
  const filesSha256 = Object.fromEntries(await Promise.all(files.map(async (path) => [relative(output, path), await sha256(path)])));
  await writeFile(resolve(output, 'protected-manifest.json'), `${JSON.stringify({
    format: 'PEAKS_SKU_QR_LABELS_V1', generated_at: new Date().toISOString(), label_count: rows.length,
    payload_format: `${QR_PAYLOAD_PREFIX}<protected-token>`, files_sha256: filesSha256, labels,
  }, null, 2)}\n`, { mode: 0o600 });
}

async function readProductionSkus(): Promise<readonly SkuLabelRow[]> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim().length === 0) throw new Error('DATABASE_URL is required from the protected runtime environment.');
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('begin read only');
    const identity = await client.query<{ current_user: string }>('select current_user');
    if (identity.rows[0]?.current_user !== 'app_runtime_role') throw new Error('SKU labels require app_runtime_role.');
    const result = await client.query<SkuLabelRow>(`
      select sku_id::text, sku_code, coalesce(sku_name, sku_code) as sku_name, sku_qr_token
      from app.skus order by sku_code
    `);
    await client.query('commit');
    return validateSkuLabelRows(result.rows);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  process.umask(0o077);
  const output = parseOutputArgument(process.argv.slice(2));
  assertProtectedOutput(output);
  await mkdir(output, { mode: 0o700, recursive: true });
  await chmod(output, 0o700);
  if ((await readdir(output)).length !== 0) throw new Error('Protected label output directory must be empty.');
  await renderLabels(await readProductionSkus(), output);
  process.stdout.write(`SKU_QR_LABELS_GENERATED count=162 output=${output}\n`);
}

const invokedPath = process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) void main().catch((error: unknown) => {
  process.stderr.write(`SKU_QR_LABELS_FAILED ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exitCode = 1;
});
