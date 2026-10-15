import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectCdp, waitHttp } from './chrome-cdp.mjs';

const baseUrl = process.env.ACTIVITY_PROFILE_PREVIEW_URL ?? 'http://127.0.0.1:39002/peaks/';
const botToken = process.env.ACTIVITY_PROFILE_PREVIEW_BOT_TOKEN;
if (!botToken) throw new Error('ACTIVITY_PROFILE_PREVIEW_BOT_TOKEN is required');

function telegramActorFromEnv(prefix, fallbackId, fallbackUsername) {
  const rawId = process.env[`${prefix}_TELEGRAM_ID`] ?? String(fallbackId);
  const telegramUserId = Number(rawId);
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0) {
    throw new Error(`${prefix}_TELEGRAM_ID must be a positive safe integer`);
  }
  return {
    telegramUserId,
    username: process.env[`${prefix}_TELEGRAM_USERNAME`] ?? fallbackUsername,
  };
}

const operatorActor = telegramActorFromEnv(
  'ACTIVITY_PROFILE_PREVIEW_OPERATOR',
  9981002,
  'activity_profile_operator',
);
const managerActor = telegramActorFromEnv(
  'ACTIVITY_PROFILE_PREVIEW_MANAGER',
  9981003,
  'activity_profile_manager',
);

const parsedBase = new URL(baseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsedBase.hostname) || parsedBase.protocol !== 'http:') {
  throw new Error('Activity profile browser proof is restricted to a loopback HTTP preview');
}

const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const executable = candidates
  .map((candidate) => spawnSync('which', [candidate], { encoding: 'utf8' }).stdout.trim())
  .find(Boolean);
if (!executable) throw new Error('System Chrome/Chromium is required');

function telegramInitData(telegramUserId, username) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `activity-profile-${telegramUserId}`,
    user: JSON.stringify({ id: telegramUserId, username }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

function actorUrl(telegramUserId, username) {
  const target = new URL(baseUrl);
  target.searchParams.set('preview_actor', String(telegramUserId));
  target.hash = new URLSearchParams({ tgWebAppData: telegramInitData(telegramUserId, username) }).toString();
  return target.href;
}

const debugPort = 42862;
const profile = mkdtempSync(join(tmpdir(), 'activity-profile-preview-chrome-'));
const browser = spawn(executable, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-component-update',
  '--disable-sync',
  '--no-first-run',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-domain-reliability',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-features=OptimizationHints,MediaRouter,Translate,AutofillServerCommunication',
  `--remote-debugging-port=${debugPort}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let browserError = '';
browser.stderr.on('data', (chunk) => { browserError += String(chunk); });

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const repository = resolve(import.meta.dirname, '../../..');
const evidenceBase = process.env.PEAKS_BROWSER_EVIDENCE_DIR ?? `${process.cwd()}/.browser-evidence`;
const evidenceRoot = `${evidenceBase}/${stamp}-activity-type-profiles`;
const screenshotRoot = join(evidenceRoot, 'screenshots');
mkdirSync(screenshotRoot, { recursive: true });

let cdp;
const consoleEvents = [];
const networkFailures = [];
const externalRequests = [];
const scenarios = [];

function assert(value, message) {
  if (!value) throw new Error(message);
}

try {
  await waitHttp(baseUrl);
  const targets = await (await waitHttp(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new Error('Chromium page target is missing');
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await Promise.all([
    cdp.command('Page.enable'),
    cdp.command('Runtime.enable'),
    cdp.command('Log.enable'),
    cdp.command('Network.enable'),
  ]);
  await cdp.command('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.command('Network.setBlockedURLs', { urls: ['https://telegram.org/js/telegram-web-app.js*'] });
  await cdp.command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  cdp.on((message) => {
    if (message.method === 'Runtime.exceptionThrown') consoleEvents.push(message.params);
    if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') consoleEvents.push(message.params);
    if (
      message.method === 'Log.entryAdded'
      && message.params?.entry?.level === 'error'
      && !String(message.params.entry.url ?? '').includes('telegram.org/js/telegram-web-app.js')
      && !String(message.params.entry.url ?? '').endsWith('/favicon.ico')
    ) consoleEvents.push(message.params.entry);
    if (message.method === 'Network.loadingFailed' && message.params?.blockedReason !== 'inspector') networkFailures.push(message.params);
    if (message.method === 'Network.requestWillBeSent') {
      const requested = new URL(message.params.request.url);
      if (!['127.0.0.1', 'localhost'].includes(requested.hostname) && requested.hostname !== 'telegram.org') {
        externalRequests.push(requested.href);
      }
    }
  });

  const evaluate = async (expression) => {
    const result = await cdp.command('Runtime.evaluate', {
      expression: `(async()=>{${expression}})()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const navigate = async (url) => {
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    for (let attempt = 0; attempt < 240; attempt += 1) {
      try {
        const ready = await evaluate(`return location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`);
        if (ready) return;
      } catch {}
      await new Promise((done) => setTimeout(done, 50));
    }
    throw new Error(`Navigation did not settle: ${url}`);
  };
  const waitNode = async (nodeId) => {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const current = await evaluate("return document.querySelector('main[data-node-id]')?.dataset.nodeId ?? null");
      if (current === nodeId) return;
      await new Promise((done) => setTimeout(done, 50));
    }
    const state = await evaluate("return {node:document.querySelector('main[data-node-id]')?.dataset.nodeId ?? null,text:document.body.innerText}");
    throw new Error(`Node ${nodeId} did not render: ${JSON.stringify(state)}`);
  };
  const clickButton = async (label) => {
    const clicked = await evaluate(`
      const normalized = (value) => value.replace(/\\s+/g, ' ').trim();
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        normalized(candidate.innerText) === ${JSON.stringify(label)} || candidate.getAttribute('aria-label') === ${JSON.stringify(label)}
      );
      if (!button || button.disabled) return false;
      button.click();
      return true;
    `);
    assert(clicked, `Enabled button not found: ${label}`);
  };
  const snapshot = async (scenarioId, expectedNodeId, expectedLabels) => {
    await evaluate('scrollTo(0, 0); await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))); return true;');
    const observed = await evaluate(`
      const normalized = (value) => value.replace(/\\s+/g, ' ').trim();
      const buttons = [...document.querySelectorAll('button')].map((button) => {
        const style = getComputedStyle(button);
        return {
          label: normalized(button.innerText),
          disabled: button.disabled,
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
        };
      });
      return {
        nodeId: document.querySelector('main[data-node-id]')?.dataset.nodeId ?? null,
        buttons,
        bodyText: document.body.innerText,
        scrollY,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    `);
    assert(observed.nodeId === expectedNodeId, `${scenarioId}: unexpected node ${observed.nodeId}`);
    for (const label of expectedLabels) {
      assert(observed.buttons.some((button) => button.label.includes(label)), `${scenarioId}: missing ${label}`);
    }
    assert(!observed.horizontalOverflow, `${scenarioId}: horizontal overflow`);
    assert(observed.documentHeight <= observed.viewportHeight + 1, `${scenarioId}: document-level vertical overflow`);
    const screenshot = join(screenshotRoot, `${scenarioId}-390x844.png`);
    const image = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(screenshot, image.data, 'base64');
    assert(existsSync(screenshot), `${scenarioId}: screenshot was not written`);
    scenarios.push({ scenarioId, status: 'PASS', expectedNodeId, expectedLabels, observed, screenshot });
  };

  await navigate(actorUrl(operatorActor.telegramUserId, operatorActor.username));
  await waitNode('S02-N02');
  await clickButton('Начать перерыв');
  await waitNode('S02-B01');
  await snapshot('section02-break-types', 'S02-B01', ['Обед', 'Личные нужды', 'Технический перерыв', 'Назад']);
  await clickButton('Назад');
  await waitNode('S02-N02');
  await clickButton('Начать простой');
  await waitNode('S02-N09');
  await snapshot('section02-downtime-types', 'S02-N09', [
    'Ожидание материала',
    'Другое',
    'Ожидание комплектующих',
    'Требуется ремонт',
    'Требуется настройка',
    'Авария электрики',
    'Назад',
  ]);

  await navigate(actorUrl(managerActor.telegramUserId, managerActor.username));
  await waitNode('S03-N01');
  await clickButton('Открыть раздел Простои');
  await waitNode('S03-D01');
  await clickButton('Начать простой');
  await waitNode('S03-D10');
  await snapshot('section03-critical-downtime-types', 'S03-D10', [
    'Требуется ремонт',
    'Требуется настройка',
    'Авария электрики',
    'Назад',
  ]);

  const report = {
    gate: 'ACTIVITY_TYPE_PROFILES_ISOLATED_BROWSER_PREVIEW',
    status: 'PASS',
    generatedAt: new Date().toISOString(),
    browser: spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim(),
    browserDriver: 'system Chromium over CDP; Browser plugin unavailable in this session',
    baseOrigin: parsedBase.origin,
    databaseBoundary: 'the_peaks_activity_profiles (verified by preview setup and backend runtime configuration)',
    controlTypesCreatedThrough: 'class-specific backend administrative HTTP API',
    scenarios,
    consoleErrorCount: consoleEvents.length,
    consoleEvents,
    networkFailureCount: networkFailures.length,
    unexpectedExternalRequestCount: externalRequests.length,
    evidenceRoot,
    harnessSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),
  };
  assert(consoleEvents.length === 0, `Browser console errors: ${JSON.stringify(consoleEvents)}`);
  assert(networkFailures.length === 0, `Browser network failures: ${JSON.stringify(networkFailures)}`);
  assert(externalRequests.length === 0, `Unexpected external requests: ${externalRequests.join(', ')}`);
  const reportPath = join(evidenceRoot, 'report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`ACTIVITY_TYPE_PROFILES_BROWSER_PREVIEW_PASS\n${reportPath}\n`);
} catch (error) {
  process.stderr.write('ACTIVITY_TYPE_PROFILES_BROWSER_PREVIEW_FAIL\n');
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  if (browserError) process.stderr.write(browserError.slice(-4000));
  process.exitCode = 1;
} finally {
  cdp?.close();
  browser.kill('SIGTERM');
  await Promise.race([
    new Promise((done) => browser.once('close', done)),
    new Promise((done) => setTimeout(done, 2_000)),
  ]);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      break;
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
}
