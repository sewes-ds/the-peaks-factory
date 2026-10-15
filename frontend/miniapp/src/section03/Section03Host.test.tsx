import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiClientError } from '../foundation/apiClient';
import {
  createPlatformFontReadinessController,
  type PlatformFontReadinessController,
  type PlatformFontReadinessEnvironment,
} from '../foundation/fontReadiness';
import {
  SECTION03_AUDIT_REASON,
} from './program';
import {
  Section03Host,
  section03InteractionErrorText,
} from './Section03Host';

const roots: Root[] = [];
const containers: HTMLElement[] = [];
const fontControllers: PlatformFontReadinessController[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) root.unmount();
  for (const container of containers.splice(0)) container.remove();
  for (const controller of fontControllers.splice(0)) controller.dispose();
  vi.restoreAllMocks();
});

function machine(overrides: Record<string, unknown> = {}) {
  return {
    machine_id: 'M-1',
    machine_name: 'Станок 1',
    ui_state: 'running',
    ui_variant: 'green',
    active_production_operation_id: 'P-1',
    active_employee_id: 'E-1',
    active_employee_full_name: 'Operator One',
    active_sku_id: 'SKU-1',
    active_sku_code: 'SKU',
    active_sku_name: 'Part',
    active_break_id: null,
    active_break_name: null,
    active_downtime_id: 'D-1',
    downtime_type: 'operational',
    downtime_name: 'Наладка',
    downtime_comment: null,
    downtime_start_comment: null,
    downtime_finish_comment: null,
    downtime_started_at: '2026-07-31 10:20:30+05',
    downtime_duration: '5 мин',
    has_active_critical_downtime: false,
    has_active_operational_downtime: true,
    active_operational_downtime_id: 'D-1',
    is_selectable_for_manager_critical_downtime: true,
    available_actions: ['OPEN_MACHINE_CARD', 'FINISH_DOWNTIME'],
    ...overrides,
  };
}

function workplace() {
  return {
    section: 'S03',
    screen: 'S03-N01',
    manager: { employee_id: 'E-9', full_name: 'Manager One' },
    sections: {
      machines: { title: 'Станки', running_count: 1, downtime_count: 1, idle_count: 0, downtime_severity: 'operational', ui_variant: 'light_blue', available_actions: ['OPEN_MACHINES'] },
      employees: { title: 'Сотрудники', open_shift_count: 1, production_count: 1, downtime_count: 0, additional_work_count: 0, break_count: 0, without_work_count: 0, production_downtime_severity: 'none', ui_variant: 'light_blue', available_actions: ['OPEN_EMPLOYEES'] },
      downtimes: { title: 'Простои', critical_count: 0, operational_count: 1, ui_variant: 'light_blue', available_actions: ['OPEN_DOWNTIMES'] },
      additional_works: { title: 'Доп. работы', requested_count: 0, approved_count: 0, active_count: 0, requires_accrual_count: 0, ui_variant: 'grey', available_actions: ['OPEN_ADDITIONAL_WORKS'] },
      corrections: { title: 'Корректировки', ui_variant: 'light_blue', available_actions: ['OPEN_CORRECTIONS'] },
      notifications: { title: 'Уведомления', open_tasks_count: 0, ui_variant: 'light_blue', available_actions: ['OPEN_NOTIFICATIONS'] },
      reports: { title: 'Отчёты', ui_variant: 'light_blue', is_placeholder: true, available_actions: [] },
    },
  };
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function deferredVoid() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

function fontController(
  loadAttempt: PlatformFontReadinessEnvironment['loadAttempt'] =
    async () => undefined,
): PlatformFontReadinessController {
  const controller = createPlatformFontReadinessController({
    environment: Object.freeze({
      clearTimer: (handle) => globalThis.clearTimeout(handle),
      isVisible: () => true,
      loadAttempt,
      now: () => Date.now(),
      preloadSource: () => undefined,
      setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
      subscribeVisibility: () => () => undefined,
    }),
    resource: Object.freeze({
      family: 'Test Font',
      requiredFaces: Object.freeze([
        Object.freeze({ style: 'normal' as const, weight: 400 }),
      ]),
      resourceId: 'TEST_FONT',
      sources: Object.freeze([
        Object.freeze({
          style: 'normal' as const,
          unicodeRange: 'U+0000-00FF',
          url: '/test.woff2',
          weightRange: '400',
        }),
      ]),
      specimen: 'Test',
    }),
  });
  fontControllers.push(controller);
  return controller;
}

function renderHost(
  fetchImpl: typeof fetch,
  readiness = fontController(),
) {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  const apiClient = new ApiClient({
    baseUrl: 'https://api.test',
    fetchImpl,
  });
  act(() => root.render(
    <Section03Host
      apiClient={apiClient}
      fontReadinessController={readiness}
    />,
  ));
  return { container, root };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function nodeId(container: HTMLElement) {
  return container.querySelector('main')?.getAttribute('data-node-id');
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === label,
  );
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`button ${label} not found`);
  }
  return found;
}

function buttonByText(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`button text ${label} not found`);
  }
  return found;
}

function standardFetch() {
  return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === '/manager/workplace-state') return response(workplace());
    if (path === '/manager/machines') {
      return response({
        section: 'S03',
        screen: 'S03-M01',
        title: 'Станки',
        machines: [machine()],
        available_actions: ['BACK'],
      });
    }
    if (path === '/manager/machines/M-1') {
      return response({
        section: 'S03',
        screen: 'S03-M02',
        machine: machine(),
        available_actions: ['BACK'],
      });
    }
    if (
      path === '/machine-downtimes/D-1/finish' &&
      init?.method === 'POST'
    ) {
      return response({ id: 'D-1' });
    }
    return response({ error: 'missing' }, 404);
  });
}

describe('Section03Host', () => {
  it('shows backend-owned structured assignment reasons without transport or database text', () => {
    const cases = [
      ['additional_work_assignment_already_exists', 'Такая доп. работа уже назначена этому сотруднику и ещё не завершена.'],
      ['additional_work_target_not_available', 'Сотрудник недоступен для назначения доп. работы. Обновите список.'],
      ['additional_work_type_not_available', 'Этот вид доп. работы больше недоступен. Обновите список.'],
      ['additional_work_assignment_forbidden', 'Недостаточно прав для назначения доп. работы.'],
      ['additional_work_assignment_conflict', 'Не удалось назначить доп. работу из-за изменения данных. Обновите список и повторите.'],
    ] as const;
    for (const [code, message] of cases) {
      const apiError = new ApiClientError('Backend request failed', 409, {
        error: { code, message },
      });
      expect(section03InteractionErrorText({ originalError: apiError })).toBe(message);
    }
    expect(section03InteractionErrorText(new Error('duplicate key value violates unique constraint secret_idx')))
      .toBe('Не удалось выполнить действие. Обновите данные и повторите.');
  });

  it('activates and renders the main screen through global primitives', async () => {
    const fetchImpl = standardFetch();
    const { container } = renderHost(fetchImpl);
    await flush();
    expect(nodeId(container)).toBe('S03-N01');
    expect(container.querySelectorAll(
      '.peaks-presentation-control-list-button, .peaks-presentation-state-list-button',
    )).toHaveLength(7);
    const reports = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Отчёты'));
    expect(reports?.hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('[data-state-key="state-info"]'))
      .not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('uses global loading and terminal feedback with no legacy renderer', async () => {
    const pending = deferredResponse();
    const { container } = renderHost(vi.fn(async () => pending.promise));
    expect(container.textContent)
      .toContain('Загружаем оформление приложения.');
    await flush();
    expect(container.textContent)
      .toContain('Получаем свежее состояние раздела.');
    expect(container.querySelector('[data-feedback-kind="loading"]'))
      .not.toBeNull();
    const failure = renderHost(vi.fn(async () => response(
      { error: 'down' },
      503,
    )));
    await flush();
    expect(failure.container.querySelector(
      '[data-feedback-kind="terminal-error"]',
    )).not.toBeNull();
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/section03/Section03Host.tsx',
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /PeaksGraphNodeRenderer|binding\.createView|createView\(/,
    );
  });

  it('preserves M01/M02/M03O transitions and full back history', async () => {
    const { container } = renderHost(standardFetch());
    await flush();
    await act(async () => {
      button(container, 'Открыть раздел Станки').click();
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-M01');
    await act(async () => {
      button(container, 'Открыть карточку станка Станок 1').click();
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-M02');
    await act(async () => {
      button(
        container,
        'Завершить: Наладка',
      ).click();
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-M03O');
    await act(async () => {
      button(container, 'Назад').click();
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-M02');
    await act(async () => {
      button(container, 'Назад').click();
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-M01');
    await act(async () => {
      button(container, 'Назад').click();
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-N01');
  });

  it('disables duplicate interaction while pending and rebuilds on settle', async () => {
    const machinesPending = deferredResponse();
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const path = new URL(String(url)).pathname;
      if (path === '/manager/workplace-state') return response(workplace());
      return machinesPending.promise;
    });
    const { container } = renderHost(fetchImpl);
    await flush();
    await act(async () => {
      button(container, 'Открыть раздел Станки').click();
      await Promise.resolve();
    });
    const pendingButton = button(container, 'Открыть раздел Станки');
    expect(pendingButton.disabled).toBe(true);
    expect(pendingButton.dataset.availability).toBe('pending');
    expect(container.querySelector('.peaks-presentation-screen-template')?.getAttribute('aria-busy'))
      .toBe('true');
    await act(async () => {
      machinesPending.resolve(response({
        section: 'S03',
        screen: 'S03-M01',
        title: 'Станки',
        machines: [machine()],
        available_actions: ['BACK'],
      }));
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-M01');
  });

  it('keeps the last ready screen and shows global terminal interaction error', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const path = new URL(String(url)).pathname;
      if (path === '/manager/workplace-state') return response(workplace());
      return response({ error: 'down' }, 503);
    });
    const { container } = renderHost(fetchImpl);
    await flush();
    await act(async () => {
      button(container, 'Открыть раздел Станки').click();
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-N01');
    expect(container.querySelector(
      '[data-feedback-kind="terminal-error"]',
    )).not.toBeNull();
    expect(container.querySelector(
      '[data-presentation-feedback-slot] [data-feedback-kind="terminal-error"]',
    )).not.toBeNull();
    expect(container.querySelector('.peaks-presentation-screen-template')?.contains(
      container.querySelector('[data-presentation-feedback-slot]'),
    )).toBe(true);
  });

  it('delegates mocked business execution exactly and performs the fresh read', async () => {
    const fetchImpl = standardFetch();
    const { container } = renderHost(fetchImpl);
    await flush();
    await act(async () => {
      button(container, 'Открыть раздел Станки').click();
      await Promise.resolve();
    });
    await act(async () => {
      button(container, 'Открыть карточку станка Станок 1').click();
      await Promise.resolve();
    });
    await act(async () => {
      button(
        container,
        'Завершить: Наладка',
      ).click();
      await Promise.resolve();
    });
    const readsBefore = fetchImpl.mock.calls.filter(([url]) =>
      new URL(String(url)).pathname === '/manager/machines').length;
    await act(async () => {
      button(container, 'Завершить: Наладка').click();
      await Promise.resolve();
    });
    const post = fetchImpl.mock.calls.find(([url, init]) =>
      new URL(String(url)).pathname ===
        '/machine-downtimes/D-1/finish' &&
      init?.method === 'POST');
    expect(post).toBeDefined();
    expect(post?.[1]?.body).toBe(JSON.stringify({
      comment: SECTION03_AUDIT_REASON,
      reason: SECTION03_AUDIT_REASON,
    }));
    const readsAfter = fetchImpl.mock.calls.filter(([url]) =>
      new URL(String(url)).pathname === '/manager/machines').length;
    expect(readsAfter).toBeGreaterThan(readsBefore);
    expect(nodeId(container)).toBe('S03-M01');
  });

  it('does not execute business reads before font readiness and does not update after unmount', async () => {
    const fontPending = deferredVoid();
    const apiPending = deferredResponse();
    const fetchImpl = vi.fn(async () => apiPending.promise);
    const consoleError = vi.spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { root } = renderHost(
      fetchImpl,
      fontController(async () => fontPending.promise),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(0);
    await act(async () => {
      fontPending.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    await act(async () => {
      apiPending.resolve(response(workplace()));
      await Promise.resolve();
    });
    expect(consoleError.mock.calls.flat().map(String).join('\n'))
      .not.toMatch(/state update.*unmounted|unmounted.*state update/i);
  });

  it('keeps diagnostics out of visible text and recovers through a fresh retry', async () => {
    const first = deferredVoid();
    const second = deferredVoid();
    const attempts = [first, second];
    const loadAttempt = vi.fn(async () => (
      attempts[loadAttempt.mock.calls.length - 1]?.promise
    ));
    const fetchImpl = standardFetch();
    const { container } = renderHost(fetchImpl, fontController(loadAttempt));
    await act(async () => {
      first.reject(new Error('net::ERR_FAILED /private/arimo.woff2'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(0);
    expect(container.querySelector('[data-feedback-kind="recoverable-error"]'))
      .not.toBeNull();
    expect(container.textContent).not.toMatch(/ERR_FAILED|woff2|PLATFORM_/);
    expect(container.querySelector('main')?.dataset.platformDiagnosticCode)
      .toBe('PLATFORM_FONT_LOAD_REJECTED');
    await act(async () => {
      buttonByText(container, 'Повторить').click();
      await Promise.resolve();
    });
    expect(loadAttempt).toHaveBeenCalledTimes(2);
    await act(async () => {
      second.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(nodeId(container)).toBe('S03-N01');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
