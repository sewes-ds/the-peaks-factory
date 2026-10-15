import type { Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';

type SalaryEmployee = Readonly<{ employee_id: string | number; full_name: string }>;
type SalaryBreakdown = Readonly<{
  production_uzs: number;
  additional_work_uzs: number;
  corrections_uzs: number | null;
  reversals_uzs: number | null;
}>;
type SalarySummaryResponse = Readonly<{
  section: 'S03';
  screen: 'S03-SAL01';
  employee: SalaryEmployee;
  employee_id: string | number;
  totals: Readonly<{ today_uzs: number; week_uzs: number; month_uzs: number }>;
  breakdown?: SalaryBreakdown;
}>;
type SalaryHistoryMonth = Readonly<{
  month: string;
  total_uzs: number;
  production_uzs: number;
  additional_work_uzs: number;
  corrections_uzs: number | null;
  reversals_uzs: number | null;
}>;
type SalaryHistoryResponse = Readonly<{
  section: 'S03';
  screen: 'S03-SAL02';
  employee: SalaryEmployee;
  employee_id: string | number;
  months: readonly SalaryHistoryMonth[];
}>;

type ExpectedNavigation = Readonly<{
  target: Section03NodeId;
  event: Section03Context;
}>;

export type Section03P2B2Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-SAL01' | 'S03-SAL02';
  context: Section03Context;
  apiResponse: SalarySummaryResponse | SalaryHistoryResponse;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  expectedStateKeys: readonly string[];
  expectedNavigations: readonly ExpectedNavigation[];
  expectedRequest: Readonly<{ method: 'GET'; path: string }>;
  backTarget: 'S03-E02' | 'S03-SAL01';
  expectProjectionFailure: boolean;
}>;

const employee = Object.freeze({ employee_id: 'EMP-SALARY', full_name: 'Мария Орлова' });
const context = Object.freeze({ employee_id: 'EMP-SALARY' });

function summary(
  totals: Readonly<{ today_uzs: number; week_uzs: number; month_uzs: number }>,
  options: Readonly<{
    employee?: SalaryEmployee;
    employee_id?: string | number;
    breakdown?: SalaryBreakdown;
  }> = {},
): SalarySummaryResponse {
  return Object.freeze({
    section: 'S03', screen: 'S03-SAL01',
    employee: Object.freeze(options.employee ?? employee),
    employee_id: options.employee_id ?? 'EMP-SALARY',
    totals: Object.freeze(totals),
    ...(options.breakdown === undefined ? {} : { breakdown: Object.freeze(options.breakdown) }),
  });
}

function history(
  months: readonly SalaryHistoryMonth[],
  options: Readonly<{
    employee?: SalaryEmployee;
    employee_id?: string | number;
  }> = {},
): SalaryHistoryResponse {
  return Object.freeze({
    section: 'S03', screen: 'S03-SAL02',
    employee: Object.freeze(options.employee ?? employee),
    employee_id: options.employee_id ?? 'EMP-SALARY',
    months: Object.freeze(months),
  });
}

function month(overrides: Partial<SalaryHistoryMonth> = {}): SalaryHistoryMonth {
  return Object.freeze({
    month: '2026-07', total_uzs: 310000, production_uzs: 250000,
    additional_work_uzs: 40000, corrections_uzs: 30000, reversals_uzs: -10000,
    ...overrides,
  });
}

const summaryItems = Object.freeze(['salary-summary-card', 'salary-history', 'salary-summary-back']);
const historyNavigation = Object.freeze([
  Object.freeze({ target: 'S03-SAL02' as const, event: context }),
]);

export const SECTION03_P2B2_FIXTURES = Object.freeze([
  Object.freeze({
    fixtureId: 'S03-SAL01:summary-with-breakdown', nodeId: 'S03-SAL01', context,
    apiResponse: summary({ today_uzs: 10000, week_uzs: 70000, month_uzs: 300000 }, { breakdown: { production_uzs: 250000, additional_work_uzs: 40000, corrections_uzs: 20000, reversals_uzs: -10000 } }),
    orderedItemIds: summaryItems, visibleText: Object.freeze(['Зарплата', 'Сотрудник', 'Мария Орлова', 'Сегодня', '10000 сум', 'Неделя', '70000 сум', 'Месяц', '300000 сум', 'История зарплаты', 'Назад']), absentText: Object.freeze(['Производство', 'Доп.Работы', 'Корректировки', 'Сторно', 'S03-SAL01']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: historyNavigation, expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary' }), backTarget: 'S03-E02', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL01:summary-without-breakdown', nodeId: 'S03-SAL01', context,
    apiResponse: summary({ today_uzs: 1500, week_uzs: 9000, month_uzs: 45000 }), orderedItemIds: summaryItems, visibleText: Object.freeze(['Мария Орлова', 'Сегодня', '1500 сум', 'Неделя', '9000 сум', 'Месяц', '45000 сум']), absentText: Object.freeze(['Производство', 'Доп.Работы', 'Корректировки', 'Сторно']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: historyNavigation, expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary' }), backTarget: 'S03-E02', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL01:zero-values', nodeId: 'S03-SAL01', context,
    apiResponse: summary({ today_uzs: 0, week_uzs: 0, month_uzs: 0 }), orderedItemIds: summaryItems, visibleText: Object.freeze(['Сегодня', 'Неделя', 'Месяц', '0 сум']), absentText: Object.freeze(['0,00', '0 ', 'Производство']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: historyNavigation, expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary' }), backTarget: 'S03-E02', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL01:negative-values', nodeId: 'S03-SAL01', context,
    apiResponse: summary({ today_uzs: -500, week_uzs: -1500.25, month_uzs: -9000 }), orderedItemIds: summaryItems, visibleText: Object.freeze(['-500 сум', '-1500 сум', '-9000 сум']), absentText: Object.freeze(['-1500.25', '-1 500', '-1,500', 'Корректировки']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: historyNavigation, expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary' }), backTarget: 'S03-E02', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL01:long-name-large-values', nodeId: 'S03-SAL01', context,
    apiResponse: summary({ today_uzs: 9876543210123.5, week_uzs: 8765432101234, month_uzs: 7654321012345 }, { employee: { employee_id: 'EMP-SALARY', full_name: 'Очень длинное имя сотрудника для проверки автоматического роста информационной карточки без обрезания текста' } }), orderedItemIds: summaryItems, visibleText: Object.freeze(['Очень длинное имя сотрудника', '9876543210124 сум', '8765432101234 сум', '7654321012345 сум']), absentText: Object.freeze(['9876543210123.5', '9 876', 'S03-SAL01']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: historyNavigation, expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary' }), backTarget: 'S03-E02', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL01:top-level-id-mismatch', nodeId: 'S03-SAL01', context,
    apiResponse: summary({ today_uzs: 1, week_uzs: 2, month_uzs: 3 }, { employee_id: 'EMP-OTHER' }), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary' }), backTarget: 'S03-E02', expectProjectionFailure: true,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL01:nested-id-mismatch', nodeId: 'S03-SAL01', context,
    apiResponse: summary({ today_uzs: 1, week_uzs: 2, month_uzs: 3 }, { employee: { employee_id: 'EMP-OTHER', full_name: 'Другой сотрудник' } }), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary' }), backTarget: 'S03-E02', expectProjectionFailure: true,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL02:mixed-months', nodeId: 'S03-SAL02', context,
    apiResponse: history([month(), month({ month: '2026-06', total_uzs: 180000, production_uzs: 160000, additional_work_uzs: 20000, corrections_uzs: null, reversals_uzs: null })]), orderedItemIds: Object.freeze(['salary-history-month-0', 'salary-history-month-1', 'salary-history-back']), visibleText: Object.freeze(['История зарплаты', 'Июль 2026', '250000 сум', '40000 сум', '30000 сум', '-10000 сум', '310000 сум', 'Июнь 2026', '160000 сум', '20000 сум', '180000 сум']), absentText: Object.freeze(['2026-07', '2026-06', 'S03-SAL02', 'Далее']), expectedStateKeys: Object.freeze(['state-info', 'state-info']), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary/history' }), backTarget: 'S03-SAL01', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL02:empty', nodeId: 'S03-SAL02', context,
    apiResponse: history([]), orderedItemIds: Object.freeze(['salary-history-empty', 'salary-history-back']), visibleText: Object.freeze(['История зарплаты отсутствует.', 'Назад']), absentText: Object.freeze(['Производство', 'Доп.Работы', 'Всего']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary/history' }), backTarget: 'S03-SAL01', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL02:null-optionals', nodeId: 'S03-SAL02', context,
    apiResponse: history([month({ corrections_uzs: null, reversals_uzs: null })]), orderedItemIds: Object.freeze(['salary-history-month-0', 'salary-history-back']), visibleText: Object.freeze(['Июль 2026', 'Производство', '250000 сум', 'Доп.Работы', '40000 сум', 'Всего', '310000 сум']), absentText: Object.freeze(['2026-07', 'Корректировки', 'Сторно']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary/history' }), backTarget: 'S03-SAL01', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL02:zero-negative-values', nodeId: 'S03-SAL02', context,
    apiResponse: history([month({ month: '2026-05', total_uzs: -25.5, production_uzs: 0, additional_work_uzs: -10, corrections_uzs: -20.5, reversals_uzs: 5 })]), orderedItemIds: Object.freeze(['salary-history-month-0', 'salary-history-back']), visibleText: Object.freeze(['Май 2026', '0 сум', '-10 сум', '-21 сум', '5 сум', '-26 сум']), absentText: Object.freeze(['2026-05', '-20.5', '-25.5', '-20,5', '0,00']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary/history' }), backTarget: 'S03-SAL01', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL02:long-values', nodeId: 'S03-SAL02', context,
    apiResponse: history([month({ month: '2026-04-01', total_uzs: 9999999999999, production_uzs: 8888888888888, additional_work_uzs: 7777777777777, corrections_uzs: 6666666666666, reversals_uzs: -5555555555555 })]), orderedItemIds: Object.freeze(['salary-history-month-0', 'salary-history-back']), visibleText: Object.freeze(['Апрель 2026', '9999999999999 сум', '8888888888888 сум', '7777777777777 сум', '6666666666666 сум', '-5555555555555 сум']), absentText: Object.freeze(['2026-04-01', '9 999', 'S03-SAL02']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary/history' }), backTarget: 'S03-SAL01', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL02:top-level-id-mismatch', nodeId: 'S03-SAL02', context,
    apiResponse: history([month()], { employee_id: 'EMP-OTHER' }), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary/history' }), backTarget: 'S03-SAL01', expectProjectionFailure: true,
  }),
  Object.freeze({
    fixtureId: 'S03-SAL02:nested-id-mismatch', nodeId: 'S03-SAL02', context,
    apiResponse: history([month()], { employee: { employee_id: 'EMP-OTHER', full_name: 'Другой сотрудник' } }), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedNavigations: Object.freeze([]), expectedRequest: Object.freeze({ method: 'GET', path: '/manager/employees/EMP-SALARY/salary/history' }), backTarget: 'S03-SAL01', expectProjectionFailure: true,
  }),
] as const satisfies readonly Section03P2B2Fixture[]);

export const SECTION03_P2B2_FIXTURE_IDS = Object.freeze(
  SECTION03_P2B2_FIXTURES.map((fixture) => fixture.fixtureId),
);
