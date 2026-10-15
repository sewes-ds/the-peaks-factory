import { describe, expect, it, vi } from 'vitest';
import {
  section03ProjectionControlKeys,
  section03ProjectionStateKeys,
  section03VisibleJson,
} from '../testPresentation';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import {
  Section03ContractError,
  decodeManagerSalaryCorrectionContextResponse,
} from '../contracts';
import {
  P4A1_EMPLOYEES_RESPONSE,
  SECTION03_P4A1_FIXTURES,
  SECTION03_P4A1_FIXTURE_IDS,
  type Section03P4A1Fixture,
} from '../fixtures/p4a1CorrectionsEntry';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import { projectSection03Generic } from './generic';
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
import {
  SECTION03_P4A1_SPECIALIZED_NODE_IDS,
  Section03P4A1ProjectionError,
} from './p4a1CorrectionsEntry';

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type Action = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

async function target(fixture: Section03P4A1Fixture) {
  const requests: Array<Readonly<{ method: string; path: string }>> = [];
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(request)).pathname;
      requests.push(Object.freeze({ method: init?.method ?? 'GET', path }));
      if (fixture.apiResponse !== null && path === '/manager/salary-correction-context') {
        return response(fixture.apiResponse);
      }
      return response({ error: path });
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
  const project = () => createSection03ScreenProjection({
    nodeId: fixture.nodeId,
    ready,
    actionFactory: binding.actionFactory,
  } as never);
  return { project, requests, runtime };
}

function actions(projection: ReturnType<typeof createSection03ScreenProjection>): readonly Action[] {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as Action]
      : []);
}

function visible(projection: ReturnType<typeof createSection03ScreenProjection>): string {
  return section03VisibleJson({
    ariaLabel: projection.ariaLabel,
    fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (!('interaction' in item)) return item;
      const { interaction: _interaction, ...rest } = item;
      return rest;
    }),
  });
}

describe('Section 03 P4A1 corrections entry', () => {
  const renderable = SECTION03_P4A1_FIXTURES.filter((fixture) => !fixture.expectProjectionFailure);

  it('decodes exact salary correction context, normalizes IDs, preserves order and deeply freezes it', () => {
    const source = clone(P4A1_EMPLOYEES_RESPONSE) as any;
    source.employees_with_today_shift[0].employee_id = 101;
    source.employees_with_today_shift[0].employee_shift_id = 201;
    source.default_accrual_salary_correction_type_id = 301;
    source.default_withholding_salary_correction_type_id = 301;
    const decoded = decodeManagerSalaryCorrectionContextResponse(source);
    expect(decoded.employees_with_today_shift.map((employee) => employee.employee_full_name)).toEqual(['Анна Ким', 'Борис Ли']);
    expect(decoded.employees_with_today_shift[0]).toMatchObject({ employee_id: '101', employee_shift_id: '201' });
    expect(decoded.default_accrual_salary_correction_type_id).toBe('301');
    expect(decoded.default_withholding_salary_correction_type_id).toBe('301');
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.employees_with_today_shift)).toBe(true);
    expect(Object.isFrozen(decoded.employees_with_today_shift[0])).toBe(true);
    expect(Object.isFrozen(decoded.available_actions)).toBe(true);
  });

  it('rejects duplicate identities, malformed fields and wrong closed envelope values', () => {
    const variants: unknown[] = [];
    const duplicateEmployee = clone(P4A1_EMPLOYEES_RESPONSE) as any;
    duplicateEmployee.employees_with_today_shift[1].employee_id = 'EMP-1'; variants.push(duplicateEmployee);
    const duplicateShift = clone(P4A1_EMPLOYEES_RESPONSE) as any;
    duplicateShift.employees_with_today_shift[1].employee_shift_id = 'SHIFT-1'; variants.push(duplicateShift);
    for (const [field, value] of [['employee_full_name', ' '], ['shift_started_at', ''], ['shift_finished_at', {}]] as const) {
      const invalid = clone(P4A1_EMPLOYEES_RESPONSE) as any;
      invalid.employees_with_today_shift[0][field] = value; variants.push(invalid);
    }
    for (const [field, value] of [['section', 'S02'], ['screen', 'S03-CF11'], ['available_actions', ['NEXT']]] as const) {
      const invalid = clone(P4A1_EMPLOYEES_RESPONSE) as any;
      invalid[field] = value; variants.push(invalid);
    }
    const extraEmployeeField = clone(P4A1_EMPLOYEES_RESPONSE) as any;
    extraEmployeeField.employees_with_today_shift[0].extra = true; variants.push(extraEmployeeField);
    for (const invalid of variants) {
      expect(() => decodeManagerSalaryCorrectionContextResponse(invalid)).toThrow(Section03ContractError);
    }
  });

  it('owns exact four nodes, preserves prior 41 and rejects generic for all 45', () => {
    expect(SECTION03_P4A1_SPECIALIZED_NODE_IDS).toEqual(['S03-C00', 'S03-CF01', 'S03-CF10', 'S03-CF11']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A3_SPECIALIZED_NODE_IDS, ...SECTION03_P3A4_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(41);
    const specialized = new Set([...prior, ...SECTION03_P4A1_SPECIALIZED_NODE_IDS]);
    expect(specialized.size).toBe(45);
    expect(SECTION03_NODE_IDS.filter((nodeId) => !specialized.has(nodeId))).toHaveLength(25);
    for (const nodeId of specialized) expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
  });

  it('keeps exact loaders, required context, forward topology and Back routes', () => {
    expect(SECTION03_NODE_REGISTRY['S03-C00']).toMatchObject({ loader: null, requiredContext: [] });
    expect(SECTION03_NODE_REGISTRY['S03-CF01']).toMatchObject({ loader: null, requiredContext: [] });
    expect(SECTION03_NODE_REGISTRY['S03-CF10']).toMatchObject({ loader: 'salary-correction-context', requiredContext: [] });
    expect(SECTION03_NODE_REGISTRY['S03-CF11']).toMatchObject({ loader: 'salary-correction-context', requiredContext: ['employee_id', 'employee_shift_id'] });
    expect(SECTION03_FORWARD_TARGETS['S03-C00']).toEqual(['S03-CF01', 'S03-CP00']);
    expect(SECTION03_FORWARD_TARGETS['S03-CF01']).toEqual(['S03-CF10', 'S03-CF20']);
    expect(SECTION03_FORWARD_TARGETS['S03-CF10']).toEqual(['S03-CF11']);
    expect(SECTION03_FORWARD_TARGETS['S03-CF11']).toEqual(['S03-CF12']);
    expect(SECTION03_BACK_REGISTRY['S03-C00']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-CF01']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-CF10']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-CF11']).toEqual({ kind: 'history' });
  });

  it('owns exactly 13 immutable fixtures with 11 renderable variants', () => {
    expect(SECTION03_P4A1_FIXTURES).toHaveLength(13);
    expect(new Set(SECTION03_P4A1_FIXTURE_IDS).size).toBe(13);
    expect(renderable).toHaveLength(11);
    expect(SECTION03_P4A1_FIXTURES.every(Object.isFrozen)).toBe(true);
  });

  it('projects every valid fixture with exact item, state, control, text and request contracts', async () => {
    for (const fixture of renderable) {
      const current = await target(fixture);
      const projection = current.project();
      expect(projection.fixedTopTitle, fixture.fixtureId).toBe(fixture.nodeId === 'S03-C00' ? 'Корректировки' : 'Финансовая корректировка');
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId).toEqual(fixture.orderedItemIds);
      expect(section03ProjectionStateKeys(projection.bridgeProjection.items), fixture.fixtureId).toEqual(fixture.expectedStateKeys);
      expect(projection.bridgeProjection.items.flatMap((item) => {
        const control = section03ProjectionControlKeys([item]);
        return control.length > 0
          ? control
          : item.kind === 'state-list-button'
            ? ['navigation-open' as const]
            : [];
      }), fixture.fixtureId).toEqual(fixture.expectedControlKeys);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId).toEqual(fixture.expectedActionIds);
      const rendered = visible(projection);
      for (const value of fixture.visibleText) expect(rendered, `${fixture.fixtureId}: ${value}`).toContain(value);
      for (const value of fixture.absentText) expect(rendered, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      expect(current.requests).toEqual(fixture.expectedRequests);
    }
  });

  it('keeps menus local and employee rows in backend order with only two scalar IDs', async () => {
    for (const fixture of SECTION03_P4A1_FIXTURES.slice(0, 2)) {
      const current = await target(fixture);
      current.project();
      expect(current.requests).toEqual([]);
    }
    const ordered = await target(SECTION03_P4A1_FIXTURES[4]);
    const projected = ordered.project();
    expect(projected.bridgeProjection.items.map((item) => item.id).slice(0, 2)).toEqual(['cf-emp-EMP-2', 'cf-emp-EMP-1']);
    expect(actions(projected).slice(0, 2).map((action) => action.event)).toEqual([
      { employee_id: 'EMP-2', employee_shift_id: 'SHIFT-2' },
      { employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1' },
    ]);
  });

  it('fresh-resolves exact employee/shift and derives exact closed mode/default type events', async () => {
    for (const fixture of SECTION03_P4A1_FIXTURES.slice(7, 11)) {
      const current = await target(fixture);
      const projected = current.project();
      expect(current.requests).toEqual([{ method: 'GET', path: '/manager/salary-correction-context' }]);
      expect(actions(projected).slice(0, 2).map((action) => action.event)).toEqual(
        fixture.expectedNavigations.map((navigation) => navigation.event),
      );
      expect(current.requests.some((request) => request.method === 'POST')).toBe(false);
    }
  });

  it('fails closed for a missing employee or shift mismatch after the fresh GET', async () => {
    for (const fixture of SECTION03_P4A1_FIXTURES.slice(11)) {
      const current = await target(fixture);
      expect(current.project).toThrow(Section03P4A1ProjectionError);
      expect(current.requests).toEqual([{ method: 'GET', path: '/manager/salary-correction-context' }]);
    }
  });
});
