import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

import { connectCdp, waitHttp } from './chrome-cdp.mjs';

const miniapp = resolve(new URL('..', import.meta.url).pathname);
const harnessDist = mkdtempSync(join(tmpdir(), 'section03-owner-ui-pass01-harness-'));
const chromeProfile = mkdtempSync(join(tmpdir(), 'section03-owner-ui-pass01-chrome-'));
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const evidenceBase = process.env.PEAKS_BROWSER_EVIDENCE_DIR ?? `${process.cwd()}/.browser-evidence`;
const evidenceRoot = `${evidenceBase}/${stamp}-SECTION03-OWNER-UI-PASS01`;
mkdirSync(join(evidenceRoot, 'screenshots'), { recursive: true });

async function removeTemporaryDirectory(path) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['ENOTEMPTY', 'EBUSY', 'EPERM'].includes(error?.code)) throw error;
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  process.stderr.write(`Temporary browser directory cleanup deferred: ${path}\n`);
}

const build = spawnSync(join(miniapp, 'node_modules/.bin/vite'), [
  'build', '--config', 'browser-tests/vite.config.ts', '--outDir', harnessDist, '--emptyOutDir',
], { cwd: miniapp, encoding: 'utf8' });
if (build.status !== 0) {
  throw new Error(`Owner UI browser harness build failed\n${build.stdout}\n${build.stderr}`);
}

const mime = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
});
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const relative = normalize(requested).replace(/^[/\\]+/, '').replace(/^(\.\.(\/|\\|$))+/, '');
  const file = resolve(harnessDist, relative);
  if (!file.startsWith(`${harnessDist}/`) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const port = server.address().port;

const chromeNames = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const chromeExecutable = chromeNames
  .map((name) => spawnSync('which', [name], { encoding: 'utf8' }).stdout.trim())
  .find(Boolean);
if (!chromeExecutable) throw new Error('System Chrome/Chromium is required.');
const debuggingPort = 43931;
const chrome = spawn(chromeExecutable, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--no-first-run',
  '--disable-default-apps', '--disable-extensions', '--disable-component-extensions-with-background-pages',
  `--remote-debugging-port=${debuggingPort}`, '--remote-allow-origins=*',
  `--user-data-dir=${chromeProfile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let chromeDiagnostics = '';
chrome.stderr.on('data', (chunk) => { chromeDiagnostics += String(chunk); });

const cases = Object.freeze([
  { id: 'S03-D01', parameter: 'p1-fixture', fixture: 'S03-D01:populated', contract: 'downtimes' },
  { id: 'S03-AW01', parameter: 'p3a1-fixture', fixture: 'S03-AW01:mixed-groups', contract: 'additional-work-list' },
  { id: 'S03-AW10', parameter: 'p3a1-fixture', fixture: 'S03-AW10:requested', contract: 'additional-work-card', values: ['Анна Ким', 'Проверить комплектность'] },
  { id: 'S03-AW11', parameter: 'p3a1-fixture', fixture: 'S03-AW11:authorized', contract: 'additional-work-decision', prompt: 'Подтвердите действие: Согласовать' },
  { id: 'S03-AW11', parameter: 'p3a1-fixture', fixture: 'S03-AW11:long-content', contract: 'additional-work-decision', prompt: 'Подтвердите действие: Согласовать' },
  { id: 'S03-AW12', parameter: 'p3a1-fixture', fixture: 'S03-AW12:authorized', contract: 'additional-work-decision', prompt: 'Подтвердите действие: Отклонить' },
  { id: 'S03-AW20', parameter: 'p3a2-fixture', fixture: 'S03-AW20:approved-authorized', contract: 'additional-work-card', values: ['Вера Юн', 'Подготовить упаковку'] },
  { id: 'S03-AW30', parameter: 'p3a2-fixture', fixture: 'S03-AW30:active-authorized', contract: 'additional-work-card', values: ['Глеб Орлов', 'Инвентаризация участка'] },
  { id: 'S03-AW40', parameter: 'p3a3-fixture', fixture: 'S03-AW40:employees', contract: 'neutral-selection' },
  { id: 'S03-AW42', parameter: 'p3a3-fixture', fixture: 'S03-AW42:authorized', contract: 'additional-work-card', values: ['Борис Ли', 'Инвентаризация участка'] },
  { id: 'S03-AW50', parameter: 'p3a4-fixture', fixture: 'S03-AW50:authorized', contract: 'additional-work-card', values: ['Вера Юн', 'Подготовить упаковку'] },
  { id: 'S03-NOT01', parameter: 'p4a5-fixture', fixture: 'S03-NOT01:representative-all-kinds', contract: 'notifications' },
  { id: 'S03-CP12', parameter: 'p4a4-fixture', fixture: 'S03-CP12:employee-mixed', contract: 'production-operation-card', values: ['03.08.2026', 'Корпус редуктора', '10', 'Станок производственной корректировки'] },
  { id: 'S03-CP12', parameter: 'p4a4-fixture', fixture: 'S03-CP12:long-content', contract: 'production-operation-card', values: ['03.08.2026', 'Очень длинное наименование производственной номенклатуры для проверки автоматического роста строки', '999999999999999999999.0001', 'Очень длинное наименование станка производственной линии без визуального обрезания'] },
  { id: 'S03-D13', parameter: 'p1-fixture', fixture: 'S03-D13:active-production-operation', contract: 'hard-action-label', visual: 'Начать:\nКритический простой', aria: 'Начать: Критический простой' },
  { id: 'S03-E02', parameter: 'p2a1-fixture', fixture: 'S03-E02:no-blockers-finish-authorized', contract: 'hard-action-label', visual: 'Завершить смену\nПетров Пётр Петрович', aria: 'Завершить смену Петров Пётр Петрович' },
  { id: 'S03-E11', parameter: 'p2a2a-fixture', fixture: 'S03-E11:valid-authorized', contract: 'hard-action-label', visual: 'Завершить смену\nПетров Пётр Петрович', aria: 'Завершить смену Петров Пётр Петрович' },
  { id: 'S03-SAL02', parameter: 'p2b2-fixture', fixture: 'S03-SAL02:mixed-months', contract: 'salary-months' },
]);
const viewports = Object.freeze([
  Object.freeze({ name: 'mobile', width: 390, height: 844, mobile: true }),
  Object.freeze({ name: 'desktop', width: 1280, height: 900, mobile: false }),
]);

function equal(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function contractFailures(testCase, snapshot) {
  const failures = [];
  const expect = (condition, code) => { if (!condition) failures.push(code); };
  expect(snapshot.layout.status === 'PASS', 'layout-status');
  expect(snapshot.layout.horizontal_overflow === false, 'horizontal-overflow');
  expect(snapshot.layout.errors.length === 0, 'layout-errors');
  expect(snapshot.layout.semantic_failures.length === 0, 'semantic-authority');
  expect(snapshot.layout.computed_paint_failures.length === 0, 'computed-paint');
  if (testCase.contract === 'downtimes') {
    expect(equal(snapshot.rows.map((row) => row.lines), [
      ['Наладка', 'Станок операционного простоя', '1 ч 20 мин'],
      ['Поломка шпинделя', 'Станок критического простоя', '2 ч 5 мин'],
    ]), 'downtime-exact-lines');
    expect(equal(snapshot.rows.map((row) => row.stateKey), ['state-warning', 'state-danger']), 'downtime-semantic-states');
    expect(snapshot.rows.every((row) => row.markerDisplay === 'none' && row.markerWidth === 0 && row.spinnerCount === 0), 'downtime-no-icon-slot');
    expect(snapshot.rows.every((row) => Math.abs(row.mainCenter - row.buttonCenter) <= 1 && Math.abs(row.secondaryCenter - row.buttonCenter) <= 1), 'downtime-symmetric-content-geometry');
    expect(!/(SKU|Оператор|Комментарий|Время начала простоя|Длительность простоя)/.test(snapshot.bodyText), 'downtime-forbidden-detail');
  }
  if (testCase.contract === 'additional-work-list') {
    const expected = [
      ['Анна Ким', 'Проверить комплектность'], ['Борис Ли', 'Пересчитать оснастку'],
      ['Вера Юн', 'Подготовить упаковку'], ['Глеб Орлов', 'Инвентаризация участка'],
      ['Дарья Соколова', 'Очистка рабочей зоны'],
    ];
    expect(equal(snapshot.rows.map((row) => row.lines), expected), 'additional-work-list-exact-lines');
    expect(snapshot.rows.every((row) => row.lines.length === 2), 'additional-work-list-two-lines');
    expect(snapshot.rows[2]?.stateKey === 'state-positive-neutral-context', 'approved-additional-work-mixed-state');
  }
  if (testCase.contract === 'additional-work-card') {
    const card = snapshot.cards[0];
    expect(card !== undefined, 'additional-work-card-missing');
    if (card !== undefined) {
      expect(equal(card.labels, ['Сотрудник', 'Вид работы']), 'additional-work-card-labels');
      expect(equal(card.values, testCase.values), 'additional-work-card-values');
      expect(card.labelDisplays.every((value) => value === 'block'), 'additional-work-label-block');
      expect(card.valueDisplays.every((value) => value === 'block'), 'additional-work-value-block');
      expect(card.labelDecorations.every((value) => value.includes('underline')), 'additional-work-label-underline');
      expect(card.valueBelowLabel.every(Boolean), 'additional-work-value-next-line');
    }
    expect(!snapshot.bodyText.includes('ФИО'), 'additional-work-no-fio');
    if (testCase.id === 'S03-AW20' && card !== undefined) {
      expect(card.stateKey === 'state-positive-neutral-context', 'aw20-mixed-state');
      expect(card.backgroundColor === 'rgb(241, 241, 241)', 'aw20-gray-fill');
      expect(card.borderColor === 'rgb(46, 139, 87)', 'aw20-green-border');
      expect(card.color === 'rgb(46, 139, 87)', 'aw20-green-text');
    }
  }
  if (testCase.contract === 'additional-work-decision') {
    const card = snapshot.cards[0];
    expect(snapshot.messages.length === 1, 'aw-decision-one-prompt');
    expect(snapshot.messages[0]?.text === testCase.prompt, 'aw-decision-exact-prompt');
    expect(card !== undefined && !card.text.includes(testCase.prompt), 'aw-decision-prompt-outside-card');
    expect(card !== undefined && equal(card.labels, ['Сотрудник', 'Вид работы']), 'aw-decision-entity-lines');
    expect(card !== undefined && (snapshot.messages[0]?.top ?? Infinity) < card.top, 'aw-decision-prompt-above-card');
  }
  if (testCase.contract === 'neutral-selection') {
    expect(snapshot.rows.length > 0, 'aw40-rows-missing');
    expect(snapshot.rows.every((row) => row.stateKey === 'state-neutral'), 'aw40-neutral-state');
    expect(snapshot.rows.every((row) => row.enabled), 'aw40-interaction-enabled');
  }
  if (testCase.contract === 'notifications') {
    expect(equal(snapshot.rows.map((row) => row.lines), [
      ['Доп. работа требует начисления', 'Илья Серов'],
      ['Запрошена доп. работа', 'Анна Ким'],
      ['Ожидание материала', 'Станок операционного простоя', '00:17'],
      ['Поломка шпинделя', 'Станок критического простоя', '00:34'],
    ]), 'notification-exact-lines');
    expect(equal(snapshot.rows.map((row) => row.stateKey), [
      'state-positive', 'state-neutral', 'state-warning', 'state-danger',
    ]), 'notification-semantic-states');
    expect(!snapshot.bodyText.includes('Операционный простой больше 15 минут'), 'notification-no-operational-class-leading-line');
    expect(!snapshot.bodyText.includes('Критический простой'), 'notification-no-critical-class-leading-line');
  }
  if (testCase.contract === 'production-operation-card') {
    const card = snapshot.cards[0];
    expect(card !== undefined, 'cp12-card-missing');
    expect(card?.tagName === 'BUTTON' && card.enabled, 'cp12-card-interactive');
    expect(card?.stateKey === 'state-positive', 'cp12-card-positive');
    expect(equal(card?.labels, ['Дата', 'SKU', 'Количество', 'Станок']), 'cp12-labels');
    expect(equal(card?.values, testCase.values), 'cp12-values');
    expect(card?.labelDecorations.every((value) => value.includes('underline')), 'cp12-underlined-labels');
    expect(card?.valueBelowLabel.every(Boolean), 'cp12-values-next-block');
    expect(card?.ariaLabel.includes(testCase.values[0]) && card.ariaLabel.includes(testCase.values[1]) && card.ariaLabel.includes(testCase.values[3]), 'cp12-aria-context');
    expect(!card?.text.includes('12:30'), 'cp12-date-without-time');
  }
  if (testCase.contract === 'hard-action-label') {
    expect(snapshot.bodyText.includes(testCase.visual), 'hard-action-visual-break');
    expect(snapshot.ariaLabels.includes(testCase.aria), 'hard-action-one-line-aria');
    expect(!snapshot.ariaLabels.includes(testCase.visual), 'hard-action-no-multiline-aria');
  }
  if (testCase.contract === 'salary-months') {
    expect(snapshot.bodyText.includes('Июль 2026') && snapshot.bodyText.includes('Июнь 2026'), 'salary-formatted-months');
    expect(!snapshot.bodyText.includes('2026-07') && !snapshot.bodyText.includes('2026-06'), 'salary-no-raw-months');
    expect(snapshot.ariaLabels.includes('Месяц зарплаты Июль 2026'), 'salary-july-aria');
    expect(snapshot.ariaLabels.includes('Месяц зарплаты Июнь 2026'), 'salary-june-aria');
  }
  return failures;
}

let cdp;
try {
  await waitHttp(`http://127.0.0.1:${port}/`);
  const targets = await (await waitHttp(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
  cdp = await connectCdp(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await Promise.all([
    cdp.command('Page.enable'), cdp.command('Runtime.enable'),
    cdp.command('Log.enable'), cdp.command('Network.enable'),
  ]);
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
    const result = await cdp.command('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const results = [];
  for (const testCase of cases) for (const viewport of viewports) {
    const consoleStart = consoleErrors.length;
    const networkStart = networkErrors.length;
    const externalStart = externalRequests.length;
    await cdp.command('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile,
    });
    const url = `http://127.0.0.1:${port}/?${testCase.parameter}=${encodeURIComponent(testCase.fixture)}&viewport=${viewport.width}x${viewport.height}`;
    await cdp.command('Runtime.evaluate', {
      expression: `setTimeout(() => location.replace(${JSON.stringify(url)}), 0); true`,
      returnByValue: true,
    });
    let layout = null;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      let candidate = '';
      try {
        candidate = await evaluate("document.querySelector('#layout-result')?.textContent ?? ''");
      } catch {
        // The previous execution context may disappear while the scheduled navigation commits.
      }
      if (candidate) {
        const parsed = JSON.parse(candidate);
        if (
          parsed.node_id === testCase.id
          && parsed.fixture_id === testCase.fixture
          && parsed.platform_geometry?.document?.viewport_inner_width === viewport.width
        ) { layout = parsed; break; }
      }
      await new Promise((done) => setTimeout(done, 25));
    }
    if (layout === null) throw new Error(`Layout result missing for ${testCase.fixture} ${viewport.name}.`);
    const dom = await evaluate(`(() => {
      const cleanLines = (element) => element.innerText.split(/\\n+/).map((line) => line.trim()).filter(Boolean);
      const rows = [...document.querySelectorAll('.peaks-presentation-state-list-button')].map((row) => {
        const marker = row.querySelector('.peaks-presentation-state-marker');
        const main = row.querySelector('.peaks-presentation-state-list-button__main');
        const secondary = row.querySelector('.peaks-presentation-state-list-button__secondary');
        const rowRect = row.getBoundingClientRect();
        const mainRect = main?.getBoundingClientRect();
        const secondaryRect = secondary?.getBoundingClientRect();
        const markerRect = marker?.getBoundingClientRect();
        return {
          lines: cleanLines(row), stateKey: row.dataset.stateKey ?? '',
          enabled: !row.disabled && row.getAttribute('aria-disabled') !== 'true',
          markerDisplay: marker === null ? 'missing' : getComputedStyle(marker).display,
          markerWidth: markerRect?.width ?? -1,
          spinnerCount: row.querySelectorAll('.peaks-presentation-spinner').length,
          buttonCenter: rowRect.left + rowRect.width / 2,
          mainCenter: (mainRect?.left ?? 0) + (mainRect?.width ?? 0) / 2,
          secondaryCenter: secondaryRect === undefined ? (mainRect?.left ?? 0) + (mainRect?.width ?? 0) / 2 : secondaryRect.left + secondaryRect.width / 2,
        };
      });
      const cards = [...document.querySelectorAll('.peaks-presentation-card')].map((card) => ({
        tagName: card.tagName,
        enabled: !card.disabled && card.getAttribute('aria-disabled') !== 'true',
        stateKey: card.dataset.stateKey ?? '',
        ariaLabel: card.getAttribute('aria-label') ?? '',
        text: card.innerText,
        top: card.getBoundingClientRect().top,
        backgroundColor: getComputedStyle(card).backgroundColor,
        borderColor: getComputedStyle(card).borderColor,
        color: getComputedStyle(card).color,
        labels: [...card.querySelectorAll('.peaks-presentation-card__label')].map((item) => item.textContent?.trim() ?? ''),
        values: [...card.querySelectorAll('.peaks-presentation-card__value')].map((item) => item.textContent?.trim() ?? ''),
        labelDisplays: [...card.querySelectorAll('.peaks-presentation-card__label')].map((item) => getComputedStyle(item).display),
        valueDisplays: [...card.querySelectorAll('.peaks-presentation-card__value')].map((item) => getComputedStyle(item).display),
        labelDecorations: [...card.querySelectorAll('.peaks-presentation-card__label')].map((item) => getComputedStyle(item).textDecorationLine),
        valueBelowLabel: [...card.querySelectorAll('.peaks-presentation-card__line')].filter((line) => line.querySelector('.peaks-presentation-card__label')).map((line) => {
          const label = line.querySelector('.peaks-presentation-card__label')?.getBoundingClientRect();
          const value = line.querySelector('.peaks-presentation-card__value')?.getBoundingClientRect();
          return label !== undefined && value !== undefined && value.top >= label.bottom - 0.5;
        }),
      }));
      const messages = [...document.querySelectorAll('.peaks-presentation-message')].map((item) => ({
        text: item.textContent?.trim() ?? '',
        top: item.getBoundingClientRect().top,
      }));
      return {
        rows, cards, messages, bodyText: document.querySelector('main')?.innerText ?? '',
        ariaLabels: [...document.querySelectorAll('[aria-label]')].map((item) => item.getAttribute('aria-label') ?? ''),
      };
    })()`);
    const snapshot = { layout, ...dom };
    const failures = contractFailures(testCase, snapshot);
    const screenshotName = `${testCase.id}-${testCase.fixture.split(':')[1]}-${viewport.width}x${viewport.height}.png`;
    const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(evidenceRoot, 'screenshots', screenshotName), screenshot.data, 'base64');
    const result = {
      node_id: testCase.id, fixture_id: testCase.fixture, viewport,
      status: failures.length === 0 ? 'PASS' : 'FAIL', failures,
      console_errors: consoleErrors.slice(consoleStart),
      network_errors: networkErrors.slice(networkStart),
      external_requests: externalRequests.slice(externalStart),
      screenshot: `screenshots/${screenshotName}`, snapshot,
    };
    if (result.console_errors.length > 0) result.failures.push('console-errors');
    if (result.network_errors.length > 0) result.failures.push('network-errors');
    if (result.external_requests.length > 0) result.failures.push('external-requests');
    result.status = result.failures.length === 0 ? 'PASS' : 'FAIL';
    results.push(result);
  }
  const summary = {
    status: results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
    gate: 'SECTION03_OWNER_UI_CORRECTIVE_PASS01',
    cases: cases.length,
    viewports: viewports.length,
    runs: results.length,
    passed: results.filter((result) => result.status === 'PASS').length,
    failed: results.filter((result) => result.status === 'FAIL').length,
    screenshots: results.length,
    console_errors: results.reduce((count, result) => count + result.console_errors.length, 0),
    network_errors: results.reduce((count, result) => count + result.network_errors.length, 0),
    external_requests: results.reduce((count, result) => count + result.external_requests.length, 0),
    evidence_root: evidenceRoot,
  };
  writeFileSync(join(evidenceRoot, 'report.json'), `${JSON.stringify({ summary, results }, null, 2)}\n`);
  writeFileSync(join(evidenceRoot, 'summary.txt'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status !== 'PASS') throw new Error(`Owner UI Pass01 browser gate failed; see ${evidenceRoot}.`);
  process.stdout.write('SECTION03_OWNER_UI_CORRECTIVE_PASS01_BROWSER_PASS\n');
} finally {
  cdp?.close();
  const chromeExited = chrome.exitCode === null
    ? new Promise((done) => chrome.once('exit', done))
    : Promise.resolve();
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  await Promise.race([
    chromeExited,
    new Promise((done) => setTimeout(done, 5_000)),
  ]);
  if (chrome.exitCode === null) {
    chrome.kill('SIGKILL');
    await Promise.race([
      chromeExited,
      new Promise((done) => setTimeout(done, 2_000)),
    ]);
  }
  await new Promise((done) => server.close(done));
  await removeTemporaryDirectory(harnessDist);
  await removeTemporaryDirectory(chromeProfile);
}
