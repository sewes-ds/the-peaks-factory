import type {
  ManagerCompletedWorkItem,
  ManagerEmployeeCompletedProductionOperationsResponse,
  ManagerEmployees,
  ManagerMachineCompletedProductionOperation,
  ManagerMachineCompletedProductionOperationsResponse,
  ManagerMachines,
  ManagerProductionCompletedOperationsResponse,
  ManagerWorkplaceState,
} from '../contracts';
import type { Section03Context } from '../program/context';
import type { Section03NodeId } from '../program/ids';
import { P1_MACHINES_RESPONSE, P1_WORKPLACE_RESPONSE } from './p1';
import {
  P2A1_EMPLOYEES_EMPTY_RESPONSE,
  P2A1_EMPLOYEES_LONG_RESPONSE,
  P2A1_EMPLOYEES_POPULATED_RESPONSE,
} from './p2a1Employees';

export type Section03P4A4Fixture = Readonly<{
  fixtureId: string;
  nodeId: 'S03-CP00' | 'S03-CP10' | 'S03-CP11' | 'S03-CP12' | 'S03-CP13' | 'S03-CP14' | 'S03-CP15' | 'S03-CP16' | 'S03-CP20';
  context: Section03Context;
  primaryResponse: ManagerEmployees | ManagerMachines | ManagerProductionCompletedOperationsResponse | unknown | null;
  workplaceResponse: ManagerWorkplaceState;
  formValue: string | null;
  formPending: boolean;
  visibleText: readonly string[];
  absentText: readonly string[];
  expectProjectionFailure: boolean;
  mutationOutcome: 'none' | 'success' | 'pending-duplicate' | 'failure';
}>;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const employeeTemplate = (P2A1_EMPLOYEES_POPULATED_RESPONSE as ManagerEmployees).employees[2]!;
const machineTemplate = (P1_MACHINES_RESPONSE as ManagerMachines).machines[0]!;

export const P4A4_EMPLOYEE_ID = 'EMP-PC';
export const P4A4_MACHINE_ID = 'M-PC';
export const P4A4_OPERATION_ID = 'OP-PC';
export const P4A4_PRODUCTION_OPERATION_ID = 'PROD-1';

export const P4A4_EMPLOYEES_RESPONSE = deepFreeze({
  section: 'S03', screen: 'S03-E01', title: 'Сотрудники',
  employees: [{ ...employeeTemplate, employee_id: P4A4_EMPLOYEE_ID, full_name: 'Анна Производственная' }],
  available_actions: ['BACK'],
}) as ManagerEmployees;

export const P4A4_MACHINES_RESPONSE = deepFreeze({
  section: 'S03', screen: 'S03-M01', title: 'Станки',
  machines: [{ ...machineTemplate, machine_id: P4A4_MACHINE_ID, machine_name: 'Станок производственной корректировки' }],
  available_actions: ['BACK'],
}) as ManagerMachines;

export const P4A4_MACHINES_EMPTY_RESPONSE = deepFreeze({
  ...P4A4_MACHINES_RESPONSE,
  machines: [],
}) as ManagerMachines;

export const P4A4_MACHINES_LONG_RESPONSE = deepFreeze({
  ...P4A4_MACHINES_RESPONSE,
  machines: [{
    ...P4A4_MACHINES_RESPONSE.machines[0]!,
    machine_name: 'Станок с очень длинным наименованием производственной линии для проверки переноса текста',
  }],
}) as ManagerMachines;

function productionWork(overrides: Partial<ManagerCompletedWorkItem> = {}): ManagerCompletedWorkItem {
  return deepFreeze({
    work_item_id: 'WI-PC', work_type: 'production', operation_id: P4A4_OPERATION_ID,
    employee_id: P4A4_EMPLOYEE_ID, employee_full_name: 'Анна Производственная',
    completed_date: '03.08.2026 12:30', production_operation_id: P4A4_PRODUCTION_OPERATION_ID,
    additional_work_id: null, machine_id: P4A4_MACHINE_ID,
    machine_name: 'Станок производственной корректировки', sku_name: 'Корпус редуктора',
    sku_code: 'KR-1', quantity: '10', additional_work_name: null, salary_entry_id: 'SAL-PC',
    salary_amount_uzs: '100000', amount_uzs: '100000', old_quantity: '10',
    correction_base_quantity: '10', current_quantity: '10', can_correct: true,
    can_storno: false, is_reversed: false, reversal_id: null, ...overrides,
  });
}

function machineOperation(
  overrides: Partial<ManagerMachineCompletedProductionOperation> = {},
): ManagerMachineCompletedProductionOperation {
  return deepFreeze({
    ...productionWork(),
    ...overrides,
  }) as ManagerMachineCompletedProductionOperation;
}

function employeeOperations(
  works: readonly ManagerCompletedWorkItem[],
  employeeId = P4A4_EMPLOYEE_ID,
): ManagerEmployeeCompletedProductionOperationsResponse {
  return deepFreeze({
    section: 'S03', screen: 'S03-CP12',
    employee: { employee_id: employeeId, full_name: 'Анна Производственная' },
    works, available_actions: ['BACK'] as const,
  });
}

function machineOperations(
  operations: readonly ManagerMachineCompletedProductionOperation[],
  machineId = P4A4_MACHINE_ID,
): ManagerMachineCompletedProductionOperationsResponse {
  return deepFreeze({
    section: 'S03', screen: 'S03-CP12',
    machine: { machine_id: machineId, machine_name: 'Станок производственной корректировки' },
    operations, available_actions: ['BACK'] as const,
  });
}

export const P4A4_EMPLOYEE_OPERATIONS_RESPONSE = employeeOperations([productionWork()]);
export const P4A4_MACHINE_OPERATIONS_RESPONSE = machineOperations([machineOperation()]);
export const P4A4_EMPLOYEE_OPERATIONS_LONG_RESPONSE = employeeOperations([productionWork({
  sku_name: 'Очень длинное наименование производственной номенклатуры для проверки автоматического роста строки',
  machine_name: 'Очень длинное наименование станка производственной линии без визуального обрезания',
  quantity: '999999999999999999999.0001', current_quantity: '999999999999999999999.0001',
  correction_base_quantity: '999999999999999999999.0001',
})]);

export const P4A4_WORKPLACE_AUTHORIZED_RESPONSE = deepFreeze(
  structuredClone(P1_WORKPLACE_RESPONSE) as ManagerWorkplaceState,
);
export const P4A4_WORKPLACE_UNAUTHORIZED_RESPONSE = deepFreeze({
  ...P4A4_WORKPLACE_AUTHORIZED_RESPONSE,
  sections: {
    ...P4A4_WORKPLACE_AUTHORIZED_RESPONSE.sections,
    corrections: { ...P4A4_WORKPLACE_AUTHORIZED_RESPONSE.sections.corrections, available_actions: [] },
  },
});
export const P4A4_WORKPLACE_UNRELATED_AUTHORITY_RESPONSE = deepFreeze({
  ...P4A4_WORKPLACE_UNAUTHORIZED_RESPONSE,
  sections: {
    ...P4A4_WORKPLACE_UNAUTHORIZED_RESPONSE.sections,
    machines: { ...P4A4_WORKPLACE_UNAUTHORIZED_RESPONSE.sections.machines, available_actions: ['OPEN_CORRECTIONS'] },
  },
});

export const P4A4_BROWSER_RESPONSES = deepFreeze({
  employees: P4A4_EMPLOYEES_RESPONSE,
  machines: P4A4_MACHINES_RESPONSE,
  employeeOperations: P4A4_EMPLOYEE_OPERATIONS_RESPONSE,
  machineOperations: P4A4_MACHINE_OPERATIONS_RESPONSE,
  workplace: P4A4_WORKPLACE_AUTHORIZED_RESPONSE,
});

const employeeScope = deepFreeze({ correction_scope: 'employee' as const, employee_id: P4A4_EMPLOYEE_ID });
const machineScope = deepFreeze({ correction_scope: 'machine' as const, machine_id: P4A4_MACHINE_ID });
const employeeList = deepFreeze({ ...employeeScope, period: 'today' as const });
const machineList = deepFreeze({ ...machineScope, period: 'today' as const });
const employeeOperationContext = deepFreeze({ ...employeeList, work_type: 'production' as const, operation_id: P4A4_OPERATION_ID });
const machineOperationContext = deepFreeze({ ...machineList, work_type: 'production' as const, operation_id: P4A4_OPERATION_ID });

function fixture(
  input: Partial<Section03P4A4Fixture> & Pick<Section03P4A4Fixture, 'fixtureId' | 'nodeId' | 'context'>,
): Section03P4A4Fixture {
  return deepFreeze({
    primaryResponse: null,
    workplaceResponse: P4A4_WORKPLACE_AUTHORIZED_RESPONSE,
    formValue: null,
    formPending: false,
    visibleText: [],
    absentText: [],
    expectProjectionFailure: false,
    mutationOutcome: 'none',
    ...input,
  });
}

const fixtures: Section03P4A4Fixture[] = [
  fixture({ fixtureId: 'S03-CP00:menu', nodeId: 'S03-CP00', context: {}, visibleText: ['По сотруднику', 'По станку', 'Назад'] }),
  fixture({ fixtureId: 'S03-CP10:mixed', nodeId: 'S03-CP10', context: {}, primaryResponse: P2A1_EMPLOYEES_POPULATED_RESPONSE, visibleText: ['Сотрудник производства', 'Назад'] }),
  fixture({ fixtureId: 'S03-CP10:empty', nodeId: 'S03-CP10', context: {}, primaryResponse: P2A1_EMPLOYEES_EMPTY_RESPONSE, visibleText: ['Нет сотрудников.'] }),
  fixture({ fixtureId: 'S03-CP10:long-content', nodeId: 'S03-CP10', context: {}, primaryResponse: P2A1_EMPLOYEES_LONG_RESPONSE, visibleText: ['Александрова Екатерина Константиновна'] }),
  fixture({ fixtureId: 'S03-CP20:mixed', nodeId: 'S03-CP20', context: {}, primaryResponse: P4A4_MACHINES_RESPONSE, visibleText: ['Станок производственной корректировки'] }),
  fixture({ fixtureId: 'S03-CP20:empty', nodeId: 'S03-CP20', context: {}, primaryResponse: P4A4_MACHINES_EMPTY_RESPONSE, visibleText: ['Нет станков.'] }),
  fixture({ fixtureId: 'S03-CP20:long-content', nodeId: 'S03-CP20', context: {}, primaryResponse: P4A4_MACHINES_LONG_RESPONSE, visibleText: ['Станок с очень длинным наименованием'] }),
  fixture({ fixtureId: 'S03-CP11:employee', nodeId: 'S03-CP11', context: employeeScope, visibleText: ['За сегодня', 'За неделю', 'За месяц', 'Последние 30 дней'] }),
  fixture({ fixtureId: 'S03-CP11:machine', nodeId: 'S03-CP11', context: machineScope, visibleText: ['За сегодня', 'Последние 30 дней'] }),
  fixture({ fixtureId: 'S03-CP11:both-scopes', nodeId: 'S03-CP11', context: { ...employeeScope, ...machineScope }, expectProjectionFailure: true }),
  fixture({ fixtureId: 'S03-CP11:no-scope', nodeId: 'S03-CP11', context: {}, expectProjectionFailure: true }),
  fixture({ fixtureId: 'S03-CP12:employee-mixed', nodeId: 'S03-CP12', context: employeeList, primaryResponse: employeeOperations([productionWork(), productionWork({ work_item_id: 'WI-PC-2', operation_id: 'OP-PC-2', production_operation_id: 'PROD-2', sku_name: null })]), visibleText: ['Дата', '03.08.2026', 'SKU', 'Корпус редуктора', '—', 'Количество', '10', 'Станок', 'Станок производственной корректировки'], absentText: ['12:30', 'SKU:', 'Станок:'] }),
  fixture({ fixtureId: 'S03-CP12:machine', nodeId: 'S03-CP12', context: machineList, primaryResponse: P4A4_MACHINE_OPERATIONS_RESPONSE, visibleText: ['Дата', '03.08.2026', 'SKU', 'Корпус редуктора', 'Количество', '10', 'Станок'], absentText: ['12:30'] }),
  fixture({ fixtureId: 'S03-CP12:empty', nodeId: 'S03-CP12', context: employeeList, primaryResponse: employeeOperations([]), visibleText: ['Нет производственных операций за выбранный период.'] }),
  fixture({ fixtureId: 'S03-CP12:long-content', nodeId: 'S03-CP12', context: employeeList, primaryResponse: P4A4_EMPLOYEE_OPERATIONS_LONG_RESPONSE, visibleText: ['Очень длинное наименование производственной номенклатуры'] }),
  fixture({ fixtureId: 'S03-CP12:employee-identity-mismatch', nodeId: 'S03-CP12', context: employeeList, primaryResponse: employeeOperations([], 'EMP-OTHER'), expectProjectionFailure: true }),
  fixture({ fixtureId: 'S03-CP12:source-branch-mismatch', nodeId: 'S03-CP12', context: employeeList, primaryResponse: P4A4_MACHINE_OPERATIONS_RESPONSE, expectProjectionFailure: true }),
  fixture({ fixtureId: 'S03-CP13:employee', nodeId: 'S03-CP13', context: employeeOperationContext, primaryResponse: P4A4_EMPLOYEE_OPERATIONS_RESPONSE, visibleText: ['Увеличить', 'Уменьшить', 'Указать итоговое количество'] }),
  fixture({ fixtureId: 'S03-CP13:machine', nodeId: 'S03-CP13', context: machineOperationContext, primaryResponse: P4A4_MACHINE_OPERATIONS_RESPONSE, visibleText: ['Увеличить', 'Уменьшить'] }),
  fixture({ fixtureId: 'S03-CP13:missing-operation', nodeId: 'S03-CP13', context: { ...employeeOperationContext, operation_id: 'OP-MISSING' }, primaryResponse: P4A4_EMPLOYEE_OPERATIONS_RESPONSE, expectProjectionFailure: true }),
  fixture({ fixtureId: 'S03-CP13:scope-mismatch', nodeId: 'S03-CP13', context: employeeOperationContext, primaryResponse: P4A4_MACHINE_OPERATIONS_RESPONSE, expectProjectionFailure: true }),
];

for (const [name, mode, value, pending] of [
  ['empty', 'increase', '', false], ['malformed', 'increase', '1e2', false],
  ['negative', 'decrease', '-1', false], ['zero-increase', 'increase', '0', false],
  ['integer', 'increase', '2', false], ['decimal', 'decrease', '2,5', false],
  ['pending', 'increase', '2.5', true], ['final-zero', 'final', '0', false],
] as const) {
  fixtures.push(fixture({
    fixtureId: `S03-CP14:${name}`, nodeId: 'S03-CP14',
    context: { ...employeeOperationContext, production_correction_mode: mode },
    formValue: value, formPending: pending, visibleText: ['Количество', 'Далее', 'Назад'],
  }));
}

for (const [name, value, pending] of [
  ['empty', '', false], ['whitespace', '   ', false],
  ['trimmed', '  Подтверждённая производственная корректировка  ', false],
  ['multiline', '  Первая строка\nВторая строка  ', false],
  ['long-content', 'Очень длинный комментарий производственной корректировки для проверки переноса без обрезания содержимого.', false],
  ['pending', 'Подтверждённая производственная корректировка', true],
] as const) {
  fixtures.push(fixture({
    fixtureId: `S03-CP15:${name}`, nodeId: 'S03-CP15',
    context: { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '2.5' },
    formValue: value, formPending: pending, visibleText: ['Комментарий', 'Далее', 'Назад'],
  }));
}
fixtures.push(fixture({
  fixtureId: 'S03-CP15:invalid-incoming-quantity', nodeId: 'S03-CP15',
  context: { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '0' },
  expectProjectionFailure: true,
}));

function confirmation(
  name: string,
  current: Section03Context,
  response: ManagerProductionCompletedOperationsResponse | unknown,
  extra: Partial<Section03P4A4Fixture> = {},
): Section03P4A4Fixture {
  return fixture({
    fixtureId: `S03-CP16:${name}`, nodeId: 'S03-CP16', context: current,
    primaryResponse: response,
    visibleText: ['Подтвердите корректировку производства:', 'Сотрудник', 'Станок', 'SKU', 'Старое количество', 'Корректировка', 'Новое количество', 'Корректировать'],
    absentText: ['Подтверждённая производственная корректировка', P4A4_OPERATION_ID, P4A4_PRODUCTION_OPERATION_ID],
    mutationOutcome: 'success', ...extra,
  });
}

const reason = 'Подтверждённая производственная корректировка';
fixtures.push(
  confirmation('employee-increase', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '2.5', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE),
  confirmation('employee-decrease', { ...employeeOperationContext, production_correction_mode: 'decrease', correction_quantity: '2.5', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE),
  confirmation('machine-final', { ...machineOperationContext, production_correction_mode: 'final', correction_quantity: '0', production_correction_reason: reason }, P4A4_MACHINE_OPERATIONS_RESPONSE),
  confirmation('pending-duplicate', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '2.5', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE, { mutationOutcome: 'pending-duplicate' }),
  confirmation('post-failure', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '2.5', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE, { mutationOutcome: 'failure' }),
  confirmation('long-content', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '0.0001', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_LONG_RESPONSE),
  confirmation('source-scope-mismatch', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, P4A4_MACHINE_OPERATIONS_RESPONSE, { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('missing-operation', { ...employeeOperationContext, operation_id: 'OP-MISSING', production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE, { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('identity-mismatch', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, employeeOperations([productionWork({ employee_id: 'EMP-OTHER' })]), { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('missing-production-operation-id', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, employeeOperations([productionWork({ production_operation_id: '' })]), { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('can-correct-false', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, employeeOperations([productionWork({ can_correct: false })]), { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('bad-base', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, employeeOperations([productionWork({ correction_base_quantity: '01' })]), { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('base-current-mismatch', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, employeeOperations([productionWork({ current_quantity: '11' })]), { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('negative-result', { ...employeeOperationContext, production_correction_mode: 'decrease', correction_quantity: '11', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE, { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('zero-delta', { ...employeeOperationContext, production_correction_mode: 'final', correction_quantity: '10.0', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE, { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('bad-reason', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: '   ' }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE, { expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('missing-authority', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE, { workplaceResponse: P4A4_WORKPLACE_UNAUTHORIZED_RESPONSE, expectProjectionFailure: true, mutationOutcome: 'none' }),
  confirmation('unrelated-authority', { ...employeeOperationContext, production_correction_mode: 'increase', correction_quantity: '1', production_correction_reason: reason }, P4A4_EMPLOYEE_OPERATIONS_RESPONSE, { workplaceResponse: P4A4_WORKPLACE_UNRELATED_AUTHORITY_RESPONSE, expectProjectionFailure: true, mutationOutcome: 'none' }),
);

export const SECTION03_P4A4_FIXTURES = deepFreeze(fixtures);
export const SECTION03_P4A4_FIXTURE_IDS = deepFreeze([
  'S03-CP00:menu',
  'S03-CP10:mixed', 'S03-CP10:empty', 'S03-CP10:long-content',
  'S03-CP20:mixed', 'S03-CP20:empty', 'S03-CP20:long-content',
  'S03-CP11:employee', 'S03-CP11:machine', 'S03-CP11:both-scopes', 'S03-CP11:no-scope',
  'S03-CP12:employee-mixed', 'S03-CP12:machine', 'S03-CP12:empty', 'S03-CP12:long-content',
  'S03-CP12:employee-identity-mismatch', 'S03-CP12:source-branch-mismatch',
  'S03-CP13:employee', 'S03-CP13:machine', 'S03-CP13:missing-operation', 'S03-CP13:scope-mismatch',
  'S03-CP14:empty', 'S03-CP14:malformed', 'S03-CP14:negative', 'S03-CP14:zero-increase',
  'S03-CP14:integer', 'S03-CP14:decimal', 'S03-CP14:pending', 'S03-CP14:final-zero',
  'S03-CP15:empty', 'S03-CP15:whitespace', 'S03-CP15:trimmed', 'S03-CP15:multiline',
  'S03-CP15:long-content', 'S03-CP15:pending', 'S03-CP15:invalid-incoming-quantity',
  'S03-CP16:employee-increase', 'S03-CP16:employee-decrease', 'S03-CP16:machine-final',
  'S03-CP16:pending-duplicate', 'S03-CP16:post-failure', 'S03-CP16:long-content',
  'S03-CP16:source-scope-mismatch', 'S03-CP16:missing-operation', 'S03-CP16:identity-mismatch',
  'S03-CP16:missing-production-operation-id', 'S03-CP16:can-correct-false', 'S03-CP16:bad-base',
  'S03-CP16:base-current-mismatch', 'S03-CP16:negative-result', 'S03-CP16:zero-delta',
  'S03-CP16:bad-reason', 'S03-CP16:missing-authority', 'S03-CP16:unrelated-authority',
] as const);
export const SECTION03_P4A4_FAIL_CLOSED_FIXTURE_IDS = deepFreeze(
  fixtures.filter((item) => item.expectProjectionFailure).map((item) => item.fixtureId),
);

export const P4A4_EXPECTED_SUCCESS_TARGET: Section03NodeId = 'S03-C00';
