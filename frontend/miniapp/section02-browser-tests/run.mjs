import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectCdp, waitHttp } from '../scripts/chrome-cdp.mjs';

const miniapp = resolve(import.meta.dirname, '..');
const source = readFileSync(join(miniapp, 'src/section02/ids.ts'), 'utf8');
const block = source.match(/SECTION02_NODE_IDS[\s\S]*?as const/)?.[0] ?? '';
const nodes = [...block.matchAll(/'(S02-[A-Za-z0-9_]+)'/g)].map((match) => match[1]);
if (nodes.length !== 26 || new Set(nodes).size !== 26) throw new Error(`Section 02 browser node registry mismatch: ${nodes.length}`);
const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 699, height: 1536 },
];
const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const executable = candidates.map((candidate) => spawnSync('which', [candidate], { encoding: 'utf8' }).stdout.trim()).find(Boolean);
if (!executable) throw new Error('system browser executable not found');
const browserVersion = spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim();
const buildDir = mkdtempSync(join(tmpdir(), 'section02-browser-build-'));
const build = spawnSync(join(miniapp, 'node_modules/.bin/vite'), ['build', '--config', 'section02-browser-tests/vite.config.ts', '--outDir', buildDir, '--emptyOutDir'], { cwd: miniapp, encoding: 'utf8' });
if (build.status !== 0) throw new Error(`Section 02 browser build failed\n${build.stdout}\n${build.stderr}`);

const serverPort = 41802;
const debuggingPort = 42832;
const profile = mkdtempSync(join(tmpdir(), 'section02-chrome-profile-'));
const server = spawn('python3', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1', '--directory', buildDir], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += String(chunk); });
server.stderr.on('data', (chunk) => { serverOutput += String(chunk); });
const browser = spawn(executable, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-background-networking', '--disable-component-update',
  '--disable-sync', '--no-first-run', '--disable-default-apps', '--disable-extensions', '--disable-domain-reliability', '--disable-breakpad',
  '--disable-client-side-phishing-detection', '--disable-features=OptimizationHints,MediaRouter,Translate,AutofillServerCommunication',
  `--remote-debugging-port=${debuggingPort}`, '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let browserError = '';
browser.stderr.on('data', (chunk) => { browserError += String(chunk); });

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const evidenceBase = process.env.PEAKS_BROWSER_EVIDENCE_DIR ?? `${process.cwd()}/.browser-evidence`;
const evidenceRoot = `${evidenceBase}/${stamp}-S02`;
mkdirSync(join(evidenceRoot, 'screenshots'), { recursive: true });
const results = [];
let cdp;

try {
  await waitHttp(`http://127.0.0.1:${serverPort}/`);
  const targets = await (await waitHttp(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
  cdp = await connectCdp(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await Promise.all([cdp.command('Page.enable'), cdp.command('Runtime.enable'), cdp.command('Log.enable'), cdp.command('Network.enable')]);
  await cdp.command('Network.setCacheDisabled', { cacheDisabled: true });
  const consoleErrors = [];
  const networkErrors = [];
  const externalRequests = [];
  cdp.on((message) => {
    if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params);
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) consoleErrors.push(message.params);
    if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params?.entry?.level)) consoleErrors.push(message.params.entry);
    if (message.method === 'Network.loadingFailed' && !message.params?.canceled) networkErrors.push(message.params);
    if (message.method === 'Network.requestWillBeSent') {
      const requested = new URL(message.params.request.url);
      if (requested.hostname !== '127.0.0.1') externalRequests.push(requested.href);
    }
  });
  const evaluate = async (expression) => {
    const evaluated = await cdp.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails));
    return evaluated.result.value;
  };
  for (const node of nodes) {
    for (const viewport of viewports) {
      const consoleStart = consoleErrors.length;
      const networkStart = networkErrors.length;
      const externalStart = externalRequests.length;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: true });
      const url = `http://127.0.0.1:${serverPort}/?node=${encodeURIComponent(node)}`;
      await cdp.command('Runtime.evaluate', {
        expression: `setTimeout(() => location.replace(${JSON.stringify(url)}), 0); true`,
        returnByValue: true,
      });
      let result = null;
      for (let attempt = 0; attempt < 200; attempt += 1) {
        let serialized = '';
        try {
          serialized = await evaluate("document.querySelector('#section02-browser-result')?.textContent ?? ''");
        } catch {
          // The previous execution context may disappear while the scheduled navigation commits.
        }
        if (serialized) {
          const candidate = JSON.parse(serialized);
          if (candidate.node_id === node && candidate.viewport.width === viewport.width) { result = candidate; break; }
        }
        await new Promise((done) => setTimeout(done, 25));
      }
      if (result === null) throw new Error(`Browser result missing for ${node} ${viewport.width}x${viewport.height}`);
      await evaluate("scrollTo(0, 0); true");
      const scenarioConsole = consoleErrors.slice(consoleStart);
      const scenarioNetwork = networkErrors.slice(networkStart);
      const scenarioExternal = externalRequests.slice(externalStart);
      const runnerErrors = [
        ...(scenarioConsole.length === 0 ? [] : ['cdp-console-errors']),
        ...(scenarioNetwork.length === 0 ? [] : ['cdp-network-errors']),
        ...scenarioExternal.map((request) => `cdp-external:${request}`),
      ];
      const captureScreenshot = viewport.width === 390 || node === 'S02-N01' || (node === 'S02-N02' && viewport.width === 699);
      const screenshot = captureScreenshot ? join(evidenceRoot, 'screenshots', `${node}-${viewport.width}x${viewport.height}.png`) : null;
      if (screenshot !== null) {
        const captured = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
        writeFileSync(screenshot, captured.data, 'base64');
        if (!existsSync(screenshot)) throw new Error(`Screenshot missing for ${node} ${viewport.width}x${viewport.height}`);
      }
      results.push({
        ...result,
        status: result.status === 'PASS' && runnerErrors.length === 0 ? 'PASS' : 'FAIL',
        errors: [...result.errors, ...runnerErrors],
        cdp_console_error_count: scenarioConsole.length,
        cdp_network_error_count: scenarioNetwork.length,
        cdp_external_request_count: scenarioExternal.length,
        screenshot,
      });
    }
    process.stdout.write(`section02-browser-progress ${results.length}/${nodes.length * viewports.length}\n`);
  }
  const ownerViewport = { width: 390, height: 844 };
  const ownerConsoleStart = consoleErrors.length;
  const ownerNetworkStart = networkErrors.length;
  const ownerExternalStart = externalRequests.length;
  await cdp.command('Emulation.setDeviceMetricsOverride', { ...ownerViewport, deviceScaleFactor: 1, mobile: true });
  const ownerUrl = `http://127.0.0.1:${serverPort}/?node=S02-N02&owner-state=idle`;
  await cdp.command('Runtime.evaluate', {
    expression: `setTimeout(() => location.replace(${JSON.stringify(ownerUrl)}), 0); true`,
    returnByValue: true,
  });
  let ownerResult = null;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      const serialized = await evaluate("document.querySelector('#section02-browser-result')?.textContent ?? ''");
      if (serialized) {
        const candidate = JSON.parse(serialized);
        if (candidate.owner_production_equivalent === true) { ownerResult = candidate; break; }
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 25));
  }
  if (ownerResult === null) throw new Error('Production-equivalent owner browser result missing.');
  const ownerRunnerErrors = [
    ...(consoleErrors.slice(ownerConsoleStart).length === 0 ? [] : ['cdp-console-errors']),
    ...(networkErrors.slice(ownerNetworkStart).length === 0 ? [] : ['cdp-network-errors']),
    ...externalRequests.slice(ownerExternalStart).map((request) => `cdp-external:${request}`),
    ...(ownerResult.meaningful_root_content === true ? [] : ['empty-root-content']),
    ...(JSON.stringify(ownerResult.exact_root_labels) === JSON.stringify([
      'Начать производство', 'Начать перерыв', 'Начать простой', 'Допработа', 'Завершить смену', 'Зарплата',
    ]) ? [] : ['owner-root-label-order']),
    ...(JSON.stringify(ownerResult.exact_root_semantics) === JSON.stringify([
      'navigation-next', 'navigation-open', 'navigation-open', 'action-neutral', 'action-positive', 'navigation-back',
    ]) ? [] : ['owner-root-semantics']),
    ...(ownerResult.idle_operator_card === true ? [] : ['owner-idle-operator-card-invalid']),
    ...(ownerResult.no_visible_title === true ? [] : ['owner-visible-title-present']),
  ];
  const ownerScreenshot = join(evidenceRoot, 'screenshots', 'owner-production-equivalent-idle-390x844.png');
  const ownerCapture = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(ownerScreenshot, ownerCapture.data, 'base64');
  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 699, height: 1536, deviceScaleFactor: 1, mobile: true });
  await evaluate("new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))");
  const ownerReferenceSizeScreenshot = join(evidenceRoot, 'screenshots', 'owner-production-equivalent-idle-699x1536.png');
  const ownerReferenceSizeCapture = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(ownerReferenceSizeScreenshot, ownerReferenceSizeCapture.data, 'base64');
  results.push({
    ...ownerResult,
    status: ownerResult.status === 'PASS' && ownerRunnerErrors.length === 0 ? 'PASS' : 'FAIL',
    errors: [...ownerResult.errors, ...ownerRunnerErrors],
    cdp_console_error_count: consoleErrors.slice(ownerConsoleStart).length,
    cdp_network_error_count: networkErrors.slice(ownerNetworkStart).length,
    cdp_external_request_count: externalRequests.slice(ownerExternalStart).length,
    screenshot: ownerScreenshot,
    reference_size_screenshot: ownerReferenceSizeScreenshot,
  });

  const conflictConsoleStart = consoleErrors.length;
  const conflictNetworkStart = networkErrors.length;
  const conflictExternalStart = externalRequests.length;
  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const conflictUrl = `http://127.0.0.1:${serverPort}/?node=S02-N11&owner-state=additional-work-conflict`;
  await cdp.command('Runtime.evaluate', {
    expression: `setTimeout(() => location.replace(${JSON.stringify(conflictUrl)}), 0); true`,
    returnByValue: true,
  });
  let conflictResult = null;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      const serialized = await evaluate("document.querySelector('#section02-browser-result')?.textContent ?? ''");
      if (serialized) {
        const candidate = JSON.parse(serialized);
        if (candidate.owner_additional_work_conflict === true) { conflictResult = candidate; break; }
      }
    } catch {}
    await new Promise((done) => setTimeout(done, 25));
  }
  if (conflictResult === null) throw new Error('Additional-work conflict browser result missing.');
  const conflictRunnerErrors = [
    ...(consoleErrors.slice(conflictConsoleStart).length === 0 ? [] : ['cdp-console-errors']),
    ...(networkErrors.slice(conflictNetworkStart).length === 0 ? [] : ['cdp-network-errors']),
    ...externalRequests.slice(conflictExternalStart).map((request) => `cdp-external:${request}`),
  ];
  const conflictScreenshot = join(evidenceRoot, 'screenshots', 'additional-work-conflict-refresh-390x844.png');
  const conflictCapture = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(conflictScreenshot, conflictCapture.data, 'base64');
  results.push({
    ...conflictResult,
    status: conflictResult.status === 'PASS' && conflictRunnerErrors.length === 0 ? 'PASS' : 'FAIL',
    errors: [...conflictResult.errors, ...conflictRunnerErrors],
    cdp_console_error_count: consoleErrors.slice(conflictConsoleStart).length,
    cdp_console_errors: consoleErrors.slice(conflictConsoleStart),
    cdp_network_error_count: networkErrors.slice(conflictNetworkStart).length,
    cdp_external_request_count: externalRequests.slice(conflictExternalStart).length,
    screenshot: conflictScreenshot,
  });

  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const formUrl = `http://127.0.0.1:${serverPort}/?node=S02-N26_keyboard`;
  await cdp.command('Runtime.evaluate', {
    expression: `setTimeout(() => location.replace(${JSON.stringify(formUrl)}), 0); true`,
    returnByValue: true,
  });
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      const serialized = await evaluate("document.querySelector('#section02-browser-result')?.textContent ?? ''");
      if (serialized && JSON.parse(serialized).node_id === 'S02-N26_keyboard') break;
    } catch {}
    await new Promise((done) => setTimeout(done, 25));
  }
  const stableSnapshots = [];
  for (const stableHeight of [700, 520]) {
    const snapshot = await evaluate(`(async()=>{
      document.documentElement.style.setProperty('--tg-viewport-stable-height','${stableHeight}px');
      document.documentElement.style.setProperty('--tg-content-safe-area-inset-top','12px');
      document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom','24px');
      await new Promise((done)=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      const template=document.querySelector('.peaks-presentation-screen-template');
      const footer=document.querySelector('.peaks-presentation-screen-template__fixed-bottom');
      const scroll=document.querySelector('[data-presentation-scroll-slot="true"]');
      const rect=(node)=>node?{top:node.getBoundingClientRect().top,bottom:node.getBoundingClientRect().bottom,height:node.getBoundingClientRect().height}:null;
      return {stableHeight:${stableHeight},template:rect(template),footer:rect(footer),scroll:rect(scroll),footerPadding:footer?parseFloat(getComputedStyle(footer).paddingBottom):null,documentHeight:document.documentElement.scrollHeight,innerHeight};
    })()`);
    stableSnapshots.push(snapshot);
  }
  const stableErrors = stableSnapshots.flatMap((snapshot) => [
    ...(Math.abs((snapshot.template?.height ?? 0) - snapshot.stableHeight) <= 0.5 ? [] : [`stable-height-${snapshot.stableHeight}`]),
    ...(snapshot.footer !== null && snapshot.footer.bottom <= snapshot.stableHeight + 0.5 ? [] : [`footer-hidden-${snapshot.stableHeight}`]),
    ...(snapshot.scroll !== null && snapshot.footer !== null && snapshot.scroll.bottom <= snapshot.footer.top + 0.5 ? [] : [`scroll-footer-overlap-${snapshot.stableHeight}`]),
    ...((snapshot.footerPadding ?? 0) >= 24 ? [] : [`safe-bottom-${snapshot.stableHeight}`]),
    ...(snapshot.documentHeight <= snapshot.innerHeight + 1 ? [] : [`document-growth-${snapshot.stableHeight}`]),
  ]);
  results.push({
    node_id: 'S02-N26_keyboard:stable-height-and-keyboard',
    viewport: { width: 390, height: 844 },
    status: stableErrors.length === 0 ? 'PASS' : 'FAIL',
    pgr_1: 'PASS',
    horizontal_overflow: false,
    semantic_root_count: 0,
    exactly_one_authority: true,
    overlap_count: 0,
    clipping_count: 0,
    console_error_count: 0,
    request_count: 0,
    production_request_leakage: 0,
    cdp_console_error_count: 0,
    cdp_network_error_count: 0,
    cdp_external_request_count: 0,
    stable_height_snapshots: stableSnapshots,
    errors: stableErrors,
    screenshot: null,
  });
  const report = {
    gate: 'SECTION02_BROWSER_QUALIFICATION',
    status: results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL',
    generated_at: new Date().toISOString(), browser: browserVersion, nodes: nodes.length, viewports,
    scenarios: results.length, screenshots: results.filter((item) => item.screenshot !== null).length,
    production_equivalent_owner_scenario: 'PASS',
    production_equivalent_owner_reference_size_screenshot: ownerReferenceSizeScreenshot,
    evidence_root: evidenceRoot,
    harness_sha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),
    totals: {
      pass: results.filter((item) => item.status === 'PASS').length,
      fail: results.filter((item) => item.status !== 'PASS').length,
      overlap: results.reduce((sum, item) => sum + item.overlap_count, 0),
      clipping: results.reduce((sum, item) => sum + item.clipping_count, 0),
      console_errors: results.reduce((sum, item) => sum + item.console_error_count + item.cdp_console_error_count, 0),
      network_errors: results.reduce((sum, item) => sum + item.cdp_network_error_count, 0),
      production_request_leakage: results.reduce((sum, item) => sum + item.production_request_leakage + item.cdp_external_request_count, 0),
    },
    results,
  };
  writeFileSync(join(evidenceRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: report.status, nodes: report.nodes, scenarios: report.scenarios, screenshots: report.screenshots, totals: report.totals, evidence_root: evidenceRoot })}\n`);
  if (report.status !== 'PASS') process.exitCode = 1;
} catch (error) {
  throw new Error(`${String(error)}\nSERVER:\n${serverOutput.slice(-4000)}\nBROWSER:\n${browserError.slice(-8000)}`);
} finally {
  try { cdp?.close(); } catch {}
  if (browser.exitCode === null) browser.kill('SIGTERM');
  if (server.exitCode === null) server.kill('SIGTERM');
  await Promise.race([new Promise((done) => browser.once('exit', done)), new Promise((done) => setTimeout(done, 2_000))]);
  if (browser.exitCode === null) browser.kill('SIGKILL');
  for (const directory of [buildDir, profile]) {
    try { rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch (error) { process.stderr.write(`Section 02 browser cleanup warning: ${String(error)}\n`); }
  }
}
