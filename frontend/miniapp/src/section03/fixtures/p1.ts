import type { Section03Context } from '../program/context';
import type { Section03P1SpecializedNodeId } from '../projections/p1';

function machine(overrides: Readonly<Record<string, unknown>> = {}) {
  return Object.freeze({
    machine_id: 'M-IDLE', machine_name: 'Станок свободен', ui_state: 'idle', ui_variant: 'light_blue',
    active_production_operation_id: null, active_employee_id: null, active_employee_full_name: null,
    active_sku_id: null, active_sku_code: null, active_sku_name: null, active_break_id: null, active_break_name: null,
    active_downtime_id: null, downtime_type: null, downtime_name: null, downtime_comment: null,
    downtime_start_comment: null, downtime_finish_comment: null, downtime_started_at: null, downtime_duration: null,
    has_active_critical_downtime: false, has_active_operational_downtime: false,
    active_operational_downtime_id: null, is_selectable_for_manager_critical_downtime: true,
    available_actions: Object.freeze(['OPEN_MACHINE_CARD', 'START_CRITICAL_DOWNTIME']),
    ...overrides,
  });
}

export const P1_MACHINE_IDLE = machine();
export const P1_MACHINE_PRODUCTION = machine({
  machine_id: 'M-PROD', machine_name: 'Станок в производстве', ui_state: 'running', ui_variant: 'green',
  active_production_operation_id: 'PO-1', active_employee_id: 'EMP-1', active_employee_full_name: 'Иван Иванов',
  active_sku_id: 'SKU-1', active_sku_code: 'SKU-CODE-HIDDEN', active_sku_name: 'Корпус редуктора',
});
export const P1_MACHINE_OPERATIONAL = machine({
  machine_id: 'M-OP', machine_name: 'Станок операционного простоя', ui_state: 'warning', ui_variant: 'yellow',
  active_production_operation_id: 'PO-OP', active_employee_id: 'EMP-OP', active_employee_full_name: 'Оператор Операционный',
  active_sku_id: 'SKU-OP', active_sku_code: 'OP-HIDDEN', active_sku_name: 'Операционная деталь',
  active_downtime_id: 'D-OP', downtime_type: 'operational', downtime_name: 'Наладка',
  downtime_started_at: '2026-08-01T10:00:00+05:00', downtime_duration: '1 ч 20 мин',
  has_active_operational_downtime: true, active_operational_downtime_id: 'D-OP',
  available_actions: Object.freeze(['OPEN_MACHINE_CARD', 'FINISH_DOWNTIME']),
});
export const P1_MACHINE_CRITICAL = machine({
  machine_id: 'M-CRIT', machine_name: 'Станок критического простоя', ui_state: 'critical', ui_variant: 'red',
  active_production_operation_id: 'PO-CRIT', active_employee_id: 'EMP-CRIT', active_employee_full_name: 'Оператор Критический',
  active_sku_id: 'SKU-CRIT', active_sku_code: 'CRIT-HIDDEN', active_sku_name: 'Критическая деталь',
  active_downtime_id: 'D-CRIT', downtime_type: 'critical', downtime_name: 'Поломка шпинделя',
  downtime_comment: 'Совместимый комментарий', downtime_start_comment: 'Остановлен из-за вибрации',
  downtime_started_at: '2026-08-01T09:30:00+05:00', downtime_duration: '2 ч 5 мин',
  has_active_critical_downtime: true,
  available_actions: Object.freeze(['OPEN_MACHINE_CARD', 'FINISH_DOWNTIME']),
});
export const P1_MACHINE_CRITICAL_NO_COMMENT = machine({
  ...P1_MACHINE_CRITICAL,
  machine_id: 'M-CRIT-NO-COMMENT',
  machine_name: 'Станок критического простоя без комментария',
  downtime_start_comment: null,
  downtime_comment: null,
});

const mainSection = (title: string, available_actions: readonly string[]) => Object.freeze({ title, ui_variant: 'light_blue', available_actions });
export const P1_WORKPLACE_RESPONSE = Object.freeze({
  section: 'S03', screen: 'S03-N01', manager: Object.freeze({ employee_id: 'EMP-MANAGER', full_name: 'Начальник производства' }),
  sections: Object.freeze({
    machines: Object.freeze({ ...mainSection('Станки', ['OPEN_MACHINES']), running_count: 2, downtime_count: 2, idle_count: 1, downtime_severity: 'critical' }),
    employees: Object.freeze({
      ...mainSection('Сотрудники', ['OPEN_EMPLOYEES']),
      open_shift_count: 5,
      production_count: 2,
      downtime_count: 2,
      additional_work_count: 1,
      break_count: 1,
      without_work_count: 1,
      production_downtime_severity: 'critical',
      production_active_clear_count: 2,
      production_break_count: 1,
      production_downtime_count: 2,
      additional_work_active_clear_count: 1,
      additional_work_break_count: 0,
      open_shift_without_work_count: 1,
    }),
    downtimes: Object.freeze({ ...mainSection('Простои', ['OPEN_DOWNTIMES', 'START_CRITICAL_DOWNTIME']), critical_count: 1, operational_count: 1 }),
    additional_works: Object.freeze({ ...mainSection('Доп. работы', ['OPEN_ADDITIONAL_WORKS']), ui_variant: 'grey', requested_count: 1, approved_count: 2, active_count: 3, requires_accrual_count: 4 }),
    corrections: mainSection('Корректировки', ['OPEN_CORRECTIONS']),
    notifications: Object.freeze({ ...mainSection('Уведомления', ['OPEN_NOTIFICATIONS']), open_tasks_count: 2 }),
    reports: Object.freeze({
      title: 'Отчёты',
      ui_variant: 'light_blue',
      is_placeholder: true,
      available_actions: Object.freeze([]) as readonly [],
    }),
  }),
});

export const P1_MACHINES_RESPONSE = Object.freeze({
  section: 'S03', screen: 'S03-M01', title: 'Станки',
  machines: Object.freeze([P1_MACHINE_PRODUCTION, P1_MACHINE_OPERATIONAL, P1_MACHINE_CRITICAL, P1_MACHINE_IDLE]),
  available_actions: Object.freeze(['BACK']),
});
export const P1_DOWNTIMES_RESPONSE = Object.freeze({
  section: 'S03', screen: 'S03-D01', title: 'Простои',
  downtimes: Object.freeze([
    Object.freeze({ ...P1_MACHINE_OPERATIONAL, machine_id: 'M-OP', active_downtime_id: 'D-OP' }),
    Object.freeze({ ...P1_MACHINE_CRITICAL, machine_id: 'M-CRIT', active_downtime_id: 'D-CRIT' }),
  ]),
  available_actions: Object.freeze(['START_CRITICAL_DOWNTIME', 'BACK']),
});
export const P1_DOWNTIME_TYPES_RESPONSE = Object.freeze({
  section: 'S03', screen: 'S03-D10',
  downtime_types: Object.freeze([Object.freeze({ downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой', severity: 'critical', is_active: true, display_order: 1 })]),
  available_actions: Object.freeze(['BACK']),
});

const P1_WORKPLACE_DENIED_RESPONSE = Object.freeze({
  ...P1_WORKPLACE_RESPONSE,
  sections: Object.freeze(Object.fromEntries(Object.entries(P1_WORKPLACE_RESPONSE.sections).map(([key, value]) => [
    key, Object.freeze({
      ...value,
      available_actions: key === 'reports'
        ? Object.freeze([])
        : Object.freeze(['BACK']),
    }),
  ]))),
  available_actions: Object.freeze(['BACK']),
});
const P1_MACHINES_DENIED_RESPONSE = Object.freeze({
  ...P1_MACHINES_RESPONSE,
  machines: Object.freeze(P1_MACHINES_RESPONSE.machines.map((value) => Object.freeze({ ...value, available_actions: Object.freeze(['BACK']) }))),
});
const P1_MACHINE_LONG = machine({
  ...P1_MACHINE_PRODUCTION,
  machine_id: 'M-LONG',
  machine_name: 'Станок с очень длинным наименованием производственной линии для проверки переноса текста',
  active_employee_full_name: 'Сотрудник с очень длинным отображаемым именем для проверки автоматической высоты',
  active_sku_name: 'Корпус редуктора с очень длинным наименованием номенклатуры',
});
const P1_MACHINES_LONG_RESPONSE = Object.freeze({
  ...P1_MACHINES_RESPONSE,
  machines: Object.freeze([P1_MACHINE_LONG]),
});
const P1_DOWNTIMES_START_DENIED_RESPONSE = Object.freeze({
  ...P1_DOWNTIMES_RESPONSE,
  available_actions: Object.freeze(['BACK']),
});
const P1_DOWNTIMES_LONG_RESPONSE = Object.freeze({
  ...P1_DOWNTIMES_RESPONSE,
  downtimes: Object.freeze(P1_DOWNTIMES_RESPONSE.downtimes.map((value) => value.downtime_type === 'critical'
    ? Object.freeze({
        ...value,
        downtime_name: 'Поломка шпинделя с очень длинным наименованием причины для проверки автоматического переноса текста',
        machine_name: 'Станок критического простоя с очень длинным производственным наименованием',
        downtime_start_comment: 'Остановлен из-за критической вибрации шпинделя; требуется подробная диагностика узла и согласование безопасного возобновления производства.',
      })
    : value)),
});
const P1_MACHINE_IDLE_DENIED = Object.freeze({ ...P1_MACHINE_IDLE, available_actions: Object.freeze(['BACK']) });
const P1_MACHINE_OPERATIONAL_DENIED = Object.freeze({ ...P1_MACHINE_OPERATIONAL, available_actions: Object.freeze(['OPEN_MACHINE_CARD']) });

const responses = (values: Readonly<Record<string, unknown>>) => Object.freeze(values);
export const P1_API_RESPONSES = Object.freeze({
  main: responses({ '/manager/workplace-state': P1_WORKPLACE_RESPONSE }),
  mainDenied: responses({ '/manager/workplace-state': P1_WORKPLACE_DENIED_RESPONSE }),
  machines: responses({ '/manager/machines': P1_MACHINES_RESPONSE }),
  machinesOrdinary: responses({ '/manager/machines': Object.freeze({ ...P1_MACHINES_RESPONSE, machines: Object.freeze([P1_MACHINE_PRODUCTION]) }) }),
  machinesOperational: responses({ '/manager/machines': Object.freeze({ ...P1_MACHINES_RESPONSE, machines: Object.freeze([P1_MACHINE_OPERATIONAL]) }) }),
  machinesCritical: responses({ '/manager/machines': Object.freeze({ ...P1_MACHINES_RESPONSE, machines: Object.freeze([P1_MACHINE_CRITICAL]) }) }),
  machinesDenied: responses({ '/manager/machines': P1_MACHINES_DENIED_RESPONSE }),
  machinesLong: responses({ '/manager/machines': P1_MACHINES_LONG_RESPONSE }),
  machinesEmpty: responses({ '/manager/machines': Object.freeze({ ...P1_MACHINES_RESPONSE, machines: Object.freeze([]) }) }),
  machineOperational: responses({ '/manager/machines/M-OP': Object.freeze({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_OPERATIONAL, available_actions: Object.freeze(['BACK']) }) }),
  machineCritical: responses({ '/manager/machines/M-CRIT': Object.freeze({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_CRITICAL, available_actions: Object.freeze(['BACK']) }) }),
  machineCriticalNoComment: responses({ '/manager/machines/M-CRIT-NO-COMMENT': Object.freeze({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_CRITICAL_NO_COMMENT, available_actions: Object.freeze(['BACK']) }) }),
  machineProduction: responses({ '/manager/machines/M-PROD': Object.freeze({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_PRODUCTION, available_actions: Object.freeze(['BACK']) }) }),
  machineIdle: responses({ '/manager/machines/M-IDLE': Object.freeze({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_IDLE, available_actions: Object.freeze(['BACK']) }) }),
  machineIdleDenied: responses({ '/manager/machines/M-IDLE': Object.freeze({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_IDLE_DENIED, available_actions: Object.freeze(['BACK']) }) }),
  machineOperationalDenied: responses({ '/manager/machines/M-OP': Object.freeze({ section: 'S03', screen: 'S03-M02', machine: P1_MACHINE_OPERATIONAL_DENIED, available_actions: Object.freeze(['BACK']) }) }),
  downtimes: responses({ '/manager/downtimes': P1_DOWNTIMES_RESPONSE }),
  downtimesStartDenied: responses({ '/manager/downtimes': P1_DOWNTIMES_START_DENIED_RESPONSE }),
  downtimesLong: responses({ '/manager/downtimes': P1_DOWNTIMES_LONG_RESPONSE }),
  downtimesEmpty: responses({ '/manager/downtimes': Object.freeze({ ...P1_DOWNTIMES_RESPONSE, downtimes: Object.freeze([]) }) }),
  downtimeTypes: responses({ '/manager/downtime-types/critical': P1_DOWNTIME_TYPES_RESPONSE }),
  downtimeTypesEmpty: responses({ '/manager/downtime-types/critical': Object.freeze({ ...P1_DOWNTIME_TYPES_RESPONSE, downtime_types: Object.freeze([]) }) }),
  none: responses({}),
});

export type P1BusinessExpectation = Readonly<{ method: 'POST'; path: string; body: Readonly<Record<string, unknown>>; successTarget: Section03NodeIdLike }>;
type Section03NodeIdLike = string;

export type Section03P1Fixture = Readonly<{
  fixtureId: string;
  nodeId: Section03P1SpecializedNodeId;
  context: Section03Context;
  apiResponses: Readonly<Record<string, unknown>>;
  expectedTitle: string | null;
  orderedItemIds: readonly string[];
  visibleText: readonly string[];
  absentText?: readonly string[];
  stateKeys: readonly string[];
  expectedActionIds: readonly string[];
  expectedBack: string | null;
  expectedNext: string | null;
  expectedBusiness: P1BusinessExpectation | null;
}>;

function fixture(value: Section03P1Fixture): Section03P1Fixture {
  return Object.freeze({
    ...value,
    context: Object.freeze({ ...value.context }),
    orderedItemIds: Object.freeze([...value.orderedItemIds]),
    visibleText: Object.freeze([...value.visibleText]),
    absentText: Object.freeze([...(value.absentText ?? [])]),
    stateKeys: Object.freeze([...value.stateKeys]),
    expectedActionIds: Object.freeze([...value.expectedActionIds]),
  });
}

const noBusiness = null;
const mainExpected = Object.freeze({ expectedTitle: null, orderedItemIds: Object.freeze(['main-machines', 'main-employees', 'main-downtimes', 'main-additional-works', 'main-corrections', 'main-notifications', 'main-reports']), visibleText: Object.freeze(['Станки', 'Сотрудники', 'Простои', 'Доп. работы', 'Корректировки', 'Уведомления', 'Отчёты']), stateKeys: Object.freeze(['state-info']), expectedActionIds: Object.freeze(['openMachines', 'p1OpenEmployees', 'p1OpenDowntimes', 'p1OpenAdditionalWorks', 'p1OpenCorrections', 'p1OpenNotifications']), expectedBack: null, expectedNext: null, expectedBusiness: noBusiness });
const machineListExpected = Object.freeze({ expectedTitle: 'Станки', orderedItemIds: Object.freeze(['machine-M-PROD', 'machine-M-OP', 'machine-M-CRIT', 'machine-M-IDLE', 'machines-back']), visibleText: Object.freeze(['Станок в производстве', 'SKU: Корпус редуктора', 'Иван И.']), absentText: Object.freeze(['Оператор Операционный', 'Оператор Критический']), stateKeys: Object.freeze(['state-positive', 'state-warning', 'state-danger', 'state-info']), expectedActionIds: Object.freeze(['openMachineRunning', 'openMachineWarning', 'openMachineCritical', 'openMachineIdle', 'p1BackToMain']), expectedBack: 'S03-N01', expectedNext: null, expectedBusiness: noBusiness });

const finishOperational = Object.freeze({ method: 'POST' as const, path: '/machine-downtimes/D-OP/finish', body: Object.freeze({ comment: 'Завершено начальником производства', reason: 'Завершено начальником производства' }), successTarget: 'S03-M01' });
const finishCritical = Object.freeze({ method: 'POST' as const, path: '/machine-downtimes/D-CRIT/finish', body: Object.freeze({ comment: 'Проверенный комментарий', reason: 'Проверенный комментарий' }), successTarget: 'S03-M01' });
const startCritical = Object.freeze({ method: 'POST' as const, path: '/machine-downtimes/start', body: Object.freeze({ machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', production_operation_id: 'PO-1', comment: 'Причина остановки' }), successTarget: 'S03-N01' });

export const SECTION03_P1_FIXTURES = Object.freeze([
  fixture({ fixtureId: 'S03-N01:representative', nodeId: 'S03-N01', context: {}, apiResponses: P1_API_RESPONSES.main, ...mainExpected }),
  fixture({ fixtureId: 'S03-N01:long-content', nodeId: 'S03-N01', context: {}, apiResponses: P1_API_RESPONSES.main, ...mainExpected }),
  fixture({ fixtureId: 'S03-N01:section-actions-denied', nodeId: 'S03-N01', context: {}, apiResponses: P1_API_RESPONSES.mainDenied, ...mainExpected, expectedActionIds: Object.freeze([]) }),
  fixture({ fixtureId: 'S03-M01:populated-states', nodeId: 'S03-M01', context: {}, apiResponses: P1_API_RESPONSES.machines, ...machineListExpected }),
  fixture({ fixtureId: 'S03-M01:empty', nodeId: 'S03-M01', context: {}, apiResponses: P1_API_RESPONSES.machinesEmpty, ...machineListExpected, orderedItemIds: Object.freeze(['machines-empty', 'machines-back']), visibleText: Object.freeze(['Нет станков для отображения.']), expectedActionIds: Object.freeze(['p1BackToMain']) }),
  fixture({ fixtureId: 'S03-M01:row-action-denied', nodeId: 'S03-M01', context: {}, apiResponses: P1_API_RESPONSES.machinesDenied, ...machineListExpected, expectedActionIds: Object.freeze(['p1BackToMain']) }),
  fixture({ fixtureId: 'S03-M01:long-content', nodeId: 'S03-M01', context: {}, apiResponses: P1_API_RESPONSES.machinesLong, ...machineListExpected, orderedItemIds: Object.freeze(['machine-M-LONG', 'machines-back']), visibleText: Object.freeze(['Станок с очень длинным наименованием', 'Корпус редуктора с очень длинным наименованием']), stateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['openMachineRunning', 'p1BackToMain']) }),
  fixture({ fixtureId: 'S03-M02:operational-downtime', nodeId: 'S03-M02', context: { machine_id: 'M-OP' }, apiResponses: P1_API_RESPONSES.machineOperational, expectedTitle: null, orderedItemIds: Object.freeze(['machine-card', 'machine-finish-operational-D-OP', 'machine-card-back']), visibleText: Object.freeze(['Станок', 'Причина простоя', 'Наладка', 'Завершить:\\nНаладка']), stateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['openOperationalDowntimeFinish', 'p1BackToMachineList']), expectedBack: 'S03-M01', expectedNext: 'S03-M03O', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M02:critical-downtime', nodeId: 'S03-M02', context: { machine_id: 'M-CRIT' }, apiResponses: P1_API_RESPONSES.machineCritical, expectedTitle: null, orderedItemIds: Object.freeze(['machine-card', 'machine-finish-critical-D-CRIT', 'machine-card-back']), visibleText: Object.freeze(['Причина простоя', 'Комментарий', 'Завершить:\\nПоломка шпинделя']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['p1OpenCriticalFinish', 'p1BackToMachineList']), expectedBack: 'S03-M01', expectedNext: 'S03-M03C', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M02:critical-downtime-no-comment', nodeId: 'S03-M02', context: { machine_id: 'M-CRIT-NO-COMMENT' }, apiResponses: P1_API_RESPONSES.machineCriticalNoComment, expectedTitle: null, orderedItemIds: Object.freeze(['machine-card', 'machine-finish-critical-D-CRIT', 'machine-card-back']), visibleText: Object.freeze(['Станок критического простоя без комментария', 'Причина простоя', 'Поломка шпинделя', 'Завершить:\\nПоломка шпинделя', 'Назад']), absentText: Object.freeze(['Комментарий', '—']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['p1OpenCriticalFinish', 'p1BackToMachineList']), expectedBack: 'S03-M01', expectedNext: 'S03-M03C', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M02:active-production', nodeId: 'S03-M02', context: { machine_id: 'M-PROD' }, apiResponses: P1_API_RESPONSES.machineProduction, expectedTitle: null, orderedItemIds: Object.freeze(['machine-card', 'machine-start-downtime-M-PROD', 'machine-card-back']), visibleText: Object.freeze(['Станок', 'SKU', 'Сотрудник', 'Начать простой']), stateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['p1OpenDowntimeStart', 'p1BackToMachineList']), expectedBack: 'S03-M01', expectedNext: 'S03-D10', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M02:idle', nodeId: 'S03-M02', context: { machine_id: 'M-IDLE' }, apiResponses: P1_API_RESPONSES.machineIdle, expectedTitle: null, orderedItemIds: Object.freeze(['machine-card', 'machine-start-downtime-M-IDLE', 'machine-card-back']), visibleText: Object.freeze(['Станок', 'Начать простой']), stateKeys: Object.freeze(['state-info']), expectedActionIds: Object.freeze(['p1OpenDowntimeStart', 'p1BackToMachineList']), expectedBack: 'S03-M01', expectedNext: 'S03-D10', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M02:backend-action-denied', nodeId: 'S03-M02', context: { machine_id: 'M-IDLE' }, apiResponses: P1_API_RESPONSES.machineIdleDenied, expectedTitle: null, orderedItemIds: Object.freeze(['machine-card', 'machine-start-downtime-M-IDLE', 'machine-card-back']), visibleText: Object.freeze(['Станок', 'Начать простой']), stateKeys: Object.freeze(['state-info']), expectedActionIds: Object.freeze(['p1OpenDowntimeStart', 'p1BackToMachineList']), expectedBack: 'S03-M01', expectedNext: null, expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M02:history-entry', nodeId: 'S03-M02', context: { machine_id: 'M-CRIT' }, apiResponses: P1_API_RESPONSES.machineCritical, expectedTitle: null, orderedItemIds: Object.freeze(['machine-card', 'machine-finish-critical-D-CRIT', 'machine-card-back']), visibleText: Object.freeze(['Поломка шпинделя']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['p1OpenCriticalFinish', 'p1BackToMachineList']), expectedBack: null, expectedNext: 'S03-M03C', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M03O:valid-operational', nodeId: 'S03-M03O', context: { machine_id: 'M-OP', downtime_id: 'D-OP' }, apiResponses: P1_API_RESPONSES.machineOperational, expectedTitle: null, orderedItemIds: Object.freeze(['operational-finish-message', 'operational-finish-card', 'finish-operational-D-OP', 'operational-finish-back']), visibleText: Object.freeze(['Подтвердите завершение простоя', 'Завершить:\\nНаладка']), stateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['FINISH_DOWNTIME', 'p1BackToMachineCard']), expectedBack: 'S03-M02', expectedNext: null, expectedBusiness: finishOperational }),
  fixture({ fixtureId: 'S03-M03O:critical-start-follow-up', nodeId: 'S03-M03O', context: { machine_id: 'M-OP', downtime_id: 'D-OP', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой', downtime_follow_up: 'start_critical_downtime' }, apiResponses: P1_API_RESPONSES.machineOperational, expectedTitle: null, orderedItemIds: Object.freeze(['operational-finish-message', 'operational-finish-card', 'finish-operational-D-OP', 'operational-finish-back']), visibleText: Object.freeze(['Подтвердите завершение простоя']), stateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['FINISH_DOWNTIME', 'p1BackToMachineCard']), expectedBack: 'S03-M02', expectedNext: null, expectedBusiness: Object.freeze({ ...finishOperational, successTarget: 'S03-D12' }) }),
  fixture({ fixtureId: 'S03-M03O:unauthorized', nodeId: 'S03-M03O', context: { machine_id: 'M-OP', downtime_id: 'D-OP' }, apiResponses: P1_API_RESPONSES.machineOperationalDenied, expectedTitle: null, orderedItemIds: Object.freeze(['operational-finish-message', 'operational-finish-card', 'finish-operational-D-OP', 'operational-finish-back']), visibleText: Object.freeze(['Подтвердите завершение простоя', 'Завершить:']), stateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['p1BackToMachineCard']), expectedBack: 'S03-M02', expectedNext: null, expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M03C:empty-form', nodeId: 'S03-M03C', context: { machine_id: 'M-CRIT', downtime_id: 'D-CRIT' }, apiResponses: P1_API_RESPONSES.machineCritical, expectedTitle: 'Комментарий', orderedItemIds: Object.freeze(['field-comment_finish', 'critical-finish-next', 'critical-finish-back']), visibleText: Object.freeze(['Комментарий завершения простоя', 'Далее', 'Назад']), stateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['p1ContinueCriticalFinish', 'p1BackToMachineCard']), expectedBack: 'S03-M02', expectedNext: 'S03-M04C', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M03C:valid-form', nodeId: 'S03-M03C', context: { machine_id: 'M-CRIT', downtime_id: 'D-CRIT', comment_finish: 'Проверенный комментарий' }, apiResponses: P1_API_RESPONSES.machineCritical, expectedTitle: 'Комментарий', orderedItemIds: Object.freeze(['field-comment_finish', 'critical-finish-next', 'critical-finish-back']), visibleText: Object.freeze(['Проверенный комментарий']), stateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['p1ContinueCriticalFinish', 'p1BackToMachineCard']), expectedBack: 'S03-M02', expectedNext: 'S03-M04C', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-M04C:valid-critical', nodeId: 'S03-M04C', context: { machine_id: 'M-CRIT', downtime_id: 'D-CRIT', comment_finish: 'Проверенный комментарий' }, apiResponses: P1_API_RESPONSES.machineCritical, expectedTitle: null, orderedItemIds: Object.freeze(['critical-finish-message', 'critical-finish-card', 'finish-critical-D-CRIT', 'critical-finish-confirm-back']), visibleText: Object.freeze(['Подтвердите завершение простоя', 'Проверенный комментарий']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['FINISH_DOWNTIME', 'p1BackToCriticalFinishForm']), expectedBack: 'S03-M03C', expectedNext: null, expectedBusiness: finishCritical }),
  fixture({ fixtureId: 'S03-M04C:pending-duplicate', nodeId: 'S03-M04C', context: { machine_id: 'M-CRIT', downtime_id: 'D-CRIT', comment_finish: 'Проверенный комментарий' }, apiResponses: P1_API_RESPONSES.machineCritical, expectedTitle: null, orderedItemIds: Object.freeze(['critical-finish-message', 'critical-finish-card', 'finish-critical-D-CRIT', 'critical-finish-confirm-back']), visibleText: Object.freeze(['Проверенный комментарий']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['FINISH_DOWNTIME', 'p1BackToCriticalFinishForm']), expectedBack: 'S03-M03C', expectedNext: null, expectedBusiness: finishCritical }),
  fixture({ fixtureId: 'S03-D01:populated', nodeId: 'S03-D01', context: {}, apiResponses: P1_API_RESPONSES.downtimes, expectedTitle: 'Простои', orderedItemIds: Object.freeze(['downtime-D-OP', 'downtime-D-CRIT', 'downtimes-start', 'downtimes-back']), visibleText: Object.freeze(['Наладка', 'Станок операционного простоя', 'Поломка шпинделя', 'Станок критического простоя', 'Начать простой']), absentText: Object.freeze(['SKU:', 'Оператор', 'Остановлен из-за критической вибрации', 'Время начала простоя:', 'Длительность простоя:']), stateKeys: Object.freeze(['state-warning', 'state-danger']), expectedActionIds: Object.freeze(['p1OpenDowntimeMachine', 'p1OpenDowntimeStart', 'p1BackToMain']), expectedBack: 'S03-N01', expectedNext: 'S03-D10', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D01:empty', nodeId: 'S03-D01', context: {}, apiResponses: P1_API_RESPONSES.downtimesEmpty, expectedTitle: 'Простои', orderedItemIds: Object.freeze(['downtimes-empty', 'downtimes-start', 'downtimes-back']), visibleText: Object.freeze(['Нет открытых простоев.']), stateKeys: Object.freeze(['state-info']), expectedActionIds: Object.freeze(['p1OpenDowntimeStart', 'p1BackToMain']), expectedBack: 'S03-N01', expectedNext: 'S03-D10', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D01:start-action-denied', nodeId: 'S03-D01', context: {}, apiResponses: P1_API_RESPONSES.downtimesStartDenied, expectedTitle: 'Простои', orderedItemIds: Object.freeze(['downtime-D-OP', 'downtime-D-CRIT', 'downtimes-start', 'downtimes-back']), visibleText: Object.freeze(['Наладка', 'Начать простой']), stateKeys: Object.freeze(['state-warning', 'state-danger']), expectedActionIds: Object.freeze(['p1OpenDowntimeMachine', 'p1OpenDowntimeStart', 'p1BackToMain']), expectedBack: 'S03-N01', expectedNext: null, expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D01:long-content', nodeId: 'S03-D01', context: {}, apiResponses: P1_API_RESPONSES.downtimesLong, expectedTitle: 'Простои', orderedItemIds: Object.freeze(['downtime-D-OP', 'downtime-D-CRIT', 'downtimes-start', 'downtimes-back']), visibleText: Object.freeze(['Поломка шпинделя с очень длинным', 'Станок критического простоя с очень длинным']), absentText: Object.freeze(['Остановлен из-за критической вибрации']), stateKeys: Object.freeze(['state-warning', 'state-danger']), expectedActionIds: Object.freeze(['p1OpenDowntimeMachine', 'p1OpenDowntimeStart', 'p1BackToMain']), expectedBack: 'S03-N01', expectedNext: 'S03-D10', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D10:with-machine', nodeId: 'S03-D10', context: { machine_id: 'M-PROD' }, apiResponses: P1_API_RESPONSES.downtimeTypes, expectedTitle: 'Выберите тип простоя', orderedItemIds: Object.freeze(['downtime-type-DT-CRIT', 'downtime-types-back']), visibleText: Object.freeze(['Критический простой']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['p1SelectDowntimeTypeWithMachine', 'p1BackToMachineCard']), expectedBack: null, expectedNext: 'S03-D12', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D10:without-machine', nodeId: 'S03-D10', context: {}, apiResponses: P1_API_RESPONSES.downtimeTypes, expectedTitle: 'Выберите тип простоя', orderedItemIds: Object.freeze(['downtime-type-DT-CRIT', 'downtime-types-back']), visibleText: Object.freeze(['Критический простой']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['p1SelectDowntimeTypeWithoutMachine', 'p1BackToDowntimeList']), expectedBack: null, expectedNext: 'S03-D11', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D10:empty', nodeId: 'S03-D10', context: {}, apiResponses: P1_API_RESPONSES.downtimeTypesEmpty, expectedTitle: 'Выберите тип простоя', orderedItemIds: Object.freeze(['downtime-types-empty', 'downtime-types-back']), visibleText: Object.freeze(['Нет доступных критических простоев.']), stateKeys: Object.freeze(['state-info']), expectedActionIds: Object.freeze(['p1BackToDowntimeList']), expectedBack: null, expectedNext: null, expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D11:ordinary-eligible', nodeId: 'S03-D11', context: { downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' }, apiResponses: P1_API_RESPONSES.machinesOrdinary, expectedTitle: 'Выберите станок', orderedItemIds: Object.freeze(['downtime-machine-M-PROD', 'downtime-machines-back']), visibleText: Object.freeze(['Станок в производстве']), stateKeys: Object.freeze(['state-positive']), expectedActionIds: Object.freeze(['p1SelectDowntimeMachine', 'p1BackToDowntimeTypes']), expectedBack: null, expectedNext: 'S03-D12', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D11:operational-downtime', nodeId: 'S03-D11', context: { downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' }, apiResponses: P1_API_RESPONSES.machinesOperational, expectedTitle: 'Выберите станок', orderedItemIds: Object.freeze(['downtime-machine-M-OP', 'downtime-machines-back']), visibleText: Object.freeze(['Станок операционного простоя']), stateKeys: Object.freeze(['state-warning']), expectedActionIds: Object.freeze(['p1SelectDowntimeMachineConflict', 'p1BackToDowntimeTypes']), expectedBack: null, expectedNext: 'S03-M03O', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D11:active-critical-visible', nodeId: 'S03-D11', context: { downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' }, apiResponses: P1_API_RESPONSES.machinesCritical, expectedTitle: 'Выберите станок', orderedItemIds: Object.freeze(['downtime-machine-M-CRIT', 'downtime-machines-back']), visibleText: Object.freeze(['Станок критического простоя']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['p1SelectDowntimeMachine', 'p1BackToDowntimeTypes']), expectedBack: null, expectedNext: null, expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D11:empty', nodeId: 'S03-D11', context: { downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' }, apiResponses: P1_API_RESPONSES.machinesEmpty, expectedTitle: 'Выберите станок', orderedItemIds: Object.freeze(['downtime-machines-empty', 'downtime-machines-back']), visibleText: Object.freeze(['Нет доступных станков.']), stateKeys: Object.freeze(['state-info']), expectedActionIds: Object.freeze(['p1BackToDowntimeTypes']), expectedBack: null, expectedNext: null, expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D12:from-machine-route', nodeId: 'S03-D12', context: { machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' }, apiResponses: P1_API_RESPONSES.none, expectedTitle: 'Комментарий', orderedItemIds: Object.freeze(['field-comment_start', 'downtime-comment-next', 'downtime-comment-back']), visibleText: Object.freeze(['Комментарий к критическому простою']), stateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['p1ContinueDowntimeStart', 'p1BackToDowntimeMachines']), expectedBack: null, expectedNext: 'S03-D13', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D12:from-list-route', nodeId: 'S03-D12', context: { machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' }, apiResponses: P1_API_RESPONSES.none, expectedTitle: 'Комментарий', orderedItemIds: Object.freeze(['field-comment_start', 'downtime-comment-next', 'downtime-comment-back']), visibleText: Object.freeze(['Комментарий к критическому простою']), stateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['p1ContinueDowntimeStart', 'p1BackToDowntimeMachines']), expectedBack: null, expectedNext: 'S03-D13', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D12:empty-form', nodeId: 'S03-D12', context: { machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой' }, apiResponses: P1_API_RESPONSES.none, expectedTitle: 'Комментарий', orderedItemIds: Object.freeze(['field-comment_start', 'downtime-comment-next', 'downtime-comment-back']), visibleText: Object.freeze(['Далее']), stateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['p1ContinueDowntimeStart', 'p1BackToDowntimeMachines']), expectedBack: null, expectedNext: 'S03-D13', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D12:valid-form', nodeId: 'S03-D12', context: { machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой', comment_start: 'Причина остановки' }, apiResponses: P1_API_RESPONSES.none, expectedTitle: 'Комментарий', orderedItemIds: Object.freeze(['field-comment_start', 'downtime-comment-next', 'downtime-comment-back']), visibleText: Object.freeze(['Причина остановки']), stateKeys: Object.freeze([]), expectedActionIds: Object.freeze(['p1ContinueDowntimeStart', 'p1BackToDowntimeMachines']), expectedBack: null, expectedNext: 'S03-D13', expectedBusiness: noBusiness }),
  fixture({ fixtureId: 'S03-D13:active-production-operation', nodeId: 'S03-D13', context: { machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой', comment_start: 'Причина остановки' }, apiResponses: P1_API_RESPONSES.machineProduction, expectedTitle: null, orderedItemIds: Object.freeze(['downtime-start-message', 'downtime-start-card', 'downtime-start-confirm', 'downtime-start-back']), visibleText: Object.freeze(['Подтвердите начало простоя:', 'Критический простой', 'Причина остановки']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['START_CRITICAL_DOWNTIME', 'p1BackToDowntimeComment']), expectedBack: null, expectedNext: null, expectedBusiness: startCritical }),
  fixture({ fixtureId: 'S03-D13:no-production-operation', nodeId: 'S03-D13', context: { machine_id: 'M-IDLE', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой', comment_start: 'Причина остановки' }, apiResponses: P1_API_RESPONSES.machineIdle, expectedTitle: null, orderedItemIds: Object.freeze(['downtime-start-message', 'downtime-start-card', 'downtime-start-confirm', 'downtime-start-back']), visibleText: Object.freeze(['Критический простой']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['START_CRITICAL_DOWNTIME', 'p1BackToDowntimeComment']), expectedBack: null, expectedNext: null, expectedBusiness: Object.freeze({ ...startCritical, body: Object.freeze({ ...startCritical.body, machine_id: 'M-IDLE', production_operation_id: null }) }) }),
  fixture({ fixtureId: 'S03-D13:pending-duplicate', nodeId: 'S03-D13', context: { machine_id: 'M-PROD', downtime_type_id: 'DT-CRIT', downtime_type_name: 'Критический простой', comment_start: 'Причина остановки' }, apiResponses: P1_API_RESPONSES.machineProduction, expectedTitle: null, orderedItemIds: Object.freeze(['downtime-start-message', 'downtime-start-card', 'downtime-start-confirm', 'downtime-start-back']), visibleText: Object.freeze(['Причина остановки']), stateKeys: Object.freeze(['state-danger']), expectedActionIds: Object.freeze(['START_CRITICAL_DOWNTIME', 'p1BackToDowntimeComment']), expectedBack: null, expectedNext: null, expectedBusiness: startCritical }),
]);

export const SECTION03_P1_FIXTURE_IDS = Object.freeze(SECTION03_P1_FIXTURES.map((item) => item.fixtureId));
