import { describe, expect, it, vi } from 'vitest';
import {
  section03ProjectionControlKeys,
  section03ResolvedAppearanceKey,
  section03VisibleJson,
} from '../testPresentation';
import { ApiClient } from '../../foundation/apiClient';
import { createPeaksGraphReadyNodeBinding } from '../../foundation/graphRenderer';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../../foundation/graphRuntime';
import { validatePresentationFormValue, type PresentationFormDraftController } from '../../foundation/presentation';
import {
  P4A4_EMPLOYEE_ID,
  P4A4_EMPLOYEES_RESPONSE,
  P4A4_EMPLOYEE_OPERATIONS_RESPONSE,
  P4A4_MACHINE_ID,
  P4A4_MACHINES_RESPONSE,
  P4A4_OPERATION_ID,
  P4A4_PRODUCTION_OPERATION_ID,
  P4A4_WORKPLACE_AUTHORIZED_RESPONSE,
  SECTION03_P4A4_FIXTURES,
  SECTION03_P4A4_FIXTURE_IDS,
  type Section03P4A4Fixture,
} from '../fixtures/p4a4ProductionCorrection';
import { createSection03Program } from '../program';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import { isSection03ContextScalarOnly } from '../program/context';
import { SECTION03_NODE_IDS } from '../program/ids';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import { createSection03ScreenProjection } from '../projection';
import { createSection03RuntimeBinding } from '../runtimeBinding';
import { section03FormFields } from '../presentation';
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
import {
  formatCompletedOperationDate,
  SECTION03_P4A4_SPECIALIZED_NODE_IDS,
} from './p4a4ProductionCorrection';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function formController(fixture: Section03P4A4Fixture): PresentationFormDraftController | undefined {
  if (fixture.nodeId !== 'S03-CP14' && fixture.nodeId !== 'S03-CP15') return undefined;
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
type ProjectedAction = Readonly<{ actionId?: string; event?: Readonly<Record<string, unknown>> }>;

async function target(fixture: Section03P4A4Fixture) {
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
      return fixture.mutationOutcome === 'failure' ? json({ error: 'fixture failure' }, 503) : json({ id: 'RESULT-1' });
    }),
  })));
  const activation = await runtime.activate({ nodeId: fixture.nodeId, context: fixture.context });
  if (activation.status !== 'ready') return {
    activation, binding: undefined, interactionStates, project: undefined,
    release: () => release?.(), requests, runtime,
  } as const;
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution: createGraphPresentationExecutionRuntime(runtime),
    nodeId: fixture.nodeId,
    onInteractionStateChange: (state) => interactionStates.push(state),
  });
  const controller = formController(fixture);
  const project = () => createSection03ScreenProjection({
    nodeId: fixture.nodeId,
    ready: activation,
    actionFactory: binding.actionFactory,
    ...(controller === undefined ? {} : { formController: controller }),
  } as never);
  return { activation, binding, interactionStates, project, release: () => release?.(), requests, runtime } as const;
}

type Target = Awaited<ReturnType<typeof target>>;

function requireReady(current: Target): asserts current is Target & {
  binding: NonNullable<Target['binding']>;
  project: NonNullable<Target['project']>;
} {
  if (current.activation.status !== 'ready' || current.binding === undefined || current.project === undefined) {
    throw new Error('Expected ready fixture target.');
  }
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

function fixture(id: string): Section03P4A4Fixture {
  const value = SECTION03_P4A4_FIXTURES.find((item) => item.fixtureId === id);
  if (value === undefined) throw new Error(`Missing fixture ${id}.`);
  return value;
}

describe('Section 03 P4A4 production correction', () => {
  it('owns the exact nine-node tuple after 54 prior nodes and leaves NOT01 first planned', () => {
    expect(SECTION03_P4A4_SPECIALIZED_NODE_IDS).toEqual([
      'S03-CP00', 'S03-CP10', 'S03-CP11', 'S03-CP12', 'S03-CP13',
      'S03-CP14', 'S03-CP15', 'S03-CP16', 'S03-CP20',
    ]);
    const prior = new Set<string>([
      ...SECTION03_P1_SPECIALIZED_NODE_IDS, ...SECTION03_P2A1_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2A2A_SPECIALIZED_NODE_IDS, ...SECTION03_P2A2B_SPECIALIZED_NODE_IDS,
      ...SECTION03_P2B1_SPECIALIZED_NODE_IDS, ...SECTION03_P2B2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A1_SPECIALIZED_NODE_IDS, ...SECTION03_P3A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P3A3_SPECIALIZED_NODE_IDS, ...SECTION03_P3A4_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A1_SPECIALIZED_NODE_IDS, ...SECTION03_P4A2_SPECIALIZED_NODE_IDS,
      ...SECTION03_P4A3_SPECIALIZED_NODE_IDS,
    ]);
    expect(prior.size).toBe(54);
    expect(SECTION03_P4A4_SPECIALIZED_NODE_IDS.every((nodeId) => !prior.has(nodeId))).toBe(true);
    const verified = new Set([...prior, ...SECTION03_P4A4_SPECIALIZED_NODE_IDS]);
    expect(verified.size).toBe(63);
    expect(SECTION03_NODE_IDS.find((nodeId) => !verified.has(nodeId))).toBe('S03-NOT01');
  });

  it('keeps the exact closed node, loader, Back and repaired command contracts', () => {
    const loaders = {
      'S03-CP00': null, 'S03-CP10': 'employees', 'S03-CP11': null,
      'S03-CP12': 'production-completed-operations', 'S03-CP13': 'production-completed-operations',
      'S03-CP14': null, 'S03-CP15': null, 'S03-CP16': 'production-completed-operations',
      'S03-CP20': 'machines',
    } as const;
    for (const nodeId of SECTION03_P4A4_SPECIALIZED_NODE_IDS) {
      expect(SECTION03_NODE_REGISTRY[nodeId].loader).toBe(loaders[nodeId]);
    }
    expect(SECTION03_BACK_REGISTRY['S03-CP11']).toEqual({ kind: 'history' });
    expect(SECTION03_BUSINESS_ACTIONS.find((item) => item.actionId === 'CREATE_PRODUCTION_CORRECTION')).toMatchObject({
      nodes: ['S03-CP16'], method: 'POST', path: '/production-operation-corrections/apply', success: 'S03-C00', freshRead: true,
    });
    expect(section03FormFields('S03-CP14')).toEqual([{
      id: 'correction_quantity', kind: 'numeric', label: 'Количество', accessibilityLabel: 'Количество', required: true,
      numericRule: 'non-negative',
    }]);
    expect(section03FormFields('S03-CP15')).toEqual([{
      id: 'production_correction_reason', kind: 'multiline', label: 'Комментарий', accessibilityLabel: 'Комментарий',
      required: true, minLength: 1,
    }]);
  });

  it('owns deeply frozen scalar fixtures with every required renderable and fail-closed family', () => {
    expect(SECTION03_P4A4_FIXTURES).toHaveLength(54);
    expect(new Set(SECTION03_P4A4_FIXTURE_IDS).size).toBe(54);
    expect(SECTION03_P4A4_FIXTURE_IDS).toEqual(SECTION03_P4A4_FIXTURES.map((item) => item.fixtureId));
    expect(SECTION03_P4A4_FIXTURES.filter((item) => !item.expectProjectionFailure)).toHaveLength(35);
    expect(SECTION03_P4A4_FIXTURES.filter((item) => item.expectProjectionFailure)).toHaveLength(19);
    expect(SECTION03_P4A4_FIXTURES.every((item) => isSection03ContextScalarOnly(item.context))).toBe(true);
    expectDeepFrozen(SECTION03_P4A4_FIXTURES);
  });

  it('projects every renderable fixture with exact visible/absent text and scope-specific request count', async () => {
    for (const currentFixture of SECTION03_P4A4_FIXTURES.filter((item) => !item.expectProjectionFailure)) {
      const current = await target(currentFixture);
      expect(current.activation.status, currentFixture.fixtureId).toBe('ready');
      requireReady(current);
      const projection = current.project();
      const rendered = visible(projection);
      currentFixture.visibleText.forEach((value) => expect(rendered, `${currentFixture.fixtureId}: ${value}`).toContain(value));
      currentFixture.absentText.forEach((value) => expect(rendered, `${currentFixture.fixtureId}: ${value}`).not.toContain(value));
      const expectedGets = currentFixture.nodeId === 'S03-CP16' ? 2
        : SECTION03_NODE_REGISTRY[currentFixture.nodeId].loader === null ? 0 : 1;
      expect(current.requests.filter((item) => item.method === 'GET'), currentFixture.fixtureId).toHaveLength(expectedGets);
    }
  });

  it('preserves scope/list/mode/form scalar events and history Back context', async () => {
    const menu = await target(fixture('S03-CP00:menu'));
    requireReady(menu);
    expect(actions(menu.project()).map((item) => item.event)).toEqual([
      { correction_scope: 'employee' }, { correction_scope: 'machine' }, {},
    ]);
    const employeePeriod = await target(fixture('S03-CP11:employee'));
    requireReady(employeePeriod);
    expect(actions(employeePeriod.project()).map((item) => item.event)).toEqual([
      { correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID, period: 'today' },
      { correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID, period: 'week' },
      { correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID, period: 'month' },
      { correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID, period: 'last_30_days' },
      { correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID },
    ]);
    const operation = await target(fixture('S03-CP12:employee-mixed'));
    requireReady(operation);
    const operationProjection = operation.project();
    const operationCard = operationProjection.bridgeProjection.items[0]!;
    expect(operationCard.kind).toBe('card');
    expect(section03ResolvedAppearanceKey(operationCard)).toBe('state-positive');
    expect(operationCard.kind === 'card'
      ? operationCard.lines.map((line) => [line.id, line.label, line.value])
      : []).toEqual([
      ['production-correction-operation-OP-PC-date', { kind: 'text', text: 'Дата' }, { kind: 'text', text: '03.08.2026' }],
      ['production-correction-operation-OP-PC-sku', { kind: 'text', text: 'SKU' }, { kind: 'text', text: 'Корпус редуктора' }],
      ['production-correction-operation-OP-PC-quantity', { kind: 'text', text: 'Количество' }, { kind: 'text', text: '10' }],
      ['production-correction-operation-OP-PC-machine', { kind: 'text', text: 'Станок' }, { kind: 'text', text: 'Станок производственной корректировки' }],
    ]);
    expect(operationCard.kind === 'card' ? operationCard.ariaLabel : null).toBe(
      'Выбрать производственную операцию: дата 03.08.2026, SKU Корпус редуктора, станок Станок производственной корректировки',
    );
    expect(actions(operation.project())[0]?.event).toEqual({
      correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID, period: 'today', work_type: 'production', operation_id: P4A4_OPERATION_ID,
    });
    const pastOperationFixture = fixture('S03-CP12:employee-mixed');
    const pastOperation = await target({
      ...pastOperationFixture,
      context: { ...pastOperationFixture.context, period: 'month' },
    });
    requireReady(pastOperation);
    expect(enabled(pastOperation.project(), `production-correction-operation-${P4A4_OPERATION_ID}`)).toBe(false);
    const mode = await target(fixture('S03-CP13:machine'));
    requireReady(mode);
    expect(actions(mode.project()).slice(0, 3).map((item) => item.event?.production_correction_mode)).toEqual(['increase', 'decrease', 'final']);
    expect(actions(mode.project())[3]?.event).toEqual({ correction_scope: 'machine', machine_id: P4A4_MACHINE_ID, period: 'today' });
    for (const name of ['empty', 'malformed', 'negative', 'zero-increase', 'pending']) {
      const quantity = await target(fixture(`S03-CP14:${name}`));
      requireReady(quantity);
      expect(enabled(quantity.project(), 'production-correction-quantity-next')).toBe(false);
    }
    const decimal = await target(fixture('S03-CP14:decimal'));
    requireReady(decimal);
    expect(actions(decimal.project())[0]?.event?.correction_quantity).toBe('2.5');
    for (const name of ['empty', 'whitespace', 'pending']) {
      const comment = await target(fixture(`S03-CP15:${name}`));
      requireReady(comment);
      expect(enabled(comment.project(), 'production-correction-comment-next')).toBe(false);
    }
    const multiline = await target(fixture('S03-CP15:multiline'));
    requireReady(multiline);
    expect(actions(multiline.project())[0]?.event?.production_correction_reason).toBe('Первая строка\nВторая строка');
    expect(actions(multiline.project())[1]?.event?.correction_quantity).toBe('2.5');
  });

  it('runs employee/machine chains with explicit scope and true history Back', async () => {
    const requestPaths: string[] = [];
    const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
      baseUrl: 'https://fixture.test',
      fetchImpl: vi.fn(async (request: RequestInfo | URL) => {
        const url = new URL(String(request));
        requestPaths.push(`${url.pathname}${url.search}`);
        if (url.pathname === '/manager/employees') return json(P4A4_EMPLOYEES_RESPONSE);
        if (url.pathname === '/manager/machines') return json(P4A4_MACHINES_RESPONSE);
        if (url.pathname.includes('/completed-works')) return json(P4A4_EMPLOYEE_OPERATIONS_RESPONSE);
        throw new Error(`Unexpected test request ${url.pathname}`);
      }),
    })));
    const presentationExecution = createGraphPresentationExecutionRuntime(runtime);
    const trace: Array<Readonly<{ nodeId: string; context: Readonly<Record<string, unknown>>; historyDepth: number }>> = [];
    const activated = await runtime.activate({ nodeId: 'S03-CP00', context: {} });
    expect(activated.status).toBe('ready');
    trace.push(Object.freeze({ nodeId: 'S03-CP00', context: Object.freeze({}), historyDepth: 0 }));

    const click = async (itemId: string) => {
      const ready = runtime.getState();
      if (ready.status !== 'ready') throw new Error(`Expected ready state before ${itemId}.`);
      const binding = createSection03RuntimeBinding({
        runtime,
        presentationExecution,
        nodeId: ready.nodeId,
        onInteractionStateChange: () => undefined,
      });
      const projection = createSection03ScreenProjection({
        nodeId: ready.nodeId,
        ready,
        actionFactory: binding.actionFactory,
      } as never);
      const item = projection.bridgeProjection.items.find((candidate) => candidate.id === itemId);
      if (item === undefined || !('interaction' in item) || item.interaction.kind !== 'action') {
        throw new Error(`Missing action ${itemId}.`);
      }
      const result = await binding.execute(item.interaction.action);
      expect(result.kind).toBe('presentation');
      if (result.kind !== 'presentation' || result.result.status !== 'ready') {
        throw new Error(`Navigation ${itemId} did not settle ready.`);
      }
      trace.push(Object.freeze({
        nodeId: result.result.activation.nodeId,
        context: Object.freeze({ ...result.result.activation.context }),
        historyDepth: result.result.historyDepthAfter,
      }));
    };

    await click('production-correction-by-employee');
    await click(`production-correction-employee-${P4A4_EMPLOYEE_ID}`);
    await click('production-correction-period-back');
    await click('production-correction-employees-back');
    await click('production-correction-by-machine');
    await click(`production-correction-machine-${P4A4_MACHINE_ID}`);
    await click('production-correction-period-back');
    await click('production-correction-machines-back');
    await click('production-correction-by-employee');
    await click(`production-correction-employee-${P4A4_EMPLOYEE_ID}`);
    await click('production-correction-period-today');
    await click('production-correction-operations-back');
    await click('production-correction-period-back');
    await click('production-correction-employees-back');
    await click('production-correction-by-machine');
    await click(`production-correction-machine-${P4A4_MACHINE_ID}`);
    await click('production-correction-period-back');

    expect(trace.map(({ nodeId }) => nodeId)).toEqual([
      'S03-CP00', 'S03-CP10', 'S03-CP11', 'S03-CP10', 'S03-CP00',
      'S03-CP20', 'S03-CP11', 'S03-CP20', 'S03-CP00',
      'S03-CP10', 'S03-CP11', 'S03-CP12', 'S03-CP11', 'S03-CP10', 'S03-CP00',
      'S03-CP20', 'S03-CP11', 'S03-CP20',
    ]);
    expect(trace.map(({ historyDepth }) => historyDepth)).toEqual([
      0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 1,
    ]);
    expect(trace[3]?.context).toEqual({ correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID });
    expect(trace[7]?.context).toEqual({ correction_scope: 'machine', machine_id: P4A4_MACHINE_ID });
    expect(trace[12]?.context).toEqual({ correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID, period: 'today' });
    expect(trace[13]?.context).toEqual({ correction_scope: 'employee', employee_id: P4A4_EMPLOYEE_ID });
    expect(trace[17]?.context).toEqual({ correction_scope: 'machine', machine_id: P4A4_MACHINE_ID });
    expect(trace.every(({ context }) => isSection03ContextScalarOnly(context))).toBe(true);
    expect(trace.every(({ context }) => !(context.employee_id !== undefined && context.machine_id !== undefined))).toBe(true);
    expect(requestPaths).toContain(`/manager/employees/${P4A4_EMPLOYEE_ID}/completed-works?period=today&type=production`);
  });

  it('formats completed-operation dates without time and rejects invalid calendar values', () => {
    expect(formatCompletedOperationDate('03.08.2026 12:30')).toBe('03.08.2026');
    expect(formatCompletedOperationDate('2026-08-03T12:30:00Z')).toBe('03.08.2026');
    expect(formatCompletedOperationDate('2026-08-03')).toBe('03.08.2026');
    for (const value of ['31.02.2026 12:30', '2026-02-31T12:30:00Z', '03/08/2026']) {
      expect(() => formatCompletedOperationDate(value)).toThrow('Invalid completed operation date.');
    }
  });

  it('fresh-loads operation then workplace and renders exact positive confirmation/event', async () => {
    for (const id of ['S03-CP16:employee-increase', 'S03-CP16:machine-final']) {
      const current = await target(fixture(id));
      expect(current.requests.slice(0, 2).map((item) => item.path), id).toEqual([
        id.includes('machine')
          ? `/manager/machines/${P4A4_MACHINE_ID}/completed-production-operations?period=today`
          : `/manager/employees/${P4A4_EMPLOYEE_ID}/completed-works?period=today&type=production`,
        '/manager/workplace-state',
      ]);
    }
    const current = await target(fixture('S03-CP16:employee-increase'));
    requireReady(current);
    const projection = current.project();
    const card = projection.bridgeProjection.items[0];
    expect(card).toMatchObject({ id: 'production-correction-confirmation' });
    expect(section03ResolvedAppearanceKey(card!)).toBe('state-positive');
    expect(card?.kind === 'card' ? card.lines.map((line) => line.id) : []).toEqual([
      'production-correction-confirm-prompt', 'production-correction-confirm-employee',
      'production-correction-confirm-machine', 'production-correction-confirm-sku',
      'production-correction-confirm-old', 'production-correction-confirm-delta', 'production-correction-confirm-new',
    ]);
    expect(projection.bridgeProjection.items[1]).toMatchObject({ id: 'production-correction-confirm' });
    expect(section03ProjectionControlKeys([projection.bridgeProjection.items[1]!])).toEqual(['action-positive']);
    expect(actions(projection)[0]?.event).toEqual({
      production_operation_id: P4A4_PRODUCTION_OPERATION_ID,
      quantity_produced: '10', correction_quantity: '12.5',
      production_correction_reason: 'Подтверждённая производственная корректировка',
    });
    expect(actions(projection)[1]?.event).toEqual(fixture('S03-CP16:employee-increase').context);
  });

  it('fails closed for every invalid identity/base/math/authority fixture with zero POST', async () => {
    for (const currentFixture of SECTION03_P4A4_FIXTURES.filter((item) => item.expectProjectionFailure)) {
      const current = await target(currentFixture);
      if (current.project !== undefined) expect(current.project, currentFixture.fixtureId).toThrow();
      else expect(current.activation.status, currentFixture.fixtureId).toBe('error');
      expect(current.requests.filter((item) => item.method === 'POST'), currentFixture.fixtureId).toHaveLength(0);
    }
  });

  it('executes exact increase/decrease/final fixture-local POSTs, suppresses pending duplicate and retains failure', async () => {
    const cases = [
      ['S03-CP16:employee-increase', '12.5'],
      ['S03-CP16:employee-decrease', '7.5'],
      ['S03-CP16:machine-final', '0'],
    ] as const;
    for (const [id, newQuantity] of cases) {
      const current = await target(fixture(id));
      requireReady(current);
      const result = await current.binding.execute(actions(current.project())[0] as never);
      expect(result.kind === 'business' && result.result.status === 'ready' ? result.result.activation.nodeId : null).toBe('S03-C00');
      expect(current.requests.filter((item) => item.method === 'POST')).toEqual([{
        method: 'POST', path: '/production-operation-corrections/apply', body: {
          production_operation_id: P4A4_PRODUCTION_OPERATION_ID, old_quantity: '10', new_quantity: newQuantity,
          reason: 'Подтверждённая производственная корректировка',
        },
      }]);
    }
    const pending = await target(fixture('S03-CP16:pending-duplicate'));
    requireReady(pending);
    const pendingAction = actions(pending.project())[0]!;
    const first = pending.binding.execute(pendingAction as never);
    await vi.waitFor(() => expect(pending.requests.filter((item) => item.method === 'POST')).toHaveLength(1));
    expect(pending.interactionStates).toContainEqual(expect.objectContaining({ status: 'pending' }));
    expect(pending.requests.filter((item) => item.method === 'POST')).toHaveLength(1);
    pending.release();
    await first;
    expect(pending.requests.filter((item) => item.method === 'POST')).toHaveLength(1);
    const failure = await target(fixture('S03-CP16:post-failure'));
    requireReady(failure);
    const failureResult = await failure.binding.execute(actions(failure.project())[0] as never);
    expect(failureResult.kind === 'business' ? failureResult.result.status : null).toBe('error');
    expect(failure.runtime.getState()).toMatchObject({ status: 'ready', nodeId: 'S03-CP16' });
    expect(failure.requests.filter((item) => item.method === 'POST')).toHaveLength(1);
  });

  it('fails activation when either CP16 fresh GET fails and never performs a real or external request', async () => {
    const context = fixture('S03-CP16:employee-increase').context;
    for (const failingPath of [
      `/manager/employees/${P4A4_EMPLOYEE_ID}/completed-works`, '/manager/workplace-state',
    ]) {
      const requests: string[] = [];
      const runtime = createGraphActivationRuntime(createSection03Program(new ApiClient({
        baseUrl: 'https://fixture.test',
        fetchImpl: vi.fn(async (request: RequestInfo | URL) => {
          const path = new URL(String(request)).pathname;
          requests.push(path);
          if (path === failingPath) return json({ error: 'fresh source failed' }, 503);
          return json(path === '/manager/workplace-state' ? P4A4_WORKPLACE_AUTHORIZED_RESPONSE : P4A4_EMPLOYEE_OPERATIONS_RESPONSE);
        }),
      })));
      expect((await runtime.activate({ nodeId: 'S03-CP16', context })).status).toBe('error');
      expect(requests.every((path) => path.startsWith('/manager/'))).toBe(true);
    }
  });
});
