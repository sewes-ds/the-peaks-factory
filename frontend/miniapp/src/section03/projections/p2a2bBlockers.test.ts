import { describe, expect, it, vi } from 'vitest';
import { section03VisibleJson } from '../testPresentation';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
} from '../../foundation/graphRuntime';
import {
  validatePresentationFormValue,
  type PresentationFormDraftController,
} from '../../foundation/presentation';
import {
  P2A2B_CARD_ALL,
  P2A2B_CARD_NONE,
  SECTION03_P2A2B_FIXTURES,
  SECTION03_P2A2B_FIXTURE_IDS,
  type Section03P2A2bFixture,
} from '../fixtures/p2a2bBlockers';
import { createSection03Program } from '../program';
import { section03EmployeeBlockersRemain } from '../program/commands';
import { SECTION03_NODE_IDS } from '../program/ids';
import { validateSection03NodeContext } from '../program/registry';
import { createSection03ScreenProjection } from '../projection';
import { section03FormFields } from '../presentation';
import { projectSection03Generic } from './generic';
import { SECTION03_P1_SPECIALIZED_NODE_IDS } from './p1';
import { SECTION03_P2A1_SPECIALIZED_NODE_IDS } from './p2a1Employees';
import { SECTION03_P2A2A_SPECIALIZED_NODE_IDS } from './p2a2aShiftClose';
import { SECTION03_P2A2B_SPECIALIZED_NODE_IDS } from './p2a2bBlockers';

function controller(value: string, pending = false): PresentationFormDraftController {
  const definition = section03FormFields('S03-E13')[0]!;
  const validation = validatePresentationFormValue(definition, value);
  return {
    activationKey: 'fixture', fieldIds: Object.freeze(['quantity_produced']),
    field: () => ({ definition, value, validation, disabled: false, pending }),
    setValue: () => undefined, reset: () => undefined, valid: validation.valid,
    commit: () => {
      if (pending) throw Object.freeze({ code: 'FORM_PENDING' });
      if (!validation.valid) throw Object.freeze({ code: 'FORM_INVALID' });
      return Object.freeze({ quantity_produced: validation.normalizedValue });
    },
  };
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

async function projectFixture(fixture: Section03P2A2bFixture) {
  const calls: Array<Readonly<{ method: string; path: string; body: unknown }>> = [];
  const interactionStates: Array<Readonly<{ status: string }>> = [];
  let cardReads = 0;
  let releasePost: (() => void) | null = null;
  const postGate = fixture.pending
    ? new Promise<void>((resolve) => { releasePost = resolve; })
    : null;
  const fetchImpl = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(request)).pathname;
    const method = init?.method ?? 'GET';
    calls.push(Object.freeze({
      method, path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    }));
    if (method === 'POST') {
      if (postGate !== null) await postGate;
      return fixture.requestFailure ? response({ error: 'mutation failed' }, 503) : response({ id: 'DONE' });
    }
    if (path === '/manager/employees/EMP-BLOCK') {
      const value = cardReads++ === 0 ? fixture.initialResponse : fixture.freshResponse;
      return response(value);
    }
    return response({ error: path }, 404);
  });
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test', fetchImpl,
  })));
  const ready = await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context });
  if (ready.status !== 'ready') throw new Error(`${fixture.fixtureId}: ${JSON.stringify(ready)}`);
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: fixture.nodeId,
    onInteractionStateChange: (state) => { interactionStates.push(state); },
  });
  const projection = createSection03ScreenProjection({
    nodeId: fixture.nodeId, ready, actionFactory: binding.actionFactory,
    ...(fixture.nodeId === 'S03-E13' ? { formController: controller(fixture.formValue ?? '') } : {}),
  } as never);
  return { binding, calls, interactionStates, projection, ready, releasePost: () => releasePost?.(), runtime };
}

function actions(projection: Awaited<ReturnType<typeof projectFixture>>['projection']) {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>]
      : []);
}

function visibleProjection(projection: Awaited<ReturnType<typeof projectFixture>>['projection']): string {
  return section03VisibleJson({
    ariaLabel: projection.ariaLabel, fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (item.kind === 'form-field') return { ...item, controller: item.controller.field(item.fieldId) };
      if (!('interaction' in item)) return item;
      const { interaction: _interaction, ...visible } = item;
      return visible;
    }),
  });
}

describe('Section 03 P2A2b employee blocker projections', () => {
  it('owns the exact ordered four-node set and leaves 50 diagnostic nodes', () => {
    expect(SECTION03_P2A2B_SPECIALIZED_NODE_IDS).toEqual(['S03-E13', 'S03-E14', 'S03-E16', 'S03-E17']);
    const specialized = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
    ]);
    expect(specialized.size).toBe(20);
    expect(SECTION03_NODE_IDS.filter((id) => !specialized.has(id))).toHaveLength(50);
    for (const nodeId of specialized) expect(() => projectSection03Generic({ nodeId } as never)).toThrow();
  });

  it('owns the exact 7/9/6/7 immutable fixture distribution', () => {
    expect(SECTION03_P2A2B_FIXTURES).toHaveLength(29);
    expect(new Set(SECTION03_P2A2B_FIXTURE_IDS).size).toBe(29);
    expect(Object.fromEntries(SECTION03_P2A2B_SPECIALIZED_NODE_IDS.map((nodeId) => [
      nodeId, SECTION03_P2A2B_FIXTURES.filter((item) => item.nodeId === nodeId).length,
    ]))).toEqual({ 'S03-E13': 7, 'S03-E14': 9, 'S03-E16': 6, 'S03-E17': 7 });
    for (const fixture of SECTION03_P2A2B_FIXTURES) {
      expect(() => validateSection03NodeContext(fixture.nodeId, fixture.context)).not.toThrow();
      expect(Object.isFrozen(fixture)).toBe(true);
      expect(fixture.fixtureId.startsWith(`${fixture.nodeId}:`)).toBe(true);
    }
  });

  it('projects exact ordered items, text absence and actions for every fixture', async () => {
    for (const fixture of SECTION03_P2A2B_FIXTURES) {
      const { projection } = await projectFixture(fixture);
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId).toEqual(fixture.orderedItemIds);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId).toEqual(fixture.expectedActionIds);
      const visible = visibleProjection(projection);
      for (const value of fixture.visibleText) expect(visible, `${fixture.fixtureId}: ${value}`).toContain(value);
      for (const value of fixture.absentText) expect(visible, `${fixture.fixtureId}: ${value}`).not.toContain(value);
    }
  });

  it('defines exact E13 positive numeric form and normalizes valid values', async () => {
    expect(section03FormFields('S03-E13')).toEqual([{
      id: 'quantity_produced', kind: 'numeric', label: 'Количество', accessibilityLabel: 'Количество',
      required: true, numericRule: 'positive',
    }]);
    for (const id of ['empty', 'malformed', 'zero', 'negative']) {
      const fixture = SECTION03_P2A2B_FIXTURES.find((item) => item.fixtureId === `S03-E13:${id}`)!;
      expect((await projectFixture(fixture)).projection.bridgeProjection.items[1])
        .toMatchObject({ interaction: { baseAvailability: 'disabled' } });
    }
    const decimal = SECTION03_P2A2B_FIXTURES.find((item) => item.fixtureId === 'S03-E13:valid-decimal')!;
    const next = actions((await projectFixture(decimal)).projection).find((item) => item.actionId === 'navigate0');
    expect(next?.event).toEqual({ employee_id: 'EMP-BLOCK', production_operation_id: 'PO-BLOCK', quantity_produced: '12.5' });
    const pendingProjection = await projectFixture({ ...decimal, formValue: '12.5' });
    const pendingInput = { nodeId: decimal.nodeId, ready: pendingProjection.ready,
      actionFactory: pendingProjection.binding.actionFactory, formController: controller('12.5', true) };
    expect(createSection03ScreenProjection(pendingInput as never).bridgeProjection.items[1])
      .toMatchObject({ interaction: { baseAvailability: 'disabled' } });
  });

  it('derives exact deterministic blocker action authority from decoded employee cards', async () => {
    const fixture = SECTION03_P2A2B_FIXTURES.find((item) => item.fixtureId === 'S03-E14:valid-blockers-remain')!;
    const target = await projectFixture(fixture);
    expect(target.ready.projection).toMatchObject({ data: { availableActions: [
      'VIEW_SALARY', 'VIEW_COMPLETED_WORKS', 'BACK',
      'FINISH_PRODUCTION', 'FINISH_BREAK', 'FINISH_ADDITIONAL_WORK',
    ] } });
    expect(actions(target.projection).filter((item) => item.actionId === 'FINISH_PRODUCTION_BLOCKER')).toHaveLength(1);
    for (const id of ['S03-E14:blocker-absent', 'S03-E16:blocker-absent', 'S03-E17:blocker-absent']) {
      const absent = SECTION03_P2A2B_FIXTURES.find((item) => item.fixtureId === id)!;
      expect(actions((await projectFixture(absent)).projection).filter((item) => item.actionId?.startsWith('FINISH_'))).toEqual([]);
    }
  });

  it('decodes only the three fresh blocker fields and rejects invalid cards', () => {
    expect(section03EmployeeBlockersRemain(P2A2B_CARD_ALL)).toBe(true);
    expect(section03EmployeeBlockersRemain(P2A2B_CARD_NONE)).toBe(false);
    expect(() => section03EmployeeBlockersRemain({
      required_finish_pipeline: ['fake'], unrelated: { blockers: ['fake'] },
    })).toThrow();
  });

  it('posts exact requests and routes fresh blocker outcomes', async () => {
    for (const fixture of SECTION03_P2A2B_FIXTURES.filter((item) =>
      item.expectedRequest !== null && !item.pending && !item.requestFailure && !item.invalidFresh &&
      item.fixtureId.includes(item.fixtureId.includes('valid-blockers-remain') ? 'valid-blockers-remain' : 'valid-last-blocker'))
    ) {
      const target = await projectFixture(fixture);
      const business = actions(target.projection).find((item) => item.actionId?.startsWith('FINISH_'))!;
      const result = await target.binding.execute(business as never);
      expect(result.kind === 'business' && result.result.status === 'ready' ? result.result.activation.nodeId : null, fixture.fixtureId)
        .toBe(fixture.expectedOutcomeTarget);
      expect(target.calls.filter((call) => call.method === 'POST'), fixture.fixtureId).toEqual([fixture.expectedRequest]);
    }
  });

  it('fails closed on blocker identity mismatch without issuing requests', async () => {
    for (const id of ['S03-E14:operation-id-mismatch', 'S03-E17:id-mismatch']) {
      const fixture = SECTION03_P2A2B_FIXTURES.find((item) => item.fixtureId === id)!;
      const target = await projectFixture(fixture);
      expect(actions(target.projection).map((item) => item.actionId)).toEqual(['navigateBack0']);
      expect(target.calls.some((call) => call.method === 'POST')).toBe(false);
    }
  });

  it('retains the node and full context on request or fresh-decode failure', async () => {
    for (const fixture of SECTION03_P2A2B_FIXTURES.filter((item) => item.requestFailure || item.invalidFresh)) {
      const target = await projectFixture(fixture);
      const business = actions(target.projection).find((item) => item.actionId?.startsWith('FINISH_'))!;
      const result = await target.binding.execute(business as never);
      expect(result.kind === 'business' ? result.result.status : null, fixture.fixtureId).toBe('error');
      expect(target.runtime.getState()).toMatchObject({ status: 'ready', nodeId: fixture.nodeId, context: fixture.context });
    }
  });

  it('publishes pending mutation state used by the UI to suppress duplicate clicks', async () => {
    for (const fixture of SECTION03_P2A2B_FIXTURES.filter((item) => item.pending)) {
      const target = await projectFixture(fixture);
      const business = actions(target.projection).find((item) => item.actionId?.startsWith('FINISH_'))!;
      const first = target.binding.execute(business as never);
      await vi.waitFor(() => expect(target.calls.filter((call) => call.method === 'POST')).toHaveLength(1));
      expect(target.interactionStates).toContainEqual(expect.objectContaining({ status: 'pending' }));
      expect(target.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
      target.releasePost();
      await first;
      expect(target.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    }
  });
});
