import { describe, expect, it, vi } from 'vitest';
import { section03ProjectionStateKeys, section03VisibleJson } from '../testPresentation';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
} from '../../foundation/graphRuntime';
import {
  decodeManagerEmployeeSalaryHistoryResponse,
  decodeManagerEmployeeSalaryResponse,
} from '../contracts';
import {
  SECTION03_P2B2_FIXTURES,
  SECTION03_P2B2_FIXTURE_IDS,
  type Section03P2B2Fixture,
} from '../fixtures/p2b2Salary';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import { projectSection03Generic } from './generic';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';
import { SECTION03_P2A1_SPECIALIZED_NODE_IDS } from './p2a1Employees';
import { SECTION03_P2A2A_SPECIALIZED_NODE_IDS } from './p2a2aShiftClose';
import { SECTION03_P2A2B_SPECIALIZED_NODE_IDS } from './p2a2bBlockers';
import { SECTION03_P2B1_SPECIALIZED_NODE_IDS } from './p2b1CompletedWorks';
import {
  SECTION03_P2B2_SPECIALIZED_NODE_IDS,
  Section03P2B2IdentityError,
} from './p2b2Salary';
import { SECTION03_BROWSER_NODE_IDS } from '../../../browser-tests/nodeRegistry';
import {
  SECTION03_BROWSER_SCENARIOS,
  SECTION03_BROWSER_SCENARIO_REGISTRY,
} from '../../../browser-tests/scenarioRegistry';

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function projectFixture(fixture: Section03P2B2Fixture) {
  const requests: Array<Readonly<{ method: string; path: string }>> = [];
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(request));
      requests.push(Object.freeze({ method: init?.method ?? 'GET', path: url.pathname }));
      return response(fixture.apiResponse);
    }),
  })));
  const ready = await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context });
  if (ready.status !== 'ready') throw new Error(`${fixture.fixtureId}: ${JSON.stringify(ready)}`);
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: fixture.nodeId,
    onInteractionStateChange: () => undefined,
  });
  const createProjection = () => createSection03ScreenProjection({
    nodeId: fixture.nodeId, ready, actionFactory: binding.actionFactory,
  } as never);
  return { createProjection, requests };
}

type Action = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

function actions(projection: ReturnType<typeof createSection03ScreenProjection>) {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as Action]
      : []);
}

function visibleProjection(
  projection: ReturnType<typeof createSection03ScreenProjection>,
): string {
  return section03VisibleJson({
    ariaLabel: projection.ariaLabel,
    fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (!('interaction' in item)) return item;
      const { interaction: _interaction, ...visible } = item;
      return visible;
    }),
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

const summaryFixture = SECTION03_P2B2_FIXTURES[0];
const historyFixture = SECTION03_P2B2_FIXTURES[7];

describe('Section 03 P2B2 employee salary contracts and projections', () => {
  it('decodes summary with/without breakdown and freezes exact numeric strings', () => {
    const withBreakdown = decodeManagerEmployeeSalaryResponse(summaryFixture.apiResponse);
    expect(withBreakdown).toMatchObject({
      employee_id: 'EMP-SALARY',
      totals: { today_uzs: '10000', week_uzs: '70000', month_uzs: '300000' },
      breakdown: {
        production_uzs: '250000', additional_work_uzs: '40000',
        corrections_uzs: '20000', reversals_uzs: '-10000',
      },
    });
    const withoutBreakdown = decodeManagerEmployeeSalaryResponse(
      SECTION03_P2B2_FIXTURES[1].apiResponse,
    );
    expect(withoutBreakdown.breakdown).toBeUndefined();
    expect(Object.isFrozen(withBreakdown)).toBe(true);
    expect(Object.isFrozen(withBreakdown.employee)).toBe(true);
    expect(Object.isFrozen(withBreakdown.totals)).toBe(true);
    expect(Object.isFrozen(withBreakdown.breakdown)).toBe(true);
  });

  it('decodes ordered history with present/null optionals and freezes every level', () => {
    const decoded = decodeManagerEmployeeSalaryHistoryResponse(historyFixture.apiResponse);
    expect(decoded.months.map((month) => month.month)).toEqual(['2026-07', '2026-06']);
    expect(decoded.months[0]).toMatchObject({
      total_uzs: '310000', corrections_uzs: '30000', reversals_uzs: '-10000',
    });
    expect(decoded.months[1]).toMatchObject({ corrections_uzs: null, reversals_uzs: null });
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.months)).toBe(true);
    expect(decoded.months.every(Object.isFrozen)).toBe(true);
  });

  it('accepts finite positive/zero/negative numbers, normalizes IDs and rejects malformed contracts', () => {
    const numericIds = clone(summaryFixture.apiResponse) as unknown as Record<string, any>;
    numericIds.employee_id = 42;
    numericIds.employee.employee_id = 42;
    numericIds.totals = { today_uzs: 0, week_uzs: -12.5, month_uzs: 10 };
    expect(decodeManagerEmployeeSalaryResponse(numericIds)).toMatchObject({
      employee_id: '42', employee: { employee_id: '42' },
      totals: { today_uzs: '0', week_uzs: '-12.5', month_uzs: '10' },
    });
    for (const invalid of ['12', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const payload = clone(summaryFixture.apiResponse) as unknown as Record<string, any>;
      payload.totals.today_uzs = invalid;
      expect(() => decodeManagerEmployeeSalaryResponse(payload)).toThrow();
    }
    expect(() => decodeManagerEmployeeSalaryResponse({
      ...clone(summaryFixture.apiResponse), section: 'S02',
    })).toThrow();
    expect(() => decodeManagerEmployeeSalaryResponse({
      ...clone(summaryFixture.apiResponse), screen: 'S03-SAL02',
    })).toThrow();
    expect(() => decodeManagerEmployeeSalaryHistoryResponse({
      ...clone(historyFixture.apiResponse), screen: 'S03-SAL01',
    })).toThrow();
    expect(() => decodeManagerEmployeeSalaryHistoryResponse({
      ...clone(historyFixture.apiResponse), months: {},
    })).toThrow();
    const invalidMonth = clone(historyFixture.apiResponse) as unknown as Record<string, any>;
    invalidMonth.months[0].month = '   ';
    expect(() => decodeManagerEmployeeSalaryHistoryResponse(invalidMonth)).toThrow();
  });

  it('owns the exact tuple, retains 23 prior specialized nodes and leaves 45 diagnostic nodes', () => {
    expect(SECTION03_P2B2_SPECIALIZED_NODE_IDS).toEqual(['S03-SAL01', 'S03-SAL02']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(23);
    const specialized = new Set<string>([...prior, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS]);
    expect(specialized.size).toBe(25);
    expect(SECTION03_NODE_IDS.filter((nodeId) => !specialized.has(nodeId)))
      .toHaveLength(45);
    for (const nodeId of specialized) {
      expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
    }
  });

  it('owns exactly 14 explicit immutable fixtures with 10 valid render variants', () => {
    expect(SECTION03_P2B2_FIXTURES).toHaveLength(14);
    expect(new Set(SECTION03_P2B2_FIXTURE_IDS).size).toBe(14);
    expect(SECTION03_P2B2_FIXTURES.filter((fixture) => !fixture.expectProjectionFailure))
      .toHaveLength(10);
    expect(Object.fromEntries(SECTION03_P2B2_SPECIALIZED_NODE_IDS.map((nodeId) => [
      nodeId, SECTION03_P2B2_FIXTURES.filter((fixture) => fixture.nodeId === nodeId).length,
    ]))).toEqual({ 'S03-SAL01': 7, 'S03-SAL02': 7 });
    expect(SECTION03_P2B2_FIXTURES.every(Object.isFrozen)).toBe(true);
  });

  it('projects every valid fixture with exact order, text, states, requests and controls', async () => {
    for (const fixture of SECTION03_P2B2_FIXTURES) {
      const target = await projectFixture(fixture);
      if (fixture.expectProjectionFailure) {
        expect(target.createProjection, fixture.fixtureId).toThrow(Section03P2B2IdentityError);
        continue;
      }
      const projection = target.createProjection();
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId)
        .toEqual(fixture.orderedItemIds);
      const visible = visibleProjection(projection);
      for (const value of fixture.visibleText) expect(visible, `${fixture.fixtureId}: ${value}`).toContain(value);
      for (const value of fixture.absentText) expect(visible, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      expect(section03ProjectionStateKeys(projection.bridgeProjection.items), fixture.fixtureId)
        .toEqual(fixture.expectedStateKeys);
      const forward = actions(projection).filter((action) => action.actionId?.startsWith('navigate'))
        .filter((action) => !action.actionId?.startsWith('navigateBack'))
        .map((action) => Object.freeze({
          target: SECTION03_FORWARD_TARGETS[fixture.nodeId][Number(action.actionId?.slice(8))],
          event: action.event,
        }));
      expect(forward, fixture.fixtureId).toEqual(fixture.expectedNavigations);
      expect(target.requests, fixture.fixtureId).toEqual([fixture.expectedRequest]);
      expect(target.requests.some((request) => request.method !== 'GET')).toBe(false);
    }
  });

  it('renders exact card line order, hides breakdown and omits null history lines', async () => {
    const summary = (await projectFixture(summaryFixture)).createProjection();
    expect((summary.bridgeProjection.items[0] as any).lines.map((line: any) => line.id)).toEqual([
      'salary-employee', 'salary-today', 'salary-week', 'salary-month',
    ]);
    expect(visibleProjection(summary)).not.toContain('production_uzs');
    const nullHistory = (await projectFixture(SECTION03_P2B2_FIXTURES[9])).createProjection();
    expect((nullHistory.bridgeProjection.items[0] as any).lines.map((line: any) => line.id)).toEqual([
      'salary-month-0-name', 'salary-month-0-production',
      'salary-month-0-additional', 'salary-month-0-total',
    ]);
    expect((nullHistory.bridgeProjection.items[0] as any).lines[0]).toHaveProperty('content');
    expect((nullHistory.bridgeProjection.items[0] as any).lines[0]).not.toHaveProperty('label');
    expect((nullHistory.bridgeProjection.items[0] as any).lines[0]).not.toHaveProperty('value');
    expect((nullHistory.bridgeProjection.items[0] as any).lines[0].content).toEqual({ kind: 'text', text: 'Июль 2026' });
    expect((nullHistory.bridgeProjection.items[0] as any).ariaLabel).toBe('Месяц зарплаты Июль 2026');
  });

  it('fails closed for both top-level and nested identity mismatch directions', async () => {
    for (const fixture of SECTION03_P2B2_FIXTURES.filter((item) => item.expectProjectionFailure)) {
      expect((await projectFixture(fixture)).createProjection, fixture.fixtureId)
        .toThrow(Section03P2B2IdentityError);
    }
    const contextMismatch = {
      ...summaryFixture,
      context: Object.freeze({ employee_id: 'EMP-CONTEXT-OTHER' }),
      expectedRequest: Object.freeze({ method: 'GET' as const, path: '/manager/employees/EMP-CONTEXT-OTHER/salary' }),
    } as Section03P2B2Fixture;
    expect((await projectFixture(contextMismatch)).createProjection)
      .toThrow(Section03P2B2IdentityError);
  });

  it('publishes the accepted salary topology and exact Back rules', () => {
    expect(SECTION03_FORWARD_TARGETS['S03-E02']).toContain('S03-SAL01');
    expect(SECTION03_FORWARD_TARGETS['S03-E02']).not.toContain('S03-SAL02');
    expect(SECTION03_FORWARD_TARGETS['S03-SAL01']).toEqual(['S03-SAL02']);
    expect(SECTION03_FORWARD_TARGETS['S03-SAL02']).toEqual([]);
    expect(SECTION03_BACK_REGISTRY['S03-SAL01']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-SAL02']).toEqual({ kind: 'history' });
  });

  it('registers employee-salary in the executable scenario set with Reports deferred', () => {
    expect(SECTION03_BROWSER_SCENARIOS).toHaveLength(19);
    expect(SECTION03_BROWSER_SCENARIO_REGISTRY['employee-salary'].steps).toEqual([
      { kind: 'navigate', nodeId: 'S03-N01' },
      { kind: 'navigate', nodeId: 'S03-E01' },
      { kind: 'navigate', nodeId: 'S03-E02' },
      { kind: 'navigate', nodeId: 'S03-SAL01' },
      { kind: 'navigate', nodeId: 'S03-SAL02' },
    ]);
    const covered = new Set(Object.values(SECTION03_BROWSER_SCENARIO_REGISTRY)
      .flatMap((scenario) => scenario.steps.map((step) =>
        step.kind === 'navigate' ? step.nodeId : step.successNodeId)));
    expect(covered.size).toBe(64);
    expect([...SECTION03_BROWSER_NODE_IDS].filter((nodeId) => !covered.has(nodeId))).toEqual([
      'S03-R01', 'S03-R10', 'S03-R11', 'S03-R12', 'S03-R13', 'S03-R14',
    ]);
  });
});
