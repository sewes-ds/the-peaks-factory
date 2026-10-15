import type {
  ManagerCompletedWorkCardResponse,
  ManagerCompletedWorkItem,
  ManagerCompletedWorksResponse,
} from '../contracts';
import type { Section03NodeId } from '../program';
import type { Section03Context } from '../program/context';

type ExpectedNavigation = Readonly<{
  target: Section03NodeId;
  event: Section03Context;
}>;

export type Section03P2B1Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-E20' | 'S03-E21' | 'S03-E22';
  context: Section03Context;
  apiResponse: ManagerCompletedWorksResponse | ManagerCompletedWorkCardResponse | null;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText: readonly string[];
  expectedStateKeys: readonly string[];
  expectedNavigations: readonly ExpectedNavigation[];
  exactRequestPath: string | null;
  backTarget: 'S03-E02' | 'S03-E20' | 'S03-E21';
  expectProjectionFailure: boolean;
}>;

const canonicalCurrentWorker: Readonly<{
  employee_id: string;
  full_name: string;
}> = Object.freeze({ employee_id: 'EMP-1', full_name: 'Анна Слесарева' });

export const SECTION03_P2B1_EMPLOYEE_FIXTURE_ALIASES = Object.freeze({
  'EMP-CW': canonicalCurrentWorker,
});

const employee = SECTION03_P2B1_EMPLOYEE_FIXTURE_ALIASES['EMP-CW'];

function work(
  overrides: Partial<ManagerCompletedWorkItem> = {},
): ManagerCompletedWorkItem {
  return Object.freeze({
    work_item_id: 'WI-PROD',
    work_type: 'production',
    operation_id: 'OP-PROD',
    employee_id: employee.employee_id,
    employee_full_name: 'Анна Слесарева',
    completed_date: '02.08.2026 14:30',
    production_operation_id: 'PO-PROD',
    additional_work_id: null,
    machine_id: 'M-7',
    machine_name: 'Фрезерный станок',
    sku_name: 'Корпус редуктора',
    sku_code: 'KR-42',
    quantity: '12.5',
    additional_work_name: null,
    salary_entry_id: 'SAL-PROD',
    salary_amount_uzs: '125000',
    amount_uzs: '120000',
    old_quantity: null,
    correction_base_quantity: '12.5',
    current_quantity: '12.5',
    can_correct: true,
    can_storno: true,
    is_reversed: false,
    reversal_id: null,
    ...overrides,
  });
}

function worksResponse(
  works: readonly ManagerCompletedWorkItem[],
  employeeOverride = employee,
): ManagerCompletedWorksResponse {
  return Object.freeze({
    section: 'S03',
    screen: 'S03-E21',
    employee: Object.freeze(employeeOverride),
    works: Object.freeze(works),
    available_actions: Object.freeze(['BACK'] as const),
  });
}

function cardResponse(
  completedWork: ManagerCompletedWorkItem,
  employeeOverride = employee,
): ManagerCompletedWorkCardResponse {
  return Object.freeze({
    section: 'S03',
    screen: 'S03-E22',
    employee: Object.freeze(employeeOverride),
    work: completedWork,
    available_actions: Object.freeze(['BACK'] as const),
  });
}

const additional = work({
  work_item_id: 'WI-AW',
  work_type: 'additional_work',
  operation_id: 'OP-AW',
  production_operation_id: null,
  additional_work_id: 'AW-9',
  machine_id: null,
  machine_name: null,
  sku_name: null,
  sku_code: null,
  quantity: null,
  additional_work_name: 'Инвентаризация оснастки',
  salary_entry_id: 'SAL-AW',
  salary_amount_uzs: '45000',
  amount_uzs: '40000',
  correction_base_quantity: null,
  current_quantity: null,
  can_correct: false,
  can_storno: true,
});

const e21Context = Object.freeze({ employee_id: employee.employee_id, period: 'today' as const });
const e22ProductionContext = Object.freeze({
  employee_id: employee.employee_id, period: 'today' as const,
  work_type: 'production' as const, operation_id: 'OP-PROD',
});
const e22AdditionalContext = Object.freeze({
  employee_id: employee.employee_id, period: 'month' as const,
  work_type: 'additional_work' as const, operation_id: 'OP-AW',
});

const correctionEvent = Object.freeze({
  correction_scope: 'employee' as const,
  ...e22ProductionContext,
});
const additionalCorrectionEvent = Object.freeze({
  correction_scope: 'employee' as const,
  ...e22AdditionalContext,
});
const productionStornoEvent = Object.freeze({
  ...e22ProductionContext,
  salary_entry_id: 'SAL-PROD',
});
const additionalStornoEvent = Object.freeze({
  ...e22AdditionalContext,
  salary_entry_id: 'SAL-AW',
});

export const SECTION03_P2B1_FIXTURES = Object.freeze([
  Object.freeze({
    fixtureId: 'S03-E20:period-menu', nodeId: 'S03-E20', context: Object.freeze({ employee_id: employee.employee_id }), apiResponse: null,
    orderedItemIds: Object.freeze(['period-today', 'period-week', 'period-month', 'period-last_30_days', 'completed-works-period-back']),
    visibleText: Object.freeze(['Выполненные работы', 'За сегодня', 'За неделю', 'За месяц', 'Последние 30 дней', 'Назад']), absentText: Object.freeze(['S03-E20', 'Далее']), expectedStateKeys: Object.freeze([]),
    expectedNavigations: Object.freeze([
      Object.freeze({ target: 'S03-E21', event: Object.freeze({ employee_id: employee.employee_id, period: 'today' }) }),
      Object.freeze({ target: 'S03-E21', event: Object.freeze({ employee_id: employee.employee_id, period: 'week' }) }),
      Object.freeze({ target: 'S03-E21', event: Object.freeze({ employee_id: employee.employee_id, period: 'month' }) }),
      Object.freeze({ target: 'S03-E21', event: Object.freeze({ employee_id: employee.employee_id, period: 'last_30_days' }) }),
    ]), exactRequestPath: null, backTarget: 'S03-E02', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E21:mixed-production-additional', nodeId: 'S03-E21', context: e21Context, apiResponse: worksResponse([work(), additional]),
    orderedItemIds: Object.freeze(['work-WI-PROD', 'work-WI-AW', 'completed-works-list-back']), visibleText: Object.freeze(['Дата 02.08.2026', 'SKU: Корпус редуктора\nКоличество: 13\nНачисленная зарплата\n125000 сум', 'Доп. работа: Инвентаризация оснастки\nНачисленная зарплата\n45000 сум']), absentText: Object.freeze(['14:30', 'S03-E21', 'Далее']), expectedStateKeys: Object.freeze(['state-positive', 'state-info']),
    expectedNavigations: Object.freeze([
      Object.freeze({ target: 'S03-E22', event: Object.freeze({ ...e21Context, work_type: 'production', operation_id: 'OP-PROD' }) }),
      Object.freeze({ target: 'S03-E22', event: Object.freeze({ ...e21Context, work_type: 'additional_work', operation_id: 'OP-AW' }) }),
    ]), exactRequestPath: '/manager/employees/EMP-1/completed-works?period=today&type=all', backTarget: 'S03-E20', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E21:empty', nodeId: 'S03-E21', context: e21Context, apiResponse: worksResponse([]), orderedItemIds: Object.freeze(['completed-works-empty', 'completed-works-list-back']), visibleText: Object.freeze(['Нет выполненных работ за выбранный период.', 'Назад']), absentText: Object.freeze(['work-', 'Далее']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([]), exactRequestPath: '/manager/employees/EMP-1/completed-works?period=today&type=all', backTarget: 'S03-E20', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E21:production-fallback-values', nodeId: 'S03-E21', context: e21Context, apiResponse: worksResponse([work({ work_item_id: 'WI-FALLBACK', operation_id: 'OP-FALLBACK', sku_name: null, quantity: null, current_quantity: '7.5', salary_amount_uzs: '', amount_uzs: '' })]), orderedItemIds: Object.freeze(['work-WI-FALLBACK', 'completed-works-list-back']), visibleText: Object.freeze(['SKU: —\nКоличество: 8\nНачисленная зарплата\n0 сум']), absentText: Object.freeze(['14:30', 'Корпус редуктора', '125000']), expectedStateKeys: Object.freeze(['state-positive']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-E22', event: Object.freeze({ ...e21Context, work_type: 'production', operation_id: 'OP-FALLBACK' }) })]), exactRequestPath: '/manager/employees/EMP-1/completed-works?period=today&type=all', backTarget: 'S03-E20', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E21:additional-fallback-name', nodeId: 'S03-E21', context: e21Context, apiResponse: worksResponse([work({ ...additional, work_item_id: 'WI-AW-FALLBACK', operation_id: 'OP-AW-FALLBACK', additional_work_name: '' })]), orderedItemIds: Object.freeze(['work-WI-AW-FALLBACK', 'completed-works-list-back']), visibleText: Object.freeze(['Дата 02.08.2026', 'Доп. работа: —\nНачисленная зарплата\n45000 сум']), absentText: Object.freeze(['14:30', 'Инвентаризация оснастки', 'Корректировка']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-E22', event: Object.freeze({ ...e21Context, work_type: 'additional_work', operation_id: 'OP-AW-FALLBACK' }) })]), exactRequestPath: '/manager/employees/EMP-1/completed-works?period=today&type=all', backTarget: 'S03-E20', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E21:long-content', nodeId: 'S03-E21', context: e21Context, apiResponse: worksResponse([work({ work_item_id: 'WI-LONG', operation_id: 'OP-LONG', sku_name: 'Очень длинное наименование производственной позиции для проверки автоматической высоты многострочной строки без обрезания текста', quantity: '1234567890.1234567890', salary_amount_uzs: '999999999999999999999' })]), orderedItemIds: Object.freeze(['work-WI-LONG', 'completed-works-list-back']), visibleText: Object.freeze(['Очень длинное наименование производственной позиции', '999999999999999999999 сум']), absentText: Object.freeze(['S03-E21', 'Далее']), expectedStateKeys: Object.freeze(['state-positive']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-E22', event: Object.freeze({ ...e21Context, work_type: 'production', operation_id: 'OP-LONG' }) })]), exactRequestPath: '/manager/employees/EMP-1/completed-works?period=today&type=all', backTarget: 'S03-E20', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E21:employee-mismatch', nodeId: 'S03-E21', context: e21Context, apiResponse: worksResponse([work()], Object.freeze({ employee_id: 'EMP-OTHER', full_name: 'Другой сотрудник' })), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedNavigations: Object.freeze([]), exactRequestPath: '/manager/employees/EMP-1/completed-works?period=today&type=all', backTarget: 'S03-E20', expectProjectionFailure: true,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:production-all-actions', nodeId: 'S03-E22', context: e22ProductionContext, apiResponse: cardResponse(work()), orderedItemIds: Object.freeze(['completed-work-card', 'completed-work-correction', 'completed-work-storno', 'completed-work-card-back']), visibleText: Object.freeze(['Сотрудник', 'Анна Слесарева', 'Дата', '02.08.2026', 'SKU', 'Корпус редуктора', 'Количество', '13', 'Начисленная зарплата', '125000 сум', 'Корректировка', 'Сторно']), absentText: Object.freeze(['14:30', 'S03-E22', 'Далее']), expectedStateKeys: Object.freeze(['state-positive']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CP13', event: correctionEvent }), Object.freeze({ target: 'S03-CF24', event: productionStornoEvent })]), exactRequestPath: '/manager/employees/EMP-1/completed-works/production/OP-PROD', backTarget: 'S03-E21', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:production-no-actions', nodeId: 'S03-E22', context: e22ProductionContext, apiResponse: cardResponse(work({ can_correct: false, can_storno: false })), orderedItemIds: Object.freeze(['completed-work-card', 'completed-work-correction', 'completed-work-storno', 'completed-work-card-back']), visibleText: Object.freeze(['Корпус редуктора', 'Количество', '13', 'Корректировка', 'Сторно', 'Назад']), absentText: Object.freeze(['14:30']), expectedStateKeys: Object.freeze(['state-positive']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CP13', event: correctionEvent }), Object.freeze({ target: 'S03-CF24', event: productionStornoEvent })]), exactRequestPath: '/manager/employees/EMP-1/completed-works/production/OP-PROD', backTarget: 'S03-E21', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:production-reversed', nodeId: 'S03-E22', context: e22ProductionContext, apiResponse: cardResponse(work({ is_reversed: true, reversal_id: 'REV-1' })), orderedItemIds: Object.freeze(['completed-work-card', 'completed-work-correction', 'completed-work-storno', 'completed-work-card-back']), visibleText: Object.freeze(['Корректировка', 'Сторнировано', 'Назад']), absentText: Object.freeze([]), expectedStateKeys: Object.freeze(['state-positive']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CP13', event: correctionEvent }), Object.freeze({ target: 'S03-CF24', event: productionStornoEvent })]), exactRequestPath: '/manager/employees/EMP-1/completed-works/production/OP-PROD', backTarget: 'S03-E21', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:production-missing-salary-entry', nodeId: 'S03-E22', context: e22ProductionContext, apiResponse: cardResponse(work({ salary_entry_id: null })), orderedItemIds: Object.freeze(['completed-work-card', 'completed-work-correction', 'completed-work-storno', 'completed-work-card-back']), visibleText: Object.freeze(['Корректировка', 'Сторно', 'Назад']), absentText: Object.freeze([]), expectedStateKeys: Object.freeze(['state-positive']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CP13', event: correctionEvent }), Object.freeze({ target: 'S03-CF24', event: Object.freeze({ employee_id: 'EMP-1', period: 'today', work_type: 'production', operation_id: 'OP-PROD' }) })]), exactRequestPath: '/manager/employees/EMP-1/completed-works/production/OP-PROD', backTarget: 'S03-E21', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:additional-storno', nodeId: 'S03-E22', context: e22AdditionalContext, apiResponse: cardResponse(additional), orderedItemIds: Object.freeze(['completed-work-card', 'completed-work-correction', 'completed-work-storno', 'completed-work-card-back']), visibleText: Object.freeze(['Инвентаризация оснастки', '45000 сум', 'Корректировка', 'Сторно']), absentText: Object.freeze(['SKU']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CP13', event: additionalCorrectionEvent }), Object.freeze({ target: 'S03-CF24', event: additionalStornoEvent })]), exactRequestPath: '/manager/employees/EMP-1/completed-works/additional_work/OP-AW', backTarget: 'S03-E21', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:additional-no-name', nodeId: 'S03-E22', context: e22AdditionalContext, apiResponse: cardResponse(work({ ...additional, additional_work_name: '' })), orderedItemIds: Object.freeze(['completed-work-card', 'completed-work-correction', 'completed-work-storno', 'completed-work-card-back']), visibleText: Object.freeze(['Сотрудник', 'Дата', 'Начисленная зарплата', '45000 сум', 'Корректировка', 'Сторно']), absentText: Object.freeze(['Доп. работа', 'Инвентаризация оснастки', 'SKU']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CP13', event: additionalCorrectionEvent }), Object.freeze({ target: 'S03-CF24', event: additionalStornoEvent })]), exactRequestPath: '/manager/employees/EMP-1/completed-works/additional_work/OP-AW', backTarget: 'S03-E21', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:long-content', nodeId: 'S03-E22', context: e22AdditionalContext, apiResponse: cardResponse(work({ ...additional, additional_work_name: 'Очень длинное описание дополнительной работы для проверки автоматического роста карточки и отсутствия пересечений с фиксированными кнопками', salary_amount_uzs: '888888888888888888888' })), orderedItemIds: Object.freeze(['completed-work-card', 'completed-work-correction', 'completed-work-storno', 'completed-work-card-back']), visibleText: Object.freeze(['Очень длинное описание дополнительной работы', '888888888888888888888 сум', 'Корректировка']), absentText: Object.freeze(['S03-E22']), expectedStateKeys: Object.freeze(['state-info']), expectedNavigations: Object.freeze([Object.freeze({ target: 'S03-CP13', event: additionalCorrectionEvent }), Object.freeze({ target: 'S03-CF24', event: additionalStornoEvent })]), exactRequestPath: '/manager/employees/EMP-1/completed-works/additional_work/OP-AW', backTarget: 'S03-E21', expectProjectionFailure: false,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:employee-mismatch', nodeId: 'S03-E22', context: e22ProductionContext, apiResponse: cardResponse(work(), Object.freeze({ employee_id: 'EMP-OTHER', full_name: 'Другой сотрудник' })), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedNavigations: Object.freeze([]), exactRequestPath: '/manager/employees/EMP-1/completed-works/production/OP-PROD', backTarget: 'S03-E21', expectProjectionFailure: true,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:work-type-mismatch', nodeId: 'S03-E22', context: e22ProductionContext, apiResponse: cardResponse(work({ work_type: 'additional_work' })), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedNavigations: Object.freeze([]), exactRequestPath: '/manager/employees/EMP-1/completed-works/production/OP-PROD', backTarget: 'S03-E21', expectProjectionFailure: true,
  }),
  Object.freeze({
    fixtureId: 'S03-E22:operation-id-mismatch', nodeId: 'S03-E22', context: e22ProductionContext, apiResponse: cardResponse(work({ operation_id: 'OP-OTHER' })), orderedItemIds: Object.freeze([]), visibleText: Object.freeze([]), absentText: Object.freeze([]), expectedStateKeys: Object.freeze([]), expectedNavigations: Object.freeze([]), exactRequestPath: '/manager/employees/EMP-1/completed-works/production/OP-PROD', backTarget: 'S03-E21', expectProjectionFailure: true,
  }),
] as const satisfies readonly Section03P2B1Fixture[]);

export const SECTION03_P2B1_FIXTURE_IDS = Object.freeze(
  SECTION03_P2B1_FIXTURES.map((fixture) => fixture.fixtureId),
);
