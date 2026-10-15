import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import { validatePresentationFormValue, type PresentationFormDraftController } from '../../foundation/presentation';
import {
  P4A3_PRODUCTION_CARD_RESPONSE,
  P4A3_WORKPLACE_AUTHORIZED_RESPONSE,
  SECTION03_P4A3_FIXTURES,
  SECTION03_P4A3_FIXTURE_IDS,
  type Section03P4A3Fixture,
} from '../fixtures/p4a3FinancialCorrectionReversal';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import { isSection03ContextScalarOnly } from '../program/context';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import { createSection03ScreenProjection } from '../projection';
import {
  section03ProjectionControlKeys,
  section03ProjectionStateKeys,
  section03ResolvedAppearanceKey,
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
import { SECTION03_P4A2_SPECIALIZED_NODE_IDS } from './p4a2FinancialCorrectionCreate';
import { SECTION03_P4A3_SPECIALIZED_NODE_IDS, Section03P4A3ProjectionError } from './p4a3FinancialCorrectionReversal';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function formController(fixture: Section03P4A3Fixture): PresentationFormDraftController | undefined {
  if (fixture.nodeId !== 'S03-CF24') return undefined;
  const definition = section03FormFields('S03-CF24')[0]!;
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
      return Object.freeze({ reversal_reason: validation.normalizedValue });
    },
  };
}

type RecordedRequest = Readonly<{ method: string; path: string; body?: unknown }>;
type ProjectedAction = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

async function target(fixture: Section03P4A3Fixture) {
  const requests: RecordedRequest[] = [];
  const interactionStates: Array<Readonly<{ status: string }>> = [];
  let release: (() => void) | undefined;
  const gate = fixture.mutationOutcome === 'pending-duplicate'
    ? new Promise<void>((resolve) => { release = resolve; })
    : null;
  const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
    baseUrl: 'https://fixture.test',
    fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(request));
      const method = init?.method ?? 'GET';
      const search = new URLSearchParams(url.search);
      search.delete('_');
      requests.push(Object.freeze({
        method,
        path: `${url.pathname}${search.size === 0 ? '' : `?${search.toString()}`}`,
        ...(typeof init?.body === 'string' ? { body: JSON.parse(init.body) } : {}),
      }));
      if (method === 'GET') {
        return json(url.pathname === '/manager/workplace-state' ? fixture.workplaceResponse : fixture.primaryResponse);
      }
      if (gate !== null) await gate;
      return fixture.mutationOutcome === 'failure' ? json({ error: 'fixture failure' }, 503) : json({ accepted: true });
    }),
  })));
  const ready = await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context });
  if (ready.status !== 'ready') throw new Error(`${fixture.fixtureId}: activation failed`);
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: fixture.nodeId,
    onInteractionStateChange: (state) => interactionStates.push(state),
  });
  const controller = formController(fixture);
  const project = () => createSection03ScreenProjection({
    nodeId: fixture.nodeId,
    ready,
    actionFactory: binding.actionFactory,
    ...(controller === undefined ? {} : { formController: controller }),
  } as never);
  return { binding, interactionStates, project, release: () => release?.(), requests, runtime };
}

function actions(projection: ReturnType<typeof createSection03ScreenProjection>): readonly ProjectedAction[] {
  return projection.bridgeProjection.items.flatMap((item) =>
    'interaction' in item && item.interaction.kind === 'action'
      ? [item.interaction.action as ProjectedAction]
      : []);
}

function visible(projection: ReturnType<typeof createSection03ScreenProjection>): string {
  return section03VisibleJson({
    ariaLabel: projection.ariaLabel,
    fixedTopTitle: projection.fixedTopTitle,
    items: projection.bridgeProjection.items.map((item) => {
      if (item.kind === 'form-field') return item.controller.field(item.fieldId);
      if ('interaction' in item) {
        const { interaction: _interaction, ...rest } = item;
        return rest;
      }
      return item;
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

describe('Section 03 P4A3 financial correction reversal', () => {
  it('owns exact CF20-CF25 tuple after 48 prior nodes and leaves CP00 as first planned node', () => {
    expect(SECTION03_P4A3_SPECIALIZED_NODE_IDS).toEqual(['S03-CF20', 'S03-CF21', 'S03-CF22', 'S03-CF23', 'S03-CF24', 'S03-CF25']);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A3_SPECIALIZED_NODE_IDS, ...SECTION03_P3A4_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A1_SPECIALIZED_NODE_IDS, ...SECTION03_P4A2_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(48);
    expect(SECTION03_P4A3_SPECIALIZED_NODE_IDS.every((nodeId) => !prior.has(nodeId))).toBe(true);
    const verified = new Set([...prior, ...SECTION03_P4A3_SPECIALIZED_NODE_IDS]);
    expect(verified.size).toBe(54);
    expect(SECTION03_NODE_IDS.find((nodeId) => !verified.has(nodeId))).toBe('S03-CP00');
  });

  it('keeps exact context, topology, Back and unchanged reversal business contracts', () => {
    const nodes = [
      ['S03-CF20', 'employees', []],
      ['S03-CF21', null, ['employee_id']],
      ['S03-CF22', 'employee-completed-works', ['employee_id', 'period']],
      ['S03-CF23', 'employee-completed-work-card', ['employee_id', 'period', 'work_type', 'operation_id']],
      ['S03-CF24', null, ['employee_id', 'period', 'work_type', 'operation_id', 'salary_entry_id']],
      ['S03-CF25', 'employee-completed-work-card', ['employee_id', 'period', 'work_type', 'operation_id', 'salary_entry_id', 'reversal_reason']],
    ] as const;
    for (const [nodeId, loader, requiredContext] of nodes) {
      expect(SECTION03_NODE_REGISTRY[nodeId]).toMatchObject({ loader, requiredContext });
    }
    expect(SECTION03_FORWARD_TARGETS['S03-CF20']).toEqual(['S03-CF21']);
    expect(SECTION03_FORWARD_TARGETS['S03-CF25']).toEqual(['S03-C00']);
    expect(SECTION03_BACK_REGISTRY['S03-CF20']).toEqual({ kind: 'history' });
    expect(SECTION03_BACK_REGISTRY['S03-CF25']).toEqual({ kind: 'history' });
    expect(SECTION03_BUSINESS_ACTIONS.find((item) => item.actionId === 'REVERSE_SALARY_ENTRY')).toMatchObject({
      nodes: ['S03-CF25'], method: 'POST', path: '/salary-entries/:salary_entry_id/reverse', success: 'S03-C00', freshRead: true,
    });
  });

  it('defines exact Comment form and leaves earlier verified bindings unchanged', () => {
    expect(section03FormFields('S03-CF24')).toEqual([{
      id: 'reversal_reason', kind: 'multiline', label: 'Комментарий', accessibilityLabel: 'Комментарий', required: true, minLength: 1,
    }]);
    expect(SECTION03_FORM_FIELDS['S03-CF12'].label).toBe('Сумма');
    expect(SECTION03_FORM_FIELDS['S03-CF13'].label).toBe('Комментарий');
    expect(SECTION03_FORM_FIELDS['S03-AW53'].label).toBe('Комментарий');
    expect(SECTION03_FORM_FIELDS['S03-CP15'].label).toBe('Комментарий');
  });

  it('owns 40 deeply frozen scalar fixtures: 24 renderable and 16 fail-closed', () => {
    expect(SECTION03_P4A3_FIXTURES).toHaveLength(40);
    expect(new Set(SECTION03_P4A3_FIXTURE_IDS).size).toBe(40);
    expect(SECTION03_P4A3_FIXTURES.filter((item) => !item.expectProjectionFailure)).toHaveLength(24);
    expect(SECTION03_P4A3_FIXTURES.filter((item) => item.expectProjectionFailure)).toHaveLength(16);
    expect(SECTION03_P4A3_FIXTURES.every((item) => isSection03ContextScalarOnly(item.context))).toBe(true);
    expectDeepFrozen(SECTION03_P4A3_FIXTURES);
  });

  it('projects every renderable fixture with explicit order, text, state, controls, actions and requests', async () => {
    for (const fixture of SECTION03_P4A3_FIXTURES.filter((item) => !item.expectProjectionFailure)) {
      const current = await target(fixture);
      const projection = current.project();
      expect(projection.bridgeProjection.items.map((item) => item.id), fixture.fixtureId).toEqual(fixture.orderedItemIds);
      expect(section03ProjectionStateKeys(projection.bridgeProjection.items), fixture.fixtureId).toEqual(fixture.expectedStateKeys);
      expect(section03ProjectionControlKeys(projection.bridgeProjection.items), fixture.fixtureId).toEqual(fixture.expectedControlKeys);
      expect(actions(projection).map((action) => action.actionId), fixture.fixtureId).toEqual(fixture.expectedActionIds);
      const rendered = visible(projection);
      fixture.visibleText.forEach((value) => expect(rendered, `${fixture.fixtureId}: ${value}`).toContain(value));
      fixture.absentText.forEach((value) => expect(rendered, `${fixture.fixtureId}: ${value}`).not.toContain(value));
      expect(current.requests, fixture.fixtureId).toEqual(fixture.expectedRequests.filter((item) => item.method === 'GET'));
    }
  });

  it('uses scalar employee/list/card events, fresh salary-entry eligibility and exact form trimming/Back behavior', async () => {
    const employees = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF20:representative')!);
    expect(actions(employees.project())[0]?.event).toEqual({ employee_id: 'EMP-WHITE' });
    const period = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF21:period-menu')!);
    expect(actions(period.project()).slice(0, 4).map((action) => action.event)).toEqual([
      { employee_id: 'EMP-REV', period: 'today' }, { employee_id: 'EMP-REV', period: 'week' },
      { employee_id: 'EMP-REV', period: 'month' }, { employee_id: 'EMP-REV', period: 'last_30_days' },
    ]);
    const list = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF22:mixed')!);
    expect(actions(list.project()).slice(0, 2).map((action) => action.event)).toEqual([
      { employee_id: 'EMP-REV', period: 'today', work_type: 'production', operation_id: 'OP-REV-PROD' },
      { employee_id: 'EMP-REV', period: 'today', work_type: 'additional_work', operation_id: 'OP-REV-AW' },
    ]);
    const card = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF23:production-reversible')!);
    expect(actions(card.project())[0]?.event).toEqual({ employee_id: 'EMP-REV', period: 'today', work_type: 'production', operation_id: 'OP-REV-PROD', salary_entry_id: 'SAL-REV-1' });
    const pastFixture = SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF23:production-reversible')!;
    const pastCard = await target({ ...pastFixture, context: { ...pastFixture.context, period: 'month' } });
    expect(enabled(pastCard.project(), 'reversal-open-confirmation')).toBe(false);
    for (const name of ['empty', 'whitespace', 'pending']) {
      const form = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === `S03-CF24:${name}`)!);
      expect(enabled(form.project(), 'reversal-reason-next')).toBe(false);
    }
    const trimmed = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF24:trimmed')!);
    expect(actions(trimmed.project())[0]?.event).toEqual({ employee_id: 'EMP-REV', period: 'today', work_type: 'production', operation_id: 'OP-REV-PROD', salary_entry_id: 'SAL-REV-1', reversal_reason: 'Подтверждённая причина сторно' });
    expect(actions(trimmed.project())[1]?.event).toEqual({ employee_id: 'EMP-REV', period: 'today', work_type: 'production', operation_id: 'OP-REV-PROD' });
    const multiline = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF24:multiline')!);
    expect(actions(multiline.project())[0]?.event?.reversal_reason).toBe('Первая строка\nВторая строка');
  });

  it('fresh-loads CF25 card then workplace, renders exact danger confirmation and fails closed on all identity/authority mismatches', async () => {
    expect('available_actions' in P4A3_WORKPLACE_AUTHORIZED_RESPONSE).toBe(false);
    expect(P4A3_WORKPLACE_AUTHORIZED_RESPONSE.sections.employees as unknown).toMatchObject({
      production_active_clear_count: 2,
      production_break_count: 1,
      production_downtime_count: 2,
      additional_work_active_clear_count: 1,
      additional_work_break_count: 0,
      open_shift_without_work_count: 1,
    });
    const activationFailureIds = new Set([
      'S03-CF25:empty-reason',
      'S03-CF25:missing-authority',
      'S03-CF25:unrelated-nested-authority',
    ]);
    for (const fixture of SECTION03_P4A3_FIXTURES.filter((item) =>
      item.expectProjectionFailure && !activationFailureIds.has(item.fixtureId))) {
      const current = await target(fixture);
      expect(current.project, fixture.fixtureId).toThrow(Section03P4A3ProjectionError);
      expect(current.requests).toEqual(fixture.expectedRequests);
    }
    for (const fixtureId of activationFailureIds) {
      const fixture = SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === fixtureId)!;
      const requests: RecordedRequest[] = [];
      const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
        baseUrl: 'https://fixture.test',
        fetchImpl: vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(String(request)).pathname;
          requests.push({ method: init?.method ?? 'GET', path });
          return json(path === '/manager/workplace-state' ? fixture.workplaceResponse : fixture.primaryResponse);
        }),
      })));
      expect((await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context })).status).toBe('error');
      expect(requests.some((request) => request.method === 'POST')).toBe(false);
    }
    const cf23 = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF23:production-reversible')!);
    expect(cf23.requests).toEqual([{ method: 'GET', path: '/manager/employees/EMP-REV/completed-works/production/OP-REV-PROD' }]);
    const authorized = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF25:production-authorized')!);
    expect(authorized.requests).toEqual([
      { method: 'GET', path: '/manager/employees/EMP-REV/completed-works/production/OP-REV-PROD' },
      { method: 'GET', path: '/manager/workplace-state' },
    ]);
    const projection = authorized.project();
    const card = projection.bridgeProjection.items[0];
    expect(card).toMatchObject({ id: 'reversal-confirmation', ariaLabel: 'Подтверждение сторно' });
    expect(section03ResolvedAppearanceKey(card!)).toBe('state-danger');
    expect(card?.kind === 'card' ? card.lines.map((line) => line.id) : []).toEqual([
      'reversal-confirm-prompt', 'reversal-confirm-employee', 'reversal-confirm-date',
      'reversal-confirm-operation', 'reversal-confirm-salary', 'reversal-confirm-comment',
    ]);
    expect(actions(projection)[0]?.event).toEqual({ salary_entry_id: 'SAL-REV-1', reversal_reason: 'Подтверждённая причина сторно' });
    expect(actions(projection)[1]?.event).toEqual({ employee_id: 'EMP-REV', period: 'today', work_type: 'production', operation_id: 'OP-REV-PROD', salary_entry_id: 'SAL-REV-1', reversal_reason: 'Подтверждённая причина сторно' });
    const rendered = visible(projection);
    ['Подтвердите сторно:', 'Мария Орлова', '03.08.2026', 'SKU: Вал приводной', 'Количество: 8', '90000 сум', 'Подтверждённая причина сторно'].forEach((value) => expect(rendered).toContain(value));
    expect(rendered).not.toContain('09:45');
    ['SAL-REV-1', 'OP-REV-PROD', 'EMP-REV'].forEach((value) => expect(rendered).not.toContain(value));

    const additional = await target(SECTION03_P4A3_FIXTURES.find((item) =>
      item.fixtureId === 'S03-CF25:additional-authorized')!);
    expect(additional.requests).toEqual([
      { method: 'GET', path: '/manager/employees/EMP-REV/completed-works/additional_work/OP-REV-AW' },
      { method: 'GET', path: '/manager/workplace-state' },
    ]);
    expect(additional.requests.filter((item) => item.method === 'POST')).toHaveLength(0);
    const additionalProjection = additional.project();
    expect(additionalProjection.bridgeProjection.items.map((item) => item.id)).toEqual([
      'reversal-confirmation', 'reversal-confirm', 'reversal-confirm-back',
    ]);
    expect(enabled(additionalProjection, 'reversal-confirm')).toBe(true);
    expect(actions(additionalProjection).filter((item) => item.actionId === 'REVERSE_SALARY_ENTRY')).toHaveLength(1);
    const additionalVisible = visible(additionalProjection);
    ['Мария Орлова', 'Пересчёт оснастки', '40000 сум', 'Подтверждённая причина сторно']
      .forEach((value) => expect(additionalVisible).toContain(value));
  });

  it('executes exact fixture-local POST once, suppresses pending duplicates, retains failure and transitions once to C00', async () => {
    const successFixture = SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF25:production-authorized')!;
    const success = await target(successFixture);
    const successResult = await success.binding.execute(actions(success.project())[0] as never);
    expect(successResult.kind === 'business' && successResult.result.status === 'ready' ? successResult.result.activation.nodeId : null).toBe('S03-C00');
    expect(success.requests.slice(-1)).toEqual([{ method: 'POST', path: '/salary-entries/SAL-REV-1/reverse', body: { reason: 'Подтверждённая причина сторно' } }]);
    const pending = await target(SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF25:pending-duplicate')!);
    const pendingAction = actions(pending.project())[0]!;
    const first = pending.binding.execute(pendingAction as never);
    await vi.waitFor(() => expect(pending.requests.filter((item) => item.method === 'POST')).toHaveLength(1));
    expect(pending.interactionStates).toContainEqual(expect.objectContaining({ status: 'pending' }));
    expect(pending.requests.filter((item) => item.method === 'POST')).toHaveLength(1);
    pending.release();
    await first;
    const failureFixture = SECTION03_P4A3_FIXTURES.find((item) => item.fixtureId === 'S03-CF25:post-failure')!;
    const failure = await target(failureFixture);
    const failureResult = await failure.binding.execute(actions(failure.project())[0] as never);
    expect(failureResult.kind === 'business' ? failureResult.result.status : null).toBe('error');
    expect(failure.runtime.getState()).toMatchObject({ status: 'ready', nodeId: 'S03-CF25', context: failureFixture.context });
    expect(failure.requests.filter((item) => item.method === 'POST')).toHaveLength(1);
  });

  it('rejects malformed/duplicate employees and fails activation when either CF25 fresh source fails', async () => {
    const response = SECTION03_P4A3_FIXTURES[0]!.primaryResponse as { readonly employees: readonly unknown[] };
    const baseEmployee = structuredClone(response.employees[0]);
    for (const employees of [[baseEmployee, baseEmployee], [{ ...baseEmployee as object, employee_id: '' }]]) {
      const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
        baseUrl: 'https://fixture.test',
        fetchImpl: vi.fn(async () => json({ section: 'S03', screen: 'S03-E01', title: 'Сотрудники', employees, available_actions: ['BACK'] })),
      })));
      const ready = await runtime.activate({ nodeId: 'S03-CF20', context: {} });
      if (ready.status === 'ready') {
        const binding = createPeaksGraphReadyNodeBinding({ runtime, presentationExecution: createGraphPresentationExecutionRuntime(runtime), nodeId: 'S03-CF20', onInteractionStateChange: () => undefined });
        expect(() => createSection03ScreenProjection({ nodeId: 'S03-CF20', ready: ready as never, actionFactory: binding.actionFactory })).toThrow();
      } else {
        expect(ready.status).toBe('error');
      }
    }
    for (const failingPath of ['/manager/employees/EMP-REV/completed-works/production/OP-REV-PROD', '/manager/workplace-state']) {
      const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
        baseUrl: 'https://fixture.test',
        fetchImpl: vi.fn(async (request: RequestInfo | URL) => {
          const path = new URL(String(request)).pathname;
          if (path === failingPath) return json({ error: 'fresh source failed' }, 503);
          return json(path === '/manager/workplace-state' ? P4A3_WORKPLACE_AUTHORIZED_RESPONSE : P4A3_PRODUCTION_CARD_RESPONSE);
        }),
      })));
      expect((await runtime.activate({ nodeId: 'S03-CF25', context: {
        employee_id: 'EMP-REV', period: 'today', work_type: 'production', operation_id: 'OP-REV-PROD',
        salary_entry_id: 'SAL-REV-1', reversal_reason: 'Подтверждённая причина сторно',
      } })).status).toBe('error');
    }
  });
});
