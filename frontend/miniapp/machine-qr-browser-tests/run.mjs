import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectCdp, waitHttp } from '../scripts/chrome-cdp.mjs';

const miniapp = resolve(import.meta.dirname, '..');
const scenarios = [
  { id: 'available', message: 'Проверьте станок и подтвердите выбор.', selectable: true, fixedPost: 1 },
  { id: 'occupied', message: 'На станке уже работает:\nПетров П.С.', selectable: false, fixedPost: 1 },
  { id: 'broken', message: 'Станок неисправен. Обратитесь к начальнику производства.', selectable: false, fixedPost: 1 },
  { id: 'unknown', message: 'QR станка не распознан.', selectable: false, fixedPost: 1 },
  { id: 'cancelled', message: 'Сканирование отменено.', selectable: false, fixedPost: 0 },
  { id: 'unavailable', message: 'Сканер QR недоступен. Нажмите «Назад».', selectable: false, fixedPost: 0 },
];
const executable = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
  .find((candidate) => spawnSync('test', ['-x', candidate]).status === 0);
if (executable === undefined) throw new Error('system browser executable not found');

const buildDirectory = mkdtempSync(join(tmpdir(), 'machine-qr-browser-build-'));
const profileDirectory = mkdtempSync(join(tmpdir(), 'machine-qr-chrome-profile-'));
const build = spawnSync(join(miniapp, 'node_modules/.bin/vite'), [
  'build', '--config', 'machine-qr-browser-tests/vite.config.ts', '--outDir', buildDirectory, '--emptyOutDir',
], { cwd: miniapp, encoding: 'utf8' });
if (build.status !== 0) throw new Error(`Machine QR browser build failed\n${build.stdout}\n${build.stderr}`);

const serverPort = 41812;
const debuggingPort = 42842;
const server = spawn('python3', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1', '--directory', buildDirectory], { stdio: ['ignore', 'pipe', 'pipe'] });
const browser = spawn(executable, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--no-first-run', '--disable-default-apps', '--disable-extensions',
  `--remote-debugging-port=${debuggingPort}`, '--remote-allow-origins=*', `--user-data-dir=${profileDirectory}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const evidenceBase = process.env.PEAKS_BROWSER_EVIDENCE_DIR ?? `${process.cwd()}/.browser-evidence`;
const evidenceRoot = `${evidenceBase}/${stamp}-machine-qr`;
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
      try {
        if (await evaluate(expression)) return;
      } catch {}
      await new Promise((done) => setTimeout(done, 25));
    }
    throw new Error(`Timed out waiting for ${label}`);
  };

  const results = [];
  for (const scenario of scenarios) {
    const consoleStart = consoleErrors.length;
    const externalStart = externalRequests.length;
    const url = `http://127.0.0.1:${serverPort}/?state=${scenario.id}`;
    await cdp.command('Runtime.evaluate', {
      expression: `setTimeout(() => location.replace(${JSON.stringify(url)}), 0); true`,
      returnByValue: true,
    });
    await waitFor(`document.querySelector('main[data-node-id="S02-N03"]')?.textContent?.includes('Сканировать QR станка') === true`, `${scenario.id} entry`);
    await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Сканировать QR станка'))?.click(); true`);
    await waitFor(`document.querySelector('main[data-node-id="S02-QR01"]')?.textContent?.includes(${JSON.stringify(scenario.message)}) === true`, `${scenario.id} QR result`);
    const snapshot = await evaluate(`(()=>{const main=document.querySelector('main[data-node-id="S02-QR01"]');const select=[...main.querySelectorAll('button')].find((button)=>button.textContent?.includes('Выбрать станок'));return {title:document.title,url:location.href,node:main?.dataset.nodeId,text:main?.textContent??'',select_disabled:select?.disabled,button_labels:[...main.querySelectorAll('button')].map((button)=>button.textContent),horizontal_overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,framework_overlay:document.body.textContent?.includes('Internal Server Error')===true,evidence:window.getMachineQrBrowserEvidence()};})()`);
    const screenshot = join(evidenceRoot, 'screenshots', `${scenario.id}-390x844.png`);
    const capture = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(screenshot, capture.data, 'base64');
    let interactionDestination = null;
    if (scenario.selectable) {
      await evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent?.includes('Выбрать станок'))?.click(); true`);
      await waitFor(`document.querySelector('main[data-node-id="S02-SKU01"]')?.textContent?.includes('Сканировать QR SKU') === true`, 'confirmed machine destination');
      interactionDestination = await evaluate(`document.querySelector('main')?.dataset.nodeId ?? null`);
    }
    const errors = [
      ...(snapshot.title === 'Machine QR Browser Qualification' ? [] : ['page-title']),
      ...(snapshot.node === 'S02-QR01' ? [] : ['qr-node']),
      ...(snapshot.text.includes(scenario.message) ? [] : ['expected-message']),
      ...(snapshot.select_disabled === !scenario.selectable ? [] : ['select-availability']),
      ...(JSON.stringify(snapshot.button_labels) === JSON.stringify(['Выбрать станок', 'Назад']) ? [] : ['result-controls']),
      ...(snapshot.horizontal_overflow ? ['horizontal-overflow'] : []),
      ...(snapshot.framework_overlay ? ['framework-overlay'] : []),
      ...(snapshot.evidence.fixed_post_count === scenario.fixedPost ? [] : ['fixed-post-count']),
      ...(snapshot.evidence.path_disclosure_count === 0 ? [] : ['path-disclosure']),
      ...(scenario.selectable && interactionDestination !== 'S02-SKU01' ? ['confirmation-destination'] : []),
      ...(consoleErrors.slice(consoleStart).length === 0 ? [] : ['console-errors']),
      ...(externalRequests.slice(externalStart).length === 0 ? [] : ['external-requests']),
    ];
    results.push({
      scenario: scenario.id,
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      viewport: { width: 390, height: 844 },
      fixed_post_count: snapshot.evidence.fixed_post_count,
      path_disclosure_count: snapshot.evidence.path_disclosure_count,
      select_disabled: snapshot.select_disabled,
      interaction_destination: interactionDestination,
      screenshot,
      errors,
    });
  }
  const report = {
    gate: 'MACHINE_QR_BROWSER_QUALIFICATION',
    status: results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
    generated_at: new Date().toISOString(),
    browser: spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim(),
    browser_plugin: 'not_available_regular_cdp_fallback',
    evidence_root: evidenceRoot,
    results,
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
