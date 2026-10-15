import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const port = 4178;
const baseUrl = 'http://127.0.0.1:' + port + '/admin/';
const evidenceDirectory = new URL('../../../.browser-evidence/admin-web-browser/', import.meta.url);
await mkdir(evidenceDirectory, { recursive: true });
const browserExecutable = [
  process.env.PEAKS_BROWSER_EXECUTABLE,
  '/usr/bin/google-chrome',
  chromium.executablePath(),
].find((candidate) => candidate !== undefined && existsSync(candidate));

if (browserExecutable === undefined) {
  throw new Error(
    'Chromium executable not found; install the Playwright Chromium build or set PEAKS_BROWSER_EXECUTABLE',
  );
}

let server;
let serverOutput = '';

async function run() {
  server = spawn(
    process.execPath,
    [
      new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  try {
    await waitForServer();
    const browser = await chromium.launch({
      executablePath: browserExecutable,
      headless: true,
      args: ['--no-sandbox']
    });
    try {
      await verifyDesktop(browser);
      await verifyMobile(browser);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }
}

async function verifyDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: 'peaks_admin_csrf', value: 'c'.repeat(43), url: baseUrl }]);
  const page = await context.newPage();
  const consoleErrors = [];
  const mutationRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !isExpectedUnauthenticatedFetch(message.text())) {
      consoleErrors.push(message.text());
    }
  });

  await page.route('**/admin-api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/admin-api/auth/session') {
      await json(route, 401, {
        error: { code: 'unauthenticated', message: 'Требуется вход' }
      });
      return;
    }
    if (url.pathname === '/admin-api/auth/telegram-qr/challenge') {
      await json(route, 200, { challenge: qrChallengeFixture() });
      return;
    }
    if (url.pathname === '/admin-api/auth/telegram-qr/challenge/41/claim') {
      await json(route, 200, { status: 'PENDING' });
      return;
    }
    if (url.pathname === '/admin-api/auth/login') {
      await json(route, 200, { session: sessionFixture });
      return;
    }
    if (url.pathname === '/admin-api/overview') {
      await json(route, 200, { overview: overviewFixture });
      return;
    }
    if (url.pathname === '/admin-api/directory') {
      await json(route, 200, { directory: directoryFixture });
      return;
    }
    if (url.pathname === '/admin-api/catalog/qr-label') {
      mutationRequests.push({
        pathname: url.pathname,
        headers: request.headers(),
        body: request.postDataJSON()
      });
      await route.fulfill({
        status: 200,
        contentType: 'image/svg+xml; charset=utf-8',
        headers: { 'content-disposition': 'attachment; filename="sku-1-qr.svg"' },
        body: '<svg xmlns="http://www.w3.org/2000/svg"><text>SKU-001</text></svg>'
      });
      return;
    }
    if (url.pathname.startsWith('/admin-api/catalog/')) {
      mutationRequests.push({
        pathname: url.pathname,
        headers: request.headers(),
        body: request.postDataJSON()
      });
      if (url.pathname === '/admin-api/catalog/activity-types/move') {
        moveActivityFixture(request.postDataJSON());
        await json(route, 200, { result: { activity_type_id: request.postDataJSON().activity_type_id, moved: true } });
        return;
      }
      await json(route, 200, { result: { sku_id: '1', created: false, qr_rotated: false } });
      return;
    }
    if (url.pathname === '/admin-api/auth/logout') {
      await json(route, 200, { status: 'LOGGED_OUT' });
      return;
    }
    await json(route, 404, { error: { code: 'not_found', message: 'not found' } });
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Административная панель' }).waitFor();
  await page.getByText('Отсканируйте QR-код камерой телефона — откроется Telegram').waitFor();
  await page.getByAltText('QR-код для входа через Telegram').waitFor();
  await page.screenshot({
    path: new URL('login-qr-desktop.png', evidenceDirectory).pathname,
    fullPage: true
  });

  await page.getByRole('button', { name: 'Вход по паролю' }).click();
  await page.getByLabel('Логин').waitFor();
  await page.screenshot({
    path: new URL('login-password-desktop.png', evidenceDirectory).pathname,
    fullPage: true
  });

  await page.getByLabel('Логин').fill('director.one');
  await page.getByLabel('Пароль', { exact: true }).fill('Secure-Manager-2026!');
  await page.getByText('Показать пароль').click();
  if (await page.getByLabel('Пароль', { exact: true }).getAttribute('type') !== 'text') {
    throw new Error('password visibility control failed');
  }
  await page.getByText('Показать пароль').click();
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('heading', { name: 'Обзор системы' }).waitFor();

  const futureButtons = await page.locator('.nav-item.is-coming button, .nav-item.is-coming a').count();
  if (futureButtons !== 0) {
    throw new Error('future modules must not expose inert controls');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) {
    throw new Error('desktop horizontal overflow: ' + overflow);
  }
  await page.screenshot({
    path: new URL('dashboard-desktop.png', evidenceDirectory).pathname,
    fullPage: true
  });

  await page.getByRole('button', { name: 'SKU' }).click();
  await page.getByRole('heading', { name: 'SKU' }).waitFor();
  await page.getByPlaceholder('Поиск по разделу').fill('SKU-001');
  await page.getByRole('cell', { name: 'SKU-001' }).waitFor();
  await page.screenshot({
    path: new URL('directory-desktop.png', evidenceDirectory).pathname,
    fullPage: true
  });

  await page.getByRole('button', { name: 'Изменить' }).click();
  await page.getByRole('heading', { name: 'Изменить SKU' }).waitFor();
  await page.screenshot({
    path: new URL('editor-desktop.png', evidenceDirectory).pathname,
    fullPage: true
  });
  await page.getByLabel('Тариф, сум').fill('1750.0000');
  await page.getByLabel('Причина изменения').fill('Плановое обновление тарифа');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByText('Данные SKU сохранены').waitFor();
  if (mutationRequests.length !== 1) {
    throw new Error('expected exactly one catalog mutation');
  }
  if (mutationRequests[0].pathname !== '/admin-api/catalog/skus') {
    throw new Error('unexpected catalog mutation endpoint');
  }
  if (mutationRequests[0].headers['x-admin-csrf-token'] !== 'c'.repeat(43)) {
    throw new Error('catalog mutation omitted the CSRF proof');
  }
  if (mutationRequests[0].body.current_sku_tariff_uzs !== '1750.0000') {
    throw new Error('catalog mutation payload mismatch');
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать QR' }).click();
  const qrDownload = await downloadPromise;
  if (qrDownload.suggestedFilename() !== 'sku-1-qr.svg') {
    throw new Error('QR label filename mismatch');
  }
  await page.getByText('QR-ярлык сформирован и скачан').waitFor();
  if (mutationRequests.length !== 2 || mutationRequests[1].pathname !== '/admin-api/catalog/qr-label') {
    throw new Error('QR label request mismatch');
  }
  if (mutationRequests[1].headers['x-admin-csrf-token'] !== 'c'.repeat(43)) {
    throw new Error('QR label request omitted the CSRF proof');
  }
  if (mutationRequests[1].body.resource_kind !== 'SKU' || mutationRequests[1].body.resource_id !== '1') {
    throw new Error('QR label request payload mismatch');
  }

  await page.getByRole('button', { name: 'Перерывы и простои' }).click();
  await page.getByRole('heading', { name: 'Перерывы и простои' }).waitFor();
  for (const groupName of ['Перерыв', 'Операционный простой', 'Критический простой']) {
    await page.locator('.activity-group-heading', { hasText: groupName }).waitFor();
  }
  if (await page.getByText('standard_break', { exact: true }).count() !== 0) {
    throw new Error('technical activity code must not be rendered');
  }
  await page.getByRole('button', { name: 'Переместить «Обед» ниже' }).click();
  await page.getByText('Порядок показа изменен').waitFor();
  const breakNames = await page.locator('.activity-table tbody').first().locator('tr:not(.activity-group-heading) td:first-child').allTextContents();
  if (breakNames.join('|') !== 'Личные нужды|Обед') {
    throw new Error('activity move did not refresh the visible and Mini App-backed order: ' + breakNames.join('|'));
  }
  await page.screenshot({
    path: new URL('activities-desktop.png', evidenceDirectory).pathname,
    fullPage: true
  });
  await page.getByRole('button', { name: 'Добавить вид' }).click();
  await page.getByRole('heading', { name: 'Добавить перерыв или простой' }).waitFor();
  if (await page.getByLabel('Технический код').count() !== 0 || await page.getByLabel('Порядок показа').count() !== 0) {
    throw new Error('internal activity fields must not be exposed in the editor');
  }
  await page.getByText('Новый пункт появится в конце выбранного раздела; положение можно изменить стрелками в списке.').waitFor();
  await page.screenshot({
    path: new URL('activity-editor-desktop.png', evidenceDirectory).pathname,
    fullPage: true
  });
  await page.getByRole('button', { name: 'Отмена' }).click();

  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.getByAltText('QR-код для входа через Telegram').waitFor();

  if (consoleErrors.length > 0) {
    throw new Error('desktop console errors: ' + consoleErrors.join(' | '));
  }
  await context.close();
}

async function verifyMobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const consoleErrors = [];
  let claimCount = 0;
  page.on('console', (message) => {
    if (message.type() === 'error' && !isExpectedUnauthenticatedFetch(message.text())) {
      consoleErrors.push(message.text());
    }
  });

  await page.route('**/admin-api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/admin-api/auth/session') {
      await json(route, 401, {
        error: { code: 'unauthenticated', message: 'Требуется вход' }
      });
      return;
    }
    if (pathname === '/admin-api/auth/telegram-qr/challenge') {
      await json(route, 200, { challenge: qrChallengeFixture() });
      return;
    }
    if (pathname === '/admin-api/auth/telegram-qr/challenge/41/claim') {
      claimCount += 1;
      await json(
        route,
        200,
        claimCount === 1
          ? { status: 'PENDING' }
          : { status: 'AUTHENTICATED', session: { ...sessionFixture, auth_method: 'TELEGRAM_QR' } }
      );
      return;
    }
    if (pathname === '/admin-api/overview') {
      await json(route, 200, { overview: overviewFixture });
      return;
    }
    if (pathname === '/admin-api/directory') {
      await json(route, 200, { directory: directoryFixture });
      return;
    }
    await json(route, 200, { status: 'OK' });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('Отсканируйте QR-код камерой телефона — откроется Telegram').waitFor();
  await page.getByAltText('QR-код для входа через Telegram').waitFor();
  await page.screenshot({
    path: new URL('login-qr-mobile.png', evidenceDirectory).pathname,
    fullPage: true
  });
  await page.getByRole('heading', { name: 'Обзор системы' }).waitFor();
  if (claimCount < 2) {
    throw new Error('mobile QR login did not pass through pending to authenticated state');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) {
    throw new Error('mobile horizontal overflow: ' + overflow);
  }
  await page.getByRole('button', { name: 'Перерывы и простои' }).click();
  await page.getByRole('heading', { name: 'Перерывы и простои' }).waitFor();
  await page.locator('.activity-group-heading', { hasText: 'Перерыв' }).waitFor();
  if (await page.getByText('standard_break', { exact: true }).count() !== 0) {
    throw new Error('mobile activity list exposed a technical code');
  }
  const activityOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (activityOverflow > 1) {
    throw new Error('mobile activity directory horizontal page overflow: ' + activityOverflow);
  }
  await page.screenshot({
    path: new URL('activities-mobile.png', evidenceDirectory).pathname,
    fullPage: true
  });
  await page.getByRole('button', { name: 'Сотрудники' }).click();
  await page.getByRole('heading', { name: 'Сотрудники' }).waitFor();
  await page.locator('tbody').getByText('Иванов Иван Иванович', { exact: true }).waitFor();
  const directoryOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (directoryOverflow > 1) {
    throw new Error('mobile directory horizontal overflow: ' + directoryOverflow);
  }
  await page.screenshot({
    path: new URL('dashboard-mobile.png', evidenceDirectory).pathname,
    fullPage: true
  });
  await page.getByRole('button', { name: 'Изменить' }).click();
  await page.getByRole('heading', { name: 'Изменить сотрудника' }).waitFor();
  const editorOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (editorOverflow > 1) {
    throw new Error('mobile editor horizontal overflow: ' + editorOverflow);
  }
  await page.screenshot({
    path: new URL('editor-mobile.png', evidenceDirectory).pathname,
    fullPage: true
  });
  if (consoleErrors.length > 0) {
    throw new Error('mobile console errors: ' + consoleErrors.join(' | '));
  }
  await context.close();
}

async function json(route, status, body) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });
}

function qrChallengeFixture() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="white"/><path d="M10 10h35v35H10zm65 0h35v35H75zM10 75h35v35H10zm50-15h12v12H60zm20 20h30v30H80z" fill="black"/></svg>';
  return {
    challenge_id: '41',
    expires_at: new Date(Date.now() + 120_000).toISOString(),
    poll_after_ms: 750,
    qr_image_src: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
  };
}

function isExpectedUnauthenticatedFetch(message) {
  return message.includes('401') && message.includes('Unauthorized');
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The bounded polling loop waits only for the local Vite listener.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Vite server did not start: ' + serverOutput);
}

const sessionFixture = {
  session_id: '11',
  employee_id: '7',
  full_name: 'Иванов Иван Иванович',
  role_name: 'Директор',
  auth_method: 'PASSWORD',
  must_change_password: false,
  created_at: '2026-08-29T12:00:00.000Z',
  last_seen_at: '2026-08-29T12:15:00.000Z',
  idle_expires_at: '2026-08-29T12:45:00.000Z',
  expires_at: '2026-08-29T20:00:00.000Z'
};

const overviewFixture = {
  counts: {
    employees: 5,
    machines: 14,
    skus: 162,
    active_sessions: 1
  },
  attention: [
    { code: 'BROKEN_MACHINES', count: 1 },
    { code: 'SKU_PRODUCTIVITY_MISSING', count: 162 },
    { code: 'ADDITIONAL_WORK_OPEN', count: 4 }
  ],
  recent_actions: [
    {
      audit_event_id: '23',
      action_name: 'admin_session_started',
      entity_table_name: 'admin_sessions',
      entity_record_id: '11',
      actor_full_name: 'Иванов Иван Иванович',
      created_at: '2026-08-29T12:15:00.000Z'
    },
    {
      audit_event_id: '22',
      action_name: 'rotate_sku_qr_token',
      entity_table_name: 'skus',
      entity_record_id: '162',
      actor_full_name: 'Петров Петр Петрович',
      created_at: '2026-08-29T11:48:00.000Z'
    },
    {
      audit_event_id: '21',
      action_name: 'change_employee_status',
      entity_table_name: 'employees',
      entity_record_id: '5',
      actor_full_name: 'Иванов Иван Иванович',
      created_at: '2026-08-29T10:30:00.000Z'
    }
  ]
};

const directoryFixture = {
  employees: [{
    employee_id: '7',
    full_name: 'Иванов Иван Иванович',
    phone_e164: '+998901234567',
    position_id: '3',
    position_name: 'Директор',
    employee_status_id: '1',
    employee_status_name: 'Работает',
    is_active_for_login: true,
    telegram_is_bound: true,
    role_names: ['Директор']
  }],
  positions: [{
    position_id: '3',
    position_name: 'Директор',
    position_description: null,
    is_production_position: false,
    is_active: true,
    employee_count: 1
  }],
  employee_statuses: [{
    employee_status_id: '1',
    employee_status_name: 'Работает',
    is_active_for_login: true,
    is_final: false,
    is_active: true
  }],
  machines: [{
    machine_id: '1',
    machine_name: 'Фрезерный станок №1',
    workshop_name: 'Основной цех',
    machine_status_id: '1',
    machine_status_name: 'Свободен',
    machine_use_status_id: '1',
    machine_use_status_name: 'В эксплуатации',
    machine_use_is_decommissioned: false,
    qr_is_assigned: true
  }],
  machine_use_statuses: [{
    machine_use_status_id: '1',
    machine_use_status_name: 'В эксплуатации',
    is_decommissioned: false,
    is_active: true
  }],
  skus: [{
    sku_id: '1',
    sku_code: 'SKU-001',
    sku_name: 'Тестовое изделие',
    sku_unit_id: '1',
    sku_unit_name: 'шт.',
    planned_productivity_per_hour: '12.000',
    current_sku_tariff_uzs: '1500.0000',
    is_active: true,
    qr_is_assigned: true
  }],
  sku_units: [{
    sku_unit_id: '1',
    sku_unit_name: 'шт.',
    allows_fractional_quantity: false,
    is_active: true
  }],
  additional_work_types: [{
    additional_work_type_id: '1',
    additional_work_type_name: 'Уборка рабочего места',
    is_active: true
  }],
  activity_profiles: [
    {
      activity_class: 'BREAK',
      profile_id: '1',
      technical_code: 'standard_break',
      profile_name: 'Стандартный перерыв',
      is_active: true
    },
    {
      activity_class: 'OPERATIONAL',
      profile_id: '2',
      technical_code: 'standard_operational',
      profile_name: 'Операционный простой',
      is_active: true
    },
    {
      activity_class: 'CRITICAL',
      profile_id: '3',
      technical_code: 'standard_critical',
      profile_name: 'Критическая неисправность',
      is_active: true
    }
  ],
  activity_types: [
    {
      activity_class: 'BREAK',
      activity_type_id: '1',
      technical_code: 'lunch',
      display_name: 'Обед',
      display_order: 10,
      profile_id: '1',
      profile_name: 'Стандартный перерыв',
      is_active: true
    },
    {
      activity_class: 'BREAK',
      activity_type_id: '2',
      technical_code: 'personal_needs',
      display_name: 'Личные нужды',
      display_order: 20,
      profile_id: '1',
      profile_name: 'Стандартный перерыв',
      is_active: true
    },
    {
      activity_class: 'OPERATIONAL',
      activity_type_id: '3',
      technical_code: 'material_wait',
      display_name: 'Ожидание материала',
      display_order: 10,
      profile_id: '2',
      profile_name: 'Операционный простой',
      is_active: true
    },
    {
      activity_class: 'CRITICAL',
      activity_type_id: '4',
      technical_code: 'repair_required',
      display_name: 'Требуется ремонт',
      display_order: 10,
      profile_id: '3',
      profile_name: 'Критическая неисправность',
      is_active: true
    }
  ],
  audit_events: overviewFixture.recent_actions.map((event) => ({ ...event, reason: null }))
};

function moveActivityFixture(input) {
  const activeRows = directoryFixture.activity_types
    .filter((row) => row.activity_class === input.activity_class && row.is_active)
    .sort((left, right) => left.display_order - right.display_order || Number(left.activity_type_id) - Number(right.activity_type_id));
  const index = activeRows.findIndex((row) => row.activity_type_id === input.activity_type_id);
  const targetIndex = index + (input.direction === 'UP' ? -1 : 1);
  if (index < 0 || targetIndex < 0 || targetIndex >= activeRows.length) return;
  [activeRows[index], activeRows[targetIndex]] = [activeRows[targetIndex], activeRows[index]];
  activeRows.forEach((row, position) => { row.display_order = (position + 1) * 10; });
}

await run();
console.log('ADMIN_BROWSER_VERIFY_PASS');
console.log('desktop=1440x900');
console.log('mobile=390x844');
