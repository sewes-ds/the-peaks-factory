import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import { decodeManagerAdditionalWorksResponse } from '../contracts';
import {
  P3A2_ACTIVE_RESPONSE,
  P3A2_APPROVED_RESPONSE,
  SECTION03_P3A2_FIXTURES,
  SECTION03_P3A2_FIXTURE_IDS,
  type Section03P3A2Fixture,
} from '../fixtures/p3a2AdditionalWorkLifecycle';
import {
  P2A2B_CARD_ADDITIONAL_WORK,
  P2A2B_CARD_NONE,
  P2A2B_CARD_PRODUCTION,
} from '../fixtures/p2a2bBlockers';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import { section03ProjectionStateKeys, section03VisibleJson } from '../testPresentation';
import { projectSection03Generic } from './generic';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';
import { SECTION03_P2A1_SPECIALIZED_NODE_IDS } from './p2a1Employees';
import { SECTION03_P2A2A_SPECIALIZED_NODE_IDS } from './p2a2aShiftClose';
import { SECTION03_P2A2B_SPECIALIZED_NODE_IDS } from './p2a2bBlockers';
import { SECTION03_P2B1_SPECIALIZED_NODE_IDS } from './p2b1CompletedWorks';
import { SECTION03_P2B2_SPECIALIZED_NODE_IDS } from './p2b2Salary';
import { SECTION03_P3A1_SPECIALIZED_NODE_IDS } from './p3a1AdditionalWorkRequests';
import {
  SECTION03_P3A2_SPECIALIZED_NODE_IDS,
  Section03P3A2SelectionError,
} from './p3a2AdditionalWorkLifecycle';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

type RecordedRequest = Readonly<{ method: string; path: string; body?: unknown }>;

async function target(fixture: Section03P3A2Fixture) {
  const requests: RecordedRequest[] = [];
  const interactionStates: Array<Readonly<{ status: string }>> = [];
  let release: (() => void) | undefined;
  const gate = fixture.pending ? new Promise<void>((resolve) => { release = resolve; }) : null;
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}),
      }));
      if (method === 'POST') {
        if (gate !== null) await gate;
        return fixture.requestFailure ? json({ error: 'fixture failure' }, 503) : json({ id: 'OK' });
      }
      return json(fixture.apiResponse);
    }),
  })));
  const ready = await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context });
  if (ready.status !== 'ready') throw new Error(`${fixture.fixtureId}: ${JSON.stringify(ready)}`);
  const binding = createPeaksGraphReadyNodeBinding({
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

type Action = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

function actions(projection: ReturnType<typeof createSection03ScreenProjection>): readonly Action[] {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as Action]
      : []);
}

function visible(projection: ReturnType<typeof createSection03ScreenProjection>): string {
  return section03VisibleJson({
    ariaLabel: projection.ariaLabel,
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

async function e17Target(freshResponse: unknown) {
  const requests: RecordedRequest[] = [];
  let cardReads = 0;
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path: url.pathname,
        ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}),
      }));
      if (method === 'POST') return json({ id: 'OK' });
      cardReads += 1;
      return json(cardReads === 1 ? P2A2B_CARD_ADDITIONAL_WORK : freshResponse);
    }),
  })));
  const ready = await runtime.activate({
    nodeId: 'S03-E17',
    context: { employee_id: 'EMP-BLOCK', additional_work_id: 'AW-BLOCK' },
  });
  if (ready.status !== 'ready') throw new Error(JSON.stringify(ready));
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: 'S03-E17',
    onInteractionStateChange: () => undefined,
  });
  const projection = createSection03ScreenProjection({
    nodeId: 'S03-E17', ready, actionFactory: binding.actionFactory,
  } as never);
  const business = actions(projection).find((action) => action.actionId === 'FINISH_ADDITIONAL_WORK');
  if (business === undefined) throw new Error('E17 finish action missing.');
  const result = await binding.execute(business as never);
  return { requests, result };
}

describe('Section 03 P3A2 additional-work lifecycle', () => {
  const valid = SECTION03_P3A2_FIXTURES.filter((fixture) => !fixture.expectProjectionFailure);

  it('owns exact four nodes, preserves prior 29 and rejects generic for all 33', () => {
    expect(SECTION03_P3A2_SPECIALIZED_NODE_IDS).toEqual(['S03-AW20', 'S03-AW21', 'S03-AW30', 'S03-AW31']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(29);
    const specialized = new Set([...prior, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS]);
    expect(specialized.size).toBe(33);
    expect(SECTION03_NODE_IDS.filter((nodeId) => !specialized.has(nodeId))).toHaveLength(37);
    for (const nodeId of specialized) expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
  });

  it('owns exactly 18 immutable fixtures with 14 valid and exact distribution', () => {
    expect(SECTION03_P3A2_FIXTURES).toHaveLength(18);
    expect(new Set(SECTION03_P3A2_FIXTURE_IDS).size).toBe(18);
    expect(valid).toHaveLength(14);
    expect(Object.fromEntries(SECTION03_P3A2_SPECIALIZED_NODE_IDS.map((nodeId) => [
      nodeId,
      SECTION03_P3A2_FIXTURES.filter((fixture) => fixture.nodeId === nodeId).length,
    ]))).toEqual({ 'S03-AW20': 5, 'S03-AW21': 4, 'S03-AW30': 5, 'S03-AW31': 4 });
    expect(SECTION03_P3A2_FIXTURES.every(Object.isFrozen)).toBe(true);
  });

  it('keeps the authoritative closed P3A1 lifecycle action tuples', () => {
    expect(decodeManagerAdditionalWorksResponse(P3A2_APPROVED_RESPONSE).groups.approved[0]?.available_actions)
      .toEqual(['OPEN_ADDITIONAL_WORK_CARD', 'CANCEL_ADDITIONAL_WORK']);
    expect(decodeManagerAdditionalWorksResponse(P3A2_ACTIVE_RESPONSE).groups.active[0]?.available_actions)
      .toEqual(['OPEN_ADDITIONAL_WORK_CARD', 'FINISH_ADDITIONAL_WORK']);
    const approvedMissing = clone(P3A2_APPROVED_RESPONSE) as any;
    approvedMissing.groups.approved[0].available_actions.pop();
    const activeMissing = clone(P3A2_ACTIVE_RESPONSE) as any;
    activeMissing.groups.active[0].available_actions.pop();
    expect(() => decodeManagerAdditionalWorksResponse(approvedMissing)).toThrow();
    expect(() => decodeManagerAdditionalWorksResponse(activeMissing)).toThrow();
  });

  it('projects every valid fixture with exact selected record, order, states and scalar-only events', async () => {
    for (const fixture of SECTION03_P3A2_FIXTURES) {
      const current = await target(fixture);
      if (fixture.expectProjectionFailure) {
        expect(current.project, fixture.fixtureId).toThrow(Section03P3A2SelectionError);
        continue;
      }
      const projection = current.project();
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId).toEqual(fixture.orderedItemIds);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId).toEqual(fixture.expectedActionIds);
      expect(section03ProjectionStateKeys(projection.bridgeProjection.items), fixture.fixtureId).toEqual(fixture.expectedStateKeys);
      const rendered = visible(projection);
      for (const value of fixture.visibleText) expect(rendered, `${fixture.fixtureId}: ${value}`).toContain(value);
      for (const value of fixture.absentText) expect(rendered, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      for (const action of actions(projection)) {
        if (action.event !== undefined) {
          expect(Object.keys(action.event).every((key) => key === 'additional_work_id')).toBe(true);
        }
      }
      expect(current.requests).toEqual([{ method: 'GET', path: '/manager/additional-works' }]);
    }
  });

  it('keeps exact lifecycle topology, Back and selected-item business authority', () => {
    expect(SECTION03_FORWARD_TARGETS['S03-AW20']).toEqual(['S03-AW21']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW21']).toEqual(['S03-AW01']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW30']).toEqual(['S03-AW31']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW31']).toEqual(['S03-AW01']);
    expect(SECTION03_BACK_REGISTRY['S03-AW20']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW21']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW30']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW31']).toEqual({ kind: 'history' });
    for (const id of ['CANCEL_ADDITIONAL_WORK', 'FINISH_ADDITIONAL_WORK']) {
      const definition = SECTION03_BUSINESS_ACTIONS.find((item) => item.actionId === id)!;
      expect(definition.authority).toContain('exact selected typed');
      expect(definition.authority).toContain('matching additional_work_id');
      expect(definition.authority).toContain('selected-item available_actions');
      expect(definition.authority).toContain('unrelated records provide no authority');
      expect(definition.freshRead).toBe(true);
    }
  });

  it('posts exact cancel and lifecycle finish bodies and fresh-loads AW01', async () => {
    for (const fixture of [SECTION03_P3A2_FIXTURES[5], SECTION03_P3A2_FIXTURES[14]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId?.endsWith('ADDITIONAL_WORK'))!;
      const result = await current.binding.execute(business as never);
      expect(result.kind === 'business' && result.result.status === 'ready' ? result.result.activation.nodeId : null).toBe('S03-AW01');
      expect(current.requests).toEqual(fixture.expectedRequests);
    }
  });

  it('keeps E17 shift-close payload and E12/E10 routing separate from AW31', async () => {
    for (const [fresh, expected] of [[P2A2B_CARD_PRODUCTION, 'S03-E12'], [P2A2B_CARD_NONE, 'S03-E10']] as const) {
      const current = await e17Target(fresh);
      expect(current.requests.find((request) => request.method === 'POST')).toEqual({
        method: 'POST',
        path: '/additional-works/AW-BLOCK/finish',
        body: { comment: 'Завершено начальником производства при завершении смены сотрудника' },
      });
      expect(current.result.kind === 'business' && current.result.result.status === 'ready'
        ? current.result.result.activation.nodeId
        : null).toBe(expected);
    }
  });

  it('publishes pending once and retains node/context on request failure', async () => {
    for (const fixture of [SECTION03_P3A2_FIXTURES[6], SECTION03_P3A2_FIXTURES[15]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId?.endsWith('ADDITIONAL_WORK'))!;
      const first = current.binding.execute(business as never);
      await vi.waitFor(() => expect(current.requests.filter((request) => request.method === 'POST')).toHaveLength(1));
      expect(current.interactionStates).toContainEqual(expect.objectContaining({ status: 'pending' }));
      current.release();
      await first;
      expect(current.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    }
    for (const fixture of [SECTION03_P3A2_FIXTURES[7], SECTION03_P3A2_FIXTURES[16]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId?.endsWith('ADDITIONAL_WORK'))!;
      const result = await current.binding.execute(business as never);
      expect(result.kind === 'business' ? result.result.status : null).toBe('error');
      expect(current.runtime.getState()).toMatchObject({ status: 'ready', nodeId: fixture.nodeId, context: fixture.context });
      expect(current.requests).toEqual(fixture.expectedRequests);
    }
  });
});
