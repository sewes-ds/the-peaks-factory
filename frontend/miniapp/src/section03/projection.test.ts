import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../foundation/apiClient';
import {
  createPeaksGraphReadyNodeBinding,
} from '../foundation/graphRenderer';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
  type GraphActivationReadyState,
  type GraphActivationResult,
} from '../foundation/graphRuntime';
import {
  SECTION03_AUDIT_REASON,
  createSection03Program,
  type Section03NodeId,
} from './program';
import {
  createSection03ScreenProjection,
} from './projection';
import {
  section03ProjectionStateKeys,
  section03ResolvedAppearanceKey,
} from './testPresentation';

function machine(overrides: Record<string, unknown> = {}) {
  return {
    machine_id: 'M-1',
    machine_name: 'Станок 1',
    ui_state: 'warning',
    ui_variant: 'yellow',
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
    downtime_comment: 'Плановая операция',
    downtime_start_comment: 'Плановая операция',
    downtime_finish_comment: null,
    downtime_started_at: '2026-07-31 10:20:30+05',
    downtime_duration: '1 ч 20 мин',
    has_active_critical_downtime: false,
    has_active_operational_downtime: true,
    active_operational_downtime_id: 'D-1',
    is_selectable_for_manager_critical_downtime: true,
    available_actions: ['OPEN_MACHINE_CARD', 'FINISH_DOWNTIME'],
    ...overrides,
  };
}

function workplace(
  machinesAvailableActions: readonly string[] = ['OPEN_MACHINES'],
) {
  return {
    section: 'S03',
    screen: 'S03-N01',
    manager: { employee_id: 'E-9', full_name: 'Manager One' },
    sections: {
      machines: { title: 'Станки', running_count: 1, downtime_count: 1, idle_count: 0, downtime_severity: 'operational', ui_variant: 'light_blue', available_actions: machinesAvailableActions },
      employees: { title: 'Сотрудники', open_shift_count: 1, production_count: 1, downtime_count: 0, additional_work_count: 0, break_count: 1, without_work_count: 0, production_downtime_severity: 'critical', ui_variant: 'light_blue', available_actions: ['OPEN_EMPLOYEES'] },
      downtimes: { title: 'Простои', critical_count: 1, operational_count: 1, ui_variant: 'light_blue', available_actions: ['OPEN_DOWNTIMES'] },
      additional_works: { title: 'Доп. работы', requested_count: 0, approved_count: 0, active_count: 1, requires_accrual_count: 0, ui_variant: 'grey', available_actions: ['OPEN_ADDITIONAL_WORKS'] },
      corrections: { title: 'Корректировки', ui_variant: 'light_blue', available_actions: ['OPEN_CORRECTIONS'] },
      notifications: { title: 'Уведомления', open_tasks_count: 2, ui_variant: 'light_blue', available_actions: ['OPEN_NOTIFICATIONS'] },
      reports: { title: 'Отчёты', ui_variant: 'light_blue', is_placeholder: true, available_actions: [] },
    },
  };
}

function setup(options: Readonly<{
  machinesAvailableActions?: readonly string[];
  machines?: readonly Record<string, unknown>[];
  card?: Record<string, unknown>;
}> = {}) {
  const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
    const path = new URL(String(url)).pathname;
    if (path === '/manager/workplace-state') {
      return new Response(JSON.stringify(workplace(
        options.machinesAvailableActions,
      )));
    }
    if (path === '/manager/machines') {
      return new Response(JSON.stringify({
        section: 'S03',
        screen: 'S03-M01',
        title: 'Станки',
        machines: options.machines ?? [machine()],
        available_actions: ['BACK'],
      }));
    }
    return new Response(JSON.stringify({
      section: 'S03',
      screen: 'S03-M02',
      machine: machine(options.card),
      available_actions: ['BACK'],
    }));
  });
  const program = createSection03Program(new ApiClient({
    baseUrl: 'https://api.test',
    fetchImpl,
  }));
  const runtime = createGraphActivationRuntime(program);
  return {
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
  };
}

function readyFor<N extends Section03NodeId>(
  result: GraphActivationResult<Section03NodeId>,
  nodeId: N,
): result is GraphActivationReadyState<N> {
  return result.status === 'ready' && result.nodeId === nodeId;
}

async function mainScreen(
  machinesAvailableActions?: readonly string[],
) {
  const target = setup({ machinesAvailableActions });
  const ready = await target.runtime.activate({
    nodeId: 'S03-N01',
    context: {},
  });
  if (!readyFor(ready, 'S03-N01')) throw new Error('main not ready');
  const binding = createPeaksGraphReadyNodeBinding({
    ...target,
    nodeId: 'S03-N01',
    onInteractionStateChange: () => undefined,
  });
  return createSection03ScreenProjection({
    nodeId: 'S03-N01',
    ready,
    actionFactory: binding.actionFactory,
  });
}

async function listScreen(
  machines: readonly Record<string, unknown>[],
) {
  const target = setup({ machines });
  const ready = await target.runtime.activate({
    nodeId: 'S03-M01',
    context: {},
  });
  if (!readyFor(ready, 'S03-M01')) throw new Error('list not ready');
  const binding = createPeaksGraphReadyNodeBinding({
    ...target,
    nodeId: 'S03-M01',
    onInteractionStateChange: () => undefined,
  });
  return createSection03ScreenProjection({
    nodeId: 'S03-M01',
    ready,
    actionFactory: binding.actionFactory,
  });
}

async function cardScreen(
  nodeId: 'S03-M02' | 'S03-M03O',
  card: Record<string, unknown>,
) {
  const target = setup({ card });
  if (nodeId === 'S03-M02') {
    const ready = await target.runtime.activate({
      nodeId,
      context: { machine_id: 'M-1' },
    });
    if (!readyFor(ready, nodeId)) throw new Error('card not ready');
    const binding = createPeaksGraphReadyNodeBinding({
      ...target,
      nodeId,
      onInteractionStateChange: () => undefined,
    });
    return createSection03ScreenProjection({
      nodeId,
      ready,
      actionFactory: binding.actionFactory,
    });
  }
  const ready = await target.runtime.activate({
    nodeId,
    context: { machine_id: 'M-1' },
  });
  if (!readyFor(ready, nodeId)) throw new Error('confirm not ready');
  const binding = createPeaksGraphReadyNodeBinding({
    ...target,
    nodeId,
    onInteractionStateChange: () => undefined,
  });
  return createSection03ScreenProjection({
    nodeId,
    ready,
    actionFactory: binding.actionFactory,
  });
}

function item(
  screen: Awaited<ReturnType<typeof mainScreen>>,
  id: string,
) {
  const found = screen.bridgeProjection.items.find((value) => value.id === id);
  if (found === undefined) throw new Error(`missing ${id}`);
  return found;
}

function actionId(value: unknown): string | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    'interaction' in value &&
    typeof value.interaction === 'object' &&
    value.interaction !== null &&
    'action' in value.interaction &&
    typeof value.interaction.action === 'object' &&
    value.interaction.action !== null &&
    'actionId' in value.interaction.action &&
    typeof value.interaction.action.actionId === 'string'
  ) {
    return value.interaction.action.actionId;
  }
  return null;
}

describe('Section03 bridge screen projection', () => {
  it('projects six active main tiles and the permanent disabled Reports tile', async () => {
    const screen = await mainScreen();
    expect(screen.fixedTopTitle).toBeUndefined();
    expect(screen.slots).toEqual({
      fixedTop: [],
      scroll: [
        'main-machines',
        'main-employees',
        'main-downtimes',
        'main-additional-works',
        'main-corrections',
        'main-notifications',
        'main-reports',
      ],
      fixedBottom: [],
    });
    expect(screen.bridgeProjection.items.map((value) => value.kind))
      .toEqual([
        'state-list-button',
        'state-list-button',
        'state-list-button',
        'state-list-button',
        'state-list-button',
        'state-list-button',
        'state-list-button',
      ]);
    expect(screen.bridgeProjection.items.map(actionId))
      .toEqual(['openMachines', 'p1OpenEmployees', 'p1OpenDowntimes', 'p1OpenAdditionalWorks', 'p1OpenCorrections', 'p1OpenNotifications', null]);
    expect(item(screen, 'main-reports')).toMatchObject({
      interaction: { kind: 'inert' },
      mainLine: { text: 'Отчёты' },
    });
    expect(section03ResolvedAppearanceKey(item(screen, 'main-machines')))
      .toBe('state-info');
    expect(item(screen, 'main-machines')).toMatchObject({
      secondaryLines: [
        { id: 'machines-running', content: { text: 'Работают: 1' } },
        { id: 'machines-downtime', content: { text: 'Простои: 1' } },
        { id: 'machines-idle', content: { text: 'Не работают: 0' } },
      ],
    });
    const mainMachines = item(screen, 'main-machines');
    const mainDowntimes = item(screen, 'main-downtimes');
    const mainEmployees = item(screen, 'main-employees');
    const mainAdditionalWorks = item(screen, 'main-additional-works');
    if (
      mainMachines.kind !== 'state-list-button' ||
      mainDowntimes.kind !== 'state-list-button' ||
      mainEmployees.kind !== 'state-list-button' ||
      mainAdditionalWorks.kind !== 'state-list-button'
    ) throw new Error('Expected state-owned main tiles.');
    expect(mainMachines.secondaryLines?.map(section03ResolvedAppearanceKey))
      .toEqual(['state-positive', 'state-warning', 'state-info']);
    expect(mainDowntimes.secondaryLines?.map(section03ResolvedAppearanceKey))
      .toEqual(['state-danger', 'state-warning']);
    expect(item(screen, 'main-employees')).toMatchObject({
      secondaryLines: [
        { id: 'employees-open-shift', content: { text: 'Смена открыта: 1' } },
        { id: 'employees-production', content: { text: 'Производство: 1' } },
        { id: 'employees-downtime', content: { text: 'Простой: 0' } },
        { id: 'employees-additional-work', content: { text: 'Доп. работы: 0' } },
        { id: 'employees-break', content: { text: 'Перерыв: 1' } },
        { id: 'employees-without-work', content: { text: 'Без работы: 0' } },
      ],
    });
    expect(mainEmployees.secondaryLines?.map(section03ResolvedAppearanceKey))
      .toEqual(['state-info', 'state-positive', 'state-info', 'state-info', 'state-warning', 'state-info']);
    expect(item(screen, 'main-additional-works')).toMatchObject({
      secondaryLines: [
        { id: 'additional-works-requested' },
        { id: 'additional-works-approved' },
        { id: 'additional-works-active' },
        { id: 'additional-works-requires-accrual' },
      ],
    });
    expect(mainAdditionalWorks.secondaryLines?.map(section03ResolvedAppearanceKey))
      .toEqual(['state-neutral', 'state-neutral', 'state-positive', 'state-neutral']);
    expect(JSON.stringify({
      nodeId: screen.nodeId,
      slots: screen.slots,
      kinds: screen.bridgeProjection.items.map((value) => value.kind),
    })).not.toMatch(/PeaksGraph|variant|className|style|tone/);
  });

  it('keeps Machines inert with identical summaries when unavailable', async () => {
    const active = await mainScreen();
    const inactive = await mainScreen(['OPEN_EMPLOYEES']);
    expect(item(inactive, 'main-machines')).toMatchObject({
      kind: 'state-list-button',
      interaction: { kind: 'inert' },
      ariaLabel: 'Станки — действие недоступно',
    });
    const activeMachines = item(active, 'main-machines');
    if (activeMachines.kind !== 'state-list-button') {
      throw new Error('active state-owned machines tile expected');
    }
    expect(section03ResolvedAppearanceKey(item(inactive, 'main-machines')))
      .toBe(section03ResolvedAppearanceKey(activeMachines));
    expect(item(inactive, 'main-machines')).toHaveProperty(
      'secondaryLines',
      activeMachines.secondaryLines,
    );
  });

  it('projects machine rows through states with compatible action IDs', async () => {
    const screen = await listScreen([
      machine(),
      machine({
        machine_id: 'M-2',
        machine_name: 'Idle',
        ui_state: 'idle',
        ui_variant: 'light_blue',
        active_production_operation_id: null,
        active_employee_full_name: null,
        active_sku_name: null,
        active_downtime_id: null,
        downtime_type: null,
        downtime_started_at: null,
        downtime_duration: null,
        available_actions: ['BACK'],
      }),
      machine({
        machine_id: 'M-3',
        machine_name: 'Critical',
        ui_state: 'critical',
        ui_variant: 'red',
        downtime_type: 'critical',
      }),
    ]);
    expect(screen.fixedTopTitle).toBe('Станки');
    expect(screen.slots.fixedBottom).toEqual(['machines-back']);
    expect(screen.bridgeProjection.items.slice(0, 3).map((value) => [
      value.id,
      section03ResolvedAppearanceKey(value),
      actionId(value),
    ])).toEqual([
      ['machine-M-1', 'state-warning', 'openMachineWarning'],
      ['machine-M-2', 'state-info', null],
      ['machine-M-3', 'state-danger', 'openMachineCritical'],
    ]);
    expect(screen.bridgeProjection.items[0]).not.toHaveProperty('secondaryLine');
    expect(JSON.stringify(screen.bridgeProjection.items[0]))
      .not.toContain('Наладка');
  });

  it('projects an empty machine list with the ordinary blue default', async () => {
    const screen = await listScreen([]);
    expect(screen.slots).toEqual({
      fixedTop: [],
      scroll: ['machines-empty'],
      fixedBottom: ['machines-back'],
    });
    expect(screen.bridgeProjection.items[0]).toMatchObject({
      kind: 'message',
      id: 'machines-empty',
      content: { kind: 'text', text: 'Нет станков для отображения.' },
    });
    expect(section03ResolvedAppearanceKey(screen.bridgeProjection.items[0]!)).toBe('state-info');
  });

  it('projects the exact card, global time roles, finish-open and back', async () => {
    const screen = await cardScreen('S03-M02', {});
    expect(screen.slots.scroll).toEqual(['machine-card']);
    expect(screen.slots.fixedBottom).toEqual([
      'machine-finish-operational-D-1',
      'machine-card-back',
    ]);
    const card = screen.bridgeProjection.items[0];
    expect(card).toMatchObject({
      kind: 'card',
      ariaLabel: 'Станок 1',
    });
    expect(section03ProjectionStateKeys([card!])).toEqual(['state-warning']);
    if (card.kind !== 'card') throw new Error('card expected');
    expect(card.title).toBeUndefined();
    expect(card.lines.map((line) => line.id)).toEqual([
      'machine-card-machine',
      'machine-card-sku',
      'machine-card-employee',
      'machine-card-downtime-reason',
      'machine-card-start',
      'machine-card-duration',
    ]);
    expect(card.lines[4]?.value).toMatchObject({
      kind: 'time',
      request: { role: 'time-only' },
    });
    expect(card.lines[5]?.value).toEqual({
      kind: 'time',
      request: { role: 'elapsed-duration', totalMinutes: 80 },
    });
    expect(screen.bridgeProjection.items.map(actionId))
      .toEqual([null, 'openOperationalDowntimeFinish', 'p1BackToMachineList']);
  });

  it('projects operational confirmation without executing its business action', async () => {
    const screen = await cardScreen('S03-M03O', {});
    expect(screen.slots.scroll).toEqual([
      'operational-finish-message',
      'operational-finish-card',
    ]);
    expect(screen.slots.fixedBottom).toEqual([
      'finish-operational-D-1',
      'operational-finish-back',
    ]);
    expect(screen.bridgeProjection.items[0]).toMatchObject({
      kind: 'message',
      content: { text: 'Подтвердите завершение простоя' },
    });
    expect(section03ResolvedAppearanceKey(screen.bridgeProjection.items[0]!)).toBe('state-warning');
    const business = screen.bridgeProjection.items[2];
    expect(actionId(business)).toBe('FINISH_DOWNTIME');
    expect(business).toMatchObject({
      label: { text: 'Завершить:\nНаладка' },
      ariaLabel: 'Завершить: Наладка',
      interaction: {
        action: {
          event: {
            downtime_id: 'D-1',
            comment_finish: SECTION03_AUDIT_REASON,
          },
        },
      },
    });
    expect(section03ResolvedAppearanceKey(business!)).toBe('action-warning');
  });

  it('omits null card lines and preserves idle/critical card presentation', async () => {
    const idle = await cardScreen('S03-M02', {
      ui_state: 'idle',
      ui_variant: 'light_blue',
      active_production_operation_id: null,
      active_employee_full_name: null,
      active_sku_code: null,
      active_sku_name: null,
      active_downtime_id: null,
      downtime_type: null,
      downtime_name: null,
      downtime_start_comment: null,
      downtime_started_at: null,
      downtime_duration: null,
      available_actions: ['OPEN_MACHINE_CARD'],
    });
    expect(idle.bridgeProjection.items[0]).toMatchObject({
      kind: 'card',
      lines: [{ id: 'machine-card-machine' }],
    });
    expect(section03ProjectionStateKeys([idle.bridgeProjection.items[0]!]))
      .toEqual(['state-info']);
    const critical = await cardScreen('S03-M02', {
      ui_state: 'critical',
      ui_variant: 'red',
      downtime_type: 'critical',
    });
    expect(critical.bridgeProjection.items[0]).toMatchObject({
      kind: 'card',
    });
    expect(section03ProjectionStateKeys([critical.bridgeProjection.items[0]!]))
      .toEqual(['state-danger']);
    expect(critical.bridgeProjection.items[1]).toMatchObject({ kind: 'control-action-button' });
    expect(section03ResolvedAppearanceKey(critical.bridgeProjection.items[1]!)).toBe('action-danger');
  });

  it('keeps the P1 dispatcher application-only and the generic fallback unreachable for P1', async () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/section03/projection.ts'),
      'utf8',
    );
    expect(source).toContain('SECTION03_P1_SPECIALIZED_NODE_IDS');
    expect(source).toContain('projectSection03P1');
    expect(source).not.toMatch(/graphRenderer|PeaksGraphRuntimeView|PeaksGraphCardTone|className/);
  });

  it('fails closed for an unknown projection node without a generic runtime dependency', () => {
    expect(() => createSection03ScreenProjection({
      nodeId: 'S03-UNKNOWN',
    } as never)).toThrow('Unknown Section 03 projection node S03-UNKNOWN.');
  });
});
