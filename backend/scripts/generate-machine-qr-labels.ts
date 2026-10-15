import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';

const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const QR_PAYLOAD_PREFIX = 'peaks-machine:v1:';

export type MachineLabelRow = Readonly<{
  machine_id: string;
  machine_name: string;
  machine_qr_token: string;
}>;

export function buildMachineQrPayload(token: string): string {
  if (!QR_TOKEN_PATTERN.test(token)) throw new Error('Machine QR token contract is invalid.');
  return `${QR_PAYLOAD_PREFIX}${token}`;
}

export function validateMachineLabelRows(value: readonly MachineLabelRow[], expectedCount = 14): readonly MachineLabelRow[] {
  if (value.length !== expectedCount) throw new Error(`Machine label row count mismatch: expected ${expectedCount}.`);
  const machineIds = new Set<string>();
  const tokens = new Set<string>();
  for (const row of value) {
    if (!/^\d+$/.test(row.machine_id) || row.machine_name.trim().length === 0) {
      throw new Error('Machine label identity contract is invalid.');
    }
    buildMachineQrPayload(row.machine_qr_token);
    if (machineIds.has(row.machine_id)) throw new Error('Duplicate machine label identity.');
    if (tokens.has(row.machine_qr_token)) throw new Error('Duplicate machine QR token.');
    machineIds.add(row.machine_id);
    tokens.add(row.machine_qr_token);
  }
  return Object.freeze([...value].sort((left, right) => left.machine_name.localeCompare(right.machine_name, 'ru')));
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
  if (repository !== null && isInside(repository, output)) throw new Error('Machine QR labels cannot be written inside Git.');
  if (isInside('/srv/the-peaks-factory/releases', output) || isInside('/srv/the-peaks-factory/current', output)) {
    throw new Error('Machine QR labels cannot be written inside an immutable release.');
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeFileStem(row: MachineLabelRow, index: number): string {
  return `${String(index + 1).padStart(2, '0')}-machine-${row.machine_id}`;
}

function runProtected(command: string, args: readonly string[], options: Readonly<{ input?: string }> = {}): void {
  const result = spawnSync(command, [...args], {
    encoding: 'utf8',
    input: options.input,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`Protected label renderer failed: ${command}.`);
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function renderLabels(rows: readonly MachineLabelRow[], output: string): Promise<void> {
  const qrDirectory = resolve(output, 'qr');
  const labelDirectory = resolve(output, 'labels');
  await mkdir(qrDirectory, { mode: 0o700 });
  await mkdir(labelDirectory, { mode: 0o700 });
  await chmod(qrDirectory, 0o700);
  await chmod(labelDirectory, 0o700);

  const printItems: string[] = [];
  const manifestItems: Array<Record<string, unknown>> = [];
  const chrome = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
    .find((candidate) => spawnSync('test', ['-x', candidate]).status === 0);
  if (chrome === undefined) throw new Error('Protected label renderer failed: Chrome is unavailable.');

  for (const [index, row] of rows.entries()) {
    const stem = safeFileStem(row, index);
    const qrPath = resolve(qrDirectory, `${stem}.svg`);
    const htmlPath = resolve(labelDirectory, `${stem}.html`);
    const pngPath = resolve(labelDirectory, `${stem}.png`);
    runProtected('/usr/bin/qrencode', ['-l', 'M', '-m', '2', '-t', 'SVG', '-o', qrPath], {
      input: buildMachineQrPayload(row.machine_qr_token),
    });
    await chmod(qrPath, 0o600);
    const labelHtml = `<!doctype html><html lang="ru"><meta charset="utf-8"><style>
      @page{margin:0}*{box-sizing:border-box}body{margin:0;width:600px;height:600px;font-family:Arial,sans-serif}
      .label{width:600px;height:600px;border:4px solid #111;border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;background:#fff}
      h1{font-size:32px;line-height:1.12;text-align:center;margin:0 0 20px;max-height:74px;overflow:hidden}img{width:390px;height:390px}p{font-size:22px;margin:16px 0 0;font-weight:700}
    </style><body><section class="label"><h1>${escapeHtml(row.machine_name)}</h1><img alt="QR станка" src="../qr/${stem}.svg"><p>Сканируйте в приложении</p></section></body></html>`;
    await writeFile(htmlPath, labelHtml, { mode: 0o600 });
    runProtected(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-background-networking',
      '--disable-component-update', '--disable-sync', '--no-first-run', '--disable-default-apps', '--disable-extensions',
      '--window-size=600,600', `--screenshot=${pngPath}`, pathToFileURL(htmlPath).href,
    ]);
    await chmod(pngPath, 0o600);
    printItems.push(`<section class="label"><h2>${escapeHtml(row.machine_name)}</h2><img alt="QR станка" src="qr/${stem}.svg"><p>Сканируйте в приложении</p></section>`);
    manifestItems.push({
      sequence: index + 1,
      machine_id: row.machine_id,
      machine_name: row.machine_name,
      qr_svg: `qr/${stem}.svg`,
      label_html: `labels/${stem}.html`,
      label_png: `labels/${stem}.png`,
    });
  }

  const sheetPath = resolve(output, 'machine-qr-labels-a4.html');
  const pdfPath = resolve(output, 'machine-qr-labels-a4.pdf');
  const sheet = `<!doctype html><html lang="ru"><meta charset="utf-8"><style>
    @page{size:A4;margin:7mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;display:grid;grid-template-columns:repeat(3,60mm);grid-auto-rows:60mm;gap:4mm;align-content:start}
    .label{width:60mm;height:60mm;border:.45mm solid #111;border-radius:2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2.5mm;break-inside:avoid;background:#fff}
    h2{font-size:10pt;line-height:1.05;text-align:center;margin:0 0 1.5mm;max-height:11mm;overflow:hidden}img{width:38mm;height:38mm}p{font-size:7pt;margin:1.2mm 0 0;font-weight:700}
  </style><body>${printItems.join('')}</body></html>`;
  await writeFile(sheetPath, sheet, { mode: 0o600 });
  runProtected(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--disable-component-update',
    '--disable-sync', '--no-first-run', '--disable-default-apps', '--disable-extensions',
    `--print-to-pdf=${pdfPath}`, '--no-pdf-header-footer', pathToFileURL(sheetPath).href,
  ]);
  await chmod(pdfPath, 0o600);

  const filePaths = [pdfPath, sheetPath, ...manifestItems.flatMap((item) => [
    resolve(output, String(item.qr_svg)),
    resolve(output, String(item.label_html)),
    resolve(output, String(item.label_png)),
  ])];
  const fileHashes = Object.fromEntries(await Promise.all(filePaths.map(async (path) => [relative(output, path), await sha256(path)])));
  const manifestPath = resolve(output, 'protected-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify({
    format: 'PEAKS_MACHINE_QR_LABELS_V1',
    generated_at: new Date().toISOString(),
    label_count: rows.length,
    payload_format: `${QR_PAYLOAD_PREFIX}<protected-token>`,
    files_sha256: fileHashes,
    labels: manifestItems,
  }, null, 2)}\n`, { mode: 0o600 });
  await chmod(manifestPath, 0o600);
}

async function readProductionMachines(): Promise<readonly MachineLabelRow[]> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.trim().length === 0) {
    throw new Error('DATABASE_URL is required from the protected runtime environment.');
  }
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('begin read only');
    const identity = await client.query<{ current_user: string }>('select current_user');
    if (identity.rows[0]?.current_user !== 'app_runtime_role') throw new Error('Machine labels require app_runtime_role.');
    const result = await client.query<MachineLabelRow>(`
      select machine_id::text, machine_name, machine_qr_token
      from app.machines
      order by machine_name
    `);
    await client.query('commit');
    return validateMachineLabelRows(result.rows);
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
  const rows = await readProductionMachines();
  await renderLabels(rows, output);
  process.stdout.write(`MACHINE_QR_LABELS_GENERATED count=${rows.length} output=${output}\n`);
}

const invokedPath = process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  void main().catch((error: unknown) => {
    process.stderr.write(`MACHINE_QR_LABELS_FAILED ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  });
}
