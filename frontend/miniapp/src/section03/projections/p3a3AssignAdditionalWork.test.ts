import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import {
  decodeManagerAdditionalWorkTypesAvailableResponse,
} from '../contracts';
import {
  P3A3_ASSIGN_BLOCKED_RESPONSE,
  P3A3_ASSIGN_AUTHORITY_RESPONSE,
  P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE,
  SECTION03_P3A3_FIXTURES,
  SECTION03_P3A3_FIXTURE_IDS,
  type Section03P3A3Fixture,
} from '../fixtures/p3a3AssignAdditionalWork';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import {
  decodeSection03Context,
  isSection03ContextScalarOnly,
  SECTION03_CONTEXT_KEYS,
} from '../program/context';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_NODE_REGISTRY, validateSection03NodeContext } from '../program/registry';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import { createSection03RuntimeBinding } from '../runtimeBinding';
import { section03ProjectionStateKeys, section03VisibleJson } from '../testPresentation';
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

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

const emptyAdditionalWorksResponse = Object.freeze({
  section: 'S03' as const,
  screen: 'S03-AW01' as const,
  title: 'Доп. работы' as const,
  groups: Object.freeze({
    requested: Object.freeze([]),
    approved: Object.freeze([]),
    active: Object.freeze([]),
    waiting_accrual: Object.freeze([]),
  }),
  available_actions: Object.freeze(['ASSIGN_ADDITIONAL_WORK', 'BACK'] as const),
});

type RecordedRequest = Readonly<{ method: string; path: string; body?: unknown }>;
type Action = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

async function target(fixture: Section03P3A3Fixture) {
  const requests: RecordedRequest[] = [];
  const interactionStates: Array<Readonly<{ status: string }>> = [];
  let release: (() => void) | undefined;
  const gate = fixture.pending ? new Promise<void>((resolve) => { release = resolve; }) : null;
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      url.searchParams.delete('_');
      const query = url.searchParams.toString();
      requests.push(Object.freeze({
        method,
        path: `${url.pathname}${query === '' ? '' : `?${query}`}`,
        ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}),
      }));
      if (method === 'POST') {
        if (gate !== null) await gate;
        return fixture.requestFailure ? json({ error: 'fixture failure' }, 503) : json({ id: 'ASSIGNED' });
      }
      if (url.pathname === '/manager/additional-works') return json(emptyAdditionalWorksResponse);
      return json(fixture.apiResponse);
    }),
  })));
  const ready = await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context });
  if (fixture.expectContextFailure) return { ready, requests, runtime };
  if (ready.status !== 'ready') throw new Error(`${fixture.fixtureId}: ${JSON.stringify(ready)}`);
  const binding = createSection03RuntimeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: fixture.nodeId,
    onInteractionStateChange: (state) => interactionStates.push(state),
  });
  const project = () => createSection03ScreenProjection({
    nodeId: fixture.nodeId,
    ready,
    actionFactory: binding.actionFactory,
  } as never);
  return { binding, interactionStates, project, ready, release: () => release?.(), requests, runtime };
}

function actions(projection: ReturnType<typeof createSection03ScreenProjection>): readonly Action[] {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as Action]
      : []);
}

function visible(projection: ReturnType<typeof createSection03ScreenProjection>): string {
  return section03VisibleJson({
    fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (!('interaction' in item)) return item;
      const { interaction: _interaction, ...rest } = item;
      return rest;
    }),
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('Section 03 P3A3 assign additional work', () => {
  const valid = SECTION03_P3A3_FIXTURES.filter((fixture) => !fixture.expectContextFailure);

  it('owns exact three nodes, preserves prior 33 and rejects generic for all 36', () => {
    expect(SECTION03_P3A3_SPECIALIZED_NODE_IDS).toEqual(['S03-AW40', 'S03-AW41', 'S03-AW42']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(33);
    const specialized = new Set([...prior, ...SECTION03_P3A3_SPECIALIZED_NODE_IDS]);
    expect(specialized.size).toBe(36);
    expect(SECTION03_NODE_IDS.filter((nodeId) => !specialized.has(nodeId))).toHaveLength(34);
    for (const nodeId of specialized) expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
  });

  it('adds exactly two trimmed scalar display keys and requires them only for AW41/AW42', () => {
    expect(SECTION03_CONTEXT_KEYS.filter((key) => key.endsWith('_name'))).toContain('employee_full_name');
    expect(SECTION03_CONTEXT_KEYS).toContain('additional_work_type_name');
    const decoded = decodeSection03Context({
      employee_id: ' EMP-2 ', employee_full_name: ' Борис Ли ',
      additional_work_type_id: ' TYPE-2 ', additional_work_type_name: ' Инвентаризация участка ',
    });
    expect(decoded).toEqual({
      employee_id: 'EMP-2', employee_full_name: 'Борис Ли',
      additional_work_type_id: 'TYPE-2', additional_work_type_name: 'Инвентаризация участка',
    });
    expect(isSection03ContextScalarOnly(decoded)).toBe(true);
    for (const invalid of [
      { employee_full_name: '   ' }, { employee_full_name: { value: 'Борис Ли' } },
      { additional_work_type_name: ['Инвентаризация'] }, { unknown_display_name: 'X' },
    ]) expect(() => decodeSection03Context(invalid)).toThrow();
    expect(SECTION03_NODE_REGISTRY['S03-AW40'].requiredContext).toEqual([]);
    expect(SECTION03_NODE_REGISTRY['S03-AW41'].requiredContext).toEqual(['employee_id', 'employee_full_name']);
    expect(SECTION03_NODE_REGISTRY['S03-AW42'].requiredContext).toEqual([
      'employee_id', 'employee_full_name', 'additional_work_type_id', 'additional_work_type_name',
    ]);
    const displayNameNodes = SECTION03_NODE_IDS.filter((nodeId) =>
      SECTION03_NODE_REGISTRY[nodeId].requiredContext.some((key) => key === 'employee_full_name' || key === 'additional_work_type_name'));
    expect(displayNameNodes).toEqual(['S03-AW41', 'S03-AW42']);
  });

  it('decodes a closed deeply immutable work-type response and preserves backend order', () => {
    const decoded = decodeManagerAdditionalWorkTypesAvailableResponse(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE);
    expect(decoded.additional_work_types.map((item) => item.additional_work_type_id)).toEqual(['TYPE-2', 'TYPE-1']);
    expect(decoded.additional_work_types.map((item) => item.display_order)).toEqual([20, 10]);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.additional_work_types)).toBe(true);
    expect(Object.isFrozen(decoded.additional_work_types[0])).toBe(true);
    expect(Object.isFrozen(decoded.available_actions)).toBe(true);
  });

  it('rejects duplicate IDs/orders, inconsistent or malformed work types and wrong envelope literals', () => {
    const duplicateId = clone(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE) as any;
    duplicateId.additional_work_types[1].additional_work_type_id = 'TYPE-2';
    const duplicateOrder = clone(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE) as any;
    duplicateOrder.additional_work_types[1].display_order = 20;
    const inconsistent = clone(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE) as any;
    inconsistent.additional_work_types[0].is_active = false;
    const emptyName = clone(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE) as any;
    emptyName.additional_work_types[0].additional_work_name = '  ';
    const wrongScreen = clone(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE) as any;
    wrongScreen.screen = 'S03-AW40';
    const wrongAction = clone(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE) as any;
    wrongAction.available_actions = ['ASSIGN_ADDITIONAL_WORK'];
    const extraField = clone(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE) as any;
    extraField.additional_work_types[0].name = 'invented alias';
    for (const invalid of [duplicateId, duplicateOrder, inconsistent, emptyName, wrongScreen, wrongAction, extraField]) {
      expect(() => decodeManagerAdditionalWorkTypesAvailableResponse(invalid)).toThrow();
    }
    for (const displayOrder of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const invalid = clone(P3A3_WORK_TYPES_BACKEND_ORDER_RESPONSE) as any;
      invalid.additional_work_types[0].display_order = displayOrder;
      expect(() => decodeManagerAdditionalWorkTypesAvailableResponse(invalid)).toThrow();
    }
  });

  it('owns exactly 14 explicit immutable fixtures with 12 valid', () => {
    expect(SECTION03_P3A3_FIXTURES).toHaveLength(14);
    expect(new Set(SECTION03_P3A3_FIXTURE_IDS).size).toBe(14);
    expect(valid).toHaveLength(12);
    expect(Object.fromEntries(SECTION03_P3A3_SPECIALIZED_NODE_IDS.map((nodeId) => [
      nodeId, SECTION03_P3A3_FIXTURES.filter((fixture) => fixture.nodeId === nodeId).length,
    ]))).toEqual({ 'S03-AW40': 4, 'S03-AW41': 4, 'S03-AW42': 6 });
    expect(SECTION03_P3A3_FIXTURES.every(Object.isFrozen)).toBe(true);
  });

  it('fails both missing display-name contexts before loading', async () => {
    for (const fixture of SECTION03_P3A3_FIXTURES.filter((item) => item.expectContextFailure)) {
      expect(() => validateSection03NodeContext(fixture.nodeId, fixture.context)).toThrow();
      const current = await target(fixture);
      expect(current.ready.status).toBe('error');
      expect(current.requests).toEqual([]);
    }
  });

  it('projects all 12 valid fixtures with exact order, states, text, scalar events and GETs', async () => {
    for (const fixture of valid) {
      const current = await target(fixture);
      if (current.project === undefined) throw new Error(fixture.fixtureId);
      const projection = current.project();
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId).toEqual(fixture.orderedItemIds);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId).toEqual(fixture.expectedActionIds);
      expect(section03ProjectionStateKeys(projection.bridgeProjection.items), fixture.fixtureId).toEqual(fixture.expectedStateKeys);
      const rendered = visible(projection);
      for (const value of fixture.visibleText) expect(rendered, `${fixture.fixtureId}: ${value}`).toContain(value);
      for (const value of fixture.absentText) expect(rendered, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      for (const action of actions(projection)) {
        if (action.event !== undefined) expect(isSection03ContextScalarOnly(action.event)).toBe(true);
      }
      expect(current.requests).toEqual(fixture.expectedRequests.slice(0, 1));
    }
  });

  it('keeps AW40 neutral regardless of employee backend presentation state', async () => {
    const fixture = valid.find((item) => item.fixtureId === 'S03-AW40:employees')!;
    const current = await target(fixture);
    if (current.project === undefined) throw new Error(fixture.fixtureId);
    const projection = current.project();
    expect(section03ProjectionStateKeys(projection.bridgeProjection.items)).toEqual([
      'state-neutral', 'state-neutral',
    ]);
    expect(projection.bridgeProjection.items.slice(0, 2).map((item) => {
      const authority = 'presentationAuthority' in item ? item.presentationAuthority : undefined;
      return authority?.rootId ?? null;
    })).toEqual(['section03-root-static-neutral-list', 'section03-root-static-neutral-list']);
  });

  it('keeps exact assignment topology, Back context and top-level authority metadata', () => {
    expect(SECTION03_FORWARD_TARGETS['S03-AW40']).toEqual(['S03-AW41']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW41']).toEqual(['S03-AW42']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW42']).toEqual(['S03-AW01']);
    expect(SECTION03_BACK_REGISTRY['S03-AW40']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW41']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW42']).toEqual({ kind: 'history' });
    const definition = SECTION03_BUSINESS_ACTIONS.find((item) => item.actionId === 'ASSIGN_ADDITIONAL_WORK')!;
    expect(definition.authority).toContain('exact selected employee/type assignability item can_assign=true');
    expect(definition.authority).toContain('top-level available_actions:ASSIGN_ADDITIONAL_WORK');
    expect(definition.path).toBe('/additional-works/assign');
    expect(definition.freshRead).toBe(true);
    expect(decodeManagerAdditionalWorkTypesAvailableResponse(P3A3_ASSIGN_AUTHORITY_RESPONSE).available_actions)
      .toEqual(['ASSIGN_ADDITIONAL_WORK', 'BACK']);
  });

  it('renders the backend block reason and keeps the assign position inert', async () => {
    const base = SECTION03_P3A3_FIXTURES[8];
    const blockedFixture: Section03P3A3Fixture = Object.freeze({
      ...base,
      fixtureId: 'S03-AW42:blocked-before-submit',
      apiResponse: P3A3_ASSIGN_BLOCKED_RESPONSE,
      expectedRequests: Object.freeze([base.expectedRequests[0]!]),
    });
    const current = await target(blockedFixture);
    if (current.project === undefined) throw new Error(blockedFixture.fixtureId);
    const projection = current.project();
    expect(visible(projection)).toContain(
      'Для сотрудника уже есть незавершённое назначение этого вида доп. работы.',
    );
    expect(actions(projection).map((action) => action.actionId)).toEqual(['navigateBack0']);
    expect(projection.slots.fixedTop).toEqual([]);
    expect(projection.slots.fixedBottom).toEqual(['assign-additional-work', 'assign-additional-work-back']);
    expect(projection.bridgeProjection.items.find((item) => item.id === 'assign-additional-work'))
      .toMatchObject({ interaction: { kind: 'inert' } });
    expect(current.requests).toEqual(blockedFixture.expectedRequests);
  });

  it('posts exact ID-only assignment body and fresh-loads AW01', async () => {
    const fixture = SECTION03_P3A3_FIXTURES[8];
    const current = await target(fixture);
    if (current.project === undefined || current.binding === undefined) throw new Error(fixture.fixtureId);
    const business = actions(current.project()).find((action) => action.actionId === 'ASSIGN_ADDITIONAL_WORK')!;
    const result = await current.binding.execute(business as never);
    expect(result.kind === 'business' && result.result.status === 'ready'
      ? result.result.activation.nodeId
      : null).toBe('S03-AW01');
    expect(current.requests).toEqual(fixture.expectedRequests);
  });

  it('suppresses pending duplicates and retains all four scalars after failure', async () => {
    const pendingFixture = SECTION03_P3A3_FIXTURES[9];
    const pending = await target(pendingFixture);
    if (pending.project === undefined || pending.binding === undefined || pending.release === undefined || pending.interactionStates === undefined) throw new Error(pendingFixture.fixtureId);
    const pendingAction = actions(pending.project()).find((action) => action.actionId === 'ASSIGN_ADDITIONAL_WORK')!;
    const first = pending.binding.execute(pendingAction as never);
    await vi.waitFor(() => expect(pending.requests.filter((request) => request.method === 'POST')).toHaveLength(1));
    const second = pending.binding.execute(pendingAction as never);
    expect(second).toBe(first);
    expect(pending.interactionStates).toContainEqual(expect.objectContaining({ status: 'pending' }));
    pending.release();
    await Promise.all([first, second]);
    expect(pending.requests.filter((request) => request.method === 'POST')).toHaveLength(1);

    const failedFixture = SECTION03_P3A3_FIXTURES[10];
    const failed = await target(failedFixture);
    if (failed.project === undefined || failed.binding === undefined) throw new Error(failedFixture.fixtureId);
    const failedAction = actions(failed.project()).find((action) => action.actionId === 'ASSIGN_ADDITIONAL_WORK')!;
    const result = await failed.binding.execute(failedAction as never);
    expect(result.kind === 'business' ? result.result.status : null).toBe('error');
    expect(failed.runtime.getState()).toMatchObject({
      status: 'ready', nodeId: 'S03-AW42', context: failedFixture.context,
    });
    expect(failed.requests).toEqual([
      ...failedFixture.expectedRequests,
      { method: 'GET', path: '/manager/additional-works' },
      { method: 'GET', path: '/manager/employees' },
      { method: 'GET', path: '/manager/additional-work-types/available?employee_id=EMP-2&additional_work_type_id=TYPE-2' },
    ]);
  });
});
