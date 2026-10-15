import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectCdp, waitHttp } from '../scripts/chrome-cdp.mjs';

const miniapp = resolve(import.meta.dirname, '..');
const scenarios = [
  { id: 'available', message: 'Проверьте SKU и подтвердите выбор.', selectable: true, fixedPost: 1 },
  { id: 'inactive', message: 'SKU недоступен для производства. Обратитесь к начальнику производства.', selectable: false, fixedPost: 1 },
  { id: 'unknown', message: 'QR SKU не распознан.', selectable: false, fixedPost: 1 },
  { id: 'cancelled', message: 'Сканирование отменено.', selectable: false, fixedPost: 0 },
  { id: 'unavailable', message: 'Сканер QR недоступен. Нажмите «Назад».', selectable: false, fixedPost: 0 },
];
const executable = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
  .find((candidate) => spawnSync('test', ['-x', candidate]).status === 0);
if (executable === undefined) throw new Error('system browser executable not found');
const buildDirectory = mkdtempSync(join(tmpdir(), 'sku-qr-browser-build-'));
const profileDirectory = mkdtempSync(join(tmpdir(), 'sku-qr-chrome-profile-'));
const build = spawnSync(join(miniapp, 'node_modules/.bin/vite'), [
  'build', '--config', 'sku-qr-browser-tests/vite.config.ts', '--outDir', buildDirectory, '--emptyOutDir',
], { cwd: miniapp, encoding: 'utf8' });
if (build.status !== 0) throw new Error(`SKU QR browser build failed\n${build.stdout}\n${build.stderr}`);

const serverPort = 41813;
const debuggingPort = 42843;
const server = spawn('python3', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1', '--directory', buildDirectory], { stdio: ['ignore', 'pipe', 'pipe'] });
const browser = spawn(executable, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--no-first-run', '--disable-default-apps', '--disable-extensions',
  `--remote-debugging-port=${debuggingPort}`, '--remote-allow-origins=*', `--user-data-dir=${profileDirectory}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const evidenceBase = process.env.PEAKS_BROWSER_EVIDENCE_DIR ?? `${process.cwd()}/.browser-evidence`;
const evidenceRoot = `${evidenceBase}/${stamp}-sku-qr`;
mkdirSync(join(evidenceRoot, 'screenshots'), { recursive: true });

let cdp;
try {
  await waitHttp(`http://127.0.0.1:${serverPort}/`);
  const targets = await (await waitHttp(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
  cdp = await connectCdp(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await Promise.all([cdp.command('Page.enable'), cdp.command('Runtime.enable'), cdp.command('Log.enable'), cdp.command('Network.enable')]);
  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const consoleErrors = [];
  const externalRequests = [];
  cdp.on((message) => {
    if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params);
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) consoleErrors.push(message.params);
    if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params?.entry?.level)) consoleErrors.push(message.params.entry);
    if (message.method === 'Network.requestWillBeSent') {
      const url = new URL(message.params.request.url);
      if (url.hostname !== '127.0.0.1') externalRequests.push(url.href);
    }
  });
  const evaluate = async (expression) => {
    const result = await cdp.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      try { if (await evaluate(expression)) return; } catch {}
      await new Promise((done) => setTimeout(done, 25));
    }
    const visibleText = await evaluate(`document.body.textContent ?? ''`).catch(() => 'unavailable');
    throw new Error(`Timed out waiting for ${label}; visible=${JSON.stringify(visibleText)}; console_errors=${consoleErrors.length}`);
  };

  const results = [];
  for (const scenario of scenarios) {
    const consoleStart = consoleErrors.length;
    const externalStart = externalRequests.length;
    const url = `http://127.0.0.1:${serverPort}/?state=${scenario.id}`;
    await cdp.command('Runtime.evaluate', { expression: `setTimeout(() => location.replace(${JSON.stringify(url)}), 0); true`, returnByValue: true });
    await waitFor(`document.querySelector('main[data-node-id="S02-SKU01"]') !== null`, `${scenario.id} entry`);
    const entryLabels = await evaluate(`[...document.querySelectorAll('main[data-node-id="S02-SKU01"] button')].map((button) => button.textContent)`);
    await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Сканировать QR SKU'))?.click(); true`);
    await waitFor(`document.querySelector('main[data-node-id="S02-SKUQR01"]')?.textContent?.includes(${JSON.stringify(scenario.message)}) === true`, `${scenario.id} result`);
    const snapshot = await evaluate(`(()=>{const main=document.querySelector('main[data-node-id="S02-SKUQR01"]');const select=[...main.querySelectorAll('button')].find((button)=>button.textContent?.includes('Выбрать SKU'));return {title:document.title,text:main?.textContent??'',select_disabled:select?.disabled,button_labels:[...main.querySelectorAll('button')].map((button)=>button.textContent),horizontal_overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,evidence:window.getSkuQrBrowserEvidence()};})()`);
    const screenshot = join(evidenceRoot, 'screenshots', `${scenario.id}-390x844.png`);
    writeFileSync(screenshot, (await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true })).data, 'base64');
    let destination = null;
    if (scenario.selectable) {
      await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Выбрать SKU'))?.click(); true`);
      await waitFor(`window.getSkuQrBrowserEvidence().production_post_count === 1`, 'production start');
      destination = await evaluate(`document.querySelector('main')?.dataset.nodeId ?? null`);
    } else {
      await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent === 'Назад')?.click(); true`);
      await waitFor(`document.querySelector('main[data-node-id="S02-SKU01"]') !== null`, 'Back destination');
      destination = 'S02-SKU01';
    }
    const evidence = await evaluate('window.getSkuQrBrowserEvidence()');
    const errors = [
      ...(JSON.stringify(entryLabels) === JSON.stringify(['Сканировать QR SKU', 'Выбрать SKU из списка', 'Назад']) ? [] : ['entry-controls']),
      ...(snapshot.title === 'SKU QR Browser Qualification' ? [] : ['page-title']),
      ...(snapshot.text.includes(scenario.message) ? [] : ['expected-message']),
      ...(snapshot.select_disabled === !scenario.selectable ? [] : ['select-availability']),
      ...(JSON.stringify(snapshot.button_labels) === JSON.stringify(['Выбрать SKU', 'Назад']) ? [] : ['result-controls']),
      ...(snapshot.horizontal_overflow ? ['horizontal-overflow'] : []),
      ...(evidence.fixed_post_count === scenario.fixedPost ? [] : ['fixed-post-count']),
      ...(evidence.path_disclosure_count === 0 ? [] : ['path-disclosure']),
      ...(scenario.selectable && evidence.production_post_count !== 1 ? ['production-count'] : []),
      ...(scenario.selectable && JSON.stringify(evidence.production_body) !== JSON.stringify({ machine_id: '11', sku_id: '21' }) ? ['production-body'] : []),
      ...(!scenario.selectable && destination !== 'S02-SKU01' ? ['back-destination'] : []),
      ...(consoleErrors.slice(consoleStart).length === 0 ? [] : ['console-errors']),
      ...(externalRequests.slice(externalStart).length === 0 ? [] : ['external-requests']),
    ];
    results.push({ scenario: scenario.id, status: errors.length === 0 ? 'PASS' : 'FAIL', destination, screenshot, errors });
  }
  const report = {
    gate: 'SKU_QR_BROWSER_QUALIFICATION',
    status: results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
    generated_at: new Date().toISOString(),
    browser: spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim(),
    browser_plugin: 'not_available_regular_cdp_fallback', evidence_root: evidenceRoot, results,
  };
  writeFileSync(join(evidenceRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: report.status, scenarios: results.length, evidence_root: evidenceRoot })}\n`);
  if (report.status !== 'PASS') process.exitCode = 1;
} finally {
  try { cdp?.close(); } catch {}
  if (browser.exitCode === null) browser.kill('SIGTERM');
  if (server.exitCode === null) server.kill('SIGTERM');
  await Promise.race([new Promise((done) => browser.once('exit', done)), new Promise((done) => setTimeout(done, 2_000))]);
  if (browser.exitCode === null) browser.kill('SIGKILL');
  for (const directory of [buildDirectory, profileDirectory]) {
    try { rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch {}
  }
}
