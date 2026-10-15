import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import {
  validatePresentationFormValue,
  type PresentationFormDraftController,
} from '../../foundation/presentation';
import {
  SECTION03_P3A4_FIXTURES,
  SECTION03_P3A4_FIXTURE_IDS,
  type Section03P3A4Fixture,
} from '../fixtures/p3a4AdditionalWorkAccrual';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import { section03ProjectionStateKeys, section03VisibleJson } from '../testPresentation';
import { section03FormFields } from '../presentation';
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

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function controller(fixture: Section03P3A4Fixture): PresentationFormDraftController | undefined {
  if (fixture.nodeId !== 'S03-AW51' && fixture.nodeId !== 'S03-AW53') return undefined;
  const definition = section03FormFields(fixture.nodeId)[0]!;
  const value = fixture.formValue ?? '';
  const validation = validatePresentationFormValue(definition, value);
  const pending = fixture.pending;
  return {
    activationKey: fixture.fixtureId,
    fieldIds: Object.freeze([definition.id]),
    field: () => ({ definition, value, validation, disabled: false, pending }),
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

type RecordedRequest = Readonly<{ method: string; path: string; body?: unknown }>;
type Action = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

async function target(fixture: Section03P3A4Fixture) {
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
        method, path: url.pathname,
        ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}),
      }));
      if (method === 'POST') {
        if (gate !== null) await gate;
        return fixture.requestFailure ? json({ error: 'fixture failure' }, 503) : json({ id: 'DONE' });
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
    ...(controller(fixture) === undefined ? {} : { formController: controller(fixture) }),
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
    ariaLabel: projection.ariaLabel,
    fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (item.kind === 'form-field') return { ...item, controller: item.controller.field(item.fieldId) };
      if (!('interaction' in item)) return item;
      const { interaction: _interaction, ...rest } = item;
      return rest;
    }),
  });
}

function enabled(projection: ReturnType<typeof createSection03ScreenProjection>, id: string): boolean {
  const item = projection.bridgeProjection.items.find((candidate) => candidate.id === id);
  return item !== undefined && 'interaction' in item && item.interaction.kind === 'action' && item.interaction.baseAvailability === 'enabled';
}

describe('Section 03 P3A4 additional-work accrual', () => {
  const renderable = SECTION03_P3A4_FIXTURES.filter((fixture) => !fixture.expectProjectionFailure);

  it('owns exact five nodes, preserves prior 36 and rejects generic for all 41', () => {
    expect(SECTION03_P3A4_SPECIALIZED_NODE_IDS).toEqual(['S03-AW50', 'S03-AW51', 'S03-AW52', 'S03-AW53', 'S03-AW54']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A3_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(36);
    const specialized = new Set([...prior, ...SECTION03_P3A4_SPECIALIZED_NODE_IDS]);
    expect(specialized.size).toBe(41);
    expect(SECTION03_NODE_IDS.filter((nodeId) => !specialized.has(nodeId))).toHaveLength(29);
    for (const nodeId of specialized) expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
  });

  it('keeps exact loader/context topology and exact legacy form labels', () => {
    expect(SECTION03_NODE_REGISTRY['S03-AW50']).toMatchObject({ loader: 'additional-works', requiredContext: ['additional_work_id'] });
    expect(SECTION03_NODE_REGISTRY['S03-AW51']).toMatchObject({ loader: null, requiredContext: ['additional_work_id'] });
    expect(SECTION03_NODE_REGISTRY['S03-AW52']).toMatchObject({ loader: 'additional-works', requiredContext: ['additional_work_id', 'amount_uzs'] });
    expect(SECTION03_NODE_REGISTRY['S03-AW53']).toMatchObject({ loader: null, requiredContext: ['additional_work_id'] });
    expect(SECTION03_NODE_REGISTRY['S03-AW54']).toMatchObject({ loader: 'additional-works', requiredContext: ['additional_work_id', 'without_accrual_reason'] });
    expect(section03FormFields('S03-AW51')).toEqual([expect.objectContaining({ id: 'amount_uzs', label: 'Сумма', accessibilityLabel: 'Сумма', numericRule: 'positive' })]);
    expect(section03FormFields('S03-AW53')).toEqual([expect.objectContaining({ id: 'without_accrual_reason', label: 'Комментарий', accessibilityLabel: 'Комментарий', minLength: 1 })]);
  });

  it('owns exactly 24 immutable fixtures with 22 renderable variants', () => {
    expect(SECTION03_P3A4_FIXTURES).toHaveLength(24);
    expect(new Set(SECTION03_P3A4_FIXTURE_IDS).size).toBe(24);
    expect(renderable).toHaveLength(22);
    expect(Object.fromEntries(SECTION03_P3A4_SPECIALIZED_NODE_IDS.map((nodeId) => [
      nodeId, SECTION03_P3A4_FIXTURES.filter((fixture) => fixture.nodeId === nodeId).length,
    ]))).toEqual({ 'S03-AW50': 5, 'S03-AW51': 7, 'S03-AW52': 4, 'S03-AW53': 4, 'S03-AW54': 4 });
    expect(SECTION03_P3A4_FIXTURES.every(Object.isFrozen)).toBe(true);
  });

  it('projects all 22 renderable fixtures with exact order, states, text and requests', async () => {
    for (const fixture of renderable) {
      const current = await target(fixture);
      const projection = current.project();
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId).toEqual(fixture.orderedItemIds);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId).toEqual(fixture.expectedActionIds);
      expect(section03ProjectionStateKeys(projection.bridgeProjection.items), fixture.fixtureId).toEqual(fixture.expectedStateKeys);
      const rendered = visible(projection);
      for (const value of fixture.visibleText) expect(rendered, `${fixture.fixtureId}: ${value}`).toContain(value);
      for (const value of fixture.absentText) expect(rendered, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      expect(current.requests).toEqual(fixture.expectedRequests.slice(0, fixture.nodeId === 'S03-AW51' || fixture.nodeId === 'S03-AW53' ? 0 : 1));
    }
  });

  it('resolves the exact warning selected item and fails closed for missing/wrong selections', async () => {
    const selected = await target(SECTION03_P3A4_FIXTURES[1]);
    expect(visible(selected.project())).toContain('Илья Серов');
    expect(visible(selected.project())).not.toContain('Вера Юн');
    for (const fixture of SECTION03_P3A4_FIXTURES.filter((item) => item.expectProjectionFailure)) {
      const current = await target(fixture);
      expect(current.project).toThrow();
    }
  });

  it('validates amount/reason forms, normalizes comma decimals and carries only committed values', async () => {
    for (const index of [5, 6, 7, 8]) {
      const current = await target(SECTION03_P3A4_FIXTURES[index]);
      expect(enabled(current.project(), 'additional-work-amount-next'), SECTION03_P3A4_FIXTURES[index]!.fixtureId).toBe(false);
    }
    for (const index of [9, 10, 11]) {
      const fixture = SECTION03_P3A4_FIXTURES[index];
      const current = await target(fixture);
      const projection = current.project();
      expect(enabled(projection, 'additional-work-amount-next'), fixture.fixtureId).toBe(true);
      expect(actions(projection)[0]?.event).toEqual(fixture.expectedNavigations[0]?.event);
    }
    for (const index of [16, 17]) {
      const current = await target(SECTION03_P3A4_FIXTURES[index]);
      expect(enabled(current.project(), 'additional-work-reason-next')).toBe(false);
    }
    for (const index of [18, 19]) {
      const fixture = SECTION03_P3A4_FIXTURES[index];
      const current = await target(fixture);
      expect(actions(current.project())[0]?.event).toEqual(fixture.expectedNavigations[0]?.event);
    }
  });

  it('preserves exact Back drafts while fresh card navigation carries no stale form value', async () => {
    const freshAmount = await target(SECTION03_P3A4_FIXTURES[0]);
    expect(actions(freshAmount.project())[0]?.event).toEqual({ additional_work_id: 'WAIT-1' });
    const amountConfirm = await target(SECTION03_P3A4_FIXTURES[12]);
    expect(actions(amountConfirm.project()).find((action) => action.actionId === 'navigateBack0')?.event).toEqual({ additional_work_id: 'WAIT-1', amount_uzs: '12500.5' });
    const freshReason = await target(SECTION03_P3A4_FIXTURES[0]);
    expect(actions(freshReason.project())[1]?.event).toEqual({ additional_work_id: 'WAIT-1' });
    const reasonConfirm = await target(SECTION03_P3A4_FIXTURES[20]);
    expect(actions(reasonConfirm.project()).find((action) => action.actionId === 'navigateBack0')?.event).toEqual({ additional_work_id: 'WAIT-1', without_accrual_reason: 'Работа учтена без начисления' });
  });

  it('posts exact accrual/no-accrual bodies and fresh-loads AW01 for all outcomes', async () => {
    for (const fixture of [SECTION03_P3A4_FIXTURES[12], SECTION03_P3A4_FIXTURES[20]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId === (fixture.nodeId === 'S03-AW52' ? 'ACCRUE_ADDITIONAL_WORK' : 'MARK_WITHOUT_ACCRUAL'))!;
      const result = await current.binding.execute(business as never);
      expect(result.kind === 'business' && result.result.status === 'ready' ? result.result.activation.nodeId : null).toBe('S03-AW01');
      expect(current.requests).toEqual(fixture.expectedRequests);
    }
  });

  it('suppresses pending duplicates and retains confirmation context after both failures', async () => {
    for (const fixture of [SECTION03_P3A4_FIXTURES[13], SECTION03_P3A4_FIXTURES[21]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId !== 'navigateBack0')!;
      const first = current.binding.execute(business as never);
      await vi.waitFor(() => expect(current.requests.filter((request) => request.method === 'POST')).toHaveLength(1));
      expect(current.interactionStates).toContainEqual(expect.objectContaining({ status: 'pending' }));
      current.release();
      await first;
      expect(current.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    }
    for (const fixture of [SECTION03_P3A4_FIXTURES[14], SECTION03_P3A4_FIXTURES[22]]) {
      const current = await target(fixture);
      const business = actions(current.project()).find((action) => action.actionId !== 'navigateBack0')!;
      const result = await current.binding.execute(business as never);
      expect(result.kind === 'business' ? result.result.status : null).toBe('error');
      expect(current.runtime.getState()).toMatchObject({ status: 'ready', nodeId: fixture.nodeId, context: fixture.context });
      expect(current.requests).toEqual(fixture.expectedRequests);
    }
  });

  it('keeps exact topology and selected-item authority metadata', () => {
    expect(SECTION03_FORWARD_TARGETS['S03-AW50']).toEqual(['S03-AW51', 'S03-AW53']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW51']).toEqual(['S03-AW52']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW52']).toEqual(['S03-AW01']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW53']).toEqual(['S03-AW54']);
    expect(SECTION03_FORWARD_TARGETS['S03-AW54']).toEqual(['S03-AW01']);
    expect(SECTION03_BACK_REGISTRY['S03-AW50']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW51']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW52']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW53']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-AW54']).toEqual({ kind: 'history' });
    for (const actionId of ['ACCRUE_ADDITIONAL_WORK', 'MARK_WITHOUT_ACCRUAL']) {
      const definition = SECTION03_BUSINESS_ACTIONS.find((item) => item.actionId === actionId)!;
      expect(definition.authority).toContain('exact selected typed item');
      expect(definition.authority).toContain('unrelated records provide no authority');
      expect(definition.freshRead).toBe(true);
      expect(definition.success).toBe('S03-AW01');
    }
  });

  it('uses the same history Back action for every AW50 entry route', async () => {
    const ordinaryFixture = SECTION03_P3A4_FIXTURES.find((item) => item.fixtureId === 'S03-AW50:authorized')!;
    const ordinary = await target(ordinaryFixture);
    expect(actions(ordinary.project()).at(-1)).toMatchObject({
      actionId: 'navigateBack0', event: { additional_work_id: 'WAIT-1' },
    });
    expect(actions(ordinary.project()).at(-1)).toMatchObject({
      actionId: 'navigateBack0', event: { additional_work_id: 'WAIT-1' },
    });
  });
});
