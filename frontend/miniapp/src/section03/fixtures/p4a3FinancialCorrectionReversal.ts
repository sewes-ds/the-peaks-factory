import type {
  ManagerCompletedWorkCardResponse,
  ManagerCompletedWorkItem,
  ManagerCompletedWorksResponse,
  ManagerEmployees,
  ManagerWorkplaceState,
} from '../contracts';
import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program/ids';
import { P1_WORKPLACE_RESPONSE } from './p1';
import {
  P2A1_EMPLOYEES_EMPTY_RESPONSE,
  P2A1_EMPLOYEES_LONG_RESPONSE,
  P2A1_EMPLOYEES_POPULATED_RESPONSE,
} from './p2a1Employees';

export type Section03P4A3ExpectedRequest = Readonly<{
  method: 'GET' | 'POST';
  path: string;
  body?: Readonly<Record<string, string>>;
}>;

export type Section03P4A3Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-CF20' | 'S03-CF21' | 'S03-CF22' | 'S03-CF23' | 'S03-CF24' | 'S03-CF25';
  context: Section03Context;
  primaryResponse: ManagerEmployees | ManagerCompletedWorksResponse | ManagerCompletedWorkCardResponse | null;
  workplaceResponse: ManagerWorkplaceState;
  formValue: string | null;
  formPending: boolean;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  expectedStateKeys: readonly string[];
  expectedControlKeys: readonly string[];
  expectedActionIds: readonly string[];
  expectedRequests: readonly Section03P4A3ExpectedRequest[];
  expectedNavigations: readonly Readonly<{ target: Section03NodeId; event: Section03Context }>[];
  expectedBack: Readonly<{ target: Section03NodeId; event: Section03Context }>;
  expectedBusinessEvent: Section03Context | null;
  mutationOutcome: 'none' | 'success' | 'pending-duplicate' | 'failure';
  expectProjectionFailure: boolean;
}>;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function work(overrides: Partial<ManagerCompletedWorkItem> = {}): ManagerCompletedWorkItem {
  return deepFreeze({
    work_item_id: 'WI-REV-PROD', work_type: 'production', operation_id: 'OP-REV-PROD',
    employee_id: 'EMP-REV', employee_full_name: 'Мария Орлова', completed_date: '03.08.2026 09:45',
    production_operation_id: 'PO-REV', additional_work_id: null, machine_id: 'M-REV', machine_name: 'Станок 4',
    sku_name: 'Вал приводной', sku_code: 'VP-7', quantity: '8', additional_work_name: null,
    salary_entry_id: 'SAL-REV-1', salary_amount_uzs: '95000', amount_uzs: '90000', old_quantity: null,
    correction_base_quantity: null, current_quantity: '8', can_correct: true, can_storno: true,
    is_reversed: false, reversal_id: null, ...overrides,
  });
}

export const P4A3_PRODUCTION_WORK = work();
export const P4A3_ADDITIONAL_WORK = work({
  work_item_id: 'WI-REV-AW', work_type: 'additional_work', operation_id: 'OP-REV-AW',
  production_operation_id: null, additional_work_id: 'AW-REV', machine_id: null, machine_name: null,
  sku_name: null, sku_code: null, quantity: null, current_quantity: null,
  additional_work_name: 'Пересчёт оснастки', salary_entry_id: 'SAL-REV-AW',
  salary_amount_uzs: '42000', amount_uzs: '40000', can_correct: false,
});

const responseEmployee = deepFreeze({ employee_id: 'EMP-REV', full_name: 'Мария Орлова' });
function worksResponse(
  works: readonly ManagerCompletedWorkItem[],
  employee = responseEmployee,
): ManagerCompletedWorksResponse {
  return deepFreeze({ section: 'S03', screen: 'S03-CF22', employee, works, available_actions: ['BACK'] as const });
}
function cardResponse(
  selected: ManagerCompletedWorkItem,
  employee = responseEmployee,
): ManagerCompletedWorkCardResponse {
  return deepFreeze({ section: 'S03', screen: 'S03-CF23', employee, work: selected, available_actions: ['BACK'] as const });
}

export const P4A3_WORKS_MIXED_RESPONSE = worksResponse([P4A3_PRODUCTION_WORK, P4A3_ADDITIONAL_WORK]);
export const P4A3_PRODUCTION_CARD_RESPONSE = cardResponse(P4A3_PRODUCTION_WORK);
export const P4A3_ADDITIONAL_CARD_RESPONSE = cardResponse(P4A3_ADDITIONAL_WORK);
export const P4A3_EMPLOYEES_RESPONSE = deepFreeze({
  ...P2A1_EMPLOYEES_POPULATED_RESPONSE,
  employees: [{
    ...(P2A1_EMPLOYEES_POPULATED_RESPONSE as ManagerEmployees).employees[2]!,
    employee_id: 'EMP-REV',
    full_name: 'Мария Орлова',
  }],
}) as ManagerEmployees;
export const P4A3_WORKPLACE_AUTHORIZED_RESPONSE = deepFreeze(
  structuredClone(P1_WORKPLACE_RESPONSE) as ManagerWorkplaceState,
);
export const P4A3_WORKPLACE_UNAUTHORIZED_RESPONSE = deepFreeze({
  ...P4A3_WORKPLACE_AUTHORIZED_RESPONSE,
  sections: {
    ...P4A3_WORKPLACE_AUTHORIZED_RESPONSE.sections,
    corrections: { ...P4A3_WORKPLACE_AUTHORIZED_RESPONSE.sections.corrections, available_actions: [] },
  },
});
export const P4A3_WORKPLACE_UNRELATED_AUTHORITY_RESPONSE = deepFreeze({
  ...P4A3_WORKPLACE_UNAUTHORIZED_RESPONSE,
  sections: {
    ...P4A3_WORKPLACE_UNAUTHORIZED_RESPONSE.sections,
    machines: { ...P4A3_WORKPLACE_UNAUTHORIZED_RESPONSE.sections.machines, available_actions: ['OPEN_CORRECTIONS'] },
  },
});

const employeeId = 'EMP-REV';
const listContext = deepFreeze({ employee_id: employeeId, period: 'today' as const });
const productionContext = deepFreeze({ ...listContext, work_type: 'production' as const, operation_id: 'OP-REV-PROD' });
const additionalContext = deepFreeze({ ...listContext, work_type: 'additional_work' as const, operation_id: 'OP-REV-AW' });
const reasonContext = deepFreeze({ ...productionContext, salary_entry_id: 'SAL-REV-1' });
const confirmationContext = deepFreeze({ ...reasonContext, reversal_reason: 'Подтверждённая причина сторно' });
const empty = Object.freeze([]) as readonly never[];
const employeeGet = deepFreeze({ method: 'GET' as const, path: '/manager/employees' });
const worksGet = deepFreeze({ method: 'GET' as const, path: '/manager/employees/EMP-REV/completed-works?period=today&type=all' });
const cardGet = deepFreeze({ method: 'GET' as const, path: '/manager/employees/EMP-REV/completed-works/production/OP-REV-PROD' });
const additionalCardGet = deepFreeze({ method: 'GET' as const, path: '/manager/employees/EMP-REV/completed-works/additional_work/OP-REV-AW' });
const workplaceGet = deepFreeze({ method: 'GET' as const, path: '/manager/workplace-state' });
const reversePost = deepFreeze({ method: 'POST' as const, path: '/salary-entries/SAL-REV-1/reverse', body: { reason: 'Подтверждённая причина сторно' } });

function fixture(
  input: Partial<Section03P4A3Fixture> & Pick<Section03P4A3Fixture, 'fixtureId' | 'nodeId' | 'context' | 'primaryResponse'>,
): Section03P4A3Fixture {
  const backTargets: Record<Section03P4A3Fixture['nodeId'], Section03NodeId> = {
    'S03-CF20': 'S03-CF01', 'S03-CF21': 'S03-CF20', 'S03-CF22': 'S03-CF21',
    'S03-CF23': 'S03-CF22', 'S03-CF24': 'S03-CF23', 'S03-CF25': 'S03-CF24',
  };
  return deepFreeze({
    workplaceResponse: P4A3_WORKPLACE_AUTHORIZED_RESPONSE,
    formValue: null, formPending: false, orderedItemIds: empty, visibleText: empty, absentText: empty,
    expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectedRequests: empty,
    expectedNavigations: empty, expectedBack: { target: backTargets[input.nodeId], event: {} },
    expectedBusinessEvent: null, mutationOutcome: 'none', expectProjectionFailure: false, ...input,
  } as Section03P4A3Fixture);
}

const fixtures: Section03P4A3Fixture[] = [];
fixtures.push(
  fixture({ fixtureId: 'S03-CF20:representative', nodeId: 'S03-CF20', context: {}, primaryResponse: P2A1_EMPLOYEES_POPULATED_RESPONSE as ManagerEmployees,
    orderedItemIds: [...(P2A1_EMPLOYEES_POPULATED_RESPONSE as ManagerEmployees).employees.map((item) => `reversal-employee-${item.employee_id}`), 'reversal-employees-back'],
    visibleText: ['Финансовая корректировка', 'Смена не начата', 'Сотрудник производства', 'Назад'], absentText: ['S03-CF20'],
    expectedStateKeys: ['state-info', 'state-info', 'state-positive', 'state-warning', 'state-danger', 'state-info'],
    expectedControlKeys: ['navigation-back'], expectedActionIds: ['navigate0', 'navigate0', 'navigate0', 'navigate0', 'navigate0', 'navigate0', 'navigateBack0'],
    expectedRequests: [employeeGet], expectedBack: { target: 'S03-CF01', event: {} } }),
  fixture({ fixtureId: 'S03-CF20:empty', nodeId: 'S03-CF20', context: {}, primaryResponse: P2A1_EMPLOYEES_EMPTY_RESPONSE as ManagerEmployees,
    orderedItemIds: ['reversal-employees-empty', 'reversal-employees-back'], visibleText: ['Финансовая корректировка', 'Нет сотрудников.', 'Назад'], absentText: ['S03-CF20'],
    expectedStateKeys: ['state-info'], expectedControlKeys: ['navigation-back'], expectedActionIds: ['navigateBack0'], expectedRequests: [employeeGet], expectedBack: { target: 'S03-CF01', event: {} } }),
  fixture({ fixtureId: 'S03-CF20:long-content', nodeId: 'S03-CF20', context: {}, primaryResponse: P2A1_EMPLOYEES_LONG_RESPONSE as ManagerEmployees,
    orderedItemIds: ['reversal-employee-EMP-LONG', 'reversal-employees-back'], visibleText: ['Александрова Екатерина Константиновна', 'Производственная линия'], absentText: ['S03-CF20'],
    expectedStateKeys: ['state-positive'], expectedControlKeys: ['navigation-back'], expectedActionIds: ['navigate0', 'navigateBack0'], expectedRequests: [employeeGet], expectedBack: { target: 'S03-CF01', event: {} } }),
  fixture({ fixtureId: 'S03-CF21:period-menu', nodeId: 'S03-CF21', context: { employee_id: employeeId }, primaryResponse: null,
    orderedItemIds: ['period-today', 'period-week', 'period-month', 'period-last_30_days', 'reversal-period-back'], visibleText: ['Финансовая корректировка', 'За сегодня', 'За неделю', 'За месяц', 'Последние 30 дней', 'Назад'], absentText: ['Далее'],
    expectedControlKeys: ['navigation-open', 'navigation-open', 'navigation-open', 'navigation-open', 'navigation-back'], expectedActionIds: ['navigate0', 'navigate0', 'navigate0', 'navigate0', 'navigateBack0'],
    expectedNavigations: [
      { target: 'S03-CF22', event: { employee_id: employeeId, period: 'today' } },
      { target: 'S03-CF22', event: { employee_id: employeeId, period: 'week' } },
      { target: 'S03-CF22', event: { employee_id: employeeId, period: 'month' } },
      { target: 'S03-CF22', event: { employee_id: employeeId, period: 'last_30_days' } },
    ], expectedBack: { target: 'S03-CF20', event: { employee_id: employeeId } } }),
);

fixtures.push(
  fixture({ fixtureId: 'S03-CF22:mixed', nodeId: 'S03-CF22', context: listContext, primaryResponse: P4A3_WORKS_MIXED_RESPONSE,
    orderedItemIds: ['reversal-work-WI-REV-PROD', 'reversal-work-WI-REV-AW', 'reversal-works-back'],
    visibleText: ['Финансовая корректировка', 'Дата 03.08.2026', 'SKU: Вал приводной', 'Количество: 8', 'Начисленная зарплата', '95000 сум', 'Доп. работа: Пересчёт оснастки', '42000 сум'], absentText: ['09:45', 'SAL-REV-1'],
    expectedStateKeys: ['state-positive', 'state-info'], expectedControlKeys: ['navigation-back'], expectedActionIds: ['navigate0', 'navigate0', 'navigateBack0'], expectedRequests: [worksGet], expectedBack: { target: 'S03-CF21', event: listContext } }),
  fixture({ fixtureId: 'S03-CF22:empty', nodeId: 'S03-CF22', context: listContext, primaryResponse: worksResponse([]),
    orderedItemIds: ['reversal-works-empty', 'reversal-works-back'], visibleText: ['Нет выполненных работ за выбранный период.', 'Назад'], absentText: ['SAL-REV-1'], expectedStateKeys: ['state-info'], expectedControlKeys: ['navigation-back'], expectedActionIds: ['navigateBack0'], expectedRequests: [worksGet], expectedBack: { target: 'S03-CF21', event: listContext } }),
  fixture({ fixtureId: 'S03-CF22:long-content', nodeId: 'S03-CF22', context: listContext,
    primaryResponse: worksResponse([work({ sku_name: 'Очень длинное название производственной номенклатуры для проверки переноса содержимого', salary_amount_uzs: '999999999999999999999' })]),
    orderedItemIds: ['reversal-work-WI-REV-PROD', 'reversal-works-back'], visibleText: ['Очень длинное название производственной номенклатуры', '999999999999999999999 сум'], absentText: ['SAL-REV-1'], expectedStateKeys: ['state-positive'], expectedControlKeys: ['navigation-back'], expectedActionIds: ['navigate0', 'navigateBack0'], expectedRequests: [worksGet], expectedBack: { target: 'S03-CF21', event: listContext } }),
  fixture({ fixtureId: 'S03-CF22:employee-mismatch', nodeId: 'S03-CF22', context: listContext, primaryResponse: worksResponse([], { employee_id: 'EMP-OTHER', full_name: 'Другой' }), expectedRequests: [worksGet], expectedBack: { target: 'S03-CF21', event: listContext }, expectProjectionFailure: true }),
  fixture({ fixtureId: 'S03-CF22:work-employee-mismatch', nodeId: 'S03-CF22', context: listContext, primaryResponse: worksResponse([work({ employee_id: 'EMP-OTHER' })]), expectedRequests: [worksGet], expectedBack: { target: 'S03-CF21', event: listContext }, expectProjectionFailure: true }),
);

function cardFixture(
  name: string,
  current: Section03Context,
  response: ManagerCompletedWorkCardResponse,
  request: Section03P4A3ExpectedRequest,
  reversible: boolean,
  extra: Partial<Section03P4A3Fixture> = {},
): Section03P4A3Fixture {
  return fixture({
    fixtureId: `S03-CF23:${name}`, nodeId: 'S03-CF23', context: current, primaryResponse: response,
    orderedItemIds: ['reversal-work-card', 'reversal-open-confirmation', 'reversal-card-back'],
    visibleText: reversible ? ['Мария Орлова', 'Начисленная зарплата', 'Сторно', 'Назад'] : ['Мария Орлова', 'Назад'], absentText: reversible ? ['SAL-REV-1'] : [],
    expectedStateKeys: [response.work.work_type === 'production' ? 'state-positive' : 'state-info'],
    expectedControlKeys: ['action-danger', 'navigation-back'],
    expectedActionIds: ['navigate0', 'navigateBack0'], expectedRequests: [request],
    expectedBack: { target: 'S03-CF22', event: listContext }, ...extra,
  });
}

fixtures.push(
  cardFixture('production-reversible', productionContext, P4A3_PRODUCTION_CARD_RESPONSE, cardGet, true, { visibleText: ['Мария Орлова', '03.08.2026', 'Вал приводной', 'Количество', '8', '95000 сум', 'Сторно'], absentText: ['09:45'] }),
  cardFixture('additional-reversible', additionalContext, P4A3_ADDITIONAL_CARD_RESPONSE, additionalCardGet, true, { visibleText: ['Мария Орлова', 'Пересчёт оснастки', '42000 сум', 'Сторно'], absentText: ['SKU'] }),
  cardFixture('not-reversible', productionContext, cardResponse(work({ can_storno: false })), cardGet, false),
  cardFixture('already-reversed', productionContext, cardResponse(work({ is_reversed: true, reversal_id: 'REV-1' })), cardGet, false),
  cardFixture('missing-salary-entry', productionContext, cardResponse(work({ salary_entry_id: null })), cardGet, false),
  cardFixture('long-content', additionalContext, cardResponse(work({ ...P4A3_ADDITIONAL_WORK, additional_work_name: 'Очень длинное описание дополнительной работы для проверки автоматического роста карточки без обрезки содержимого', salary_amount_uzs: '888888888888888888888' })), additionalCardGet, true, { visibleText: ['Очень длинное описание дополнительной работы', '888888888888888888888 сум'] }),
  cardFixture('employee-mismatch', productionContext, cardResponse(P4A3_PRODUCTION_WORK, { employee_id: 'EMP-OTHER', full_name: 'Другой' }), cardGet, false, { orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectProjectionFailure: true }),
  cardFixture('type-mismatch', productionContext, cardResponse(work({ work_type: 'additional_work' })), cardGet, false, { orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectProjectionFailure: true }),
  cardFixture('operation-mismatch', productionContext, cardResponse(work({ operation_id: 'OP-OTHER' })), cardGet, false, { orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty, expectedControlKeys: empty, expectedActionIds: empty, expectProjectionFailure: true }),
);

for (const [name, value, pending] of [
  ['empty', '', false], ['whitespace', '   ', false], ['trimmed', '  Подтверждённая причина сторно  ', false],
  ['multiline', '  Первая строка\nВторая строка  ', false],
  ['long', 'Очень длинный комментарий сторно, который переносится на несколько строк и сохраняется без визуальной обрезки.', false],
  ['pending', 'Подтверждённая причина сторно', true],
] as const) {
  fixtures.push(fixture({
    fixtureId: `S03-CF24:${name}`, nodeId: 'S03-CF24', context: reasonContext, primaryResponse: null,
    formValue: value, formPending: pending, orderedItemIds: ['field-reversal_reason', 'reversal-reason-next', 'reversal-reason-back'],
    visibleText: ['Комментарий', ...(name === 'multiline' ? ['Первая строка', 'Вторая строка'] : [value.trim()]), 'Далее', 'Назад'].filter((item) => item.length > 0), absentText: ['SAL-REV-1'],
    expectedControlKeys: ['navigation-next', 'navigation-back'], expectedActionIds: ['navigate0', 'navigateBack0'],
    expectedBack: { target: 'S03-CF23', event: productionContext },
  }));
}

function confirmationFixture(
  name: string,
  current: Section03Context,
  response: ManagerCompletedWorkCardResponse,
  workplace: ManagerWorkplaceState,
  outcome: Section03P4A3Fixture['mutationOutcome'],
  extra: Partial<Section03P4A3Fixture> = {},
): Section03P4A3Fixture {
  const salaryEntryId = response.work.salary_entry_id ?? '';
  const reason = String(current.reversal_reason ?? '').trim();
  const request = current.work_type === 'additional_work' ? additionalCardGet : cardGet;
  return fixture({
    fixtureId: `S03-CF25:${name}`, nodeId: 'S03-CF25', context: current, primaryResponse: response, workplaceResponse: workplace,
    orderedItemIds: ['reversal-confirmation', 'reversal-confirm', 'reversal-confirm-back'],
    visibleText: ['Подтвердите сторно:', response.employee.full_name, 'Операция', 'Начисленная зарплата', 'Комментарий', 'Сторно', 'Назад'],
    absentText: ['SAL-REV-1', 'OP-REV-PROD', 'EMP-REV'], expectedStateKeys: ['state-danger'],
    expectedControlKeys: ['action-danger', 'navigation-back'], expectedActionIds: ['REVERSE_SALARY_ENTRY', 'navigateBack0'],
    expectedRequests: outcome === 'none' ? [request, workplaceGet] : [request, workplaceGet, reversePost],
    expectedBack: { target: 'S03-CF24', event: { ...current, salary_entry_id: salaryEntryId, reversal_reason: reason } },
    expectedBusinessEvent: { salary_entry_id: salaryEntryId, reversal_reason: reason }, mutationOutcome: outcome, ...extra,
  });
}

fixtures.push(
  confirmationFixture('production-authorized', confirmationContext, P4A3_PRODUCTION_CARD_RESPONSE, P4A3_WORKPLACE_AUTHORIZED_RESPONSE, 'success'),
  confirmationFixture('additional-authorized', { ...additionalContext, salary_entry_id: 'SAL-REV-AW', reversal_reason: 'Подтверждённая причина сторно' }, P4A3_ADDITIONAL_CARD_RESPONSE, P4A3_WORKPLACE_AUTHORIZED_RESPONSE, 'success'),
  confirmationFixture('pending-duplicate', confirmationContext, P4A3_PRODUCTION_CARD_RESPONSE, P4A3_WORKPLACE_AUTHORIZED_RESPONSE, 'pending-duplicate'),
  confirmationFixture('post-failure', confirmationContext, P4A3_PRODUCTION_CARD_RESPONSE, P4A3_WORKPLACE_AUTHORIZED_RESPONSE, 'failure'),
  confirmationFixture('long-content', { ...confirmationContext, reversal_reason: 'Очень длинный комментарий сторно для проверки автоматического роста подтверждения без обрезки.' }, cardResponse(work({ sku_name: 'Очень длинное название операции для проверки роста подтверждения', amount_uzs: '777777777777777777777' })), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, 'none', { visibleText: ['Очень длинное название операции', '777777777777777777777 сум', 'Очень длинный комментарий сторно'] }),
);

const failures: readonly [string, ManagerCompletedWorkCardResponse, ManagerWorkplaceState, Section03Context][] = [
  ['employee-mismatch', cardResponse(P4A3_PRODUCTION_WORK, { employee_id: 'EMP-OTHER', full_name: 'Другой' }), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, confirmationContext],
  ['work-employee-mismatch', cardResponse(work({ employee_id: 'EMP-OTHER' })), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, confirmationContext],
  ['type-mismatch', cardResponse(work({ work_type: 'additional_work' })), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, confirmationContext],
  ['operation-mismatch', cardResponse(work({ operation_id: 'OP-OTHER' })), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, confirmationContext],
  ['salary-entry-mismatch', cardResponse(work({ salary_entry_id: 'SAL-OTHER' })), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, confirmationContext],
  ['missing-salary-entry', cardResponse(work({ salary_entry_id: null })), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, confirmationContext],
  ['not-reversible', cardResponse(work({ can_storno: false })), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, confirmationContext],
  ['already-reversed', cardResponse(work({ is_reversed: true, reversal_id: 'REV-1' })), P4A3_WORKPLACE_AUTHORIZED_RESPONSE, confirmationContext],
  ['empty-reason', P4A3_PRODUCTION_CARD_RESPONSE, P4A3_WORKPLACE_AUTHORIZED_RESPONSE, { ...reasonContext, reversal_reason: '   ' }],
  ['missing-authority', P4A3_PRODUCTION_CARD_RESPONSE, P4A3_WORKPLACE_UNAUTHORIZED_RESPONSE, confirmationContext],
  ['unrelated-nested-authority', P4A3_PRODUCTION_CARD_RESPONSE, P4A3_WORKPLACE_UNRELATED_AUTHORITY_RESPONSE, confirmationContext],
];
for (const [name, response, workplace, current] of failures) {
  fixtures.push(confirmationFixture(name, current, response, workplace, 'none', {
    orderedItemIds: empty, visibleText: empty, absentText: empty, expectedStateKeys: empty,
    expectedControlKeys: empty, expectedActionIds: empty, expectedBusinessEvent: null,
    expectedRequests: [cardGet, workplaceGet], expectProjectionFailure: true,
  }));
}

export const SECTION03_P4A3_FIXTURES = deepFreeze(fixtures);
export const SECTION03_P4A3_FIXTURE_IDS = Object.freeze([
  'S03-CF20:representative',
  'S03-CF20:empty',
  'S03-CF20:long-content',
  'S03-CF21:period-menu',
  'S03-CF22:mixed',
  'S03-CF22:empty',
  'S03-CF22:long-content',
  'S03-CF22:employee-mismatch',
  'S03-CF22:work-employee-mismatch',
  'S03-CF23:production-reversible',
  'S03-CF23:additional-reversible',
  'S03-CF23:not-reversible',
  'S03-CF23:already-reversed',
  'S03-CF23:missing-salary-entry',
  'S03-CF23:long-content',
  'S03-CF23:employee-mismatch',
  'S03-CF23:type-mismatch',
  'S03-CF23:operation-mismatch',
  'S03-CF24:empty',
  'S03-CF24:whitespace',
  'S03-CF24:trimmed',
  'S03-CF24:multiline',
  'S03-CF24:long',
  'S03-CF24:pending',
  'S03-CF25:production-authorized',
  'S03-CF25:additional-authorized',
  'S03-CF25:pending-duplicate',
  'S03-CF25:post-failure',
  'S03-CF25:long-content',
  'S03-CF25:employee-mismatch',
  'S03-CF25:work-employee-mismatch',
  'S03-CF25:type-mismatch',
  'S03-CF25:operation-mismatch',
  'S03-CF25:salary-entry-mismatch',
  'S03-CF25:missing-salary-entry',
  'S03-CF25:not-reversible',
  'S03-CF25:already-reversed',
  'S03-CF25:empty-reason',
  'S03-CF25:missing-authority',
  'S03-CF25:unrelated-nested-authority',
] as const);
