import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import { validatePresentationFormValue, type PresentationFormDraftController } from '../../foundation/presentation';
import {
  P5_EXPORT_SUCCESS_RESPONSE,
  P5_REPORTS_AUTHORIZED_RESPONSE,
  P5_REPORTS_UNAUTHORIZED_RESPONSE,
  SECTION03_P5_FIXTURES,
  SECTION03_P5_FIXTURE_IDS,
} from '../fixtures/p5Reports';
import { createSection03Program, type Section03NodeId } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import { section03FormFields } from '../presentation';
import { section03ResolvedAppearanceKey } from '../testPresentation';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';
import { SECTION03_P2A1_SPECIALIZED_NODE_IDS } from './p2a1Employees';
import { SECTION03_P2A2A_SPECIALIZED_NODE_IDS } from './p2a2aShiftClose';
import { SECTION03_P2A2B_SPECIALIZED_NODE_IDS } from './p2a2bBlockers';
import { SECTION03_P2B1_SPECIALIZED_NODE_IDS } from './p2b1CompletedWorks';
import { SECTION03_P2B2_SPECIALIZED_NODE_IDS } from './p2b2Salary';
import { SECTION03_P3A1_SPECIALIZED_NODE_IDS } from './p3a1AdditionalWorkRequests';
import { SECTION03_P3A2_SPECIALIZED_NODE_IDS } from './p3a2AdditionalWorkLifecycle';
import { SECTION03_P3A3_SPECIALIZED_NODE_IDS } from './p3a3AssignAdditionalWork';
import { SECTION03_P3A4_SPECIALIZED_NODE_IDS } from './p3a4AdditionalWorkAccrual';
import { SECTION03_P4A1_SPECIALIZED_NODE_IDS } from './p4a1CorrectionsEntry';
import { SECTION03_P4A2_SPECIALIZED_NODE_IDS } from './p4a2FinancialCorrectionCreate';
import { SECTION03_P4A3_SPECIALIZED_NODE_IDS } from './p4a3FinancialCorrectionReversal';
import { SECTION03_P4A4_SPECIALIZED_NODE_IDS } from './p4a4ProductionCorrection';
import { SECTION03_P4A5_SPECIALIZED_NODE_IDS } from './p4a5Notifications';
import { SECTION03_P5_SPECIALIZED_NODE_IDS } from './p5Reports';

type RequestRecord = Readonly<{ method: string; path: string; body: unknown }>;
type ProjectedAction = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function controller(nodeId: 'S03-R11' | 'S03-R12', value: string, pending = false): PresentationFormDraftController {
  const definition = section03FormFields(nodeId)[0]!;
  const validation = validatePresentationFormValue(definition, value);
  return {
    activationKey: `${nodeId}:${value}`,
    fieldIds: Object.freeze([definition.id]),
    field: () => Object.freeze({ definition, value, validation, disabled: pending, pending }),
    setValue: () => undefined,
    reset: () => undefined,
    valid: validation.valid,
    commit: () => {
      if (pending) throw Object.freeze({ code: 'FORM_PENDING' });
      if (!validation.valid) throw Object.freeze({ code: 'FORM_INVALID' });
      return Object.freeze({ [definition.id]: validation.normalizedValue });
    },
  };
}

function harness(options: Readonly<{
  workplace?: unknown;
  exportResponse?: unknown;
  exportStatus?: number;
  pending?: boolean;
}> = {}) {
  const requests: RequestRecord[] = [];
  let release: (() => void) | undefined;
  const gate = options.pending ? new Promise<void>((resolve) => { release = resolve; }) : null;
  const apiClient = new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(request)).pathname;
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({ method, path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null }));
      if (method === 'POST') {
        if (gate !== null) await gate;
        return response(options.exportResponse ?? P5_EXPORT_SUCCESS_RESPONSE, options.exportStatus ?? 200);
      }
      if (path === '/manager/workplace-state') return response(options.workplace ?? P5_REPORTS_AUTHORIZED_RESPONSE);
      return response({ error: path }, 404);
    }),
  });
  const runtime = createGraphActivationRuntime(createSection03Program(apiClient));
  return { requests, runtime, release: () => release?.() };
}

async function projected(
  nodeId: Section03NodeId,
  context: Readonly<Record<string, string>>,
  formController?: PresentationFormDraftController,
  options: Parameters<typeof harness>[0] = {},
) {
  const target = harness(options);
  const ready = await target.runtime.activate({ nodeId, context });
  if (ready.status !== 'ready') return { ...target, ready, binding: undefined, projection: undefined } as const;
  const binding = createPeaksGraphReadyNodeBinding({
    runtime: target.runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(target.runtime),
    nodeId,
    onInteractionStateChange: () => undefined,
  });
  const projection = createSection03ScreenProjection({
    nodeId, ready, actionFactory: binding.actionFactory,
    ...(formController === undefined ? {} : { formController }),
  } as never);
  return { ...target, ready, binding, projection } as const;
}

function actions(projection: NonNullable<Awaited<ReturnType<typeof projected>>['projection']>): readonly ProjectedAction[] {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action' ? [item.interaction.action as ProjectedAction] : []);
}

function deeplyFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}

describe('Section 03 P5 Reports', () => {
  it('owns the exact final tuple and completes a disjoint 70-node specialized set', () => {
    expect(SECTION03_P5_SPECIALIZED_NODE_IDS).toEqual(['S03-R01', 'S03-R10', 'S03-R11', 'S03-R12', 'S03-R13', 'S03-R14']);
    const specialized = [
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A3_SPECIALIZED_NODE_IDS, ...SECTION03_P3A4_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A1_SPECIALIZED_NODE_IDS, ...SECTION03_P4A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A3_SPECIALIZED_NODE_IDS, ...SECTION03_P4A4_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A5_SPECIALIZED_NODE_IDS, ...SECTION03_P5_SPECIALIZED_NODE_IDS,
    ];
    expect(specialized).toHaveLength(70);
    expect(new Set(specialized).size).toBe(70);
    expect(new Set(specialized)).toEqual(new Set(SECTION03_NODE_IDS));
  });

  it('keeps the exact program, forward, ordinary Back and business contracts', () => {
    expect(SECTION03_NODE_REGISTRY['S03-R13']).toMatchObject({ loader: 'main', requiredContext: ['from_date', 'to_date'], projection: 'confirmation' });
    expect(SECTION03_FORWARD_TARGETS['S03-R10']).toEqual(['S03-R11', 'S03-R13']);
    expect(SECTION03_FORWARD_TARGETS['S03-R13']).toEqual(['S03-R14']);
    expect(SECTION03_BACK_REGISTRY['S03-R13']).toEqual({ kind: 'history' });
    expect(SECTION03_NODE_REGISTRY['S03-R14'].requiredContext).toEqual(['export_run_id']);
    expect(SECTION03_BUSINESS_ACTIONS.filter((action) => action.nodes.some((node) => SECTION03_P5_SPECIALIZED_NODE_IDS.includes(node as never))).map((action) => [action.actionId, action.nodes])).toEqual([
      ['CREATE_GOOGLE_SHEETS_EXPORT', ['S03-R13']],
    ]);
  });

  it('owns the complete unique deeply frozen scalar fixture registry', () => {
    expect(SECTION03_P5_FIXTURES).toHaveLength(46);
    expect(SECTION03_P5_FIXTURE_IDS).toEqual(SECTION03_P5_FIXTURES.map((fixture) => fixture.fixtureId));
    expect(new Set(SECTION03_P5_FIXTURE_IDS).size).toBe(46);
    expect(SECTION03_P5_FIXTURES.filter((fixture) => !fixture.expectProjectionFailure)).toHaveLength(37);
    expect(SECTION03_P5_FIXTURES.filter((fixture) => fixture.expectProjectionFailure)).toHaveLength(9);
    expect(deeplyFrozen(SECTION03_P5_FIXTURES)).toBe(true);
  });

  it('projects the exact Reports menu and deterministic period controls/events', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T20:30:00Z'));
    try {
      const menu = await projected('S03-R01', {});
      expect(menu.projection?.fixedTopTitle).toBe('Отчёты');
      expect(menu.projection?.bridgeProjection.items.map((item) => [item.id, section03ResolvedAppearanceKey(item)])).toEqual([
        ['reports-google-sheets', 'navigation-open'], ['reports-menu-back', 'navigation-back'],
      ]);
      expect(actions(menu.projection!).map((action) => [action.actionId, action.event])).toEqual([
        ['navigate0', {}], ['navigateBack0', {}],
      ]);
      const periods = await projected('S03-R10', {});
      expect(periods.projection?.bridgeProjection.items.map((item) => item.id)).toEqual([
        'reports-period-today', 'reports-period-week', 'reports-period-month', 'reports-period-last-30-days', 'reports-period-custom', 'reports-period-back',
      ]);
      expect(actions(periods.projection!)[0]).toMatchObject({ actionId: 'navigate1', event: { period: 'today', from_date: '2026-08-04', to_date: '2026-08-04' } });
      expect(actions(periods.projection!)[4]).toMatchObject({ actionId: 'navigate0', event: {} });
    } finally {
      vi.useRealTimers();
    }
  });

  it('validates R11/R12 exact committed dates, ordering, pending state and restoration events', async () => {
    expect(section03FormFields('S03-R11')).toEqual([{ id: 'from_date', kind: 'date', label: 'Дата начала', accessibilityLabel: 'Дата начала', required: true }]);
    expect(section03FormFields('S03-R12')).toEqual([{ id: 'to_date', kind: 'date', label: 'Дата окончания', accessibilityLabel: 'Дата окончания', required: true }]);
    const malformed = await projected('S03-R11', {}, controller('S03-R11', '2026-8-01'));
    expect(malformed.projection?.bridgeProjection.items.find((item) => item.id === 'reports-start-date-next')).toMatchObject({ interaction: { baseAvailability: 'disabled' } });
    const start = await projected('S03-R11', {}, controller('S03-R11', '2026-08-01'));
    expect(actions(start.projection!)[0]).toMatchObject({ actionId: 'navigate0', event: { from_date: '2026-08-01' } });
    const reversed = await projected('S03-R12', { from_date: '2026-08-04' }, controller('S03-R12', '2026-08-03'));
    expect(reversed.projection?.bridgeProjection.items.find((item) => item.id === 'reports-end-date-next')).toMatchObject({ interaction: { baseAvailability: 'disabled' } });
    const end = await projected('S03-R12', { from_date: '2026-08-01' }, controller('S03-R12', '2026-08-04'));
    expect(actions(end.projection!).map((action) => [action.actionId, action.event])).toEqual([
      ['navigate0', { from_date: '2026-08-01', to_date: '2026-08-04' }],
      ['navigateBack0', { from_date: '2026-08-01' }],
    ]);
    const pending = await projected('S03-R12', { from_date: '2026-08-01' }, controller('S03-R12', '2026-08-04', true));
    expect(pending.projection?.bridgeProjection.items.find((item) => item.id === 'reports-end-date-next')).toMatchObject({ interaction: { baseAvailability: 'disabled' } });
  });

  it('fresh-loads R13 and keeps the placeholder authority unavailable', async () => {
    const context = { from_date: '2026-08-01', to_date: '2026-08-04' };
    const target = harness();
    expect((await target.runtime.activate({ nodeId: 'S03-R13', context })).status).toBe('ready');
    expect((await target.runtime.activate({ nodeId: 'S03-R13', context })).status).toBe('ready');
    expect(target.requests).toEqual([
      { method: 'GET', path: '/manager/workplace-state', body: null },
      { method: 'GET', path: '/manager/workplace-state', body: null },
    ]);
    const unavailable = await projected('S03-R13', context, undefined, { workplace: P5_REPORTS_UNAUTHORIZED_RESPONSE });
    expect(unavailable.ready.status).toBe('ready');
    expect(unavailable.projection?.bridgeProjection.items.map((item) => item.id)).toEqual([
      'reports-export-authority-denied', 'reports-export-confirm-back',
    ]);
    expect(unavailable.requests).toEqual([
      { method: 'GET', path: '/manager/workplace-state', body: null },
    ]);
  });

  it('projects a permanent unavailable message with only the route Back action', async () => {
    const target = await projected('S03-R13', { period: 'week', from_date: '2026-08-01', to_date: '2026-08-04' });
    expect(target.projection?.bridgeProjection.items.map((item) => [item.id, section03ResolvedAppearanceKey(item)])).toEqual([
      ['reports-export-authority-denied', 'state-info'], ['reports-export-confirm-back', 'navigation-back'],
    ]);
    expect(target.projection?.bridgeProjection.items[0]).toMatchObject({
      content: { text: 'Недостаточно прав для создания выгрузки.' },
    });
    expect(actions(target.projection!).map((action) => [action.actionId, action.event])).toEqual([
      ['navigateBack0', {}],
    ]);
    const custom = await projected('S03-R13', { from_date: '2026-08-01', to_date: '2026-08-04' });
    expect(actions(custom.projection!).map((action) => [action.actionId, action.event])).toEqual([
      ['navigateBack1', { from_date: '2026-08-01', to_date: '2026-08-04' }],
    ]);
  });

  it('never exposes or executes the export command while Reports is a placeholder', async () => {
    const target = await projected('S03-R13', { period: 'today', from_date: '2026-08-01', to_date: '2026-08-04' });
    expect(actions(target.projection!).some((action) => action.actionId === 'CREATE_GOOGLE_SHEETS_EXPORT')).toBe(false);
    expect(target.requests.filter((request) => request.method === 'POST')).toEqual([]);
    expect(target.runtime.getState()).toMatchObject({ status: 'ready', nodeId: 'S03-R13' });
  });

  it('does not start export transport for pending, failed or malformed mock responses', async () => {
    const context = { from_date: '2026-08-01', to_date: '2026-08-04' };
    for (const options of [
      { pending: true },
      { exportStatus: 503, exportResponse: { error: 'fixture failure' } },
      { exportResponse: { id: '42' } }, { exportResponse: { run_id: '42' } },
      { exportResponse: { operation_id: '42' } }, { exportResponse: {} },
      { exportResponse: { export_run_id: '0' } }, { exportResponse: { export_run_id: ' 42' } },
      { exportResponse: { export_run_id: '42', extra: true } },
    ]) {
      const unavailable = await projected('S03-R13', context, undefined, options);
      expect(actions(unavailable.projection!).some((action) => action.actionId === 'CREATE_GOOGLE_SHEETS_EXPORT')).toBe(false);
      expect(unavailable.runtime.getState()).toMatchObject({ status: 'ready', nodeId: 'S03-R13' });
      expect(unavailable.requests.filter((request) => request.method === 'POST')).toEqual([]);
    }
  });
});
