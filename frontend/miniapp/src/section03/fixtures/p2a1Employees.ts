import type { ManagerEmployeeUiVariant } from '../contracts';
import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program/ids';
import type { Section03P2A1SpecializedNodeId } from '../projections/p2a1Employees';

const employee = (
  employeeId: string,
  fullName: string,
  overrides: Readonly<Record<string, unknown>> = {},
) => Object.freeze({
  employee_id: employeeId,
  full_name: fullName,
  ui_state: 'shift_idle',
  ui_variant: 'light_blue',
  open_shift_id: `SHIFT-${employeeId}`,
  shift_started_at: '2026-08-01T08:00:00+05:00',
  active_production_operation_id: null,
  production_started_at: null,
  active_machine_id: null,
  active_machine_name: null,
  active_sku_id: null,
  active_sku_code: null,
  active_sku_name: null,
  active_break_id: null,
  active_break_name: null,
  break_started_at: null,
  break_duration: null,
  break_context_type: 'none',
  active_downtime_id: null,
  downtime_type: null,
  downtime_name: null,
  downtime_comment: null,
  downtime_started_at: null,
  downtime_duration: null,
  downtime_start_comment: null,
  downtime_finish_comment: null,
  active_additional_work_id: null,
  active_additional_work_name: null,
  additional_work_started_at: null,
  additional_work_duration: null,
  available_actions: Object.freeze(['OPEN_EMPLOYEE_CARD']),
  ...overrides,
});

const noBlockers = Object.freeze({
  production: null,
  break: null,
  additional_work: null,
});

const allBlockers = Object.freeze({
  production: Object.freeze({
    production_operation_id: 'PO-BLOCK',
    machine_id: 'M-BLOCK',
    machine_name: 'Станок блокирующего производства',
    sku_name: 'Блокирующая деталь',
  }),
  break: Object.freeze({
    target_employee_id: 'EMP-1',
    operator_break_id: 'BREAK-BLOCK',
  }),
  additional_work: Object.freeze({ additional_work_id: 'AW-BLOCK' }),
});

const cardEmployee = (
  employeeId: string,
  fullName: string,
  overrides: Readonly<Record<string, unknown>> = {},
) => Object.freeze({
  ...employee(employeeId, fullName),
  blockers: noBlockers,
  completed_shift_production_summary_by_sku: Object.freeze([]),
  completed_shift_additional_work_items: Object.freeze([]),
  available_actions: Object.freeze([
    'VIEW_SALARY',
    'VIEW_COMPLETED_WORKS',
    'FINISH_EMPLOYEE_SHIFT_BY_MANAGER',
  ]),
  ...overrides,
});

const listResponse = (employees: readonly unknown[]) => Object.freeze({
  section: 'S03',
  screen: 'S03-E01',
  title: 'Сотрудники',
  employees: Object.freeze([...employees]),
  available_actions: Object.freeze(['BACK']),
});

const cardResponse = (value: unknown) => Object.freeze({
  section: 'S03',
  screen: 'S03-E02',
  employee: value,
  available_actions: Object.freeze(['BACK']),
});

const stateEmployees = Object.freeze(([
  ['EMP-WHITE', 'Смена не начата', 'white', 'shift_not_started'],
  ['EMP-INFO', 'Сотрудник без работы', 'light_blue', 'shift_idle'],
  ['EMP-GREEN', 'Сотрудник производства', 'green', 'production'],
  ['EMP-YELLOW', 'Сотрудник операционного простоя', 'yellow', 'operational_down'],
  ['EMP-RED', 'Сотрудник критического простоя', 'red', 'critical_down'],
  ['EMP-GREY', 'Сотрудник дополнительной работы', 'grey', 'additional_work'],
] as const).map(([id, name, variant, state]) => employee(id, name, {
  ui_variant: variant satisfies ManagerEmployeeUiVariant,
  ui_state: state,
  ...(id === 'EMP-GREEN'
    ? { active_sku_name: 'Корпус редуктора', active_machine_name: 'Станок 7' }
    : {}),
  ...(id === 'EMP-YELLOW' ? { active_break_name: 'Регламентный перерыв' } : {}),
  ...(id === 'EMP-GREY' ? { active_additional_work_name: 'Инвентаризация' } : {}),
})));

export const P2A1_EMPLOYEES_POPULATED_RESPONSE = listResponse(stateEmployees);
export const P2A1_EMPLOYEES_EMPTY_RESPONSE = listResponse([]);
export const P2A1_EMPLOYEES_DENIED_RESPONSE = listResponse([
  employee('EMP-DENIED', 'Недоступный сотрудник', {
    available_actions: Object.freeze([]),
  }),
]);
export const P2A1_EMPLOYEES_LONG_RESPONSE = listResponse([
  employee(
    'EMP-LONG',
    'Александрова Екатерина Константиновна с очень длинным отображаемым именем',
    {
      ui_variant: 'green',
      ui_state: 'production',
      active_sku_name: 'Корпус редуктора с очень длинным наименованием номенклатуры',
      active_machine_name: 'Производственная линия с очень длинным наименованием станка',
    },
  ),
]);

export const P2A1_EMPLOYEE_ALL_ACTIVITY = cardEmployee(
  'EMP-ALL',
  'Иванов Иван Иванович',
  {
    ui_state: 'critical_down',
    ui_variant: 'red',
    active_production_operation_id: 'PO-ALL',
    production_started_at: '2026-08-01T08:15:00+05:00',
    active_machine_id: 'M-ALL',
    active_machine_name: 'Станок 12',
    active_sku_id: 'SKU-ALL',
    active_sku_code: 'SKU-012',
    active_sku_name: 'Корпус редуктора',
    active_break_id: 'BREAK-ALL',
    active_break_name: 'Обеденный перерыв',
    break_started_at: '2026-08-01T10:00:00+05:00',
    break_duration: '20 мин',
    active_downtime_id: 'DOWN-ALL',
    downtime_type: 'critical',
    downtime_name: 'Поломка шпинделя',
    downtime_comment: 'Совместимый комментарий',
    downtime_started_at: '2026-08-01T09:30:00+05:00',
    downtime_duration: '1 ч 5 мин',
    downtime_start_comment: 'Критическая вибрация шпинделя',
    active_additional_work_id: 'AW-ALL',
    active_additional_work_name: 'Инвентаризация инструмента',
    additional_work_started_at: '2026-08-01T11:00:00+05:00',
    additional_work_duration: '35 мин',
    blockers: allBlockers,
  },
);
export const P2A1_EMPLOYEE_NO_BLOCKERS = cardEmployee(
  'EMP-NO-BLOCKERS',
  'Петров Пётр Петрович',
);
export const P2A1_EMPLOYEE_ALL_BLOCKERS = cardEmployee(
  'EMP-1',
  'Сидоров Сергей Сергеевич',
  { blockers: allBlockers },
);
export const P2A1_EMPLOYEE_FINISH_UNAUTHORIZED = cardEmployee(
  'EMP-NO-FINISH',
  'Кузнецов Константин Константинович',
  {
    available_actions: Object.freeze(['VIEW_SALARY', 'VIEW_COMPLETED_WORKS']),
  },
);
export const P2A1_EMPLOYEE_AUTHORITY_DENIED = cardEmployee(
  'EMP-AUTHORITY-DENIED',
  'Смирнова Светлана Сергеевна',
  { available_actions: Object.freeze(['FINISH_EMPLOYEE_SHIFT_BY_MANAGER']) },
);
export const P2A1_EMPLOYEE_SHIFT_NOT_STARTED = cardEmployee(
  'EMP-NOT-STARTED',
  'Орлов Олег Олегович',
  {
    ui_state: 'shift_not_started',
    ui_variant: 'white',
    open_shift_id: null,
    shift_started_at: null,
    available_actions: Object.freeze([]),
  },
);
export const P2A1_EMPLOYEE_CRITICAL_COMMENT = cardEmployee(
  'EMP-CRITICAL-COMMENT',
  'Волков Виктор Викторович',
  {
    ui_state: 'critical_down',
    ui_variant: 'red',
    active_downtime_id: 'DOWN-COMMENT',
    downtime_type: 'critical',
    downtime_name: 'Аварийная остановка',
    downtime_comment: 'Совместимый комментарий',
    downtime_start_comment: 'Основной комментарий запуска простоя',
    downtime_started_at: '2026-08-01T09:30:00+05:00',
    downtime_duration: '45 мин',
  },
);
export const P2A1_EMPLOYEE_CRITICAL_NO_COMMENT = cardEmployee(
  'EMP-CRITICAL-NO-COMMENT',
  'Фёдоров Фёдор Фёдорович',
  {
    ui_state: 'critical_down',
    ui_variant: 'red',
    active_downtime_id: 'DOWN-NO-COMMENT',
    downtime_type: 'critical',
    downtime_name: 'Аварийная остановка без комментария',
    downtime_comment: null,
    downtime_start_comment: null,
    downtime_started_at: '2026-08-01T09:30:00+05:00',
    downtime_duration: '45 мин',
  },
);
export const P2A1_EMPLOYEE_LONG = cardEmployee(
  'EMP-LONG-CARD',
  'Александрова Екатерина Константиновна с очень длинным отображаемым именем сотрудника',
  {
    ui_state: 'additional_work',
    ui_variant: 'grey',
    active_additional_work_id: 'AW-LONG',
    active_additional_work_name: 'Дополнительная работа с очень длинным описанием для проверки автоматической высоты карточки без обрезания содержимого',
    additional_work_started_at: '2026-08-01T11:00:00+05:00',
    additional_work_duration: '2 ч 15 мин',
  },
);

export type Section03P2A1Fixture = Readonly<{
  fixtureId: string;
  nodeId: Section03P2A1SpecializedNodeId;
  context: Section03Context;
  apiResponses: Readonly<Record<string, unknown>>;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  stateKeys: readonly string[];
  controlKeys: readonly string[];
  expectedActionIds: readonly string[];
  expectedTargets: readonly Readonly<{
    itemId: string;
    target: Section03NodeId;
  }>[];
  expectedBack: Section03NodeId;
}>;

function fixture(value: Section03P2A1Fixture): Section03P2A1Fixture {
  return Object.freeze({
    ...value,
    context: Object.freeze({ ...value.context }),
    apiResponses: Object.freeze({ ...value.apiResponses }),
    orderedItemIds: Object.freeze([...value.orderedItemIds]),
    visibleText: Object.freeze([...value.visibleText]),
    absentText: Object.freeze([...value.absentText]),
    stateKeys: Object.freeze([...value.stateKeys]),
    controlKeys: Object.freeze([...value.controlKeys]),
    expectedActionIds: Object.freeze([...value.expectedActionIds]),
    expectedTargets: Object.freeze(value.expectedTargets.map((target) =>
      Object.freeze({ ...target }))),
  });
}

const api = (path: string, value: unknown) => Object.freeze({ [path]: value });
const cardFixture = (
  fixtureId: string,
  employeeValue: Readonly<Record<string, unknown>>,
  expected: Omit<Section03P2A1Fixture, 'fixtureId' | 'nodeId' | 'context' | 'apiResponses' | 'expectedBack'>,
) => fixture({
  fixtureId,
  nodeId: 'S03-E02',
  context: { employee_id: String(employeeValue.employee_id) },
  apiResponses: api(
    `/manager/employees/${String(employeeValue.employee_id)}`,
    cardResponse(employeeValue),
  ),
  expectedBack: 'S03-E01',
  ...expected,
});

const blockerFixture = (
  fixtureId: string,
  employeeValue: Readonly<Record<string, unknown>>,
  orderedItemIds: readonly string[],
  visibleText: readonly string[],
  stateKeys: readonly string[],
  expectedActionIds: readonly string[],
  expectedTargets: Section03P2A1Fixture['expectedTargets'],
) => fixture({
  fixtureId,
  nodeId: 'S03-E12',
  context: { employee_id: String(employeeValue.employee_id) },
  apiResponses: api(
    `/manager/employees/${String(employeeValue.employee_id)}`,
    cardResponse(employeeValue),
  ),
  orderedItemIds,
  visibleText,
  absentText: [],
  stateKeys,
  controlKeys: ['navigation-back'],
  expectedActionIds,
  expectedTargets,
  expectedBack: 'S03-E02',
});

export const SECTION03_P2A1_FIXTURES = Object.freeze([
  fixture({
    fixtureId: 'S03-E01:populated-six-states', nodeId: 'S03-E01', context: {},
    apiResponses: api('/manager/employees', P2A1_EMPLOYEES_POPULATED_RESPONSE),
    orderedItemIds: ['employee-EMP-WHITE', 'employee-EMP-INFO', 'employee-EMP-GREEN', 'employee-EMP-YELLOW', 'employee-EMP-RED', 'employee-EMP-GREY', 'employees-back'],
    visibleText: ['Смена не начата', 'Сотрудник без работы', 'SKU: Корпус редуктора', 'Станок 7', 'Регламентный перерыв', 'Инвентаризация'],
    absentText: ['Сценарий', 'S03-E01'],
    stateKeys: ['state-info', 'state-info', 'state-positive', 'state-warning', 'state-danger', 'state-info'],
    controlKeys: ['navigation-back'],
    expectedActionIds: ['navigate0', 'navigate0', 'navigate0', 'navigate0', 'navigate0', 'navigate0', 'navigateBack0'],
    expectedTargets: [
      { itemId: 'employee-EMP-WHITE', target: 'S03-E02' },
      { itemId: 'employee-EMP-INFO', target: 'S03-E02' },
      { itemId: 'employee-EMP-GREEN', target: 'S03-E02' },
      { itemId: 'employee-EMP-YELLOW', target: 'S03-E02' },
      { itemId: 'employee-EMP-RED', target: 'S03-E02' },
      { itemId: 'employee-EMP-GREY', target: 'S03-E02' },
    ],
    expectedBack: 'S03-N01',
  }),
  fixture({
    fixtureId: 'S03-E01:empty', nodeId: 'S03-E01', context: {},
    apiResponses: api('/manager/employees', P2A1_EMPLOYEES_EMPTY_RESPONSE),
    orderedItemIds: ['employees-empty', 'employees-back'],
    visibleText: ['Сотрудники', 'Нет сотрудников для отображения.', 'Назад'],
    absentText: ['Сценарий'], stateKeys: ['state-info'], controlKeys: ['navigation-back'],
    expectedActionIds: ['navigateBack0'], expectedTargets: [], expectedBack: 'S03-N01',
  }),
  fixture({
    fixtureId: 'S03-E01:row-action-denied', nodeId: 'S03-E01', context: {},
    apiResponses: api('/manager/employees', P2A1_EMPLOYEES_DENIED_RESPONSE),
    orderedItemIds: ['employee-EMP-DENIED', 'employees-back'],
    visibleText: ['Недоступный сотрудник', 'Назад'], absentText: ['Сценарий'],
    stateKeys: ['state-info'], controlKeys: ['navigation-back'],
    expectedActionIds: ['navigateBack0'], expectedTargets: [], expectedBack: 'S03-N01',
  }),
  fixture({
    fixtureId: 'S03-E01:long-content', nodeId: 'S03-E01', context: {},
    apiResponses: api('/manager/employees', P2A1_EMPLOYEES_LONG_RESPONSE),
    orderedItemIds: ['employee-EMP-LONG', 'employees-back'],
    visibleText: ['Александрова Екатерина Константиновна', 'Корпус редуктора с очень длинным наименованием', 'Производственная линия'],
    absentText: ['Сценарий'], stateKeys: ['state-positive'], controlKeys: ['navigation-back'],
    expectedActionIds: ['navigate0', 'navigateBack0'],
    expectedTargets: [{ itemId: 'employee-EMP-LONG', target: 'S03-E02' }], expectedBack: 'S03-N01',
  }),
  cardFixture('S03-E02:all-activity-fields', P2A1_EMPLOYEE_ALL_ACTIVITY, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Сотрудник', 'Время начала смены', 'SKU', 'Станок', 'Поломка шпинделя', 'Комментарий', 'Время начала производства', 'Время начала простоя', 'Продолжительность простоя', 'Обеденный перерыв', 'Время начала перерыва', 'Продолжительность перерыва', 'Инвентаризация инструмента', 'Время начала доп. работы', 'Продолжительность доп. работы'],
    absentText: ['Состояние', '—'], stateKeys: ['state-danger'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'],
    expectedActionIds: ['navigate3', 'navigate2', 'navigate0', 'navigateBack0'],
    expectedTargets: [{ itemId: 'employee-salary', target: 'S03-SAL01' }, { itemId: 'employee-completed-works', target: 'S03-E20' }, { itemId: 'employee-finish-shift', target: 'S03-E12' }],
  }),
  cardFixture('S03-E02:no-blockers-finish-authorized', P2A1_EMPLOYEE_NO_BLOCKERS, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Петров Пётр Петрович', 'Зарплата', 'Выполненные работы', 'Завершить смену\\nПетров Пётр Петрович'],
    absentText: ['Состояние', '—'], stateKeys: ['state-info'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'],
    expectedActionIds: ['navigate3', 'navigate2', 'navigate1', 'navigateBack0'],
    expectedTargets: [{ itemId: 'employee-finish-shift', target: 'S03-E10' }],
  }),
  cardFixture('S03-E02:all-blockers-finish-authorized', P2A1_EMPLOYEE_ALL_BLOCKERS, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Сидоров Сергей Сергеевич', 'Завершить смену\\nСидоров Сергей Сергеевич'],
    absentText: ['Состояние', '—'], stateKeys: ['state-info'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'],
    expectedActionIds: ['navigate3', 'navigate2', 'navigate0', 'navigateBack0'],
    expectedTargets: [{ itemId: 'employee-finish-shift', target: 'S03-E12' }],
  }),
  cardFixture('S03-E02:finish-unauthorized', P2A1_EMPLOYEE_FINISH_UNAUTHORIZED, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Кузнецов Константин Константинович', 'Зарплата', 'Выполненные работы', 'Завершить смену'],
    absentText: ['Состояние', '—'], stateKeys: ['state-info'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'],
    expectedActionIds: ['navigate3', 'navigate2', 'navigate1', 'navigateBack0'], expectedTargets: [],
  }),
  cardFixture('S03-E02:salary-completed-denied', P2A1_EMPLOYEE_AUTHORITY_DENIED, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Смирнова Светлана Сергеевна', 'Зарплата', 'Выполненные работы', 'Завершить смену'],
    absentText: ['Состояние', '—'], stateKeys: ['state-info'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'],
    expectedActionIds: ['navigate3', 'navigate2', 'navigate1', 'navigateBack0'], expectedTargets: [{ itemId: 'employee-finish-shift', target: 'S03-E10' }],
  }),
  cardFixture('S03-E02:shift-not-started', P2A1_EMPLOYEE_SHIFT_NOT_STARTED, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Орлов Олег Олегович', 'Смена не начата', 'Зарплата', 'Выполненные работы', 'Завершить смену', 'Назад'],
    absentText: ['Время начала смены', 'Состояние', '—'], stateKeys: ['state-info'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'], expectedActionIds: ['navigate3', 'navigate2', 'navigate1', 'navigateBack0'], expectedTargets: [],
  }),
  cardFixture('S03-E02:critical-comment-present', P2A1_EMPLOYEE_CRITICAL_COMMENT, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Аварийная остановка', 'Комментарий', 'Основной комментарий запуска простоя'],
    absentText: ['Совместимый комментарий', 'Состояние', '—'], stateKeys: ['state-danger'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'],
    expectedActionIds: ['navigate3', 'navigate2', 'navigate1', 'navigateBack0'], expectedTargets: [],
  }),
  cardFixture('S03-E02:critical-comment-absent', P2A1_EMPLOYEE_CRITICAL_NO_COMMENT, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Аварийная остановка без комментария', 'Время начала простоя'],
    absentText: ['Комментарий', 'Состояние', '—'], stateKeys: ['state-danger'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'],
    expectedActionIds: ['navigate3', 'navigate2', 'navigate1', 'navigateBack0'], expectedTargets: [],
  }),
  cardFixture('S03-E02:long-content', P2A1_EMPLOYEE_LONG, {
    orderedItemIds: ['employee-card', 'employee-salary', 'employee-completed-works', 'employee-finish-shift', 'employee-card-back'],
    visibleText: ['Александрова Екатерина Константиновна', 'Дополнительная работа с очень длинным описанием', 'Продолжительность доп. работы'],
    absentText: ['Состояние', '—'], stateKeys: ['state-info'],
    controlKeys: ['navigation-open', 'navigation-open', 'action-danger', 'navigation-back'],
    expectedActionIds: ['navigate3', 'navigate2', 'navigate1', 'navigateBack0'], expectedTargets: [],
  }),
  blockerFixture(
    'S03-E12:all-blockers', P2A1_EMPLOYEE_ALL_BLOCKERS,
    ['employee-blockers-message', 'blocker-production', 'blocker-break', 'blocker-additional-work', 'employee-blockers-back'],
    ['Для завершения смены сначала завершите:', 'Производство', 'Перерыв', 'Доп. работа'],
    ['state-info', 'state-positive', 'state-warning', 'state-info'],
    ['navigate0', 'navigate1', 'navigate2', 'navigateBack0'],
    [{ itemId: 'blocker-production', target: 'S03-E13' }, { itemId: 'blocker-break', target: 'S03-E16' }, { itemId: 'blocker-additional-work', target: 'S03-E17' }],
  ),
  blockerFixture(
    'S03-E12:production-only', cardEmployee('EMP-PRODUCTION-BLOCKER', 'Производственный блокер', { blockers: Object.freeze({ ...noBlockers, production: allBlockers.production }) }),
    ['employee-blockers-message', 'blocker-production', 'employee-blockers-back'],
    ['Для завершения смены сначала завершите:', 'Производство'], ['state-info', 'state-positive'],
    ['navigate0', 'navigateBack0'], [{ itemId: 'blocker-production', target: 'S03-E13' }],
  ),
  blockerFixture(
    'S03-E12:break-only', cardEmployee('EMP-BREAK-BLOCKER', 'Блокер перерыва', { blockers: Object.freeze({ ...noBlockers, break: Object.freeze({ target_employee_id: 'EMP-BREAK-BLOCKER', operator_break_id: 'BREAK-ONLY' }) }) }),
    ['employee-blockers-message', 'blocker-break', 'employee-blockers-back'],
    ['Для завершения смены сначала завершите:', 'Перерыв'], ['state-info', 'state-warning'],
    ['navigate1', 'navigateBack0'], [{ itemId: 'blocker-break', target: 'S03-E16' }],
  ),
  blockerFixture(
    'S03-E12:additional-work-only', cardEmployee('EMP-AW-BLOCKER', 'Блокер дополнительной работы', { blockers: Object.freeze({ ...noBlockers, additional_work: Object.freeze({ additional_work_id: 'AW-ONLY' }) }) }),
    ['employee-blockers-message', 'blocker-additional-work', 'employee-blockers-back'],
    ['Для завершения смены сначала завершите:', 'Доп. работа'], ['state-info', 'state-info'],
    ['navigate2', 'navigateBack0'], [{ itemId: 'blocker-additional-work', target: 'S03-E17' }],
  ),
  blockerFixture(
    'S03-E12:no-blockers', P2A1_EMPLOYEE_NO_BLOCKERS,
    ['employee-blockers-message', 'employee-blockers-back'],
    ['Для завершения смены сначала завершите:', 'Назад'], ['state-info'],
    ['navigateBack0'], [],
  ),
]);

export const SECTION03_P2A1_FIXTURE_IDS = Object.freeze(
  SECTION03_P2A1_FIXTURES.map((value) => value.fixtureId),
);
