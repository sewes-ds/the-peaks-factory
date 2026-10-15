import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import {
  PLATFORM_ROOT_GEOMETRY_CONTRACT,
  platformGeometryEvaluationExpression,
} from './platform-geometry-gate.mjs';

const miniapp = resolve(new URL('..', import.meta.url).pathname);
const dist = join(miniapp, 'dist');
if (!existsSync(join(dist, 'index.html'))) throw new Error('Production dist is missing; run pnpm build first.');

const workplace = {
  section: 'S03', screen: 'S03-N01', manager: { employee_id: 'MGR-1', full_name: 'Начальник производства' },
  sections: {
    machines: { title: 'Станки', running_count: 0, downtime_count: 1, idle_count: 13, downtime_severity: 'operational', ui_variant: 'light_blue', available_actions: ['OPEN_MACHINES'] },
    employees: { title: 'Сотрудники', open_shift_count: 0, production_count: 0, downtime_count: 0, additional_work_count: 0, break_count: 0, without_work_count: 0, production_downtime_severity: 'none', ui_variant: 'light_blue', available_actions: ['OPEN_EMPLOYEES'] },
    downtimes: { title: 'Простои', critical_count: 0, operational_count: 1, ui_variant: 'light_blue', available_actions: ['OPEN_DOWNTIMES'] },
    additional_works: { title: 'Доп. работы', requested_count: 1, approved_count: 0, active_count: 0, requires_accrual_count: 0, ui_variant: 'grey', available_actions: ['OPEN_ADDITIONAL_WORKS'] },
    corrections: { title: 'Корректировки', ui_variant: 'light_blue', available_actions: ['OPEN_CORRECTIONS'] },
    notifications: { title: 'Уведомления', open_tasks_count: 3, ui_variant: 'light_blue', available_actions: ['OPEN_NOTIFICATIONS'] },
    reports: { title: 'Отчёты', ui_variant: 'light_blue', is_placeholder: true, available_actions: [] },
  },
};

function machine(index, overrides = {}) {
  return {
    machine_id: `M-${index}`, machine_name: `Станок ${index + 1}`, ui_state: 'idle', ui_variant: 'light_blue',
    active_production_operation_id: null, active_employee_id: null, active_employee_full_name: null,
    active_sku_id: null, active_sku_code: null, active_sku_name: null, active_break_id: null,
    active_break_name: null, active_downtime_id: null, downtime_type: null, downtime_name: null,
    downtime_comment: null, downtime_start_comment: null, downtime_finish_comment: null,
    downtime_started_at: null, downtime_duration: null, has_active_critical_downtime: false,
    has_active_operational_downtime: false, active_operational_downtime_id: null,
    is_selectable_for_manager_critical_downtime: true, available_actions: ['OPEN_MACHINE_CARD'], ...overrides,
  };
}

const activeMachine = machine(0, {
  ui_state: 'warning', ui_variant: 'yellow', active_downtime_id: 'D-1', downtime_type: 'operational',
  downtime_name: 'Ожидание материала', downtime_started_at: '2026-08-08 10:00:00+03', downtime_duration: '20 мин',
  has_active_operational_downtime: true, active_operational_downtime_id: 'D-1',
  is_selectable_for_manager_critical_downtime: false,
});
const machines = [activeMachine, ...Array.from({ length: 13 }, (_, index) => machine(index + 1))];

function task(kind, id, fields) {
  return {
    task_id: `source:${kind}:${id}`, notification_id: `source:${kind}:${id}`,
    created_at: '2026-08-08 10:00:00+03', task_kind: kind, sort_started_at: '2026-08-08 10:00:00+03',
    ui_state: 'open', available_actions: ['OPEN_TASK_SOURCE'], description: null, ...fields,
  };
}
const tasks = [
  task('CRITICAL_DOWNTIME_OPEN', 'D-2', { entity_table: 'machine_downtimes', entity_id: 'D-2', source_table: 'machine_downtimes', source_id: 'D-2', sort_group: 1, ui_color_token: 'red', ui_variant: 'red', target_screen_id: 'S03-M02', target_context: { machine_id: 'M-2' }, display_lines: ['Критический простой', 'Станок 3', 'Ремонт'], task_type: 'open_machine_downtime', title: 'Критический простой' }),
  task('OPERATIONAL_DOWNTIME_OVER_15_MIN', 'D-1', { entity_table: 'machine_downtimes', entity_id: 'D-1', source_table: 'machine_downtimes', source_id: 'D-1', sort_group: 2, ui_color_token: 'yellow', ui_variant: 'yellow', target_screen_id: 'S03-M02', target_context: { machine_id: 'M-0' }, display_lines: ['Операционный простой больше 15 минут', 'Станок 1', 'Ожидание материала', '20 мин'], task_type: 'open_machine_downtime', title: 'Операционный простой больше 15 минут' }),
  task('ADDITIONAL_WORK_REQUESTED', 'AW-1', { entity_table: 'additional_works', entity_id: 'AW-1', source_table: 'additional_works', source_id: 'AW-1', sort_group: 4, ui_color_token: 'gray', ui_variant: 'grey', target_screen_id: 'S03-AW10', target_context: { additional_work_id: 'AW-1' }, display_lines: ['Запрошена доп. работа', 'Анна Ким', 'Проверить комплектность'], task_type: 'additional_work_request', title: 'Запрошена доп. работа' }),
];

const api = new Map([
  ['/peaks/api/manager/workplace-state', workplace],
  ['/peaks/api/manager/machines', { section: 'S03', screen: 'S03-M01', title: 'Станки', machines, available_actions: ['BACK'] }],
  ['/peaks/api/manager/machines/M-0', { section: 'S03', screen: 'S03-M02', machine: { ...activeMachine, available_actions: ['FINISH_DOWNTIME'] }, available_actions: ['BACK'] }],
  ['/peaks/api/manager/notifications/open-tasks', { section: 'S03', screen: 'S03-NOT01', title: 'Уведомления', tasks, open_tasks: structuredClone(tasks), open_tasks_count: tasks.length, available_actions: ['BACK'] }],
]);

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const requests = [];
let activePlatformCase = 's03';
let activeFontCase = 'fast';
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;
  if (path === '/peaks/api/auth/me') {
    const payload = activePlatformCase === 's01'
      ? { status: 'GEOMETRY_GATE_UNSUPPORTED_AUTH_STATE' }
      : { status: 'AUTHENTICATED', actor_employee_id: activePlatformCase === 's02' ? 'OP-1' : 'MGR-1', telegram_user_id: 'TG-1', telegram_username: null };
    requests.push({ path, status: 200, kind: 'api', platformCase: activePlatformCase });
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(payload));
    return;
  }
  if (path === '/peaks/api/auth/app-entrypoint') {
    const payload = activePlatformCase === 's02'
      ? { section: 'section02', screen: 'S02-N01', contour: 'operator', actor: { employee_id: 'OP-1' }, role_hints: [], resolution_source: 'operator_default' }
      : { section: 'section03', screen: 'S03-N01', contour: 'production_manager', actor: { employee_id: 'MGR-1' }, role_hints: [], resolution_source: 'production_manager_role' };
    requests.push({ path, status: 200, kind: 'api', platformCase: activePlatformCase });
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(payload));
    return;
  }
  if (path === '/peaks/api/operator/workplace-state') {
    const payload = {
      actor_employee_id: 'OP-1',
      actor_full_name: 'Иванов Иван Иванович',
      shift: { is_active: false, employee_shift_id: null, started_at: null },
      additional_work_start: { blockers: [] },
      salary: { can_view_salary: true },
    };
    requests.push({ path, status: 200, kind: 'api', platformCase: activePlatformCase });
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(payload));
    return;
  }
  if (api.has(path)) {
    requests.push({ path, status: 200, kind: 'api' });
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(api.get(path)));
    return;
  }
  if (path === '/telegram-web-app.js') {
    response.writeHead(200, { 'content-type': 'text/javascript' });
    response.end('window.Telegram = window.Telegram || { WebApp: { initData: "c5-local", ready() {}, expand() {} } };');
    return;
  }
  if (path === '/favicon.ico') {
    requests.push({ path, status: 200, kind: 'asset' });
    response.writeHead(200, { 'content-type': 'image/x-icon' });
    response.end();
    return;
  }
  if (path === '/' || path === '/peaks/' || path === '/peaks/index.html') {
    activePlatformCase = url.searchParams.get('platform-case') ?? 's03';
    activeFontCase = url.searchParams.get('font-case') ?? 'fast';
    const html = readFileSync(join(dist, 'index.html'), 'utf8')
      .replace('https://telegram.org/js/telegram-web-app.js', '/telegram-web-app.js');
    requests.push({ path, status: 200, kind: 'entrypoint' });
    response.writeHead(200, { 'content-type': mime['.html'] });
    response.end(html);
    return;
  }
  const relative = normalize(path.replace(/^\/peaks\//, '')).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = resolve(dist, relative);
  if (!file.startsWith(`${dist}/`) || !existsSync(file) || !statSync(file).isFile()) {
    requests.push({ path, status: 404, kind: 'asset' });
    response.writeHead(404).end();
    return;
  }
  const extension = extname(file);
  if (extension === '.woff2' && activeFontCase === 'reject') {
    requests.push({ path, status: 503, kind: 'asset', fontCase: activeFontCase, expectedFailure: true });
    response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    response.end('controlled font rejection');
    return;
  }
  const deliver = () => {
    requests.push({ path, status: 200, kind: 'asset', ...(extension === '.woff2' ? { fontCase: activeFontCase } : {}) });
    response.writeHead(200, { 'content-type': mime[extension] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  };
  if (extension === '.woff2' && activeFontCase === 'slow') {
    setTimeout(deliver, 4_500);
    return;
  }
  deliver();
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const port = server.address().port;

function encodeFrame(text, opcode = 1) {
  const payload = Buffer.from(text); const mask = randomBytes(4);
  const header = payload.length < 126 ? Buffer.alloc(2) : payload.length <= 0xffff ? Buffer.alloc(4) : Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  if (payload.length < 126) header[1] = 0x80 | payload.length;
  else if (payload.length <= 0xffff) { header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
  else { header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) masked[index] = payload[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

async function cdpClient(webSocketUrl) {
  const parsed = new URL(webSocketUrl); const socket = connect(Number(parsed.port), parsed.hostname);
  await new Promise((resolveConnect, rejectConnect) => { socket.once('connect', resolveConnect); socket.once('error', rejectConnect); });
  const key = randomBytes(16).toString('base64');
  socket.write([`GET ${parsed.pathname}${parsed.search} HTTP/1.1`, `Host: ${parsed.host}`, 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', '\r\n'].join('\r\n'));
  let buffer = Buffer.alloc(0);
  await new Promise((resolveHandshake, rejectHandshake) => {
    const onData = (chunk) => { buffer = Buffer.concat([buffer, chunk]); const boundary = buffer.indexOf('\r\n\r\n'); if (boundary < 0) return; socket.off('data', onData); const response = buffer.subarray(0, boundary).toString(); buffer = buffer.subarray(boundary + 4); response.startsWith('HTTP/1.1 101') ? resolveHandshake() : rejectHandshake(new Error(response)); };
    socket.on('data', onData); socket.once('error', rejectHandshake);
  });
  let nextId = 1; const pending = new Map(); const listeners = []; const eventWaiters = [];
  let fragmented = Buffer.alloc(0); let fragmentedOpcode = 0;
  function dispatch(message) {
    if (message.id !== undefined) { const waiter = pending.get(message.id); if (waiter) { pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result); } return; }
    for (const listener of listeners) listener(message);
    const index = eventWaiters.findIndex((waiter) => waiter.method === message.method);
    if (index >= 0) eventWaiters.splice(index, 1)[0].resolve(message.params);
  }
  function frames(chunk = Buffer.alloc(0)) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const final = (buffer[0] & 0x80) !== 0; const opcode = buffer[0] & 0x0f; const masked = (buffer[1] & 0x80) !== 0;
      let length = buffer[1] & 0x7f; let offset = 2;
      if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
      else if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
      const maskBytes = masked ? 4 : 0; if (buffer.length < offset + maskBytes + length) return;
      const mask = masked ? buffer.subarray(offset, offset + 4) : null; offset += maskBytes;
      const payload = Buffer.from(buffer.subarray(offset, offset + length)); buffer = buffer.subarray(offset + length);
      if (mask) for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
      if (opcode === 8) return;
      if (opcode === 9) { socket.write(encodeFrame(payload.toString(), 10)); continue; }
      if (opcode === 1 && final) { dispatch(JSON.parse(payload.toString())); continue; }
      if (opcode === 1) { fragmentedOpcode = opcode; fragmented = payload; continue; }
      if (opcode === 0) {
        fragmented = Buffer.concat([fragmented, payload]);
        if (final && fragmentedOpcode === 1) dispatch(JSON.parse(fragmented.toString()));
        if (final) { fragmented = Buffer.alloc(0); fragmentedOpcode = 0; }
      }
    }
  }
  socket.on('data', frames); if (buffer.length) frames();
  return {
    command(method, params = {}) { const id = nextId++; return new Promise((resolveCommand, rejectCommand) => { const timeout = setTimeout(() => { pending.delete(id); rejectCommand(new Error(`CDP timeout: ${method}`)); }, 15000); pending.set(id, { resolve: (value) => { clearTimeout(timeout); resolveCommand(value); }, reject: (error) => { clearTimeout(timeout); rejectCommand(error); } }); socket.write(encodeFrame(JSON.stringify({ id, method, params }))); }); },
    wait(method) { return new Promise((resolveEvent, rejectEvent) => { const timeout = setTimeout(() => rejectEvent(new Error(`CDP event timeout: ${method}`)), 15000); eventWaiters.push({ method, resolve: (value) => { clearTimeout(timeout); resolveEvent(value); } }); }); },
    on(listener) { listeners.push(listener); }, close() { socket.end(encodeFrame('', 8)); },
  };
}

function assert(value, message) { if (!value) throw new Error(message); }
async function waitHttp(url) { for (let count = 0; count < 200; count += 1) { try { const response = await fetch(url); if (response.ok) return response; } catch {} await new Promise((done) => setTimeout(done, 50)); } throw new Error(`Timed out: ${url}`); }

const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const executable = candidates.map((name) => spawnSync('which', [name], { encoding: 'utf8' }).stdout.trim()).find(Boolean);
if (!executable) throw new Error('System Chrome/Chromium is required.');
const debugPort = 42817; const profile = mkdtempSync(join(tmpdir(), 'peaks-c5-chrome-'));
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-sync', '--no-first-run', '--disable-default-apps', '--disable-extensions', `--remote-debugging-port=${debugPort}`, '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let browserError = ''; browser.stderr.on('data', (chunk) => { browserError += String(chunk); });

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const evidenceBase = process.env.PEAKS_BROWSER_EVIDENCE_DIR ?? `${process.cwd()}/.browser-evidence`;
const evidence = `${evidenceBase}/${stamp}-C5-section03-production-entrypoint`;
mkdirSync(join(evidence, 'screenshots'), { recursive: true });
let cdp;
try {
  const targets = await (await waitHttp(`http://127.0.0.1:${debugPort}/json/list`)).json();
  cdp = await cdpClient(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await Promise.all([cdp.command('Page.enable'), cdp.command('Runtime.enable'), cdp.command('Log.enable'), cdp.command('Network.enable')]);
  await cdp.command('Network.setCacheDisabled', { cacheDisabled: true });
  const failures = []; const external = []; const fontResponses = [];
  cdp.on((message) => {
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params);
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) failures.push(message.params);
    if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params?.entry?.level)) failures.push(message.params.entry);
    if (message.method === 'Network.loadingFailed') failures.push(message.params);
    if (message.method === 'Network.requestWillBeSent') { const url = new URL(message.params.request.url); if (url.hostname !== '127.0.0.1') external.push(url.href); }
    if (message.method === 'Network.responseReceived' && message.params.response.url.includes('.woff2')) fontResponses.push({ url: message.params.response.url, status: message.params.response.status });
  });
  const evaluate = async (expression) => { const result = await cdp.command('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const waitNode = async (nodeId) => { for (let attempt = 0; attempt < 100; attempt += 1) { if (await evaluate(`return document.querySelector('main')?.dataset.nodeId === ${JSON.stringify(nodeId)}`)) return; await new Promise((done) => setTimeout(done, 50)); } const state = await evaluate(`const main=document.querySelector('main'); return {node:main?.dataset.nodeId,fontState:main?.dataset.platformFontReadinessState,diagnostic:main?.dataset.platformDiagnosticCode,text:document.body.innerText}`); throw new Error(`Node ${nodeId} did not render: ${JSON.stringify({ state, requests, failures })}`); };
  const waitCondition = async (expression, context) => { for (let attempt = 0; attempt < 120; attempt += 1) { if (await evaluate(`return Boolean(${expression})`)) return; await new Promise((done) => setTimeout(done, 50)); } const state = await evaluate(`return {html:document.documentElement.outerHTML,text:document.body.innerText}`); throw new Error(`${context} did not render: ${JSON.stringify({ state, requests, failures })}`); };
  const navigate = async (url) => {
    void cdp.command('Page.navigate', { url }).catch(() => undefined);
    for (let attempt = 0; attempt < 300; attempt += 1) {
      try {
        if (await evaluate(`return location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`)) return;
      } catch {
        // The prior execution context is expected to disappear while the new document commits.
      }
      await new Promise((done) => setTimeout(done, 50));
    }
    throw new Error(`navigation ${url} did not complete`);
  };
  const click = (label) => evaluate(`const button=[...document.querySelectorAll('button')].find((item)=>item.getAttribute('aria-label')===${JSON.stringify(label)}); if(!button) throw new Error('button missing'); button.click(); return true;`);
  const clickText = (label) => evaluate(`const button=[...document.querySelectorAll('button')].find((item)=>item.textContent===${JSON.stringify(label)}); if(!button) throw new Error('button missing'); button.click(); return true;`);
  const platformGeometryExpression = platformGeometryEvaluationExpression({
    expectedNormalizationContract: PLATFORM_ROOT_GEOMETRY_CONTRACT,
  });
  const inspectPlatformGeometry = () => evaluate(`return ${platformGeometryExpression}`);
  const fontTimingPatch = await cdp.command('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    window.__peaksFontReadinessTiming = { slowAtMs: null, readyAtMs: null };
    const capture = () => {
      const main = document.querySelector('main');
      if (main?.dataset.platformFontReadinessState === 'SLOW' && window.__peaksFontReadinessTiming.slowAtMs === null) {
        window.__peaksFontReadinessTiming.slowAtMs = performance.now();
      }
      if (main?.dataset.nodeId === 'S03-N01' && window.__peaksFontReadinessTiming.readyAtMs === null) {
        window.__peaksFontReadinessTiming.readyAtMs = performance.now();
      }
    };
    new MutationObserver(capture).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-node-id', 'data-platform-font-readiness-state'] });
    setTimeout(capture, 0);
  })();` });
  const fontReadinessResults = [];
  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  failures.length = 0; external.length = 0; fontResponses.length = 0;
  await navigate(`http://127.0.0.1:${port}/peaks/?font-case=fast`);
  await waitNode('S03-N01');
  const fastTiming = await evaluate(`const navigation=performance.getEntriesByType('navigation')[0]; return {navigationResponseEndMs:navigation.responseEnd,readyAtMs:window.__peaksFontReadinessTiming.readyAtMs};`);
  const fastElapsedMs = Math.round(fastTiming.readyAtMs - fastTiming.navigationResponseEndMs);
  const fast = await evaluate(`const screen=document.querySelector('.peaks-section03-screen'); return {font:getComputedStyle(screen).fontFamily,font400:document.fonts.check('400 16px "Peaks Arimo"'),font700:document.fonts.check('700 16px "Peaks Arimo"'),text:document.body.innerText};`);
  const fastGeometry = await inspectPlatformGeometry();
  assert(fastElapsedMs < 3_000, `font-fast: exceeded SLOW threshold (${fastElapsedMs}ms)`);
  assert(fast.font.includes('Peaks Arimo') && fast.font400 && fast.font700, `font-fast: required faces unavailable ${JSON.stringify(fast)}`);
  assert(fastGeometry.status === 'PASS', `font-fast: geometry ${JSON.stringify(fastGeometry)}`);
  assert(failures.length === 0 && external.length === 0, `font-fast: browser failures ${JSON.stringify({ failures, external })}`);
  assert(fontResponses.length >= 2 && fontResponses.every((item) => item.status === 200), `font-fast: asset responses ${JSON.stringify(fontResponses)}`);
  fontReadinessResults.push({ case: 'FAST', elapsedMs: fastElapsedMs, timingAuthority: 'BROWSER_PERFORMANCE_FROM_ENTRYPOINT_RESPONSE_END', state: 'READY', geometry: fastGeometry, fontResponses: [...fontResponses] });

  failures.length = 0; external.length = 0; fontResponses.length = 0;
  await navigate(`http://127.0.0.1:${port}/peaks/?font-case=slow`);
  await waitCondition(`document.querySelector('main')?.dataset.platformFontReadinessState === 'SLOW'`, 'font-slow');
  const slowTimingAtTransition = await evaluate(`const navigation=performance.getEntriesByType('navigation')[0]; return {navigationResponseEndMs:navigation.responseEnd,slowAtMs:window.__peaksFontReadinessTiming.slowAtMs};`);
  const slowAtMs = Math.round(slowTimingAtTransition.slowAtMs - slowTimingAtTransition.navigationResponseEndMs);
  const slowShell = await evaluate(`const main=document.querySelector('main'); return {diagnostic:main?.dataset.platformDiagnosticCode,font:getComputedStyle(main).fontFamily,state:main?.dataset.platformFontReadinessState,text:document.body.innerText,retry:[...document.querySelectorAll('button')].some((item)=>item.textContent==='Повторить')};`);
  const slowGeometry = await inspectPlatformGeometry();
  assert(slowAtMs >= 2_900 && slowAtMs < 4_500, `font-slow: SLOW transition timing ${slowAtMs}ms`);
  assert(slowShell.state === 'SLOW' && slowShell.diagnostic === 'PLATFORM_FONT_READINESS_SLOW', `font-slow: diagnostics ${JSON.stringify(slowShell)}`);
  assert(!slowShell.text.includes('PLATFORM_') && !slowShell.font.includes('Peaks Arimo') && slowShell.retry, `font-slow: unsafe or font-dependent shell ${JSON.stringify(slowShell)}`);
  assert(slowGeometry.status === 'PASS', `font-slow: geometry ${JSON.stringify(slowGeometry)}`);
  await waitNode('S03-N01');
  const slowReadyAtMs = await evaluate(`const navigation=performance.getEntriesByType('navigation')[0]; return Math.round(window.__peaksFontReadinessTiming.readyAtMs-navigation.responseEnd);`);
  assert(slowReadyAtMs >= 4_300, `font-slow: did not wait for late faces (${slowReadyAtMs}ms)`);
  assert(failures.length === 0 && external.length === 0, `font-slow: browser failures ${JSON.stringify({ failures, external })}`);
  assert(fontResponses.length >= 2 && fontResponses.every((item) => item.status === 200), `font-slow: asset responses ${JSON.stringify(fontResponses)}`);
  fontReadinessResults.push({ case: 'SLOW_4500_AUTO_READY', slowAtMs, readyAtMs: slowReadyAtMs, timingAuthority: 'BROWSER_PERFORMANCE_FROM_ENTRYPOINT_RESPONSE_END', shell: slowShell, geometry: slowGeometry, fontResponses: [...fontResponses] });

  failures.length = 0; external.length = 0; fontResponses.length = 0;
  await navigate(`http://127.0.0.1:${port}/peaks/?font-case=reject`);
  await waitCondition(`document.querySelector('main')?.dataset.platformFontReadinessState === 'LOAD_REJECTED'`, 'font-reject');
  await new Promise((done) => setTimeout(done, 150));
  const rejected = await evaluate(`const main=document.querySelector('main'); return {diagnostic:main?.dataset.platformDiagnosticCode,state:main?.dataset.platformFontReadinessState,text:document.body.innerText,retry:[...document.querySelectorAll('button')].some((item)=>item.textContent==='Повторить')};`);
  const rejectedGeometry = await inspectPlatformGeometry();
  assert(rejected.diagnostic === 'PLATFORM_FONT_LOAD_REJECTED' && rejected.retry, `font-reject: typed recoverable state missing ${JSON.stringify(rejected)}`);
  assert(!rejected.text.includes('PLATFORM_') && !rejected.text.includes('woff2') && !rejected.text.includes('ERR_'), `font-reject: raw diagnostic leaked ${JSON.stringify(rejected)}`);
  assert(rejectedGeometry.status === 'PASS', `font-reject: geometry ${JSON.stringify(rejectedGeometry)}`);
  const rejectionEvidence = { failures: [...failures], fontResponses: [...fontResponses] };
  activeFontCase = 'fast';
  failures.length = 0; external.length = 0; fontResponses.length = 0;
  await clickText('Повторить');
  await waitCondition(`document.querySelector('main')?.dataset.platformFontReadinessState === 'RETRYING' || document.querySelector('main')?.dataset.nodeId === 'S03-N01'`, 'font-retry-start');
  await waitNode('S03-N01');
  const recoveryGeometry = await inspectPlatformGeometry();
  assert(recoveryGeometry.status === 'PASS', `font-retry: geometry ${JSON.stringify(recoveryGeometry)}`);
  assert(failures.length === 0 && external.length === 0, `font-retry: browser failures ${JSON.stringify({ failures, external })}`);
  assert(fontResponses.length >= 2 && fontResponses.every((item) => item.status === 200), `font-retry: fresh asset responses ${JSON.stringify(fontResponses)}`);
  fontReadinessResults.push({ case: 'NETWORK_REJECTION_RETRY_SUCCESS', rejected, rejectedGeometry, rejectionEvidence, recoveryGeometry, recoveryFontResponses: [...fontResponses], state: 'READY_AFTER_RETRY' });

  failures.length = 0; external.length = 0; fontResponses.length = 0;
  const missingFacePatch = await cdp.command('Page.addScriptToEvaluateOnNewDocument', { source: `if(document.fonts){const fonts=document.fonts;const nativeLoad=fonts.load.bind(fonts);Object.defineProperty(fonts,'load',{configurable:true,value(font,text){const result=nativeLoad(font,text);return String(font).includes('700')?result.then(()=>[]):result;}});}` });
  await navigate(`http://127.0.0.1:${port}/peaks/?font-case=fast`);
  await waitCondition(`document.querySelector('main')?.dataset.platformFontReadinessState === 'LOAD_REJECTED'`, 'font-missing-face');
  const missingFace = await evaluate(`const main=document.querySelector('main'); return {diagnostic:main?.dataset.platformDiagnosticCode,state:main?.dataset.platformFontReadinessState,text:document.body.innerText,retry:[...document.querySelectorAll('button')].some((item)=>item.textContent==='Повторить')};`);
  const missingFaceGeometry = await inspectPlatformGeometry();
  assert(missingFace.diagnostic === 'PLATFORM_FONT_FACE_MISSING' && missingFace.retry, `font-missing-face: ${JSON.stringify(missingFace)}`);
  assert(!missingFace.text.includes('PLATFORM_'), `font-missing-face: raw diagnostic leaked ${JSON.stringify(missingFace)}`);
  assert(missingFaceGeometry.status === 'PASS', `font-missing-face: geometry ${JSON.stringify(missingFaceGeometry)}`);
  assert(failures.length === 0 && external.length === 0, `font-missing-face: browser failures ${JSON.stringify({ failures, external })}`);
  assert(fontResponses.length >= 2 && fontResponses.every((item) => item.status === 200), `font-missing-face: asset responses ${JSON.stringify(fontResponses)}`);
  fontReadinessResults.push({ case: 'MISSING_FACE_WRONG_WEIGHT', shell: missingFace, geometry: missingFaceGeometry, fontResponses: [...fontResponses] });
  await cdp.command('Page.removeScriptToEvaluateOnNewDocument', { identifier: missingFacePatch.identifier });

  const platformConsumers = [];
  const platformViewports = [
    { id: 'mobile-390', width: 390, height: 844, mobile: true },
    { id: 'desktop-1280', width: 1280, height: 800, mobile: false },
  ];
  for (const consumer of ['s01', 's02']) {
    for (const current of platformViewports) {
      failures.length = 0; external.length = 0; fontResponses.length = 0;
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: current.width, height: current.height, deviceScaleFactor: 1, mobile: current.mobile });
      await cdp.command('Emulation.setTouchEmulationEnabled', { enabled: current.mobile, maxTouchPoints: current.mobile ? 5 : 1 });
      await navigate(`http://127.0.0.1:${port}/peaks/?platform-case=${consumer}`);
      if (consumer === 's01') {
        await waitCondition("document.querySelector('main.s01-page') && document.body.innerText.includes('Сервис временно недоступен.')", `${consumer}-${current.id}`);
      } else {
        await waitNode('S02-N01');
      }
      await new Promise((done) => setTimeout(done, 100));
      const geometry = await inspectPlatformGeometry();
      assert(geometry.status === 'PASS', `${consumer}-${current.id}: ${JSON.stringify(geometry)}`);
      const mainRoot = geometry.significant_roots.find((root) => root.target.startsWith('main'));
      assert(mainRoot !== undefined && mainRoot.bounds.left >= -0.5 && mainRoot.bounds.right <= geometry.document.document_client_width + 0.5, `${consumer}-${current.id}: root bounds ${JSON.stringify(geometry)}`);
      assert(failures.length === 0, `${consumer}-${current.id}: console/network failures ${JSON.stringify(failures)}`);
      assert(external.length === 0, `${consumer}-${current.id}: external requests ${external.join(',')}`);
      const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(evidence, 'screenshots', `platform-${consumer}-${current.id}.png`), screenshot.data, 'base64');
      platformConsumers.push({ consumer, ...current, geometry });
    }
  }
  const cases = [
    { id: 'mobile-360', width: 360, height: 640, stable: 600, mobile: true, safeTop: 24, safeBottom: 20 },
    { id: 'mobile-390', width: 390, height: 844, stable: 800, mobile: true, safeTop: 24, safeBottom: 20 },
    { id: 'desktop-1280', width: 1280, height: 800, stable: 800, mobile: false, safeTop: 0, safeBottom: 0 },
  ];
  const results = [];
  for (const current of cases) {
    failures.length = 0; external.length = 0; fontResponses.length = 0;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: current.width, height: current.height, deviceScaleFactor: 1, mobile: current.mobile });
    await cdp.command('Emulation.setTouchEmulationEnabled', { enabled: current.mobile, maxTouchPoints: current.mobile ? 5 : 1 });
    const preload = await cdp.command('Page.addScriptToEvaluateOnNewDocument', { source: `window.__c5Cls=0; new PerformanceObserver((list)=>{for(const entry of list.getEntries()) if(!entry.hadRecentInput) window.__c5Cls+=entry.value;}).observe({type:'layout-shift',buffered:true}); const applyTelegramGeometry=()=>{document.documentElement.style.setProperty('--tg-viewport-stable-height','${current.stable}px');document.documentElement.style.setProperty('--tg-content-safe-area-inset-top','${current.safeTop}px');document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom','${current.safeBottom}px');}; if(document.documentElement)applyTelegramGeometry();else{const observer=new MutationObserver(()=>{if(document.documentElement){applyTelegramGeometry();observer.disconnect();}});observer.observe(document,{childList:true});} window.Telegram={WebApp:{initData:'c5-local',ready(){},expand(){}}};` });
    await navigate(`http://127.0.0.1:${port}/peaks/`); await waitNode('S03-N01');
    await evaluate(`await document.fonts.ready; await new Promise((done)=>setTimeout(done,100)); return true;`);
    const platformGeometry = await inspectPlatformGeometry();
    assert(platformGeometry.status === 'PASS', `${current.id}: platform geometry ${JSON.stringify(platformGeometry)}`);
    const main = await evaluate(`const screen=document.querySelector('.peaks-section03-screen'); const shell=document.querySelector('.peaks-presentation-screen-template'); const scroll=document.querySelector('[data-presentation-scroll-slot="true"]'); const footer=document.querySelector('.peaks-presentation-screen-template__fixed-bottom'); const header=document.querySelector('.peaks-section03-header'); const rect=(node)=>node?Object.fromEntries(['top','right','bottom','left','width','height'].map((key)=>[key,node.getBoundingClientRect()[key]])):null; return {screen:rect(shell),scroll:rect(scroll),footer:rect(footer),header:rect(header),documentScroll:document.scrollingElement.scrollTop,documentHeight:document.scrollingElement.scrollHeight,viewportHeight:innerHeight,scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight,font:getComputedStyle(screen).fontFamily,font400:document.fonts.check('400 16px "Peaks Arimo"'),font700:document.fonts.check('700 16px "Peaks Arimo"'),count:document.body.innerText.includes('Открытые задачи: 3')};`);
    assert(Math.abs(main.screen.height - current.stable) <= 1, `${current.id}: stable height mismatch ${JSON.stringify(main)}`);
    assert(main.documentScroll === 0 && main.documentHeight <= current.height, `${current.id}: document owns scroll`);
    assert(main.font.includes('Peaks Arimo') && main.font400 && main.font700, `${current.id}: local typography not ready`);
    assert(main.count, `${current.id}: canonical notification summary count missing`);
    const initialCls = await evaluate(`return window.__c5Cls`);
    assert(initialCls === 0, `${current.id}: initial typography/layout shift ${initialCls}`);
    const mainContentOverflows = main.scrollHeight > main.clientHeight;
    if (mainContentOverflows) {
      const point = { x: Math.round((main.scroll.left + main.scroll.right) / 2), y: Math.round((main.scroll.top + main.scroll.bottom) / 2) };
      if (current.mobile) {
        await cdp.command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 2, radiusY: 2 }] });
        await cdp.command('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - 220, radiusX: 2, radiusY: 2 }] });
        await cdp.command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await cdp.command('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY: 420 });
      }
      await new Promise((done) => setTimeout(done, 150));
      assert(await evaluate(`return document.querySelector('[data-presentation-scroll-slot="true"]').scrollTop > 0`), `${current.id}: central gesture did not scroll overflowing content`);
    } else {
      assert(await evaluate(`return document.querySelector('[data-presentation-scroll-slot="true"]').scrollTop === 0`), `${current.id}: fitting central content has unexpected scroll`);
    }
    assert(await evaluate(`return document.scrollingElement.scrollTop === 0`), `${current.id}: gesture scrolled document`);

    await click('Открыть раздел Станки'); await waitNode('S03-M01');
    const before = await evaluate(`const title=document.querySelector('.peaks-presentation-screen-template__title'); const scroll=document.querySelector('[data-presentation-scroll-slot="true"]'); const footer=document.querySelector('.peaks-presentation-screen-template__fixed-bottom'); const style=getComputedStyle(title); return {titleTop:title.getBoundingClientRect().top,titleBottom:title.getBoundingClientRect().bottom,scrollTop:scroll.getBoundingClientRect().top,footerTop:footer.getBoundingClientRect().top,color:style.color,align:style.textAlign};`);
    await evaluate(`const scroll=document.querySelector('[data-presentation-scroll-slot="true"]'); scroll.scrollTop=scroll.scrollHeight; return scroll.scrollTop;`);
    const after = await evaluate(`const title=document.querySelector('.peaks-presentation-screen-template__title'); const footer=document.querySelector('.peaks-presentation-screen-template__fixed-bottom'); return {titleTop:title.getBoundingClientRect().top,footerTop:footer.getBoundingClientRect().top};`);
    assert(before.align === 'center' && before.color === 'rgb(8, 97, 187)', `${current.id}: title contract failed`);
    assert(Math.abs(before.titleTop - after.titleTop) < 0.5 && Math.abs(before.footerTop - after.footerTop) < 0.5, `${current.id}: fixed zones moved`);
    assert(before.titleBottom <= before.scrollTop + 0.5, `${current.id}: title entered scroll zone`);

    await click('Открыть карточку станка Станок 1'); await waitNode('S03-M02');
    const card = await evaluate(`const footer=document.querySelector('.peaks-presentation-screen-template__fixed-bottom'); const buttons=[...footer.querySelectorAll('button')].map((button)=>button.getBoundingClientRect()); const scroll=document.querySelector('[data-presentation-scroll-slot="true"]').getBoundingClientRect(); const label=document.querySelector('.peaks-presentation-card__label')?.getBoundingClientRect(); const value=document.querySelector('.peaks-presentation-card__value')?.getBoundingClientRect(); return {buttonCount:buttons.length,buttonGap:buttons[1]?.top-buttons[0]?.bottom,contentGap:buttons[0]?.top-scroll.bottom,labelBottom:label?.bottom,valueTop:value?.top,labelLeft:label?.left,valueLeft:value?.left};`);
    assert(card.buttonCount === 2 && card.buttonGap >= 6.5 && card.contentGap >= 5.5, `${current.id}: fixed control spacing failed`);
    assert(card.valueTop >= card.labelBottom && Math.abs(card.labelLeft - card.valueLeft) < 1, `${current.id}: detail label/value is not stacked`);
    await click('Назад'); await waitNode('S03-M01'); await click('Назад'); await waitNode('S03-N01');
    await click('Открыть раздел Уведомления'); await waitNode('S03-NOT01');
    const notificationCount = await evaluate(`return document.querySelectorAll('.peaks-presentation-state-list-button').length`);
    assert(notificationCount === 3, `${current.id}: notification detail count mismatch`);
    const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(evidence, 'screenshots', `${current.id}.png`), screenshot.data, 'base64');
    assert(failures.length === 0, `${current.id}: console/network failures ${JSON.stringify(failures)}`);
    assert(external.length === 0, `${current.id}: external requests ${external.join(',')}`);
    assert(fontResponses.length >= 2 && fontResponses.every((item) => item.status === 200), `${current.id}: font assets not 200`);
    results.push({ ...current, main, mainContentOverflows, platformGeometry, card, notificationCount, initialCls, fontResponses: [...fontResponses] });
    await cdp.command('Page.removeScriptToEvaluateOnNewDocument', { identifier: preload.identifier });
  }
  const legacyRouteResults = [];
  for (const legacyCase of [
    { id: 'section03', url: `http://127.0.0.1:${port}/peaks/?section03=legacy`, nodeId: 'S03-N01', expectedClass: 'peaks-s03-screen', expectedText: 'Станки' },
    { id: 'section02', url: `http://127.0.0.1:${port}/peaks/?platform-case=s02&section02=legacy`, nodeId: 'S02-N01', expectedClass: 'peaks-graph-viewport', expectedText: 'Начать смену' },
  ]) {
    failures.length = 0; external.length = 0; fontResponses.length = 0;
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await navigate(legacyCase.url);
    await waitNode(legacyCase.nodeId);
    await waitCondition(`document.body.innerText.includes(${JSON.stringify(legacyCase.expectedText)})`, `${legacyCase.id}-legacy-content`);
    const observed = await evaluate(`const main=document.querySelector('main'); return {className:main?.className,text:document.body.innerText,nodeId:main?.dataset.nodeId};`);
    const hardFailures = failures.filter((item) => item?.level !== 'warning');
    assert(observed.className.includes(legacyCase.expectedClass), `${legacyCase.id}: emergency implementation class missing ${JSON.stringify(observed)}`);
    assert(observed.text.includes(legacyCase.expectedText), `${legacyCase.id}: emergency implementation content missing ${JSON.stringify(observed)}`);
    assert(hardFailures.length === 0 && external.length === 0, `${legacyCase.id}: emergency route browser failures ${JSON.stringify({ failures, external })}`);
    legacyRouteResults.push({ ...legacyCase, observed, warnings: failures.filter((item) => item?.level === 'warning') });
  }
  await cdp.command('Page.removeScriptToEvaluateOnNewDocument', { identifier: fontTimingPatch.identifier });
  const assetFailures = requests.filter((request) => request.status !== 200 && request.expectedFailure !== true);
  assert(assetFailures.length === 0, `Static/API failures: ${JSON.stringify(assetFailures)}`);
  const summary = { gate: 'C5_CROSS_SECTION_PRODUCTION_ENTRYPOINT', status: 'PASS', browser: spawnSync(executable, ['--version'], { encoding: 'utf8' }).stdout.trim(), productionEntrypoint: '/peaks/', section03Entrypoint: '/peaks/', rootGeometryContract: PLATFORM_ROOT_GEOMETRY_CONTRACT, specialGeometryCss: false, fontReadinessResults, hiddenBackgroundCoverage: 'DETERMINISTIC_UNIT_GATE', platformConsumers, legacyRouteResults, results, requests };
  writeFileSync(join(evidence, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(evidence, 'font-readiness-summary.json'), JSON.stringify({ gate: 'PLATFORM_FONT_READINESS_PRODUCTION_ENTRYPOINT', status: 'PASS', cases: fontReadinessResults, hiddenBackgroundCoverage: 'DETERMINISTIC_UNIT_GATE' }, null, 2));
  process.stdout.write(`PLATFORM_FONT_READINESS_GATE_PASS evidence=${evidence}\n`);
  process.stdout.write(`C5_CROSS_SECTION_PRODUCTION_ENTRYPOINT_PASS evidence=${evidence}\n`);
} finally {
  try { cdp?.close(); } catch {}
  if (browser.exitCode === null) {
    browser.kill('SIGTERM');
    await Promise.race([
      new Promise((done) => browser.once('exit', done)),
      new Promise((done) => setTimeout(done, 2_000)),
    ]);
  }
  await new Promise((done) => server.close(done));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try { rmSync(profile, { recursive: true, force: true }); break; }
    catch (error) {
      if (attempt === 9) process.stderr.write(`C5 cleanup warning: ${String(error)}\n`);
      else await new Promise((done) => setTimeout(done, 100));
    }
  }
}
