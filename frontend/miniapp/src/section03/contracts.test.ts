import { describe, expect, it } from 'vitest';
import {
  Section03ContractError,
  decodeManagerEmployeeCardResponse,
  decodeManagerEmployeesResponse,
  decodeManagerMachineCardResponse,
  decodeManagerMachinesResponse,
  decodeManagerWorkplaceStateResponse,
  decodeManagerMachineCompletedProductionOperationsResponse,
  decodeManagerOpenTasksResponse,
  decodeManagerProductionCompletedOperationsResponse,
  decodeOperationIdResponse,
  decodeSection03ExportRunResponse,
} from './contracts';
import {
  P2A1_EMPLOYEE_ALL_ACTIVITY,
  P2A1_EMPLOYEES_POPULATED_RESPONSE,
} from './fixtures/p2a1Employees';
import {
  P4A4_EMPLOYEE_OPERATIONS_RESPONSE,
  P4A4_MACHINE_OPERATIONS_RESPONSE,
} from './fixtures/p4a4ProductionCorrection';
import {
  P4A5_NOTIFICATIONS_ALL_RESPONSE,
  SECTION03_P4A5_FIXTURES,
} from './fixtures/p4a5Notifications';

const baseActions = Object.freeze(['OPEN_MACHINE_CARD']);

function machine(overrides: Record<string, unknown> = {}) {
  return {
    machine_id: 'M-1',
    machine_name: 'Станок 1',
    ui_state: 'running',
    ui_variant: 'green',
    active_production_operation_id: 'P-1',
    active_employee_id: 'E-1',
    active_employee_full_name: 'Operator One',
    active_sku_id: 'SKU-1',
    active_sku_code: 'SKU',
    active_sku_name: 'Part',
    active_break_id: null,
    active_break_name: null,
    active_downtime_id: 'D-1',
    downtime_type: 'operational',
    downtime_name: 'Наладка',
    downtime_comment: 'comment',
    downtime_start_comment: 'comment',
    downtime_finish_comment: null,
    downtime_started_at: '10:00',
    downtime_duration: '5 мин',
    has_active_critical_downtime: false,
    has_active_operational_downtime: true,
    active_operational_downtime_id: 'D-1',
    is_selectable_for_manager_critical_downtime: true,
    available_actions: baseActions,
    ...overrides,
  };
}

function workplace(overrides: Record<string, unknown> = {}) {
  return {
    section: 'S03',
    screen: 'S03-N01',
    manager: { employee_id: 'E-9', full_name: 'Manager One' },
    sections: {
      machines: { title: 'Станки', running_count: 1, downtime_count: 2, idle_count: 3, downtime_severity: 'operational', ui_variant: 'light_blue', available_actions: ['OPEN_MACHINES'] },
      employees: { title: 'Сотрудники', open_shift_count: 1, production_count: 2, downtime_count: 3, additional_work_count: 4, break_count: 5, without_work_count: 6, production_downtime_severity: 'none', ui_variant: 'light_blue', available_actions: ['OPEN_EMPLOYEES'] },
      downtimes: { title: 'Простои', critical_count: 1, operational_count: 2, ui_variant: 'light_blue', available_actions: ['OPEN_DOWNTIMES'] },
      additional_works: { title: 'Доп. работы', requested_count: 1, approved_count: 2, active_count: 3, requires_accrual_count: 4, ui_variant: 'grey', available_actions: ['OPEN_ADDITIONAL_WORKS'] },
      corrections: { title: 'Корректировки', ui_variant: 'light_blue', available_actions: ['OPEN_CORRECTIONS'] },
      notifications: { title: 'Уведомления', open_tasks_count: 1, ui_variant: 'light_blue', available_actions: ['OPEN_NOTIFICATIONS'] },
      reports: { title: 'Отчеты', ui_variant: 'light_blue', is_placeholder: true, available_actions: [] },
    },
    ...overrides,
  };
}

function expectContractError(fn: () => unknown, code: string) {
  expect(fn).toThrow(Section03ContractError);
  try {
    fn();
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe('Section03 transport contracts', () => {
  it('decodes and freezes a valid workplace with all seven sections', () => {
    const decoded = decodeManagerWorkplaceStateResponse(workplace());
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.keys(decoded.sections)).toEqual(['machines', 'employees', 'downtimes', 'additional_works', 'corrections', 'notifications', 'reports']);
    expect(Object.isFrozen(decoded.sections.machines.available_actions)).toBe(true);
  });

  it('requires every main section', () => {
    for (const key of ['machines', 'employees', 'downtimes', 'additional_works', 'corrections', 'notifications', 'reports']) {
      const source = workplace();
      delete (source.sections as Record<string, unknown>)[key];
      expectContractError(() => decodeManagerWorkplaceStateResponse(source), 'INVALID_OBJECT');
    }
  });

  it('rejects wrong section and screen literals', () => {
    expectContractError(() => decodeManagerWorkplaceStateResponse(workplace({ section: 'S02' })), 'INVALID_SECTION');
    expectContractError(() => decodeManagerMachinesResponse({ section: 'S03', screen: 'S03-N01', title: 'Станки', machines: [], available_actions: ['A'] }), 'INVALID_SCREEN');
  });

  it('rejects invalid counters after closed number narrowing', () => {
    for (const value of [-1, 1.5, Number.POSITIVE_INFINITY, '1', null]) {
      const source = workplace();
      source.sections.machines.running_count = value as never;
      expectContractError(() => decodeManagerWorkplaceStateResponse(source), 'INVALID_NUMBER');
    }
  });

  it('rejects invalid severity and visual variant', () => {
    const severity = workplace();
    severity.sections.machines.downtime_severity = 'high' as never;
    expectContractError(() => decodeManagerWorkplaceStateResponse(severity), 'INVALID_SEVERITY');
    expectContractError(() => decodeManagerMachineCardResponse({ section: 'S03', screen: 'S03-M02', machine: machine({ ui_variant: 'blue' }), available_actions: ['A'] }), 'INVALID_UI_VARIANT');
  });

  it('requires the reports placeholder with no enabled actions', () => {
    const reports = workplace();
    reports.sections.reports.is_placeholder = false as never;
    expectContractError(() => decodeManagerWorkplaceStateResponse(reports), 'INVALID_LITERAL');
    const enabledReports = workplace();
    enabledReports.sections.reports.available_actions = ['OPEN_REPORTS'] as never;
    expectContractError(() => decodeManagerWorkplaceStateResponse(enabledReports), 'INVALID_AVAILABLE_ACTIONS');
    expectContractError(() => decodeManagerMachinesResponse({ section: 'S03', screen: 'S03-M01', title: 'Станки', machines: [], available_actions: [] }), 'INVALID_AVAILABLE_ACTIONS');
  });

  it('decodes machines and card payloads', () => {
    const list = decodeManagerMachinesResponse({ section: 'S03', screen: 'S03-M01', title: 'Станки', machines: [machine()], available_actions: ['BACK'] });
    const card = decodeManagerMachineCardResponse({ section: 'S03', screen: 'S03-M02', machine: machine(), available_actions: ['BACK'] });
    expect(list.machines[0].machine_id).toBe('M-1');
    expect(card.machine.active_downtime_id).toBe('D-1');
  });

  it('preserves null read-model fields as null', () => {
    const decoded = decodeManagerMachineCardResponse({ section: 'S03', screen: 'S03-M02', machine: machine({ active_downtime_id: null, downtime_type: null, downtime_name: null }), available_actions: ['BACK'] });
    expect(decoded.machine.active_downtime_id).toBeNull();
    expect(decoded.machine.downtime_type).toBeNull();
    expect(decoded.machine.downtime_name).toBeNull();
  });

  it('accepts an empty machine action list while retaining non-empty screen authority', () => {
    const decoded = decodeManagerMachineCardResponse({ section: 'S03', screen: 'S03-M02', machine: machine({ available_actions: [] }), available_actions: ['BACK'] });
    expect(decoded.machine.available_actions).toEqual([]);
  });

  it('normalizes finite numeric operation IDs and rejects response mismatch', () => {
    expect(decodeOperationIdResponse({ id: 123 }, '123')).toEqual({ id: '123' });
    expectContractError(() => decodeOperationIdResponse({ id: 'D-2' }, 'D-1'), 'OPERATION_ID_MISMATCH');
  });

  it('decodes and deeply freezes exact employee list and card read models', () => {
    const list = decodeManagerEmployeesResponse(
      P2A1_EMPLOYEES_POPULATED_RESPONSE,
    );
    const card = decodeManagerEmployeeCardResponse({
      section: 'S03',
      screen: 'S03-E02',
      employee: P2A1_EMPLOYEE_ALL_ACTIVITY,
      available_actions: ['BACK'],
    });
    expect(list.employees).toHaveLength(6);
    expect(Object.isFrozen(list)).toBe(true);
    expect(Object.isFrozen(list.employees)).toBe(true);
    expect(Object.isFrozen(list.employees[0])).toBe(true);
    expect(card.employee.blockers.production).toMatchObject({
      production_operation_id: 'PO-BLOCK',
      machine_id: 'M-BLOCK',
    });
    expect(Object.isFrozen(card.employee)).toBe(true);
    expect(Object.isFrozen(card.employee.blockers)).toBe(true);
    expect(Object.isFrozen(card.employee.blockers.production)).toBe(true);
    expect(Object.isFrozen(card.employee.available_actions)).toBe(true);
  });

  it('fails closed on employee literals, nullability, actions and blockers', () => {
    const listEmployee = P2A1_EMPLOYEES_POPULATED_RESPONSE.employees[0]!;
    for (const value of [
      { ...listEmployee, ui_state: 'unknown' },
      { ...listEmployee, ui_variant: 'blue' },
      { ...listEmployee, open_shift_id: {} },
      { ...listEmployee, available_actions: ['UNKNOWN'] },
      { ...listEmployee, available_actions: ['OPEN_EMPLOYEE_CARD', 'OPEN_EMPLOYEE_CARD'] },
    ]) {
      expect(() => decodeManagerEmployeesResponse({
        ...P2A1_EMPLOYEES_POPULATED_RESPONSE,
        employees: [value],
      })).toThrow(Section03ContractError);
    }
    expect(() => decodeManagerEmployeeCardResponse({
      section: 'S03',
      screen: 'S03-E02',
      employee: { ...P2A1_EMPLOYEE_ALL_ACTIVITY, blockers: [] },
      available_actions: ['BACK'],
    })).toThrow(Section03ContractError);
    expect(() => decodeManagerEmployeeCardResponse({
      section: 'S03',
      screen: 'S03-E02',
      employee: {
        ...P2A1_EMPLOYEE_ALL_ACTIVITY,
        blockers: {
          ...P2A1_EMPLOYEE_ALL_ACTIVITY.blockers,
          production: { production_operation_id: null },
        },
      },
      available_actions: ['BACK'],
    })).toThrow(Section03ContractError);
  });

  it('decodes the closed employee/machine production-operation union without mutation', () => {
    const employeeInput = structuredClone(P4A4_EMPLOYEE_OPERATIONS_RESPONSE);
    const machineInput = structuredClone(P4A4_MACHINE_OPERATIONS_RESPONSE);
    const employee = decodeManagerProductionCompletedOperationsResponse(employeeInput);
    const machine = decodeManagerMachineCompletedProductionOperationsResponse(machineInput);
    expect('works' in employee && employee.works[0]?.correction_base_quantity).toBe('10');
    expect(machine.operations[0]?.production_operation_id).toBe('PROD-1');
    expect(machine.operations[0]).toEqual(P4A4_MACHINE_OPERATIONS_RESPONSE.operations[0]);
    expect(Object.keys(machine.operations[0] ?? {})).toEqual([
      'work_item_id', 'work_type', 'operation_id', 'employee_id', 'employee_full_name',
      'completed_date', 'production_operation_id', 'additional_work_id', 'machine_id',
      'machine_name', 'sku_name', 'sku_code', 'quantity', 'additional_work_name',
      'salary_entry_id', 'salary_amount_uzs', 'amount_uzs', 'old_quantity',
      'correction_base_quantity', 'current_quantity', 'can_correct', 'can_storno',
      'is_reversed', 'reversal_id',
    ]);
    expect(employeeInput).toEqual(P4A4_EMPLOYEE_OPERATIONS_RESPONSE);
    expect(machineInput).toEqual(P4A4_MACHINE_OPERATIONS_RESPONSE);
    expect(Object.isFrozen(employee)).toBe(true);
    expect(Object.isFrozen('works' in employee ? employee.works[0] : null)).toBe(true);
    expect(Object.isFrozen(machine.operations[0])).toBe(true);
  });

  it('rejects malformed production-operation shapes, decimals, identities and fields', () => {
    const employee = structuredClone(P4A4_EMPLOYEE_OPERATIONS_RESPONSE);
    const machine = structuredClone(P4A4_MACHINE_OPERATIONS_RESPONSE);
    const machineOperation = machine.operations[0]!;
    const invalid = [
      { ...employee, works: [{ ...employee.works[0]!, work_type: 'additional_work' }] },
      { ...employee, works: [{ ...employee.works[0]!, production_operation_id: null }] },
      { ...employee, works: [{ ...employee.works[0]!, correction_base_quantity: null }] },
      { ...employee, works: [employee.works[0]!, employee.works[0]!] },
      { ...machine, operations: [{ ...machineOperation, work_type: 'additional_work' }] },
      { ...machine, operations: [{ ...machineOperation, machine_id: 'M-OTHER' }] },
      { ...machine, operations: [{ ...machineOperation, quantity: '01' }] },
      { ...machine, operations: [{ ...machineOperation, current_quantity: '1e2' }] },
      { ...machine, operations: [{ ...machineOperation, correction_base_quantity: '-1' }] },
      { ...machine, operations: [{ ...machineOperation, extra: true }] },
      { ...machine, operations: [
        machineOperation,
        { ...machineOperation, work_item_id: 'WI-2', production_operation_id: 'PROD-2' },
      ] },
      { ...machine, operations: [
        machineOperation,
        { ...machineOperation, work_item_id: 'WI-2', operation_id: 'OP-2' },
      ] },
      { ...machine, available_actions: ['OPEN_CORRECTIONS'] },
      { ...machine, screen: 'S03-E21' },
      { ...machine, extra: true },
      { ...machine, employee: employee.employee, works: employee.works },
      { section: 'S03', screen: 'S03-CP12', available_actions: ['BACK'] },
    ];
    invalid.forEach((value) => expect(() => decodeManagerProductionCompletedOperationsResponse(value)).toThrow(Section03ContractError));
  });

  it('accepts an exact empty machine completed-production response', () => {
    const decoded = decodeManagerMachineCompletedProductionOperationsResponse({
      ...structuredClone(P4A4_MACHINE_OPERATIONS_RESPONSE),
      operations: [],
    });
    expect(decoded.operations).toEqual([]);
    expect(Object.isFrozen(decoded.operations)).toBe(true);
  });

  it('decodes the exact ordered deeply immutable notification response without input mutation', () => {
    const input = structuredClone(P4A5_NOTIFICATIONS_ALL_RESPONSE);
    const decoded = decodeManagerOpenTasksResponse(input);
    expect(decoded.tasks.map((task) => task.task_id)).toEqual([
      'NOT-TASK-WAIT', 'NOT-TASK-REQ', 'NOT-TASK-OP', 'NOT-TASK-CRIT',
    ]);
    expect(decoded.tasks).toEqual(decoded.open_tasks);
    expect(decoded.open_tasks_count).toBe(4);
    expect(input).toEqual(P4A5_NOTIFICATIONS_ALL_RESPONSE);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded.tasks)).toBe(true);
    expect(Object.isFrozen(decoded.tasks[0]?.target_context)).toBe(true);
    expect(Object.isFrozen(decoded.tasks[0]?.display_lines)).toBe(true);
  });

  it('rejects every closed notification-contract failure fixture', () => {
    const failures = SECTION03_P4A5_FIXTURES.filter((fixture) => fixture.expectProjectionFailure);
    expect(failures).toHaveLength(15);
    failures.forEach((fixture) => {
      expect(() => decodeManagerOpenTasksResponse(fixture.apiResponse), fixture.fixtureId)
        .toThrow(Section03ContractError);
    });
  });

  it('decodes only the exact immutable positive export_run_id response without mutating input', () => {
    const input = { export_run_id: '42' };
    const decoded = decodeSection03ExportRunResponse(input);
    expect(decoded).toEqual({ export_run_id: '42' });
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(input).toEqual({ export_run_id: '42' });
    for (const invalid of [
      null, [], {}, { id: '42' }, { run_id: '42' }, { operation_id: '42' },
      { export_run_id: 42 }, { export_run_id: '0' }, { export_run_id: '-1' },
      { export_run_id: ' 42' }, { export_run_id: '42 ' }, { export_run_id: '4.2' },
      { export_run_id: 'abc' }, { export_run_id: '42', extra: true },
    ]) {
      expect(() => decodeSection03ExportRunResponse(invalid)).toThrow(Section03ContractError);
    }
  });
});
