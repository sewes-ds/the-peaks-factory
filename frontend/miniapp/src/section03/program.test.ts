import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../foundation/graphRuntime';
import { SECTION03_AUDIT_REASON, createSection03Program } from './program';
import { SECTION03_NODE_IDS } from './program/ids';
import { createSection03RuntimeBinding } from './runtimeBinding';
import type { ManagerWorkplaceState } from './contracts';

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
    downtime_started_at: '10:00',
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
      reports: { title: 'Отчеты', ui_variant: 'light_blue', is_placeholder: true, available_actions: [] },
    },
  };
}

function machines(overrides: Record<string, unknown> = {}) {
  return { section: 'S03', screen: 'S03-M01', title: 'Станки', machines: [machine(overrides)], available_actions: ['BACK'] };
}

function card(overrides: Record<string, unknown> = {}) {
  return { section: 'S03', screen: 'S03-M02', machine: machine(overrides), available_actions: ['BACK'] };
}

function runtimeFor(options: Readonly<{
  machine?: Record<string, unknown>;
  finishId?: string;
  workplaceRefreshGate?: Promise<void>;
}> = {}) {
  const calls: Array<{ path: string; init: RequestInit }> = [];
  let workplaceReads = 0;
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push({ path, init: init ?? {} });
    if (path === '/manager/workplace-state') {
      workplaceReads += 1;
      if (workplaceReads === 2) await options.workplaceRefreshGate;
      return new Response(JSON.stringify(workplace()), { status: 200 });
    }
    if (path === '/manager/machines') return new Response(JSON.stringify(machines(options.machine)), { status: 200 });
    if (path === '/manager/machines/M-1') return new Response(JSON.stringify(card(options.machine)), { status: 200 });
    if (path === '/manager/downtimes') return new Response(JSON.stringify({ section: 'S03', screen: 'S03-D01', downtimes: [], available_actions: ['START_CRITICAL_DOWNTIME', 'BACK'] }), { status: 200 });
    if (path === '/machine-downtimes/D-1/finish') return new Response(JSON.stringify({ id: options.finishId ?? 'D-1' }), { status: 200 });
    if (path === '/machine-downtimes/start') return new Response(JSON.stringify({ id: 'D-NEW' }), { status: 200 });
    return new Response(JSON.stringify({ error: path }), { status: 404 });
  });
  const apiClient = new ApiClient({ baseUrl: 'https://api.test', fetchImpl });
  const program = createSection03Program(apiClient);
  const runtime = createGraphActivationRuntime(program);
  const presentationExecution = createGraphPresentationExecutionRuntime(runtime);
  return { calls, program, runtime, presentationExecution };
}

function requireSingle<T>(values: readonly T[]): T {
  expect(values).toHaveLength(1);
  const value = values[0];
  if (value === undefined) {
    throw new Error('Expected exactly one action.');
  }
  return value;
}

type PresentationFactory = Readonly<{
  presentation: (
    actionId: string,
    input: Readonly<{ ariaLabel: string }>,
    event: Readonly<Record<string, never>>,
  ) => object;
}>;

function readyBinding<TNodeId extends 'S03-N01' | 'S03-M01' | 'S03-M02' | 'S03-M03O' | 'S03-M04C' | 'S03-D13'>(target: ReturnType<typeof runtimeFor>, nodeId: TNodeId) {
  return createPeaksGraphReadyNodeBinding({
    runtime: target.runtime,
    presentationExecution: target.presentationExecution,
    nodeId,
    onInteractionStateChange: () => undefined,
  });
}

describe('Section03 program', () => {
  it('defines exactly all 70 Section 03 nodes with no fallback', () => {
    const target = runtimeFor();
    expect(Object.keys(target.program.graph.nodes)).toEqual(SECTION03_NODE_IDS);
    expect(Object.keys(target.program.interactions)).toEqual(SECTION03_NODE_IDS);
  });

  it('keeps Google Sheets report contracts but disables their normal production UI entry', async () => {
    const target = runtimeFor();
    const ready = await target.runtime.activate({ nodeId: 'S03-N01', context: {} });
    expect(ready.status).toBe('ready');
    const binding = readyBinding(target, 'S03-N01');
    expect(binding.actionFactory.presentation(
      'p1OpenReports',
      { ariaLabel: 'Открыть раздел Отчёты' },
      {},
    )).toBeDefined();
    expect(binding.actionFactory.presentation('navigate6', { ariaLabel: 'Отчёты' }, {})).toBeDefined();
    expect(ready.status === 'ready' && ready.projection.kind === 'manager-main'
      ? (ready.projection.model as ManagerWorkplaceState).sections.reports
      : null).toEqual({
      title: 'Отчеты', ui_variant: 'light_blue', is_placeholder: true, available_actions: [],
    });
    expect(target.calls.some((call) => call.path === '/exports/google-sheets')).toBe(false);
    expect(target.program.graph.nodes['S03-R01']).toBeDefined();
    expect(target.program.graph.nodes['S03-R13']).toBeDefined();
  });

  it('accepts only optional machine_id context and rejects missing machine_id where required', async () => {
    const target = runtimeFor();
    const main = await target.runtime.activate({ nodeId: 'S03-N01', context: {} });
    expect(main.status).toBe('ready');
    const missing = await target.runtime.activate({ nodeId: 'S03-M02', context: {} });
    expect(missing.status).toBe('error');
  });

  it('activates additional endpoint-backed and local nodes through Graph Runtime', async () => {
    const target = runtimeFor();
    const endpoint = await target.runtime.activate({ nodeId: 'S03-M03C', context: { machine_id: 'M-1', downtime_id: 'D-1' } });
    expect(endpoint.status).toBe('ready');
    expect(endpoint.status === 'ready' ? endpoint.projection : null).toMatchObject({ kind: 'section03-node', screenId: 'S03-M03C' });
    const local = await target.runtime.activate({ nodeId: 'S03-D12', context: { machine_id: 'M-1', downtime_type_id: 'DT-1', downtime_type_name: 'Критический простой' } });
    expect(local.status).toBe('ready');
    expect(local.status === 'ready' ? local.projection : null).toMatchObject({ kind: 'section03-node', screenId: 'S03-D12' });
    expect((await target.runtime.activate({ nodeId: 'S03-D12', context: { machine_id: 'M-1' } })).status).toBe('error');
  });

  it('performs a fresh read for every activation', async () => {
    const target = runtimeFor();
    await target.runtime.activate({ nodeId: 'S03-N01', context: {} });
    await target.runtime.activate({ nodeId: 'S03-N01', context: {} });
    expect(target.calls.filter((call) => call.path === '/manager/workplace-state')).toHaveLength(2);
  });

  it('exposes exact presentation actions from backend authority', async () => {
    const target = runtimeFor();
    await target.runtime.activate({ nodeId: 'S03-M01', context: {} });
    const binding = readyBinding(target, 'S03-M01');
    expect(binding.actionFactory.presentation('openMachineRunning', { ariaLabel: 'open' }, { machine_id: 'M-1' }).actionId).toBe('openMachineRunning');
  });

  it('does not expose finish when backend action authority omits FINISH_DOWNTIME', async () => {
    const target = runtimeFor({ machine: { available_actions: ['OPEN_MACHINE_CARD'], downtime_type: 'critical' } });
    await target.runtime.activate({ nodeId: 'S03-M03O', context: { machine_id: 'M-1' } });
    const binding = readyBinding(target, 'S03-M03O');
    expect(binding.actionFactory.business('FINISH_DOWNTIME', { ariaLabel: 'finish' }, { downtime_id: 'D-1', comment_finish: SECTION03_AUDIT_REASON })).toEqual([]);
  });

  it('sends command body with audit reason while action event contains downtime_id and reason', async () => {
    const target = runtimeFor();
    await target.runtime.activate({ nodeId: 'S03-M03O', context: { machine_id: 'M-1' } });
    const binding = readyBinding(target, 'S03-M03O');
    const actions = binding.actionFactory.business('FINISH_DOWNTIME', { ariaLabel: 'finish' }, { downtime_id: 'D-1', comment_finish: SECTION03_AUDIT_REASON });
    const action = requireSingle(actions);
    expect(action.event).toEqual({ downtime_id: 'D-1', comment_finish: SECTION03_AUDIT_REASON });
    const result = await binding.execute(action);
    expect(result.kind).toBe('business');
    expect(result.kind === 'business' ? result.result.status : null).toBe('ready');
    const finish = target.calls.find((call) => call.path === '/machine-downtimes/D-1/finish');
    expect(JSON.parse(String(finish?.init.body))).toEqual({ comment: SECTION03_AUDIT_REASON, reason: SECTION03_AUDIT_REASON });
  });

  it('rejects command response mismatch and returns operational finish to S03-M01 after success', async () => {
    const mismatch = runtimeFor({ finishId: 'D-2' });
    await mismatch.runtime.activate({ nodeId: 'S03-M03O', context: { machine_id: 'M-1' } });
    const mismatchBinding = readyBinding(mismatch, 'S03-M03O');
    const mismatchAction = requireSingle(mismatchBinding.actionFactory.business('FINISH_DOWNTIME', { ariaLabel: 'finish' }, { downtime_id: 'D-1', comment_finish: SECTION03_AUDIT_REASON }));
    const mismatchResult = await mismatchBinding.execute(mismatchAction);
    expect(mismatchResult.kind === 'business' ? mismatchResult.result.status : null).toBe('error');

    const target = runtimeFor();
    await target.runtime.activate({ nodeId: 'S03-M03O', context: { machine_id: 'M-1' } });
    const binding = readyBinding(target, 'S03-M03O');
    const action = requireSingle(binding.actionFactory.business('FINISH_DOWNTIME', { ariaLabel: 'finish' }, { downtime_id: 'D-1', comment_finish: SECTION03_AUDIT_REASON }));
    const result = await binding.execute(action);
    expect(result.kind === 'business' && result.result.status === 'ready' ? result.result.activation.nodeId : null).toBe('S03-M01');
    expect(target.calls.filter((call) => call.path === '/manager/machines')).toHaveLength(1);
  });

  it('preserves presentation back chain', async () => {
    const target = runtimeFor();
    await target.runtime.activate({ nodeId: 'S03-N01', context: {} });
    const main = readyBinding(target, 'S03-N01');
    const opened = await main.execute(main.actionFactory.presentation('openMachines', { ariaLabel: 'open' }, {}));
    expect(opened.kind === 'presentation' && opened.result.status === 'ready' ? opened.result.activation.nodeId : null).toBe('S03-M01');
    const list = readyBinding(target, 'S03-M01');
    const backed = await list.execute(list.actionFactory.presentation('back', { ariaLabel: 'back' }, {}));
    expect(backed.kind === 'presentation' && backed.result.status === 'ready' ? backed.result.activation.nodeId : null).toBe('S03-N01');
  });

  it('prioritizes manager navigation over an already in-flight auto-refresh', async () => {
    let releaseRefresh!: () => void;
    const workplaceRefreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    const target = runtimeFor({ workplaceRefreshGate });
    const initial = await target.runtime.activate({ nodeId: 'S03-N01', context: {} });
    expect(initial.status).toBe('ready');
    const binding = createSection03RuntimeBinding({
      runtime: target.runtime,
      presentationExecution: target.presentationExecution,
      nodeId: 'S03-N01',
      onInteractionStateChange: () => undefined,
    });
    const action = (binding.actionFactory as unknown as PresentationFactory)
      .presentation('openMachines', { ariaLabel: 'open' }, {});

    const refresh = target.runtime.refresh({ context: { refresh_nonce: 1 } });
    const execution = binding.execute(action);
    await Promise.resolve();
    releaseRefresh();

    await expect(refresh).resolves.toMatchObject({ status: 'stale', nodeId: 'S03-N01' });
    const result = await execution;
    expect(result.kind === 'presentation' && result.result.status === 'ready'
      ? result.result.activation.nodeId
      : null).toBe('S03-M01');
  });

  it('resolves the critical-start follow-up and trims critical comments', async () => {
    const followUp = runtimeFor();
    await followUp.runtime.activate({
      nodeId: 'S03-M03O',
      context: {
        machine_id: 'M-1', downtime_id: 'D-1', downtime_follow_up: 'start_critical_downtime',
        downtime_type_id: 'DT-1', downtime_type_name: 'Критический простой',
      },
    });
    const followUpBinding = readyBinding(followUp, 'S03-M03O');
    const followUpAction = requireSingle(followUpBinding.actionFactory.business('FINISH_DOWNTIME', { ariaLabel: 'finish' }, {
      machine_id: 'M-1', downtime_id: 'D-1', downtime_follow_up: 'start_critical_downtime',
      downtime_type_id: 'DT-1', downtime_type_name: 'Критический простой',
      comment_finish: SECTION03_AUDIT_REASON,
    }));
    const returned = await followUpBinding.execute(followUpAction);
    expect(returned.kind === 'business' && returned.result.status === 'ready' ? returned.result.activation.nodeId : null).toBe('S03-D12');

    const critical = runtimeFor({ machine: { downtime_type: 'critical', ui_state: 'critical', ui_variant: 'red' } });
    await critical.runtime.activate({ nodeId: 'S03-M04C', context: { machine_id: 'M-1', downtime_id: 'D-1', comment_finish: '  Проверено  ' } });
    const criticalBinding = readyBinding(critical, 'S03-M04C');
    const criticalAction = requireSingle(criticalBinding.actionFactory.business('FINISH_DOWNTIME', { ariaLabel: 'finish' }, {
      machine_id: 'M-1', downtime_id: 'D-1', comment_finish: '  Проверено  ',
    }));
    const criticalResult = await criticalBinding.execute(criticalAction);
    expect(criticalResult.kind === 'business' && criticalResult.result.status === 'ready' ? criticalResult.result.activation.nodeId : null).toBe('S03-M01');
    const post = critical.calls.find((call) => call.path === '/machine-downtimes/D-1/finish');
    expect(JSON.parse(String(post?.init.body))).toEqual({ comment: 'Проверено', reason: 'Проверено' });
  });

  it('starts critical downtime with the exact four fields and always returns to S03-N01', async () => {
    const target = runtimeFor({ machine: {
      active_downtime_id: null, downtime_type: null, downtime_name: null,
      downtime_started_at: null, downtime_duration: null,
      has_active_operational_downtime: false, active_operational_downtime_id: null,
      available_actions: ['OPEN_MACHINE_CARD', 'START_CRITICAL_DOWNTIME'],
    } });
    await target.runtime.activate({ nodeId: 'S03-D13', context: {
      machine_id: 'M-1', downtime_type_id: 'DT-1', downtime_type_name: 'Критический простой',
      comment_start: '  Причина остановки  ',
    } });
    const binding = readyBinding(target, 'S03-D13');
    const action = requireSingle(binding.actionFactory.business('START_CRITICAL_DOWNTIME', { ariaLabel: 'start' }, {
      machine_id: 'M-1', downtime_type_id: 'DT-1', downtime_type_name: 'Критический простой',
      production_operation_id: 'P-1', comment_start: '  Причина остановки  ',
    }));
    const result = await binding.execute(action);
    expect(result.kind === 'business' && result.result.status === 'ready' ? result.result.activation.nodeId : null).toBe('S03-N01');
    const post = target.calls.find((call) => call.path === '/machine-downtimes/start');
    expect(JSON.parse(String(post?.init.body))).toEqual({
      machine_id: 'M-1', downtime_type_id: 'DT-1', production_operation_id: 'P-1', comment: 'Причина остановки',
    });
  });
});
