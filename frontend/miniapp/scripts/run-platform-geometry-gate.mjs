import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectCdp, waitHttp } from './chrome-cdp.mjs';
import {
  PLATFORM_ROOT_GEOMETRY_CONTRACT,
  platformGeometryEvaluationExpression,
} from './platform-geometry-gate.mjs';

const miniapp = resolve(new URL('..', import.meta.url).pathname);
const productionRootCss = readFileSync(join(miniapp, 'src/foundation/platformRoot.css'), 'utf8');
const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const executable = candidates
  .map((candidate) => spawnSync('which', [candidate], { encoding: 'utf8' }).stdout.trim())
  .find(Boolean);
if (!executable) throw new Error('System Chrome/Chromium is required.');

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const evidenceBase = process.env.PEAKS_BROWSER_EVIDENCE_DIR ?? `${process.cwd()}/.browser-evidence`;
const evidence = `${evidenceBase}/${stamp}-PLATFORM-GEOMETRY-SYNTHETIC`;
const workspace = mkdtempSync(join(tmpdir(), 'peaks-platform-geometry-'));
mkdirSync(evidence, { recursive: true });
const debugPort = 42829;
const browserProfile = join(workspace, 'chrome-profile');
const browser = spawn(executable, [
  '--headless=new',
  '--disable-gpu',
  '--disable-background-networking',
  '--disable-sync',
  '--no-first-run',
  '--disable-default-apps',
  '--disable-extensions',
  `--remote-debugging-port=${debugPort}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${browserProfile}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let browserError = '';
browser.stderr.on('data', (chunk) => { browserError += String(chunk); });

const normalized = productionRootCss;
const cases = [
  {
    id: 'negative-default-body-margin-100vw',
    expected: 'FAIL',
    width: 390,
    height: 844,
    css: 'main { width: 100vw; min-height: 100vh; background: white; }',
    markup: '<div id="root"><main data-platform-geometry-root>overflow</main></div>',
    options: {},
    requiredFailure: 'document-scroll-width',
  },
  {
    id: 'negative-normal-flow-root-wider-than-container',
    expected: 'FAIL',
    width: 390,
    height: 844,
    css: `${normalized}\nmain { width: calc(100% + 1px); min-height: 100dvh; }`,
    markup: '<div id="root"><main data-platform-geometry-root>wide root</main></div>',
    options: { expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT },
    requiredFailure: 'significant-root-viewport-bounds',
  },
  {
    id: 'negative-fixed-right-edge',
    expected: 'FAIL',
    width: 390,
    height: 844,
    css: `${normalized}\nmain { width: 100%; min-height: 100dvh; } .fixed { position: fixed; left: 0; width: calc(100% + 8px); height: 40px; bottom: 0; }`,
    markup: '<div id="root"><main data-platform-geometry-root>root<div class="fixed">fixed</div></main></div>',
    options: { expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT },
    requiredFailure: 'positioned-viewport-bounds',
  },
  {
    id: 'negative-transform-eight-pixel-spill',
    expected: 'FAIL',
    width: 390,
    height: 844,
    css: `${normalized}\nmain { width: 100%; min-height: 100dvh; transform: translateX(8px); }`,
    markup: '<div id="root"><main data-platform-geometry-root>translated root</main></div>',
    options: { expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT },
    requiredFailure: 'significant-root-transform',
  },
  {
    id: 'negative-harness-normalization-divergence',
    expected: 'FAIL',
    width: 390,
    height: 844,
    css: `${normalized}\nhtml { --peaks-platform-root-geometry-contract: TEST-ONLY; } main { width: 100%; min-height: 100dvh; }`,
    markup: '<div id="root"><main data-platform-geometry-root>divergent harness</main></div>',
    options: { expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT },
    requiredFailure: 'normalization-contract',
  },
  {
    id: 'negative-oversized-child-document-scroll',
    expected: 'FAIL',
    width: 390,
    height: 844,
    css: `${normalized}\nmain { width: 100%; min-height: 100dvh; } .oversized { width: 500px; }`,
    markup: '<div id="root"><main data-platform-geometry-root><div class="oversized">oversized child</div></main></div>',
    options: { expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT },
    requiredFailure: 'document-scroll-width',
  },
  {
    id: 'positive-normalized-container-root',
    expected: 'PASS',
    width: 390,
    height: 844,
    css: `${normalized}\nmain { width: 100%; min-height: 100dvh; }`,
    markup: '<div id="root"><main data-platform-geometry-root>contained root</main></div>',
    options: { expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT },
  },
  {
    id: 'positive-contained-fixed-controls',
    expected: 'PASS',
    width: 390,
    height: 844,
    css: `${normalized}\nmain { width: 100%; min-height: 100dvh; } .fixed { position: fixed; inset: auto 0 0; height: 48px; }`,
    markup: '<div id="root"><main data-platform-geometry-root>root<div class="fixed">fixed</div></main></div>',
    options: { expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT },
  },
  {
    id: 'positive-desktop-vertical-scrollbar',
    expected: 'PASS',
    width: 1280,
    height: 800,
    css: `${normalized}\nmain { width: 100%; } .tall { height: 2000px; }`,
    markup: '<div id="root"><main data-platform-geometry-root><div class="tall">vertical scroll</div></main></div>',
    options: { expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT },
  },
];

const results = [];
let cdp;
try {
  const targets = await (await waitHttp(`http://127.0.0.1:${debugPort}/json/list`)).json();
  cdp = await connectCdp(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await Promise.all([cdp.command('Page.enable'), cdp.command('Runtime.enable')]);
  for (const definition of cases) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${definition.css}</style></head><body>${definition.markup}</body></html>`;
    const file = join(workspace, `${definition.id}.html`);
    writeFileSync(file, html);
    await cdp.command('Emulation.setDeviceMetricsOverride', {
      width: definition.width,
      height: definition.height,
      deviceScaleFactor: 1,
      mobile: definition.width < 600,
    });
    const loaded = cdp.wait('Page.loadEventFired');
    await cdp.command('Page.navigate', { url: pathToFileURL(file).href });
    await loaded;
    const evaluated = await cdp.command('Runtime.evaluate', {
      expression: platformGeometryEvaluationExpression(definition.options),
      returnByValue: true,
    });
    if (evaluated.exceptionDetails) {
      throw new Error(`${definition.id}: evaluation failed ${JSON.stringify(evaluated.exceptionDetails)}`);
    }
    const snapshot = evaluated.result.value;
    if (snapshot.status !== definition.expected) {
      throw new Error(`${definition.id}: expected ${definition.expected}, got ${JSON.stringify(snapshot)}`);
    }
    if (definition.requiredFailure !== undefined && !snapshot.failures.some((failure) => failure.startsWith(definition.requiredFailure))) {
      throw new Error(`${definition.id}: missing ${definition.requiredFailure}: ${JSON.stringify(snapshot)}`);
    }
    results.push({
      id: definition.id,
      expected: definition.expected,
      observed: snapshot.status,
      viewport: { width: definition.width, height: definition.height },
      snapshot,
    });
  }
  const summary = {
    gate: 'PLATFORM_GEOMETRY_SYNTHETIC',
    status: 'PASS',
    browser: spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim(),
    production_root_contract: PLATFORM_ROOT_GEOMETRY_CONTRACT,
    production_root_css_sha256: createHash('sha256').update(productionRootCss).digest('hex'),
    negative_cases_passed: results.filter((result) => result.expected === 'FAIL').length,
    positive_cases_passed: results.filter((result) => result.expected === 'PASS').length,
    horizontal_scroll_capability: 'NOT_DEFINED_NO_CONSUMER',
    results,
  };
  writeFileSync(join(evidence, 'summary.json'), JSON.stringify(summary, null, 2));
  process.stdout.write(`PLATFORM_GEOMETRY_SYNTHETIC_PASS evidence=${evidence}\n`);
} finally {
  try { cdp?.close(); } catch {}
  if (browser.exitCode === null) {
    browser.kill('SIGTERM');
    await Promise.race([
      new Promise((done) => browser.once('exit', done)),
      new Promise((done) => setTimeout(done, 2_000)),
    ]);
  }
  if (browser.exitCode === null) {
    browser.kill('SIGKILL');
    process.stderr.write(`Synthetic Chrome required SIGKILL: ${browserError}\n`);
    await Promise.race([
      new Promise((done) => browser.once('exit', done)),
      new Promise((done) => setTimeout(done, 500)),
    ]);
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(workspace, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      break;
    } catch (error) {
      if (attempt === 9) process.stderr.write(`Synthetic cleanup warning: ${String(error)}\n`);
      else await new Promise((done) => setTimeout(done, 100));
    }
  }
}
