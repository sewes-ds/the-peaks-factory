import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import {
  validatePresentationFormValue,
  type PresentationFormDraftController,
} from '../../foundation/presentation';
import {
  SECTION03_P4A2_FIXTURES,
  SECTION03_P4A2_FIXTURE_IDS,
  type Section03P4A2Fixture,
} from '../fixtures/p4a2FinancialCorrectionCreate';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { decodeSection03Context } from '../program/context';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_NODE_REGISTRY, validateSection03NodeContext } from '../program/registry';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import {
  section03ProjectionControlKeys,
  section03ProjectionStateKeys,
  section03VisibleJson,
} from '../testPresentation';
import { SECTION03_FORM_FIELDS, section03FormFields } from '../presentation';
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
import {
  SECTION03_P4A2_SPECIALIZED_NODE_IDS,
  Section03P4A2ProjectionError,
} from './p4a2FinancialCorrectionCreate';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function controller(fixture: Section03P4A2Fixture): PresentationFormDraftController | undefined {
  if (fixture.nodeId === 'S03-CF14') return undefined;
  const definition = section03FormFields(fixture.nodeId)[0]!;
  const value = fixture.formValue ?? '';
  const validation = validatePresentationFormValue(definition, value);
  return {
    activationKey: fixture.fixtureId,
    fieldIds: Object.freeze([definition.id]),
    field: () => ({ definition, value, validation, disabled: false, pending: fixture.formPending }),
    setValue: () => undefined,
    reset: () => undefined,
    valid: validation.valid,
    commit: () => {
      if (fixture.formPending) throw Object.freeze({ code: 'FORM_PENDING' });
      if (!validation.valid) throw Object.freeze({ code: 'FORM_INVALID' });
      return Object.freeze({ [definition.id]: validation.normalizedValue });
    },
  };
}

type RecordedRequest = Readonly<{ method: string; path: string; body?: unknown }>;
type Action = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

async function target(
  fixture: Section03P4A2Fixture,
  createResult: Readonly<Record<string, string>> = Object.freeze({ id: 'RESULT-1' }),
) {
  const requests: RecordedRequest[] = [];
  const interactionStates: Array<Readonly<{ status: string }>> = [];
  let release: (() => void) | undefined;
  const gate = fixture.mutationOutcome === 'pending-duplicate'
    ? new Promise<void>((resolve) => { release = resolve; })
    : null;
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(request)).pathname;
      const method = init?.method ?? 'GET';
      requests.push(Object.freeze({
        method,
        path,
        ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}),
      }));
      if (method === 'GET') {
        return json(path === '/manager/workplace-state' ? fixture.workplaceResponse : fixture.correctionResponse);
      }
      if (path === '/salary-corrections/apply') {
        if (gate !== null) await gate;
        if (fixture.mutationOutcome === 'create-failure') return json({ error: 'create' }, 503);
        if (fixture.mutationOutcome === 'malformed-result') return json({ accepted: true });
        if (fixture.mutationOutcome === 'approve-failure') return json({ error: 'approve' }, 503);
        return json(createResult);
      }
      return json({ error: path }, 404);
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
    ...(controller(fixture) === undefined ? {} : { formController: controller(fixture) }),
  } as never);
  return { binding, interactionStates, project, release: () => release?.(), requests, runtime };
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
  return item !== undefined && 'interaction' in item && item.interaction.kind === 'action'
    && item.interaction.baseAvailability === 'enabled';
}

function expectDeepFrozen(value: unknown): void {
  if (typeof value !== 'object' || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(expectDeepFrozen);
}

describe('Section 03 P4A2 financial correction create and approve', () => {
  const renderable = SECTION03_P4A2_FIXTURES.filter((fixture) => !fixture.expectProjectionFailure);

  it('owns exactly CF12-CF14, preserves prior 45 and leaves 22 planned nodes starting at CF20', () => {
    expect(SECTION03_P4A2_SPECIALIZED_NODE_IDS).toEqual(['S03-CF12', 'S03-CF13', 'S03-CF14']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A3_SPECIALIZED_NODE_IDS, ...SECTION03_P3A4_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A1_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(45);
    expect(SECTION03_P4A2_SPECIALIZED_NODE_IDS.every((nodeId) => !prior.has(nodeId))).toBe(true);
    const verified = new Set([...prior, ...SECTION03_P4A2_SPECIALIZED_NODE_IDS]);
    expect(verified.size).toBe(48);
    expect(SECTION03_NODE_IDS.filter((nodeId) => !verified.has(nodeId))).toEqual([
      'S03-CF20', 'S03-CF21', 'S03-CF22', 'S03-CF23', 'S03-CF24', 'S03-CF25',
      'S03-CP00', 'S03-CP10', 'S03-CP11', 'S03-CP12', 'S03-CP13',
      'S03-CP14', 'S03-CP15', 'S03-CP16', 'S03-CP20', 'S03-NOT01', 'S03-R01', 'S03-R10',
      'S03-R11', 'S03-R12', 'S03-R13', 'S03-R14',
    ]);
  });

  it('keeps exact context, topology and Back contracts and rejects absent/unknown context', () => {
    expect(SECTION03_NODE_REGISTRY['S03-CF12']).toMatchObject({ loader: null, requiredContext: ['employee_id', 'employee_shift_id', 'correction_mode', 'salary_correction_type_id'] });
    expect(SECTION03_NODE_REGISTRY['S03-CF13']).toMatchObject({ loader: null, requiredContext: ['employee_id', 'employee_shift_id', 'correction_mode', 'salary_correction_type_id', 'amount_uzs'] });
    expect(SECTION03_NODE_REGISTRY['S03-CF14']).toMatchObject({ loader: 'salary-correction-context', requiredContext: ['employee_id', 'employee_shift_id', 'correction_mode', 'salary_correction_type_id', 'amount_uzs', 'financial_correction_reason'] });
    expect(SECTION03_FORWARD_TARGETS['S03-CF12']).toEqual(['S03-CF13']);
    expect(SECTION03_FORWARD_TARGETS['S03-CF13']).toEqual(['S03-CF14']);
    expect(SECTION03_FORWARD_TARGETS['S03-CF14']).toEqual(['S03-C00']);
    expect(SECTION03_BACK_REGISTRY['S03-CF12']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-CF13']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-CF14']).toEqual({ kind: 'history' });
    for (const fixture of [SECTION03_P4A2_FIXTURES[0]!, SECTION03_P4A2_FIXTURES[8]!, SECTION03_P4A2_FIXTURES[15]!]) {
      const { salary_correction_type_id: _missing, ...invalid } = fixture.context;
      expect(() => validateSection03NodeContext(fixture.nodeId, invalid)).toThrow('salary_correction_type_id');
    }
    expect(() => decodeSection03Context({ employee_id: 'EMP-1', unknown_scalar: 'x' })).toThrow('unknown field');
  });

  it('keeps exact legacy labels without changing earlier form definitions', () => {
    expect(section03FormFields('S03-CF12')).toEqual([expect.objectContaining({ id: 'amount_uzs', label: 'Сумма', accessibilityLabel: 'Сумма', numericRule: 'positive' })]);
    expect(section03FormFields('S03-CF13')).toEqual([expect.objectContaining({ id: 'financial_correction_reason', label: 'Комментарий', accessibilityLabel: 'Комментарий', minLength: 1 })]);
    expect(Object.fromEntries(Object.entries(SECTION03_FORM_FIELDS).filter(([nodeId]) => nodeId !== 'S03-CF12' && nodeId !== 'S03-CF13').map(([nodeId, field]) => [nodeId, field.label]))).toEqual({
      'S03-M03C': 'Комментарий завершения простоя', 'S03-D12': 'Комментарий к критическому простою',
      'S03-E10': 'Причина завершения смены', 'S03-E13': 'Количество', 'S03-AW51': 'Сумма',
      'S03-AW53': 'Комментарий', 'S03-CF24': 'Комментарий', 'S03-CP14': 'Количество',
      'S03-CP15': 'Комментарий', 'S03-R11': 'Дата начала',
      'S03-R12': 'Дата окончания',
    });
  });

  it('owns 29 deeply frozen fixtures, 21 renderable and eight fail-closed', () => {
    expect(SECTION03_P4A2_FIXTURES).toHaveLength(29);
    expect(new Set(SECTION03_P4A2_FIXTURE_IDS).size).toBe(29);
    expect(renderable).toHaveLength(21);
    expect(SECTION03_P4A2_FIXTURES.filter((fixture) => fixture.expectProjectionFailure)).toHaveLength(8);
    expectDeepFrozen(SECTION03_P4A2_FIXTURES);
  });

  it('projects every renderable fixture with exact order, state, controls, text, events and activation reads', async () => {
    for (const fixture of renderable) {
      const current = await target(fixture);
      const projection = current.project();
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId).toEqual(fixture.orderedItemIds);
      expect(section03ProjectionStateKeys(projection.bridgeProjection.items), fixture.fixtureId).toEqual(fixture.expectedStateKeys);
      expect(section03ProjectionControlKeys(projection.bridgeProjection.items), fixture.fixtureId).toEqual(fixture.expectedControlKeys);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId).toEqual(fixture.expectedActionIds);
      const rendered = visible(projection);
      for (const value of fixture.visibleText) expect(rendered, `${fixture.fixtureId}: ${value}`).toContain(value);
      for (const value of fixture.absentText) expect(rendered, `${fixture.fixtureId}: ${value}`).not.toContain(value);
      expect(current.requests).toEqual(fixture.expectedActivationRequests);
      if (fixture.expectedBusinessEvent !== null) {
        expect(actions(projection).find((action) => action.actionId === 'CREATE_APPROVE_SALARY_CORRECTION')?.event).toEqual(fixture.expectedBusinessEvent);
      }
    }
  });

  it('validates both forms, normalizes comma decimals, trims comments and preserves exact Back drafts', async () => {
    for (const index of [0, 1, 2, 3, 7]) {
      const current = await target(SECTION03_P4A2_FIXTURES[index]!);
      expect(enabled(current.project(), 'financial-correction-amount-next')).toBe(false);
    }
    const amount = await target(SECTION03_P4A2_FIXTURES[5]!);
    expect(actions(amount.project())[0]?.event).toEqual(SECTION03_P4A2_FIXTURES[5]!.expectedNavigations[0]!.event);
    expect(actions(amount.project())[1]?.event).toEqual({ employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1' });
    for (const index of [8, 9, 13]) {
      const current = await target(SECTION03_P4A2_FIXTURES[index]!);
      expect(enabled(current.project(), 'financial-correction-comment-next')).toBe(false);
    }
    const comment = await target(SECTION03_P4A2_FIXTURES[10]!);
    expect(actions(comment.project())[0]?.event).toEqual(SECTION03_P4A2_FIXTURES[10]!.expectedNavigations[0]!.event);
    expect(actions(comment.project())[1]?.event).toEqual({ employee_id: 'EMP-1', employee_shift_id: 'SHIFT-1', correction_mode: 'accrual', salary_correction_type_id: 'TYPE-ACCRUAL', amount_uzs: '12500.5' });
    const confirmation = await target(SECTION03_P4A2_FIXTURES[15]!);
    expect(actions(confirmation.project())[1]?.event).toEqual(SECTION03_P4A2_FIXTURES[15]!.context);
  });

  it('fresh-loads exactly correction context then workplace and fails closed for every authority mismatch', async () => {
    const activationFailureIds = new Set([
      'S03-CF14:invalid-incoming-reason',
      'S03-CF14:missing-open-corrections',
    ]);
    for (const fixture of SECTION03_P4A2_FIXTURES.filter((item) =>
      item.expectProjectionFailure && !activationFailureIds.has(item.fixtureId))) {
      const current = await target(fixture);
      expect(current.project).toThrow(Section03P4A2ProjectionError);
      expect(current.requests).toEqual(fixture.expectedActivationRequests);
    }
    for (const fixtureId of activationFailureIds) {
      const fixture = SECTION03_P4A2_FIXTURES.find((item) => item.fixtureId === fixtureId)!;
      const requests: RecordedRequest[] = [];
      const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
        baseUrl: 'https://fixture.test',
        fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(String(request)).pathname;
          requests.push({ method: init?.method ?? 'GET', path });
          return json(path === '/manager/workplace-state' ? fixture.workplaceResponse : fixture.correctionResponse);
        }),
      })));
      const activation = await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context });
      expect(activation.status).toBe('error');
      expect(requests.some((request) => request.method === 'POST')).toBe(false);
    }
  });

  it('applies exact atomic accrual/withholding requests with the canonical result id', async () => {
    for (const fixture of [SECTION03_P4A2_FIXTURES[15]!, SECTION03_P4A2_FIXTURES[16]!] as const) {
      const current = await target(fixture, Object.freeze({ id: 'RESULT-1' }));
      const business = actions(current.project()).find((action) => action.actionId === 'CREATE_APPROVE_SALARY_CORRECTION')!;
      const result = await current.binding.execute(business as never);
      expect(result.kind === 'business' && result.result.status === 'ready' ? result.result.activation.nodeId : null).toBe('S03-C00');
      expect(current.requests).toEqual([...fixture.expectedActivationRequests, ...fixture.expectedMutationRequests]);
    }
  });

  it('marks the interaction pending to suppress UI duplicates and retains CF14 after all failures', async () => {
    const pendingFixture = SECTION03_P4A2_FIXTURES[17]!;
    const pending = await target(pendingFixture);
    const pendingAction = actions(pending.project())[0]!;
    const first = pending.binding.execute(pendingAction as never);
    await vi.waitFor(() => expect(pending.requests.filter((request) => request.method === 'POST')).toHaveLength(1));
    expect(pending.interactionStates).toContainEqual(expect.objectContaining({ status: 'pending' }));
    expect(pending.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    pending.release();
    await first;
    expect(pending.requests).toEqual([...pendingFixture.expectedActivationRequests, ...pendingFixture.expectedMutationRequests]);

    for (const fixture of SECTION03_P4A2_FIXTURES.slice(18, 21)) {
      const current = await target(fixture);
      const business = actions(current.project())[0]!;
      const result = await current.binding.execute(business as never);
      expect(result.kind === 'business' ? result.result.status : null).toBe('error');
      expect(current.runtime.getState()).toMatchObject({ status: 'ready', nodeId: 'S03-CF14', context: fixture.context });
      expect(current.requests).toEqual([...fixture.expectedActivationRequests, ...fixture.expectedMutationRequests]);
    }
  });
});
