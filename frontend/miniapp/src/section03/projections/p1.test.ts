import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import type { PresentationFormDraftController } from '../../foundation/presentation';
import {
  P1_DOWNTIMES_RESPONSE,
  P1_DOWNTIME_TYPES_RESPONSE,
  P1_MACHINE_CRITICAL,
  P1_MACHINE_CRITICAL_NO_COMMENT,
  P1_MACHINE_IDLE,
  P1_MACHINE_OPERATIONAL,
  P1_MACHINE_PRODUCTION,
  P1_MACHINES_RESPONSE,
  P1_WORKPLACE_RESPONSE,
} from '../fixtures/p1';
import { createSection03Program, type Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';
import { SECTION03_NODE_IDS } from '../program/ids';
import { createSection03ScreenProjection } from '../projection';
import { section03ProjectionStateKeys, section03VisibleJson } from '../testPresentation';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';

function response(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

function harness(downtimeTypesResponse: unknown = P1_DOWNTIME_TYPES_RESPONSE) {
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (init?.method === 'POST' && path.includes('/finish')) return response({ id: path.split('/')[2] });
    if (init?.method === 'POST') return response({ id: 'RESULT-1' });
    if (path === '/manager/workplace-state') return response(P1_WORKPLACE_RESPONSE);
    if (path === '/manager/machines') return response(P1_MACHINES_RESPONSE);
    if (path === '/manager/downtimes') return response(P1_DOWNTIMES_RESPONSE);
    if (path === '/manager/downtime-types/critical') return response(downtimeTypesResponse);
    if (path === '/manager/machines/M-OP') return response({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_OPERATIONAL, available_actions: ['BACK'] });
    if (path === '/manager/machines/M-CRIT') return response({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_CRITICAL, available_actions: ['BACK'] });
    if (path === '/manager/machines/M-CRIT-NO-COMMENT') return response({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_CRITICAL_NO_COMMENT, available_actions: ['BACK'] });
    if (path === '/manager/machines/M-PROD') return response({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_PRODUCTION, available_actions: ['BACK'] });
    if (path === '/manager/machines/M-IDLE') return response({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_IDLE, available_actions: ['BACK'] });
    return new Response(JSON.stringify({ error: path }), { status: 404 });
  });
  const program = createSection03Program(new ApiClient({ baseUrl: 'https://fixture.test', fetchImpl }));
  const runtime = createGraphActivationRuntime(program);
  return { program, runtime, presentationExecution: createGraphPresentationExecutionRuntime(runtime), fetchImpl };
}

function controller(fieldId: string, value: string, valid = true): PresentationFormDraftController {
  return Object.freeze({
    activationKey: 'unit', fieldIds: Object.freeze([fieldId]), valid,
    field: () => { throw new Error('field rendering is covered by the owned form integration tests'); },
    setValue: () => undefined, reset: () => undefined,
    commit: () => valid ? Object.freeze({ [fieldId]: value.trim() }) : (() => { throw new Error('invalid'); })(),
  });
}

async function screen(
  nodeId: Section03NodeId,
  context: Section03Context,
  formController?: PresentationFormDraftController,
  downtimeTypesResponse?: unknown,
) {
  const target = harness(downtimeTypesResponse);
  const ready = await target.runtime.activate({ nodeId, context });
  if (ready.status !== 'ready' || ready.nodeId !== nodeId) throw new Error(JSON.stringify(ready));
  const binding = createPeaksGraphReadyNodeBinding({
    runtime: target.runtime, presentationExecution: target.presentationExecution,
    nodeId, onInteractionStateChange: () => undefined,
  });
  return createSection03ScreenProjection({
    nodeId, ready, actionFactory: binding.actionFactory,
    ...(formController === undefined ? {} : { formController }),
  } as never);
}

function actionIds(value: Awaited<ReturnType<typeof screen>>): readonly (string | null)[] {
  return value.bridgeProjection.items.map((item) => {
    if (!('interaction' in item) || item.interaction.kind !== 'action') return null;
    return (item.interaction.action as Readonly<{ actionId?: string }>).actionId ?? null;
  });
}

describe('Section 03 P1 closed specialized projections', () => {
  it('exports the exact ordered set and leaves exactly 59 generic nodes', () => {
    expect(SECTION03_P1_SPECIALIZED_NODE_IDS).toEqual([
      'S03-N01', 'S03-M01', 'S03-M02', 'S03-M03O', 'S03-M03C', 'S03-M04C',
      'S03-D01', 'S03-D10', 'S03-D11', 'S03-D12', 'S03-D13',
    ]);
    expect(SECTION03_NODE_IDS.filter((id) =>
      !(SECTION03_P1_SPECIALIZED_NODE_IDS as readonly string[]).includes(id))).toHaveLength(59);
  });

  it('projects exact downtime list/type/machine selection controls without generic labels', async () => {
    const d01 = await screen('S03-D01', {});
    expect(d01.slots.scroll).toEqual(['downtime-D-OP', 'downtime-D-CRIT']);
    expect(actionIds(d01)).toEqual(['p1OpenDowntimeMachine', 'p1OpenDowntimeMachine', 'p1OpenDowntimeStart', 'p1BackToMain']);
    expect(JSON.stringify(d01)).not.toMatch(/scenario-card|Сценарий|S03-D01.*title|Подтвердить/);
    const downtimeRows = d01.bridgeProjection.items.slice(0, 2) as any[];
    expect(downtimeRows.map((row) => [
      row.mainLine,
      row.secondaryLines.map((line: any) => line.content),
    ])).toEqual([
      [
        { kind: 'text', text: 'Наладка' },
        [{ kind: 'text', text: 'Станок операционного простоя' }, { kind: 'time', request: { role: 'elapsed-duration', totalMinutes: 80 } }],
      ],
      [
        { kind: 'text', text: 'Поломка шпинделя' },
        [{ kind: 'text', text: 'Станок критического простоя' }, { kind: 'time', request: { role: 'elapsed-duration', totalMinutes: 125 } }],
      ],
    ]);
    expect(JSON.stringify(downtimeRows)).not.toMatch(/SKU:|Оператор|Комментарий|Время начала простоя|Длительность простоя/);

    const d10 = await screen('S03-D10', {});
    expect(d10.fixedTopTitle).toBe('Выберите тип простоя');
    expect(actionIds(d10)).toEqual(['p1SelectDowntimeTypeWithoutMachine', 'p1BackToDowntimeList']);

    const d11 = await screen('S03-D11', { downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' });
    expect(d11.slots.scroll).toEqual(['downtime-machine-M-PROD', 'downtime-machine-M-OP', 'downtime-machine-M-CRIT', 'downtime-machine-M-IDLE']);
    expect(actionIds(d11)).toEqual(['p1SelectDowntimeMachine', 'p1SelectDowntimeMachineConflict', 'p1SelectDowntimeMachine', 'p1SelectDowntimeMachine', 'p1BackToDowntimeTypes']);
    expect(d11.bridgeProjection.items.find((item) => item.id === 'downtime-machine-M-CRIT')).toMatchObject({
      interaction: { baseAvailability: 'disabled' },
    });
  });

  it('projects every backend critical type including a newly configured sixth type', async () => {
    const responseWithNewType = {
      ...P1_DOWNTIME_TYPES_RESPONSE,
      downtime_types: [
        { downtime_type_id: 'DT-REPAIR', downtime_type_name: 'Требуется ремонт', severity: 'critical', is_active: true, display_order: 10 },
        { downtime_type_id: 'DT-SETUP', downtime_type_name: 'Требуется настройка', severity: 'critical', is_active: true, display_order: 20 },
        { downtime_type_id: 'DT-ELECTRICAL', downtime_type_name: 'Авария электрики', severity: 'critical', is_active: true, display_order: 30 },
      ],
    };

    const d10 = await screen('S03-D10', {}, undefined, responseWithNewType);
    expect(d10.slots.scroll).toEqual([
      'downtime-type-DT-REPAIR',
      'downtime-type-DT-SETUP',
      'downtime-type-DT-ELECTRICAL',
    ]);
    expect(actionIds(d10)).toEqual([
      'p1SelectDowntimeTypeWithoutMachine',
      'p1SelectDowntimeTypeWithoutMachine',
      'p1SelectDowntimeTypeWithoutMachine',
      'p1BackToDowntimeList',
    ]);
    expect(JSON.stringify(d10)).toContain('Авария электрики');
  });

  it('shows SKU and surname with initials only on a running-machine button', async () => {
    const machines = await screen('S03-M01', {});
    const running = machines.bridgeProjection.items.find((item) => item.id === 'machine-M-PROD');
    expect(running).toMatchObject({
      mainLine: { kind: 'text', text: 'Станок в производстве' },
      secondaryLine: { kind: 'text', text: 'SKU: Корпус редуктора\nИван И.' },
    });
    for (const id of ['machine-M-OP', 'machine-M-CRIT', 'machine-M-IDLE']) {
      expect(machines.bridgeProjection.items.find((item) => item.id === id)).not.toHaveProperty('secondaryLine');
    }
  });

  it('omits the complete critical comment line only when both comment sources are absent', async () => {
    const withoutComment = await screen('S03-M02', { machine_id: 'M-CRIT-NO-COMMENT' });
    const card = withoutComment.bridgeProjection.items[0];
    expect(card).toMatchObject({ kind: 'card', id: 'machine-card' });
    expect(section03ProjectionStateKeys([card!])).toEqual(['state-danger']);
    expect(actionIds(withoutComment)).toEqual([null, 'p1OpenCriticalFinish', 'p1BackToMachineList']);
    expect(withoutComment.slots.fixedBottom).toEqual(['machine-finish-critical-D-CRIT', 'machine-card-back']);
    const absentSerialized = JSON.stringify(withoutComment);
    expect(absentSerialized).toContain('Причина простоя');
    expect(absentSerialized).toContain('Поломка шпинделя');
    expect(absentSerialized).not.toContain('Комментарий');
    expect(absentSerialized).not.toContain('—');

    const withComment = await screen('S03-M02', { machine_id: 'M-CRIT' });
    const presentSerialized = JSON.stringify(withComment);
    expect(presentSerialized).toContain('Комментарий');
    expect(presentSerialized).toContain('Остановлен из-за вибрации');
  });

  it('uses the same history Back control for every M02 entry route', async () => {
    const machines = await screen('S03-M02', { machine_id: 'M-IDLE' });
    expect(actionIds(machines).at(-1)).toBe('p1BackToMachineList');
    const anotherRoute = await screen('S03-M02', { machine_id: 'M-IDLE' });
    expect(actionIds(anotherRoute).at(-1)).toBe('p1BackToMachineList');
    const back = anotherRoute.bridgeProjection.items.at(-1);
    expect(back && 'interaction' in back && back.interaction.kind === 'action'
      ? (back.interaction.action as Readonly<{ event?: unknown }>).event
      : null).toEqual({});
  });

  it('projects both required multiline forms with trimmed scalar commits and exact Back', async () => {
    const finish = await screen('S03-M03C', { machine_id: 'M-CRIT', downtime_id: 'D-CRIT' }, controller('comment_finish', '  Готово  '));
    expect(finish.fixedTopTitle).toBe('Комментарий');
    expect(finish.slots).toEqual({ fixedTop: [], scroll: ['field-comment_finish'], fixedBottom: ['critical-finish-next', 'critical-finish-back'] });
    expect(actionIds(finish)).toEqual([null, 'p1ContinueCriticalFinish', 'p1BackToMachineCard']);
    expect(JSON.stringify(finish)).toContain('Готово');

    const start = await screen('S03-D12', { machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' }, controller('comment_start', '  Причина  '));
    expect(actionIds(start)).toEqual([null, 'p1ContinueDowntimeStart', 'p1BackToDowntimeMachines']);
    expect(JSON.stringify(start)).toContain('Причина');
  });

  it('projects exact critical finish and start confirmations with business actions', async () => {
    const finish = await screen('S03-M04C', { machine_id: 'M-CRIT', downtime_id: 'D-CRIT', comment_finish: 'Проверенный комментарий' });
    expect(finish.slots.scroll).toEqual(['critical-finish-message', 'critical-finish-card']);
    expect(actionIds(finish)).toEqual([null, null, 'FINISH_DOWNTIME', 'p1BackToCriticalFinishForm']);
    expect(JSON.stringify(finish)).toContain('Завершить:\\nПоломка шпинделя');

    const start = await screen('S03-D13', { machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой', comment_start: 'Причина остановки' });
    expect(start.slots.scroll).toEqual(['downtime-start-message', 'downtime-start-card']);
    expect(actionIds(start)).toEqual([null, null, 'START_CRITICAL_DOWNTIME', 'p1BackToDowntimeComment']);
    expect(JSON.stringify(start)).toContain('Начать:\\nКритический простой');
  });
});
