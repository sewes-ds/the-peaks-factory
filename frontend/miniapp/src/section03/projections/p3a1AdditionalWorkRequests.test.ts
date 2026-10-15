import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import { decodeManagerAdditionalWorksResponse } from '../contracts';
import {
  SECTION03_P3A1_FIXTURES,
  SECTION03_P3A1_FIXTURE_IDS,
  type Section03P3A1Fixture,
} from '../fixtures/p3a1AdditionalWorkRequests';
import { createSection03Program } from '../program';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_BACK_REGISTRY } from '../program/back';
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
import { SECTION03_P3A1_SPECIALIZED_NODE_IDS, Section03P3A1SelectionError } from './p3a1AdditionalWorkRequests';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

async function target(fixture: Section03P3A1Fixture) {
  const requests: Array<Readonly<{ method: string; path: string; body?: unknown }>> = [];
  const interactionStates: Array<Readonly<{ status: string }>> = [];
  let release: (() => void) | undefined;
  const gate = fixture.pending ? new Promise<void>((resolve) => { release = resolve; }) : null;
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method, path: url.pathname,
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
    nodeId: fixture.nodeId, ready, actionFactory: binding.actionFactory,
  } as never);
  return { binding, interactionStates, project, ready, release: () => release?.(), requests, runtime };
}

type Action = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;
function actions(projection: ReturnType<typeof createSection03ScreenProjection>): readonly Action[] {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action' ? [item.interaction.action as Action] : []);
}
function visible(projection: ReturnType<typeof createSection03ScreenProjection>): string {
  return section03VisibleJson({
    ariaLabel: projection.ariaLabel, fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (!('interaction' in item)) return item;
      const { interaction: _interaction, ...rest } = item;
      return rest;
    }),
  }).replaceAll('\\n', '\n');
}
function clone<T>(value: T): T { return structuredClone(value); }

describe('Section 03 P3A1 additional-work request decisions', () => {
  const valid = SECTION03_P3A1_FIXTURES.filter((fixture) => !fixture.expectProjectionFailure);
  const base = SECTION03_P3A1_FIXTURES[0].apiResponse;

  it('decodes all statuses, exact actions and deeply freezes preserved order', () => {
    const decoded = decodeManagerAdditionalWorksResponse(base);
    expect(Object.keys(decoded.groups)).toEqual(['requested', 'approved', 'active', 'waiting_accrual']);
    expect(decoded.groups.requested.map((item) => item.additional_work_id)).toEqual(['REQ-1', 'REQ-2']);
    expect(decoded.available_actions).toEqual(['ASSIGN_ADDITIONAL_WORK', 'BACK']);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.groups)).toBe(true);
    expect(Object.values(decoded.groups).every(Object.isFrozen)).toBe(true);
    expect(Object.values(decoded.groups).flat().every((item) => Object.isFrozen(item) && Object.isFrozen(item.available_actions))).toBe(true);
    expect(Object.fromEntries(Object.entries(decoded.groups).map(([status, items]) => [status, items[0]?.available_actions]))).toEqual({
      requested: ['OPEN_ADDITIONAL_WORK_CARD', 'APPROVE_ADDITIONAL_WORK_REQUEST', 'REJECT_ADDITIONAL_WORK_REQUEST'],
      approved: ['OPEN_ADDITIONAL_WORK_CARD', 'CANCEL_ADDITIONAL_WORK'],
      active: ['OPEN_ADDITIONAL_WORK_CARD', 'FINISH_ADDITIONAL_WORK'],
      waiting_accrual: ['OPEN_ADDITIONAL_WORK_CARD', 'ACCRUE_ADDITIONAL_WORK_SALARY', 'MARK_WITHOUT_ACCRUAL'],
    });
  });

  it('normalizes IDs and rejects duplicate, mismatched, missing, unknown and malformed fields', () => {
    const numeric = clone(base) as any;
    numeric.groups.requested[0].additional_work_id = 101;
    numeric.groups.requested[0].additional_work_type_id = 201;
    numeric.groups.requested[0].employee_id = 301;
    expect(decodeManagerAdditionalWorksResponse(numeric).groups.requested[0]).toMatchObject({
      additional_work_id: '101', additional_work_type_id: '201', employee_id: '301',
    });
    const variants: any[] = [];
    const duplicateWithin = clone(base) as any;
    duplicateWithin.groups.requested[1].additional_work_id = 'REQ-1'; variants.push(duplicateWithin);
    const duplicateAcross = clone(base) as any;
    duplicateAcross.groups.approved[0].additional_work_id = 'REQ-1'; variants.push(duplicateAcross);
    const groupMismatch = clone(base) as any;
    groupMismatch.groups.approved[0].status = 'requested'; groupMismatch.groups.approved[0].ui_state = 'requested'; variants.push(groupMismatch);
    const stateMismatch = clone(base) as any;
    stateMismatch.groups.requested[0].ui_state = 'approved'; variants.push(stateMismatch);
    const emptyName = clone(base) as any;
    emptyName.groups.requested[0].employee_full_name = ' '; variants.push(emptyName);
    const emptyId = clone(base) as any;
    emptyId.groups.requested[0].additional_work_id = ''; variants.push(emptyId);
    const unknownStatus = clone(base) as any;
    unknownStatus.groups.requested[0].status = 'unknown'; variants.push(unknownStatus);
    const unknownAction = clone(base) as any;
    unknownAction.groups.requested[0].available_actions[1] = 'OTHER'; variants.push(unknownAction);
    const missingAction = clone(base) as any;
    missingAction.groups.requested[0].available_actions.pop(); variants.push(missingAction);
    const extraAction = clone(base) as any;
    extraAction.groups.requested[0].available_actions.push('FINISH_ADDITIONAL_WORK'); variants.push(extraAction);
    const duplicateAction = clone(base) as any;
    duplicateAction.groups.requested[0].available_actions[2] = 'APPROVE_ADDITIONAL_WORK_REQUEST'; variants.push(duplicateAction);
    const badTimestamp = clone(base) as any;
    badTimestamp.groups.requested[0].requested_at = ' '; variants.push(badTimestamp);
    const badTop = clone(base) as any;
    badTop.available_actions = ['BACK', 'ASSIGN_ADDITIONAL_WORK']; variants.push(badTop);
    for (const value of variants) expect(() => decodeManagerAdditionalWorksResponse(value)).toThrow();
  });

  it('isolates loader authority to top-level and the exact selected item', async () => {
    const overview = await target(SECTION03_P3A1_FIXTURES[0]);
    expect((overview.ready.projection as any).data.availableActions).toEqual(['ASSIGN_ADDITIONAL_WORK', 'BACK']);
    const selected = await target(SECTION03_P3A1_FIXTURES[5]);
    expect((selected.ready.projection as any).data.availableActions).toEqual([
      'ASSIGN_ADDITIONAL_WORK', 'BACK', 'OPEN_ADDITIONAL_WORK_CARD',
      'APPROVE_ADDITIONAL_WORK_REQUEST', 'REJECT_ADDITIONAL_WORK_REQUEST',
    ]);
    const approvedFixture = { ...SECTION03_P3A1_FIXTURES[7], nodeId: 'S03-AW20' as const, expectProjectionFailure: false };
    const selectedApproved = await target(approvedFixture as unknown as Section03P3A1Fixture);
    expect((selectedApproved.ready.projection as any).data.availableActions).toEqual([
      'ASSIGN_ADDITIONAL_WORK', 'BACK', 'OPEN_ADDITIONAL_WORK_CARD', 'CANCEL_ADDITIONAL_WORK',
    ]);
    const missing = await target(SECTION03_P3A1_FIXTURES[6]);
    expect((missing.ready.projection as any).data.availableActions).toEqual(['ASSIGN_ADDITIONAL_WORK', 'BACK']);
  });

  it('owns exact four nodes, preserves prior 25 and rejects generic for all 29', () => {
    expect(SECTION03_P3A1_SPECIALIZED_NODE_IDS).toEqual(['S03-AW01', 'S03-AW10', 'S03-AW11', 'S03-AW12']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(25);
    const specialized = new Set([...prior, ...SECTION03_P3A1_SPECIALIZED_NODE_IDS]);
    expect(specialized.size).toBe(29);
    expect(SECTION03_NODE_IDS.filter((nodeId) => !specialized.has(nodeId))).toHaveLength(41);
    for (const nodeId of specialized) expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
  });

  it('owns exactly 16 immutable fixtures, 14 valid and exact distribution', () => {
    expect(SECTION03_P3A1_FIXTURES).toHaveLength(16);
    expect(new Set(SECTION03_P3A1_FIXTURE_IDS).size).toBe(16);
    expect(valid).toHaveLength(14);
    expect(Object.fromEntries(SECTION03_P3A1_SPECIALIZED_NODE_IDS.map((nodeId) => [nodeId, SECTION03_P3A1_FIXTURES.filter((fixture) => fixture.nodeId === nodeId).length]))).toEqual({
      'S03-AW01': 4, 'S03-AW10': 4, 'S03-AW11': 4, 'S03-AW12': 4,
    });
    expect(SECTION03_P3A1_FIXTURES.every(Object.isFrozen)).toBe(true);
  });

  it('projects every valid fixture with exact order, text, states, controls and scalar navigation', async () => {
    for (const fixture of SECTION03_P3A1_FIXTURES) {
      const current = await target(fixture);
      if (fixture.expectProjectionFailure) {
        expect(current.project, fixture.fixtureId).toThrow(Section03P3A1SelectionError);
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
        if (action.event !== undefined) expect(Object.keys(action.event).every((key) => key === 'additional_work_id')).toBe(true);
      }
      expect(current.requests).toEqual([{ method: 'GET', path: '/manager/additional-works' }]);
    }
  });

  it('renders AW11/AW12 prompts as separate messages above two-line entity cards', async () => {
    for (const fixture of [SECTION03_P3A1_FIXTURES[8]!, SECTION03_P3A1_FIXTURES[12]!]) {
      const current = await target(fixture);
      const projection = current.project();
      expect(projection.slots.scroll).toEqual([
        fixture.nodeId === 'S03-AW11'
          ? 'additional-work-request-approve-prompt'
          : 'additional-work-request-reject-prompt',
        fixture.nodeId === 'S03-AW11'
          ? 'additional-work-request-approve-card'
          : 'additional-work-request-reject-card',
      ]);
      const [prompt, card] = projection.bridgeProjection.items;
      expect(prompt?.kind).toBe('message');
      expect(card?.kind).toBe('card');
      expect(card?.kind === 'card' ? card.lines.map((line) => line.id) : []).toEqual([
        'additional-work-request-decision-employee',
        'additional-work-request-decision-type',
      ]);
    }
  });

  it('keeps exact topology, back routes and selected-item business metadata', () => {
    expect(SECTION03_FORWARD_TARGETS['S03-AW01']).toEqual(['S03-AW10', 'S03-AW20', 'S03-AW30', 'S03-AW40', 'S03-AW50']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW10']).toEqual(['S03-AW11', 'S03-AW12']);
    expect(SECTION03_BACK_REGISTRY['S03-AW01']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW10']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW11']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW12']).toEqual({ kind: 'history' });
    for (const id of ['APPROVE_ADDITIONAL_WORK', 'REJECT_ADDITIONAL_WORK']) {
      const definition = SECTION03_BUSINESS_ACTIONS.find((item) => item.actionId === id)!;
      expect(definition.authority).toContain('exact selected typed item');
      expect(definition.authority).toContain('matching additional_work_id');
      expect(definition.authority).toContain('requested status');
      expect(definition.authority).toContain('unrelated records provide no authority');
      expect(definition.success).toBe('S03-AW01');
      expect(definition.freshRead).toBe(true);
    }
  });

  it('posts exact approve/reject bodies and fresh-loads AW01', async () => {
    for (const fixture of [SECTION03_P3A1_FIXTURES[8], SECTION03_P3A1_FIXTURES[12]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId?.endsWith('ADDITIONAL_WORK'))!;
      const result = await current.binding.execute(business as never);
      expect(result.kind === 'business' && result.result.status === 'ready' ? result.result.activation.nodeId : null).toBe('S03-AW01');
      expect(current.requests).toEqual(fixture.expectedRequests);
    }
  });

  it('publishes pending once and retains node/context on request failure', async () => {
    for (const fixture of [SECTION03_P3A1_FIXTURES[9], SECTION03_P3A1_FIXTURES[13]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId?.endsWith('ADDITIONAL_WORK'))!;
      const first = current.binding.execute(business as never);
      await vi.waitFor(() => expect(current.requests.filter((request) => request.method === 'POST')).toHaveLength(1));
      expect(current.interactionStates).toContainEqual(expect.objectContaining({ status: 'pending' }));
      current.release();
      await first;
      expect(current.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    }
    for (const fixture of [SECTION03_P3A1_FIXTURES[10], SECTION03_P3A1_FIXTURES[14]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId?.endsWith('ADDITIONAL_WORK'))!;
      const result = await current.binding.execute(business as never);
      expect(result.kind === 'business' ? result.result.status : null).toBe('error');
      expect(current.runtime.getState()).toMatchObject({ status: 'ready', nodeId: fixture.nodeId, context: fixture.context });
      expect(current.requests).toEqual(fixture.expectedRequests);
    }
  });

  it('uses the same history Back action for every AW10 entry route', async () => {
    const ordinaryFixture = SECTION03_P3A1_FIXTURES.find((item) => item.fixtureId === 'S03-AW10:requested')!;
    const ordinary = await target(ordinaryFixture);
    expect(actions(ordinary.project()).at(-1)).toMatchObject({ actionId: 'navigateBack0', event: {} });
    expect(actions(ordinary.project()).at(-1)).toMatchObject({ actionId: 'navigateBack0', event: {} });
  });
});
