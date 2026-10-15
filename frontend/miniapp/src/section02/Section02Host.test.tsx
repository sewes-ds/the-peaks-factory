import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiClientError, type ApiRequestOptions } from '../foundation/apiClient';
import { createPlatformFontReadinessController, type PlatformFontReadinessController } from '../foundation/fontReadiness';
import { SECTION02_FIXTURE_CONTEXTS, createSection02FixtureApiClient, type Section02FixtureRequest } from './__fixtures__/section02Fixtures';
import { SECTION02_FAMILIES, SECTION02_NODE_IDS, type Section02NodeId } from './ids';
import { Section02Host } from './Section02Host';
import { resolveSection02InitialNode } from './program';
import { SECTION02_ADDITIONAL_WORK_START_RACE_MESSAGE } from './runtimeBinding';
import { decodeOperatorWorkplaceState } from './contracts';
import type { TelegramQrScanner } from '../foundation/telegramQr';

const roots: Root[] = [];
const containers: HTMLElement[] = [];
const controllers: PlatformFontReadinessController[] = [];

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  roots.splice(0).forEach((root) => root.unmount());
  containers.splice(0).forEach((container) => container.remove());
  controllers.splice(0).forEach((controller) => controller.dispose());
});

function readiness(): PlatformFontReadinessController {
  const controller = createPlatformFontReadinessController({
    environment: Object.freeze({
      clearTimer: (handle) => globalThis.clearTimeout(handle), isVisible: () => true, loadAttempt: async () => undefined,
      now: () => Date.now(), preloadSource: () => undefined, setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
      subscribeVisibility: () => () => undefined,
    }),
    resource: Object.freeze({
      family: 'Test', requiredFaces: Object.freeze([Object.freeze({ style: 'normal' as const, weight: 400 })]),
      resourceId: 'SECTION02_TEST_FONT', sources: Object.freeze([Object.freeze({ style: 'normal' as const, unicodeRange: 'U+0000-00FF', url: '/test.woff2', weightRange: '400' })]), specimen: 'Test',
    }),
  });
  controllers.push(controller);
  return controller;
}

function renderNode(nodeId: Section02NodeId, requests: Section02FixtureRequest[] = []) {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(<Section02Host apiClient={createSection02FixtureApiClient(nodeId, requests)} initialNodeId={nodeId} initialContext={SECTION02_FIXTURE_CONTEXTS[nodeId]} fontReadinessController={readiness()} />));
  return container;
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function control(container: HTMLElement, label: string): HTMLButtonElement {
  const exact = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(label));
  if (!(exact instanceof HTMLButtonElement)) throw new Error(`Rendered control not found: ${label}`);
  return exact;
}

const SANITIZED_OWNER_WORKPLACE_STATE = {
  actor_employee_id: '1',
  actor_full_name: 'Иванов Иван Иванович',
  shift: { is_active: true, employee_shift_id: '1', started_at: '2026-08-14T08:00:00.000Z' },
  production: {
    is_active: false, production_operation_id: null, machine_id: null, machine_name: null,
    sku_id: null, sku_code: null, sku_name: null, can_finish_production: false,
  },
  break: {
    is_active: false, operator_break_id: null, break_type_id: null, break_type_name: null, can_finish_break: false,
  },
  downtime: {
    slot_state: 'NONE', downtime_id: null, downtime_type_name: null, downtime_class: null,
    ui_color_token: null, can_start_downtime: true, can_finish_downtime: false,
  },
  additional_work_summary: { has_active_additional_work: false, active_additional_work_id: null, active_additional_work_name: null },
  additional_work_start: { blockers: [] },
  salary: { can_view_salary: true },
  finish_shift: {
    can_finish_now: true, blockers: [],
    warnings: ['APPROVED_ADDITIONAL_WORKS_NOT_STARTED'],
    next_required_pipeline: 'CONFIRM_FINISH_SHIFT_WITH_WARNING',
  },
  available_pipelines: [
    'FINISH_SHIFT', 'VIEW_SALARY', 'OPEN_ADDITIONAL_WORK', 'REQUEST_ADDITIONAL_WORK',
    'START_PRODUCTION', 'START_DOWNTIME', 'START_BREAK', 'START_ADDITIONAL_WORK',
  ],
};

describe('Section 02 rendered controls', () => {
  it('renders the sanitized production-equivalent owner state without a blank root', async () => {
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    const apiClient = createSection02FixtureApiClient('S02-N02');
    const originalRequest = apiClient.request.bind(apiClient);
    apiClient.request = <TResponse,>(path: string, init?: ApiRequestOptions) => path === '/operator/workplace-state'
      ? Promise.resolve(SANITIZED_OWNER_WORKPLACE_STATE as TResponse)
      : originalRequest<TResponse>(path, init);
    act(() => root.render(<Section02Host
      apiClient={apiClient}
      initialNodeId="S02-N02"
      fontReadinessController={readiness()}
    />));
    await flush();
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N02');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Начать производство',
      'Начать перерыв',
      'Начать простой',
      'Допработа',
      'Завершить смену',
      'Зарплата',
    ]);
    expect([...container.querySelectorAll('button')].map((button) => button.dataset.controlKey)).toEqual([
      'navigation-next',
      'navigation-open',
      'navigation-open',
      'action-neutral',
      'action-positive',
      'navigation-back',
    ]);
    expect(container.querySelector('.peaks-presentation-screen-template__title')).toBeNull();
    expect(container.querySelector('.peaks-presentation-card')?.textContent).toContain('ОператорИванов И.И.');
    expect(container.querySelector('.peaks-presentation-card')?.getAttribute('data-state-key')).toBe('state-info');
    expect(container.querySelector('.peaks-presentation-screen-template__fixed-bottom')).toBeNull();
    expect(container.querySelector('.peaks-presentation-screen-template__scroll')?.textContent)
      .not.toContain('Смена активна');
  });

  it.each([
    ['no-open-shift', {
      ...SANITIZED_OWNER_WORKPLACE_STATE,
      shift: { is_active: false, employee_shift_id: null, started_at: null },
      finish_shift: { can_finish_now: false, blockers: ['NO_OPEN_SHIFT'], warnings: [], next_required_pipeline: 'CONFIRM_FINISH_SHIFT' },
    }, 'S02-N01'],
    ['open-shift-idle', SANITIZED_OWNER_WORKPLACE_STATE, 'S02-N02'],
    ['active-production', {
      ...SANITIZED_OWNER_WORKPLACE_STATE,
      production: {
        is_active: true, production_operation_id: '1', machine_id: '1', machine_name: 'Станок',
        sku_id: '1', sku_code: 'SKU', sku_name: 'Деталь', can_finish_production: true,
      },
    }, 'S02-N02'],
    ['active-break', {
      ...SANITIZED_OWNER_WORKPLACE_STATE,
      break: { is_active: true, operator_break_id: '1', break_type_id: '1', break_type_name: 'Перерыв', can_finish_break: true },
    }, 'S02-N02'],
    ['approved-additional-work-available', {
      ...SANITIZED_OWNER_WORKPLACE_STATE,
      finish_shift: {
        ...SANITIZED_OWNER_WORKPLACE_STATE.finish_shift,
        warnings: ['APPROVED_ADDITIONAL_WORKS_NOT_STARTED'],
      },
    }, 'S02-N02'],
    ['active-additional-work', {
      ...SANITIZED_OWNER_WORKPLACE_STATE,
      additional_work_summary: { has_active_additional_work: true, active_additional_work_id: '1', active_additional_work_name: 'Инвентаризация' },
      finish_shift: {
        can_finish_now: false, blockers: ['ACTIVE_ADDITIONAL_WORK'], warnings: [], next_required_pipeline: 'FINISH_ADDITIONAL_WORK',
      },
    }, 'S02-N02'],
  ] as const)('renders representative production-equivalent state %s', async (_name, workplace, expectedNode) => {
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    let reads = 0;
    const apiClient = createSection02FixtureApiClient(expectedNode);
    const originalRequest = apiClient.request.bind(apiClient);
    apiClient.request = <TResponse,>(path: string, init?: ApiRequestOptions) => {
      if (path === '/operator/workplace-state') {
        reads += 1;
        return Promise.resolve(workplace as TResponse);
      }
      return originalRequest<TResponse>(path, init);
    };
    act(() => root.render(<Section02Host
      apiClient={apiClient}
      initialNodeId={resolveSection02InitialNode(decodeOperatorWorkplaceState(workplace))}
      fontReadinessController={readiness()}
    />));
    await flush();
    expect(reads).toBe(1);
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe(expectedNode);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
    if (_name === 'active-break') {
      expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toContain('Начать производство');
    }
  });

  it('turns a decoder failure into a visible bounded shell and retries through the same mounted host', async () => {
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    let reads = 0;
    const apiClient = createSection02FixtureApiClient('S02-N02');
    const originalRequest = apiClient.request.bind(apiClient);
    apiClient.request = <TResponse,>(path: string, init?: ApiRequestOptions) => {
      if (path !== '/operator/workplace-state') return originalRequest<TResponse>(path, init);
      reads += 1;
      return Promise.resolve((reads === 1 ? { shift: null } : SANITIZED_OWNER_WORKPLACE_STATE) as TResponse);
    };
    act(() => root.render(<Section02Host
      apiClient={apiClient}
      initialNodeId="S02-N02"
      fontReadinessController={readiness()}
    />));
    await flush();
    expect(container.querySelector('main')?.getAttribute('data-feedback-shell')).toBe('section02');
    expect(container.querySelector('main')?.hasAttribute('data-node-id')).toBe(false);
    expect(container.textContent).toContain('Не удалось открыть раздел. Повторите попытку.');
    expect(container.textContent).not.toContain('workplace-state');
    expect(container.querySelector('main')?.getAttribute('data-diagnostic-code')).toBe('S02_RENDER_FAILURE');
    await act(async () => {
      control(container, 'Повторить').click();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(reads).toBe(2);
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N02');
    expect(container.textContent).toContain('Начать производство');
    expect(container.textContent).not.toContain('Смена активна');
  });

  it.each(Object.entries(SECTION02_FAMILIES))('%s renders actual controls for every family node', async (_family, nodes) => {
    for (const nodeId of nodes) {
      const container = renderNode(nodeId);
      await flush();
      expect(container.querySelector('main')?.getAttribute('data-node-id'), nodeId).toBe(nodeId);
      expect(container.querySelectorAll('button, input, textarea').length, nodeId).toBeGreaterThan(0);
      expect(container.querySelector('[data-state-key], [data-control-key]'), nodeId).not.toBeNull();
    }
  });

  it('renders exactly one canonical main root per node and no legacy renderer root', async () => {
    for (const nodeId of SECTION02_NODE_IDS) {
      const container = renderNode(nodeId);
      await flush();
      expect(container.querySelectorAll(`main[data-node-id="${nodeId}"]`)).toHaveLength(1);
      expect(container.querySelector('.peaks-graph-node')).toBeNull();
    }
  });

  it('machine-audits slot ownership for all canonical nodes', async () => {
    expect(SECTION02_NODE_IDS).toHaveLength(26);
    for (const nodeId of SECTION02_NODE_IDS) {
      const container = renderNode(nodeId);
      await flush();
      const template = container.querySelector('.peaks-presentation-screen-template');
      const scroll = container.querySelector('[data-presentation-scroll-slot]');
      expect(template, nodeId).not.toBeNull();
      expect(scroll, nodeId).not.toBeNull();
      expect(container.querySelectorAll('[data-presentation-scroll-slot]'), nodeId).toHaveLength(1);
      expect(scroll?.contains(container.querySelector('.peaks-section02-header')!), nodeId).toBe(false);
      expect(scroll?.contains(container.querySelector('.peaks-presentation-screen-template__fixed-bottom')!), nodeId).toBe(false);
      for (const item of container.querySelectorAll('.peaks-presentation-template-item')) {
        const ownedSlots = [
          '.peaks-presentation-screen-template__fixed-top',
          '.peaks-presentation-screen-template__scroll',
          '.peaks-presentation-screen-template__fixed-bottom',
        ].filter((selector) => item.closest(selector) !== null);
        expect(ownedSlots, `${nodeId}:${item.textContent}`).toHaveLength(1);
      }
    }
  });

  it.each([
    ['S02-N01', 'Начать смену', '/shifts/start'],
    ['S02-N05', 'SKU-021', '/production-operations/start'],
    ['S02-N08', 'Завершить производство', '/production-operations/31/finish'],
    ['S02-B01', 'Обеденный перерыв', '/operator-breaks/start'],
    ['S02-B03', 'Завершить перерыв', '/operator-breaks/finish'],
    ['S02-N09', 'Наладка оборудования', '/machine-downtimes/start'],
    ['S02-N27', 'Начать:', '/machine-downtimes/start'],
    ['S02-N10', 'Завершить:', '/machine-downtimes/51/finish'],
    ['S02-AW02', 'Запросить:', '/additional-works/request'],
    ['S02-AW03', 'Начать:', '/additional-works/72/start'],
    ['S02-AW04', 'Завершить:', '/additional-works/71/finish'],
    ['S02-FS01', 'Завершить смену', '/shifts/finish'],
  ] as const)('%s executes $2 only through its rendered control', async (nodeId, label, expectedPath) => {
    const requests: Section02FixtureRequest[] = [];
    const context = nodeId === 'S02-AW03'
      ? { ...SECTION02_FIXTURE_CONTEXTS[nodeId], additional_work_id: '72', additional_work_type_id: '82', additional_work_name: 'Помощь упаковке' }
      : SECTION02_FIXTURE_CONTEXTS[nodeId];
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    act(() => root.render(<Section02Host apiClient={createSection02FixtureApiClient(nodeId, requests)} initialNodeId={nodeId} initialContext={context} fontReadinessController={readiness()} />));
    await flush();
    await act(async () => { control(container, label).click(); await Promise.resolve(); await Promise.resolve(); });
    expect(requests.some((request) => request.method === 'POST' && request.path === expectedPath)).toBe(true);
  });

  it('resolves a scanned machine through the fixed POST path and requires confirmation', async () => {
    const requests: Section02FixtureRequest[] = [];
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    const qrPayload = `peaks-machine:v1:${'A'.repeat(32)}`;
    const scanner: TelegramQrScanner = { scan: async () => ({ status: 'scanned', text: qrPayload }) };
    act(() => root.render(<Section02Host
      apiClient={createSection02FixtureApiClient('S02-N03', requests)}
      initialNodeId="S02-N03"
      initialContext={SECTION02_FIXTURE_CONTEXTS['S02-N03']}
      fontReadinessController={readiness()}
      qrScanner={scanner}
    />));
    await flush();
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Сканировать QR станка',
      'Выбрать станок из списка',
      'Назад',
    ]);

    await act(async () => { control(container, 'Сканировать QR станка').click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-QR01');
    expect(container.textContent).toContain('Проверьте станок и подтвердите выбор.');
    expect(container.textContent).toContain('Станок продольной резки с длинным наименованием');
    expect(control(container, 'Выбрать станок').disabled).toBe(false);
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Выбрать станок',
      'Назад',
    ]);
    expect(requests).toContainEqual({
      method: 'POST',
      path: '/operator/machines/resolve-qr',
      body: { qr_payload: qrPayload },
    });
    expect(requests.some((request) => request.path.includes(qrPayload))).toBe(false);

    await act(async () => { control(container, 'Выбрать станок').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-SKU01');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Сканировать QR SKU',
      'Выбрать SKU из списка',
      'Назад',
    ]);
    await act(async () => { control(container, 'Выбрать SKU из списка').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N05');
    expect(container.textContent).toContain('SKU-021');
  });

  it('resolves a scanned SKU through the fixed POST path and starts production only after confirmation', async () => {
    const requests: Section02FixtureRequest[] = [];
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    const qrPayload = `peaks-sku:v1:${'S'.repeat(32)}`;
    act(() => root.render(<Section02Host
      apiClient={createSection02FixtureApiClient('S02-SKU01', requests)}
      initialNodeId="S02-SKU01"
      initialContext={SECTION02_FIXTURE_CONTEXTS['S02-SKU01']}
      fontReadinessController={readiness()}
      qrScanner={{ scan: async () => ({ status: 'scanned', text: qrPayload }) }}
    />));
    await flush();

    await act(async () => { control(container, 'Сканировать QR SKU').click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-SKUQR01');
    expect(container.textContent).toContain('SKU-021');
    expect(container.textContent).toContain('Деталь производственная контрольная');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Выбрать SKU', 'Назад']);
    expect(requests).toContainEqual({ method: 'POST', path: '/operator/skus/resolve-qr', body: { qr_payload: qrPayload } });
    expect(requests.some((request) => request.path.includes(qrPayload))).toBe(false);
    expect(requests.some((request) => request.path === '/production-operations/start')).toBe(false);

    await act(async () => { control(container, 'Выбрать SKU').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(requests).toContainEqual({
      method: 'POST',
      path: '/production-operations/start',
      body: { machine_id: '11', sku_id: '21' },
    });
  });

  it('shows the accepted inactive SKU reason and disables confirmation', async () => {
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    act(() => root.render(<Section02Host
      apiClient={createSection02FixtureApiClient('S02-SKU01', [], { skuQrResponse: {
        found: true,
        sku: {
          sku_id: '22', sku_code: 'SKU-022', sku_name: 'Неактивный SKU', sku_unit_name: 'шт.',
          current_sku_tariff_uzs: 0, is_active: false, is_selectable_for_production: false,
          production_unavailability: { code: 'SKU_INACTIVE' },
        },
      } })}
      initialNodeId="S02-SKU01"
      initialContext={SECTION02_FIXTURE_CONTEXTS['S02-SKU01']}
      fontReadinessController={readiness()}
      qrScanner={{ scan: async () => ({ status: 'scanned', text: `peaks-sku:v1:${'I'.repeat(32)}` }) }}
    />));
    await flush();
    await act(async () => { control(container, 'Сканировать QR SKU').click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('SKU недоступен для производства. Обратитесь к начальнику производства.');
    expect(control(container, 'Выбрать SKU').disabled).toBe(true);
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Выбрать SKU', 'Назад']);
  });

  it('routes SKU list and method Back through the visited machine QR history', async () => {
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    act(() => root.render(<Section02Host
      apiClient={createSection02FixtureApiClient('S02-N03')}
      initialNodeId="S02-N03"
      initialContext={SECTION02_FIXTURE_CONTEXTS['S02-N03']}
      fontReadinessController={readiness()}
      qrScanner={{ scan: async () => ({ status: 'scanned', text: `peaks-machine:v1:${'H'.repeat(32)}` }) }}
    />));
    await flush();
    await act(async () => { control(container, 'Сканировать QR станка').click(); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { control(container, 'Выбрать станок').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.dataset.nodeId).toBe('S02-SKU01');
    await act(async () => { control(container, 'Выбрать SKU из списка').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.dataset.nodeId).toBe('S02-N05');
    await act(async () => { control(container, 'Назад').click(); await Promise.resolve(); });
    expect(container.querySelector('main')?.dataset.nodeId).toBe('S02-SKU01');
    await act(async () => { control(container, 'Назад').click(); await Promise.resolve(); });
    expect(container.querySelector('main')?.dataset.nodeId).toBe('S02-QR01');
    expect(container.textContent).toContain('Станок продольной резки с длинным наименованием');
  });

  it.each([
    ['занят', {
      code: 'OCCUPIED_BY_OPERATOR', operator_full_name: 'Петров Пётр Сергеевич',
    }, 'На станке уже работает:\nПетров П.С.'],
    ['неисправен', { code: 'MACHINE_BROKEN' }, 'Станок неисправен. Обратитесь к начальнику производства.'],
  ] as const)('shows the accepted reason when a scanned machine is %s', async (_name, productionUnavailability, expectedMessage) => {
    const requests: Section02FixtureRequest[] = [];
    const apiClient = createSection02FixtureApiClient('S02-N03', requests, {
      machineQrResponse: {
        found: true,
        machine: {
          machine_id: '12', machine_name: '180 автомат', workshop_name: null,
          machine_status: productionUnavailability.code === 'MACHINE_BROKEN' ? 'Неисправен' : 'Работает',
          machine_use_status: 'Используется', is_selectable_for_production: false,
          is_selectable_for_critical_downtime: false,
          ui_status_token: productionUnavailability.code === 'MACHINE_BROKEN' ? 'critical' : 'busy',
          production_unavailability: productionUnavailability,
        },
      },
    });
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    act(() => root.render(<Section02Host
      apiClient={apiClient}
      initialNodeId="S02-N03"
      fontReadinessController={readiness()}
      qrScanner={{ scan: async () => ({ status: 'scanned', text: `peaks-machine:v1:${'B'.repeat(32)}` }) }}
    />));
    await flush();

    await act(async () => { control(container, 'Сканировать QR станка').click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain(expectedMessage);
    expect(control(container, 'Выбрать станок').disabled).toBe(true);
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Выбрать станок',
      'Назад',
    ]);
    expect(container.querySelector('[data-presentation-feedback-slot] [role="alert"]')).toBeNull();
  });

  it('shows only selection and Back after cancellation, then returns to machine-choice actions', async () => {
    const scanner: TelegramQrScanner = { scan: async () => ({ status: 'cancelled' }) };
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    act(() => root.render(<Section02Host
      apiClient={createSection02FixtureApiClient('S02-N03')}
      initialNodeId="S02-N03"
      fontReadinessController={readiness()}
      qrScanner={scanner}
    />));
    await flush();

    await act(async () => { control(container, 'Сканировать QR станка').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('Сканирование отменено.');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Выбрать станок',
      'Назад',
    ]);
    expect(control(container, 'Выбрать станок').disabled).toBe(true);
    await act(async () => { control(container, 'Назад').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N03');
    expect([...container.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      'Сканировать QR станка',
      'Выбрать станок из списка',
      'Назад',
    ]);
  });

  it('renders a critical machine red while keeping it unavailable for production selection', async () => {
    const requests: Section02FixtureRequest[] = [];
    const container = renderNode('S02-N04', requests);
    await flush();
    const normal = control(container, 'Станок продольной резки');
    const critical = control(container, '180 автомат');

    expect(normal.disabled).toBe(false);
    expect(normal.dataset.stateKey).toBe('state-info');
    expect(critical.disabled).toBe(true);
    expect(critical.dataset.stateKey).toBe('state-danger');

    await act(async () => { critical.click(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N04');
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('renders the additional-work finish-shift warning in gray and finishes directly at shift start', async () => {
    const requests: Section02FixtureRequest[] = [];
    const apiClient = createSection02FixtureApiClient('S02-FS01', requests);
    const originalRequest = apiClient.request.bind(apiClient);
    apiClient.request = <TResponse,>(path: string, init?: ApiRequestOptions) => path === '/operator/workplace-state'
      ? Promise.resolve({
          ...SANITIZED_OWNER_WORKPLACE_STATE,
          finish_shift: {
            can_finish_now: true,
            blockers: [],
            warnings: ['APPROVED_ADDITIONAL_WORKS_NOT_STARTED'],
            next_required_pipeline: 'CONFIRM_FINISH_SHIFT_WITH_WARNING',
          },
        } as TResponse)
      : originalRequest<TResponse>(path, init);
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    act(() => root.render(<Section02Host apiClient={apiClient} initialNodeId="S02-FS01" fontReadinessController={readiness()} />));
    await flush();

    const warning = [...container.querySelectorAll('[data-state-key]')]
      .find((item) => item.textContent?.includes('Есть согласованные допработы'));
    expect(warning?.getAttribute('data-state-key')).toBe('state-neutral');
    expect(control(container, 'Перейти к допработам').dataset.controlKey).toBe('action-neutral');

    await act(async () => {
      control(container, 'Завершить смену').click();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N01');
    expect(container.textContent).toContain('Начать смену');
    expect(container.textContent).not.toContain('Информация об окончании смены сохранена');
  });

  it('routes Back through the actual visited graph history', async () => {
    const container = renderNode('S02-N02');
    await flush();
    await act(async () => { control(container, 'Начать производство').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N03');
    await act(async () => { control(container, 'Сканировать QR').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-QR01');
    await act(async () => { control(container, 'Назад').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N03');
    await act(async () => { control(container, 'Выбрать станок').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N04');
    await act(async () => { control(container, 'Назад').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N03');
    await act(async () => { control(container, 'Назад').click(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-N02');
  });

  it('shows stable start-race feedback, refreshes authority and does not show success', async () => {
    const nodeId = 'S02-AW03';
    const requests: Section02FixtureRequest[] = [];
    const context = {
      ...SECTION02_FIXTURE_CONTEXTS[nodeId],
      additional_work_id: '72', additional_work_type_id: '82', additional_work_name: 'Помощь упаковке',
    };
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    act(() => root.render(<Section02Host
      apiClient={createSection02FixtureApiClient(nodeId, requests, { failMutation: true })}
      initialNodeId={nodeId}
      initialContext={context}
      fontReadinessController={readiness()}
    />));
    await flush();
    const readsBefore = requests.filter((request) => request.method === 'GET').length;
    await act(async () => { control(container, 'Начать:').click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    expect(requests.filter((request) => request.method === 'GET').length).toBeGreaterThan(readsBefore);
    expect(container.textContent).toContain(SECTION02_ADDITIONAL_WORK_START_RACE_MESSAGE);
    expect(container.querySelector('[data-presentation-feedback-slot] [role="alert"]')).not.toBeNull();
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe(nodeId);
    expect(container.textContent).not.toContain('Дополнительная работа завершена');
  });

  it('silently refreshes the available list when a request type was concurrently requested', async () => {
    const requests: Section02FixtureRequest[] = [];
    const apiClient = createSection02FixtureApiClient('S02-AW02', requests);
    const originalRequest = apiClient.request.bind(apiClient);
    let typeReads = 0;
    apiClient.request = async <TResponse,>(path: string, options?: ApiRequestOptions) => {
      if (path === '/operator/additional-work-types/available') {
        typeReads += 1;
        requests.push(Object.freeze({ method: 'GET', path, body: null }));
        return {
          additional_work_types: typeReads === 1
            ? [
                { additional_work_type_id: '81', display_name: 'Инвентаризация материалов' },
                { additional_work_type_id: '82', display_name: 'Помощь упаковке' },
              ]
            : [{ additional_work_type_id: '82', display_name: 'Помощь упаковке' }],
        } as TResponse;
      }
      if (path === '/additional-works/request' && options?.method === 'POST') {
        requests.push(Object.freeze({ method: 'POST', path, body: options.body ?? null }));
        throw new ApiClientError('Backend request failed', 409, {
          error: { code: 'conflict', message: 'Operation violates current business state' },
        });
      }
      return originalRequest<TResponse>(path, options);
    };
    const container = document.createElement('div');
    document.body.append(container); containers.push(container);
    const root = createRoot(container); roots.push(root);
    act(() => root.render(<Section02Host
      apiClient={apiClient}
      initialNodeId="S02-AW02"
      initialContext={SECTION02_FIXTURE_CONTEXTS['S02-AW02']}
      fontReadinessController={readiness()}
    />));
    await flush();

    await act(async () => {
      control(container, 'Запросить:').click();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });

    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    expect(typeReads).toBe(2);
    expect(container.querySelector('main')?.getAttribute('data-node-id')).toBe('S02-AW01');
    expect(container.textContent).not.toContain('Инвентаризация материалов');
    expect(container.textContent).toContain('Помощь упаковке');
    expect(container.textContent).not.toContain('Operation violates current business state');
    expect(container.querySelector('[data-presentation-feedback-slot] [role="alert"]')).toBeNull();
  });
});
