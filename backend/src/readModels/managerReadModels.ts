import type { ActorContext } from '../auth/actorContext.js';
import {
  ADDITIONAL_WORK_ASSIGNMENT_CONTRACTS,
  type AdditionalWorkAssignmentBlockedCode
} from '../additionalWorkAssignmentContract.js';
import { ApiError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';
import { resolveSalaryHistory, resolveSalaryTotals } from './domainState.js';
import {
  resolveManagerAdditionalWorkPresentation,
  resolveManagerEmployeePresentation,
  resolveManagerMachinePresentation,
  resolveManagerNotificationPresentation
} from './managerPresentationContract.js';
import {
  readActiveAdditionalWorkTypeRows,
  readManagerAdditionalWorkAssignabilityRows,
  readEmployeeSalaryHistory,
  readEmployeeSalaryTotals,
  readManagerAdditionalWorkRows,
  readManagerCanonicalOpenTaskSourceRows,
  readManagerCriticalDowntimeTypeRows,
  readManagerEmployeeCompletedWorkCard,
  readManagerEmployeeCompletedWorks,
  readManagerEmployeeReadModelRow,
  readManagerEmployeeReadModelRows,
  readManagerIdentity,
  readManagerMachineCompletedProductionOperations,
  readManagerMachineReadModelRow,
  readManagerMachineReadModelRows,
  readManagerSalaryCorrectionContextEmployees,
  readManagerSalaryCorrectionDefaultTypes,
  readManagerSalaryCorrectionTypeRows,
  readManagerWorkplaceState,
  type ManagerAdditionalWorkRow,
  type ManagerCanonicalOpenTaskSourceRow,
  type ManagerCompletedWorkRow,
  type ManagerEmployeeReadModelRow,
  type ManagerMachineReadModelRow,
  type ManagerOpenTaskRow,
  type ManagerWorkplaceStateRow
} from './sharedQueries.js';

import type {
  ManagerAdditionalWorkAction,
  ManagerAdditionalWorkItem,
  ManagerAdditionalWorksResponse,
  ManagerAdditionalWorkAssignabilityResponse,
  ManagerAdditionalWorkTypesAvailableResponse,
  ManagerCompletedWorkCardResponse,
  ManagerCompletedWorkItem,
  ManagerCompletedWorksResponse,
  ManagerCompletedWorkType,
  ManagerCriticalDowntimeTypesResponse,
  ManagerDowntimeReadModelItem,
  ManagerDowntimesResponse,
  ManagerEmployeeCardResponse,
  ManagerEmployeeReadModelItem,
  ManagerEmployeeSalaryHistoryResponse,
  ManagerEmployeeSalaryResponse,
  ManagerEmployeesResponse,
  ManagerEmployeeUiState,
  ManagerEmployeeUiVariant,
  ManagerMachineCardResponse,
  ManagerMachineCompletedProductionOperationsResponse,
  ManagerMachineDowntimeType,
  ManagerMachineReadModelItem,
  ManagerMachinesResponse,
  ManagerMachineUiState,
  ManagerMachineUiVariant,
  ManagerOpenTaskItem,
  ManagerOpenTasksResponse,
  ManagerOpenTaskTargetScreenId,
  ManagerSalaryCorrectionContextResponse,
  ManagerSalaryCorrectionTypesAvailableResponse,
  ManagerWorkplaceSeverity,
  ManagerWorkplaceStateResponse
} from './types.js';

export function formatElapsedMinutesClock(totalMinutes: number): string {
  if (!Number.isSafeInteger(totalMinutes) || totalMinutes < 0) {
    throw new ApiError(500, 'database_error', 'elapsed_minutes is not a valid count');
  }
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export async function getManagerWorkplaceState(
  pool: DbPool,
  actor: ActorContext
): Promise<ManagerWorkplaceStateResponse> {
  const row = await readManagerWorkplaceState(pool, actor.employeeId.toString());

  if (!row) {
    throw new ApiError(403, 'forbidden', 'Production manager permission is required');
  }

  return resolveManagerWorkplaceState(row);
}

export async function getManagerMachines(pool: DbPool, actor: ActorContext): Promise<ManagerMachinesResponse> {
  await requireProductionManager(pool, actor);
  const rows = await readManagerMachineReadModelRows(pool);

  return {
    section: 'S03',
    screen: 'S03-M01',
    title: 'Станки',
    machines: rows.map(resolveManagerMachineListItem),
    available_actions: ['BACK']
  };
}

export async function getManagerMachineCard(
  pool: DbPool,
  actor: ActorContext,
  machineId: string
): Promise<ManagerMachineCardResponse> {
  await requireProductionManager(pool, actor);
  const row = await readManagerMachineReadModelRow(pool, machineId);

  if (!row) {
    throw new ApiError(404, 'not_found', 'Machine was not found');
  }

  const item = resolveManagerMachineListItem(row);
  const availableActions: Array<'FINISH_DOWNTIME' | 'START_CRITICAL_DOWNTIME'> = [];

  if (item.active_downtime_id) {
    availableActions.push('FINISH_DOWNTIME');
  } else {
    availableActions.push('START_CRITICAL_DOWNTIME');
  }

  return {
    section: 'S03',
    screen: 'S03-M02',
    machine: {
      ...item,
      available_actions: availableActions
    },
    available_actions: ['BACK']
  };
}

export async function getManagerDowntimes(pool: DbPool, actor: ActorContext): Promise<ManagerDowntimesResponse> {
  await requireProductionManager(pool, actor);
  const rows = await readManagerMachineReadModelRows(pool);

  return {
    section: 'S03',
    screen: 'S03-D01',
    title: 'Простои',
    downtimes: rows.flatMap(resolveManagerDowntimeItem),
    available_actions: ['START_CRITICAL_DOWNTIME', 'BACK']
  };
}

export async function getManagerEmployees(pool: DbPool, actor: ActorContext): Promise<ManagerEmployeesResponse> {
  await requireProductionManager(pool, actor);
  const rows = await readManagerEmployeeReadModelRows(pool);

  return {
    section: 'S03',
    screen: 'S03-E01',
    title: 'Сотрудники',
    employees: rows.map(resolveManagerEmployeeListItem),
    available_actions: ['BACK']
  };
}

export async function getManagerEmployeeCard(
  pool: DbPool,
  actor: ActorContext,
  employeeId: string
): Promise<ManagerEmployeeCardResponse> {
  await requireProductionManager(pool, actor);
  const row = await readManagerEmployeeReadModelRow(pool, employeeId);

  if (!row) {
    throw new ApiError(404, 'not_found', 'Employee was not found');
  }

  const item = resolveManagerEmployeeListItem(row);
  const availableActions: Array<'VIEW_SALARY' | 'VIEW_COMPLETED_WORKS' | 'FINISH_EMPLOYEE_SHIFT_BY_MANAGER'> = [
    'VIEW_SALARY',
    'VIEW_COMPLETED_WORKS'
  ];

  if (item.open_shift_id) {
    availableActions.push('FINISH_EMPLOYEE_SHIFT_BY_MANAGER');
  }

  return {
    section: 'S03',
    screen: 'S03-E02',
    employee: {
      ...item,
      blockers: resolveManagerShiftBlockers(item),
      completed_shift_production_summary_by_sku: [],
      completed_shift_additional_work_items: [],
      available_actions: availableActions
    },
    available_actions: ['BACK']
  };
}

export async function getManagerEmployeeSalary(
  pool: DbPool,
  actor: ActorContext,
  employeeId: string
): Promise<ManagerEmployeeSalaryResponse> {
  await requireProductionManager(pool, actor);
  const employee = await requireProductionEmployee(pool, employeeId);
  const row = await readEmployeeSalaryTotals(pool, employee.employee_id);
  const salary = resolveSalaryTotals(employee.employee_id, row);

  return {
    section: 'S03',
    screen: 'S03-SAL01',
    employee: {
      employee_id: employee.employee_id,
      full_name: employee.full_name
    },
    ...salary
  };
}

export async function getManagerEmployeeSalaryHistory(
  pool: DbPool,
  actor: ActorContext,
  employeeId: string
): Promise<ManagerEmployeeSalaryHistoryResponse> {
  await requireProductionManager(pool, actor);
  const employee = await requireProductionEmployee(pool, employeeId);
  const rows = await readEmployeeSalaryHistory(pool, employee.employee_id);
  const salaryHistory = resolveSalaryHistory(employee.employee_id, rows);

  return {
    section: 'S03',
    screen: 'S03-SAL02',
    employee: {
      employee_id: employee.employee_id,
      full_name: employee.full_name
    },
    ...salaryHistory
  };
}

export async function getManagerAdditionalWorks(
  pool: DbPool,
  actor: ActorContext
): Promise<ManagerAdditionalWorksResponse> {
  await requireProductionManager(pool, actor);
  const rows = await readManagerAdditionalWorkRows(pool);
  const items = rows.map(resolveManagerAdditionalWorkItem);

  return {
    section: 'S03',
    screen: 'S03-AW01',
    title: 'Доп. работы',
    groups: {
      requested: items.filter((item) => item.status === 'requested'),
      approved: items.filter((item) => item.status === 'approved'),
      active: items.filter((item) => item.status === 'active'),
      waiting_accrual: items.filter((item) => item.status === 'waiting_accrual')
    },
    available_actions: ['ASSIGN_ADDITIONAL_WORK', 'BACK']
  };
}

export async function getManagerOpenTasks(pool: DbPool, actor: ActorContext): Promise<ManagerOpenTasksResponse> {
  await requireProductionManager(pool, actor);
  const rows = await readManagerCanonicalOpenTaskSourceRows(pool);
  const tasks = mergeOpenTasks(rows.map(resolveManagerCanonicalOpenTaskSourceItem));

  return {
    section: 'S03',
    screen: 'S03-NOT01',
    title: 'Уведомления',
    tasks,
    open_tasks: tasks,
    open_tasks_count: tasks.length,
    available_actions: ['BACK']
  };
}

export function resolveManagerCanonicalOpenTaskSourceItem(
  row: ManagerCanonicalOpenTaskSourceRow
): ManagerOpenTaskItem {
  const taskKind = row.task_kind;
  const title = resolveOpenTaskFallbackTitle(taskKind);
  const presentation = resolveManagerNotificationPresentation(taskKind);
  const taskId = `source:${taskKind}:${row.source_table}:${row.source_id}`;
  const common = {
    task_id: taskId,
    notification_id: taskId,
    created_at: row.source_started_at,
    task_kind: taskKind,
    entity_table: row.source_table,
    entity_id: row.source_id,
    sort_group: readSafeInteger(row.sort_group, 'sort_group'),
    sort_started_at: row.source_started_at,
    ui_color_token: presentation.ui_color_token,
    source_table: row.source_table,
    source_id: row.source_id,
    title,
    description: null,
    ui_state: 'open' as const,
    ui_variant: presentation.ui_variant,
    available_actions: ['OPEN_TASK_SOURCE'] as ['OPEN_TASK_SOURCE']
  };

  if (
    taskKind === 'ADDITIONAL_WORK_REQUESTED' ||
    taskKind === 'ADDITIONAL_WORK_WAITING_ACCRUAL'
  ) {
    if (!row.employee_full_name) {
      throw new ApiError(500, 'database_error', 'Canonical Additional Work task is missing display data');
    }
    return {
      ...common,
      target_screen_id: resolveOpenTaskTargetScreenId(taskKind),
      target_context: { additional_work_id: row.source_id },
      display_lines: [title, row.employee_full_name],
      task_type: taskKind === 'ADDITIONAL_WORK_REQUESTED'
        ? 'additional_work_request'
        : 'additional_work_waiting_accrual'
    };
  }

  if (!row.machine_id || !row.machine_name || !row.downtime_name) {
    throw new ApiError(500, 'database_error', 'Canonical downtime task is missing display data');
  }
  if (row.elapsed_minutes === null) {
    throw new ApiError(500, 'database_error', 'Canonical downtime task is missing elapsed minutes');
  }
  const elapsedMinutes = readSafeInteger(row.elapsed_minutes, 'elapsed_minutes');
  return {
    ...common,
    target_screen_id: 'S03-M02',
    target_context: { machine_id: row.machine_id },
    display_lines: [row.downtime_name, row.machine_name, formatElapsedMinutesClock(elapsedMinutes)],
    task_type: 'open_machine_downtime'
  };
}

export async function getManagerCriticalDowntimeTypes(
  pool: DbPool,
  actor: ActorContext
): Promise<ManagerCriticalDowntimeTypesResponse> {
  await requireProductionManager(pool, actor);
  const rows = await readManagerCriticalDowntimeTypeRows(pool);

  return {
    section: 'S03',
    screen: 'S03-D10',
    downtime_types: rows.map((row, index) => ({
      downtime_type_id: row.downtime_type_id,
      downtime_type_name: row.downtime_type_name,
      severity: 'critical',
      is_active: true,
      display_order: readSafeInteger(row.display_order ?? index + 1, 'display_order')
    })),
    available_actions: ['BACK']
  };
}

export async function getManagerAdditionalWorkTypesAvailable(
  pool: DbPool,
  actor: ActorContext,
  employeeId?: string,
  selectedAdditionalWorkTypeId?: string
): Promise<ManagerAdditionalWorkTypesAvailableResponse | ManagerAdditionalWorkAssignabilityResponse> {
  await requireProductionManager(pool, actor);
  if (employeeId !== undefined) {
    const rows = await readManagerAdditionalWorkAssignabilityRows(pool, employeeId, selectedAdditionalWorkTypeId);
    const types = rows.map((row, index) => {
      const blockedCode = row.blocked_code as AdditionalWorkAssignmentBlockedCode | null;
      return {
        additional_work_type_id: row.additional_work_type_id,
        additional_work_name: row.display_name,
        is_active: row.is_active,
        display_order: index + 1,
        can_assign: row.can_assign,
        blocked_code: blockedCode,
        blocked_message: blockedCode === null
          ? null
          : ADDITIONAL_WORK_ASSIGNMENT_CONTRACTS[blockedCode].message
      };
    });
    return {
      section: 'S03',
      screen: 'S03-AW41',
      assignability_employee_id: employeeId,
      assignability_additional_work_type_id: selectedAdditionalWorkTypeId ?? null,
      additional_work_types: types,
      available_actions: types.some((item) => item.can_assign)
        ? ['ASSIGN_ADDITIONAL_WORK', 'BACK']
        : ['BACK']
    };
  }
  const rows = await readActiveAdditionalWorkTypeRows(pool);

  return {
    section: 'S03',
    screen: 'S03-AW41',
    additional_work_types: rows.map((row, index) => ({
      additional_work_type_id: row.additional_work_type_id,
      additional_work_name: row.display_name,
      is_active: true,
      display_order: index + 1
    })),
    available_actions: ['BACK']
  };
}

export async function getManagerSalaryCorrectionContext(
  pool: DbPool,
  actor: ActorContext
): Promise<ManagerSalaryCorrectionContextResponse> {
  await requireProductionManager(pool, actor);
  const [employees, defaultTypes] = await Promise.all([
    readManagerSalaryCorrectionContextEmployees(pool),
    readManagerSalaryCorrectionDefaultTypes(pool)
  ]);

  if (!defaultTypes.default_accrual_salary_correction_type_id || !defaultTypes.default_withholding_salary_correction_type_id) {
    throw new ApiError(500, 'database_error', 'Default salary correction type ids are not configured');
  }

  return {
    section: 'S03',
    screen: 'S03-CF10',
    employees_with_today_shift: employees.map((row) => ({
      employee_id: row.employee_id,
      employee_full_name: row.employee_full_name,
      employee_shift_id: row.employee_shift_id,
      shift_started_at: row.shift_started_at,
      shift_finished_at: row.shift_finished_at
    })),
    default_accrual_salary_correction_type_id: defaultTypes.default_accrual_salary_correction_type_id,
    default_withholding_salary_correction_type_id: defaultTypes.default_withholding_salary_correction_type_id,
    available_actions: ['BACK']
  };
}

export async function getManagerSalaryCorrectionTypesAvailable(
  pool: DbPool,
  actor: ActorContext
): Promise<ManagerSalaryCorrectionTypesAvailableResponse> {
  await requireProductionManager(pool, actor);
  const rows = await readManagerSalaryCorrectionTypeRows(pool);

  return {
    section: 'S03',
    screen: 'S03-CF11',
    salary_correction_types: rows.map((row) => ({
      salary_correction_type_id: row.salary_correction_type_id,
      salary_correction_type_name: row.salary_correction_type_name,
      is_active: true
    })),
    available_actions: ['BACK']
  };
}

export async function getManagerEmployeeCompletedWorks(
  pool: DbPool,
  actor: ActorContext,
  employeeId: string,
  period: string,
  typeFilter: 'all' | ManagerCompletedWorkType = 'all'
): Promise<ManagerCompletedWorksResponse> {
  await requireProductionManager(pool, actor);
  const employee = await requireProductionEmployee(pool, employeeId);
  const rows = await readManagerEmployeeCompletedWorks(pool, employeeId, period, typeFilter);

  return {
    section: 'S03',
    screen: typeFilter === 'production' ? 'S03-CP12' : 'S03-E21',
    employee: {
      employee_id: employee.employee_id,
      full_name: employee.full_name
    },
    works: rows.map(resolveCompletedWorkItem),
    available_actions: ['BACK']
  };
}

export async function getManagerEmployeeCompletedWorkCard(
  pool: DbPool,
  actor: ActorContext,
  employeeId: string,
  workType: ManagerCompletedWorkType,
  operationId: string
): Promise<ManagerCompletedWorkCardResponse> {
  await requireProductionManager(pool, actor);
  const employee = await requireProductionEmployee(pool, employeeId);
  const row = await readManagerEmployeeCompletedWorkCard(pool, employeeId, workType, operationId);

  if (!row) {
    throw new ApiError(404, 'not_found', 'Completed work was not found');
  }

  return {
    section: 'S03',
    screen: 'S03-E22',
    employee: {
      employee_id: employee.employee_id,
      full_name: employee.full_name
    },
    work: resolveCompletedWorkItem(row),
    available_actions: ['BACK']
  };
}

export async function getManagerMachineCompletedProductionOperations(
  pool: DbPool,
  actor: ActorContext,
  machineId: string,
  period: string
): Promise<ManagerMachineCompletedProductionOperationsResponse> {
  await requireProductionManager(pool, actor);
  const machine = await readManagerMachineReadModelRow(pool, machineId);

  if (!machine) {
    throw new ApiError(404, 'not_found', 'Machine was not found');
  }

  const rows = await readManagerMachineCompletedProductionOperations(pool, machineId, period);

  return {
    section: 'S03',
    screen: 'S03-CP12',
    machine: {
      machine_id: machine.machine_id,
      machine_name: machine.machine_name
    },
    operations: rows.map(resolveCompletedWorkItem),
    available_actions: ['BACK']
  };
}

export function resolveManagerWorkplaceState(row: ManagerWorkplaceStateRow): ManagerWorkplaceStateResponse {
  const machineCriticalDowntimeCount = readCount(row.machine_critical_downtime_count, 'machine_critical_downtime_count');
  const machineOperationalDowntimeCount = readCount(
    row.machine_operational_downtime_count,
    'machine_operational_downtime_count'
  );
  const employeeCriticalDowntimeCount = readCount(
    row.employee_production_critical_downtime_count,
    'employee_production_critical_downtime_count'
  );
  const employeeOperationalDowntimeCount = readCount(
    row.employee_production_operational_downtime_count,
    'employee_production_operational_downtime_count'
  );
  const employeeProductionCount = readCount(
    row.employee_production_count ?? row.employee_production_active_clear_count ?? 0,
    'employee_production_count'
  );
  const employeeDowntimeCount = readCount(
    row.employee_downtime_count ?? row.employee_production_downtime_count ?? 0,
    'employee_downtime_count'
  );
  const employeeAdditionalWorkCount = readCount(
    row.employee_additional_work_count ?? row.employee_additional_work_active_clear_count ?? 0,
    'employee_additional_work_count'
  );
  const employeeBreakCount = readCount(
    row.employee_break_count ?? row.employee_production_break_count ?? row.employee_additional_work_break_count ?? 0,
    'employee_break_count'
  );
  const employeeWithoutWorkCount = readCount(
    row.employee_without_work_count ?? row.employee_open_shift_without_work_count ?? 0,
    'employee_without_work_count'
  );
  const additionalWorkRequiresAccrualCount = readCount(
    row.additional_work_requires_accrual_count ?? 0,
    'additional_work_requires_accrual_count'
  );

  return {
    section: 'S03',
    screen: 'S03-N01',
    manager: {
      employee_id: row.manager_employee_id,
      full_name: row.manager_full_name
    },
    sections: {
      machines: {
        title: 'Станки',
        running_count: readCount(row.machine_running_count, 'machine_running_count'),
        downtime_count: readCount(row.machine_downtime_count, 'machine_downtime_count'),
        idle_count: readCount(row.machine_idle_count, 'machine_idle_count'),
        downtime_severity: resolveSeverity(machineCriticalDowntimeCount, machineOperationalDowntimeCount),
        ui_variant: 'light_blue',
        available_actions: ['OPEN_MACHINES']
      },
      employees: {
        title: 'Сотрудники',
        open_shift_count: readCount(row.employee_open_shift_count, 'employee_open_shift_count'),
        production_count: employeeProductionCount,
        downtime_count: employeeDowntimeCount,
        additional_work_count: employeeAdditionalWorkCount,
        break_count: employeeBreakCount,
        without_work_count: employeeWithoutWorkCount,
        production_downtime_severity: resolveSeverity(
          employeeCriticalDowntimeCount,
          employeeOperationalDowntimeCount
        ),
        production_active_clear_count: readCount(
          row.employee_production_active_clear_count,
          'employee_production_active_clear_count'
        ),
        production_break_count: readCount(row.employee_production_break_count, 'employee_production_break_count'),
        production_downtime_count: readCount(
          row.employee_production_downtime_count,
          'employee_production_downtime_count'
        ),
        additional_work_active_clear_count: readCount(
          row.employee_additional_work_active_clear_count,
          'employee_additional_work_active_clear_count'
        ),
        additional_work_break_count: readCount(
          row.employee_additional_work_break_count,
          'employee_additional_work_break_count'
        ),
        open_shift_without_work_count: readCount(
          row.employee_open_shift_without_work_count,
          'employee_open_shift_without_work_count'
        ),
        ui_variant: 'light_blue',
        available_actions: ['OPEN_EMPLOYEES']
      },
      downtimes: {
        title: 'Простои',
        critical_count: readCount(row.downtime_critical_count, 'downtime_critical_count'),
        operational_count: readCount(row.downtime_operational_count, 'downtime_operational_count'),
        ui_variant: 'light_blue',
        available_actions: ['OPEN_DOWNTIMES', 'START_CRITICAL_DOWNTIME']
      },
      additional_works: {
        title: 'Доп. работы',
        requested_count: readCount(row.additional_work_requested_count, 'additional_work_requested_count'),
        approved_count: readCount(row.additional_work_approved_count, 'additional_work_approved_count'),
        active_count: readCount(row.additional_work_active_count, 'additional_work_active_count'),
        requires_accrual_count: additionalWorkRequiresAccrualCount,
        ui_variant: 'grey',
        available_actions: ['OPEN_ADDITIONAL_WORKS']
      },
      corrections: {
        title: 'Корректировки',
        ui_variant: 'light_blue',
        available_actions: ['OPEN_CORRECTIONS']
      },
      notifications: {
        title: 'Уведомления',
        open_tasks_count: readCount(row.open_tasks_count, 'open_tasks_count'),
        ui_variant: 'light_blue',
        available_actions: ['OPEN_NOTIFICATIONS']
      },
      reports: {
        title: 'Отчёты',
        ui_variant: 'light_blue',
        is_placeholder: true,
        available_actions: []
      }
    }
  };
}

export function resolveManagerMachineListItem(row: ManagerMachineReadModelRow): ManagerMachineReadModelItem {
  const downtimeType = resolveDowntimeType(row);
  const ui = resolveMachineUiState(row, downtimeType);

  return {
    machine_id: row.machine_id,
    machine_name: row.machine_name,
    ui_state: ui.ui_state,
    ui_variant: ui.ui_variant,
    active_production_operation_id: row.active_production_operation_id,
    active_employee_id: row.active_employee_id,
    active_employee_full_name: row.active_employee_full_name,
    active_sku_id: row.active_sku_id,
    active_sku_code: row.active_sku_code,
    active_sku_name: row.active_sku_name,
    active_break_id: row.active_break_id,
    active_break_name: row.active_break_name,
    active_downtime_id: row.active_downtime_id,
    downtime_type: downtimeType,
    downtime_name: row.downtime_name,
    downtime_comment: row.downtime_start_comment ?? row.downtime_comment,
    downtime_started_at: row.downtime_started_at,
    downtime_duration: row.downtime_duration,
    downtime_start_comment: row.downtime_start_comment,
    downtime_finish_comment: row.downtime_finish_comment,
    has_active_critical_downtime: Boolean(row.has_active_critical_downtime),
    has_active_operational_downtime: Boolean(row.has_active_operational_downtime),
    active_operational_downtime_id: row.active_operational_downtime_id,
    is_selectable_for_manager_critical_downtime: Boolean(row.is_selectable_for_manager_critical_downtime),
    available_actions: ['OPEN_MACHINE_CARD']
  };
}

export function resolveManagerDowntimeItem(row: ManagerMachineReadModelRow): ManagerDowntimeReadModelItem[] {
  const downtimeType = resolveDowntimeType(row);

  if (!row.active_downtime_id) {
    return [];
  }

  if (!downtimeType || !row.downtime_name) {
    throw new ApiError(500, 'database_error', 'Active downtime is not classifiable');
  }

  return [
    {
      machine_id: row.machine_id,
      machine_name: row.machine_name,
      active_downtime_id: row.active_downtime_id,
      downtime_type: downtimeType,
      downtime_name: row.downtime_name,
      downtime_comment: row.downtime_start_comment ?? row.downtime_comment,
      downtime_started_at: row.downtime_started_at,
      downtime_duration: row.downtime_duration,
      downtime_start_comment: row.downtime_start_comment,
      downtime_finish_comment: row.downtime_finish_comment,
      active_production_operation_id: row.active_production_operation_id,
      active_employee_id: row.active_employee_id,
      active_employee_full_name: row.active_employee_full_name,
      active_sku_id: row.active_sku_id,
      active_sku_code: row.active_sku_code,
      active_sku_name: row.active_sku_name,
      ui_state: downtimeType === 'critical' ? 'critical' : 'warning',
      ui_variant: downtimeType === 'critical' ? 'red' : 'yellow',
      available_actions: ['OPEN_MACHINE_CARD']
    }
  ];
}

export function resolveManagerEmployeeListItem(row: ManagerEmployeeReadModelRow): ManagerEmployeeReadModelItem {
  const downtimeType = resolveEmployeeDowntimeType(row);
  const ui = resolveEmployeeUiState(row, downtimeType);

  return {
    employee_id: row.employee_id,
    full_name: row.full_name,
    ui_state: ui.ui_state,
    ui_variant: ui.ui_variant,
    open_shift_id: row.open_shift_id,
    shift_started_at: row.shift_started_at,
    active_production_operation_id: row.active_production_operation_id,
    production_started_at: row.production_started_at,
    active_machine_id: row.active_machine_id,
    active_machine_name: row.active_machine_name,
    active_sku_id: row.active_sku_id,
    active_sku_code: row.active_sku_code,
    active_sku_name: row.active_sku_name,
    active_break_id: row.active_break_id,
    active_break_name: row.active_break_name,
    break_started_at: row.break_started_at,
    break_duration: row.break_duration,
    break_context_type: row.break_context_type ?? 'none',
    active_downtime_id: row.active_downtime_id,
    downtime_type: downtimeType,
    downtime_name: row.downtime_name,
    downtime_comment: row.downtime_start_comment ?? row.downtime_comment,
    downtime_started_at: row.downtime_started_at,
    downtime_duration: row.downtime_duration,
    downtime_start_comment: row.downtime_start_comment,
    downtime_finish_comment: row.downtime_finish_comment,
    active_additional_work_id: row.active_additional_work_id,
    active_additional_work_name: row.active_additional_work_name,
    additional_work_started_at: row.additional_work_started_at,
    additional_work_duration: row.additional_work_duration,
    available_actions: ['OPEN_EMPLOYEE_CARD']
  };
}

export function resolveManagerAdditionalWorkItem(row: ManagerAdditionalWorkRow): ManagerAdditionalWorkItem {
  if (!row.additional_work_name || !row.employee_full_name) {
    throw new ApiError(500, 'database_error', 'Additional work row is missing required display data');
  }

  return {
    additional_work_id: row.additional_work_id,
    additional_work_type_id: row.additional_work_type_id,
    additional_work_name: row.additional_work_name,
    employee_id: row.employee_id,
    employee_full_name: row.employee_full_name,
    requested_at: row.requested_at,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    status: row.status,
    ui_state: row.status,
    ui_variant: resolveManagerAdditionalWorkPresentation(row.status).ui_variant,
    available_actions: resolveAdditionalWorkActions(row.status)
  };
}

export function resolveManagerOpenTaskItem(row: ManagerOpenTaskRow): ManagerOpenTaskItem {
  const taskKind = resolveOpenTaskKind(row);
  const fallbackTitle = resolveOpenTaskFallbackTitle(taskKind);
  const displayLines = normalizeTextArray(row.display_lines, 'display_lines');
  const visibleDisplayLines =
    displayLines.length > 0
      ? displayLines
      : [fallbackTitle, row.description].filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
  const targetScreenId = row.target_screen_id ?? resolveOpenTaskTargetScreenId(taskKind);
  const targetContext = normalizeTargetContext(row.target_context, row, targetScreenId);
  const sortGroup = readSafeInteger(row.sort_group ?? resolveOpenTaskSortGroup(taskKind), 'sort_group');
  const presentation = resolveManagerNotificationPresentation(taskKind);

  return {
    task_id: row.task_id ?? row.notification_id,
    notification_id: row.notification_id,
    created_at: row.created_at,
    task_kind: taskKind,
    entity_table: row.entity_table ?? row.source_table,
    entity_id: row.entity_id ?? row.source_id ?? row.notification_id,
    sort_group: sortGroup,
    sort_started_at: row.sort_started_at ?? row.created_at,
    ui_color_token: presentation.ui_color_token,
    target_screen_id: targetScreenId,
    target_context: targetContext,
    display_lines: visibleDisplayLines,
    source_table: row.source_table,
    source_id: row.source_id,
    task_type: row.task_type,
    title: fallbackTitle,
    description: row.description,
    ui_state: 'open',
    ui_variant: presentation.ui_variant,
    available_actions: ['OPEN_TASK_SOURCE']
  };
}

function resolveAdditionalWorkOpenTaskItem(item: ManagerAdditionalWorkItem): ManagerOpenTaskItem | null {
  if (item.status !== 'requested' && item.status !== 'waiting_accrual') {
    return null;
  }

  const taskKind: ManagerOpenTaskItem['task_kind'] =
    item.status === 'requested' ? 'ADDITIONAL_WORK_REQUESTED' : 'ADDITIONAL_WORK_WAITING_ACCRUAL';
  const title = resolveOpenTaskFallbackTitle(taskKind);
  const sortStartedAt = item.requested_at ?? item.created_at ?? item.started_at ?? '';
  const presentation = resolveManagerNotificationPresentation(taskKind);
  const taskId = `source:additional_work:${taskKind}:${item.additional_work_id}`;

  return {
    task_id: taskId,
    notification_id: taskId,
    created_at: sortStartedAt,
    task_kind: taskKind,
    entity_table: 'additional_works',
    entity_id: item.additional_work_id,
    sort_group: resolveOpenTaskSortGroup(taskKind),
    sort_started_at: sortStartedAt,
    ui_color_token: presentation.ui_color_token,
    target_screen_id: resolveOpenTaskTargetScreenId(taskKind),
    target_context: { additional_work_id: item.additional_work_id },
    display_lines: [title, item.employee_full_name].filter((line) => line.trim().length > 0),
    source_table: 'additional_works',
    source_id: item.additional_work_id,
    task_type: item.status === 'requested' ? 'additional_work_request' : 'additional_work_waiting_accrual',
    title,
    description: null,
    ui_state: 'open',
    ui_variant: presentation.ui_variant,
    available_actions: ['OPEN_TASK_SOURCE']
  };
}

function mergeOpenTasks(tasks: ManagerOpenTaskItem[]): ManagerOpenTaskItem[] {
  const seen = new Set<string>();
  const merged: ManagerOpenTaskItem[] = [];

  for (const task of tasks) {
    const dedupeKey = `${task.task_kind}:${task.entity_table}:${task.entity_id ?? task.task_id}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    merged.push(task);
  }

  return merged.sort((left, right) => {
    const groupDiff = left.sort_group - right.sort_group;
    if (groupDiff !== 0) return groupDiff;

    const timeDiff = String(left.sort_started_at).localeCompare(String(right.sort_started_at));
    if (timeDiff !== 0) return timeDiff;

    return String(left.task_id).localeCompare(String(right.task_id));
  });
}

function resolveOpenTaskKind(row: ManagerOpenTaskRow): ManagerOpenTaskItem['task_kind'] {
  if (
    row.task_kind === 'ADDITIONAL_WORK_REQUESTED' ||
    row.task_kind === 'ADDITIONAL_WORK_WAITING_ACCRUAL' ||
    row.task_kind === 'CRITICAL_DOWNTIME_OPEN' ||
    row.task_kind === 'OPERATIONAL_DOWNTIME_OVER_15_MIN'
  ) {
    return row.task_kind;
  }

  if (row.task_type === 'additional_work_request') {
    return 'ADDITIONAL_WORK_REQUESTED';
  }

  if (row.task_type === 'additional_work_waiting_accrual') {
    return 'ADDITIONAL_WORK_WAITING_ACCRUAL';
  }

  if (row.task_type === 'open_machine_downtime') {
    return row.ui_color_token === 'yellow' ? 'OPERATIONAL_DOWNTIME_OVER_15_MIN' : 'CRITICAL_DOWNTIME_OPEN';
  }

  if (row.source_table === 'additional_works') {
    return row.ui_color_token === 'green' ? 'ADDITIONAL_WORK_WAITING_ACCRUAL' : 'ADDITIONAL_WORK_REQUESTED';
  }

  return row.ui_color_token === 'yellow' ? 'OPERATIONAL_DOWNTIME_OVER_15_MIN' : 'CRITICAL_DOWNTIME_OPEN';
}

function resolveOpenTaskFallbackTitle(taskKind: ManagerOpenTaskItem['task_kind']): string {
  switch (taskKind) {
    case 'ADDITIONAL_WORK_REQUESTED':
      return 'Запрошена доп. работа';
    case 'ADDITIONAL_WORK_WAITING_ACCRUAL':
      return 'Доп. работа требует начисления';
    case 'CRITICAL_DOWNTIME_OPEN':
      return 'Критический простой';
    case 'OPERATIONAL_DOWNTIME_OVER_15_MIN':
      return 'Операционный простой больше 15 минут';
  }
}

function resolveOpenTaskSortGroup(taskKind: ManagerOpenTaskItem['task_kind']): number {
  switch (taskKind) {
    case 'CRITICAL_DOWNTIME_OPEN':
      return 1;
    case 'OPERATIONAL_DOWNTIME_OVER_15_MIN':
      return 2;
    case 'ADDITIONAL_WORK_REQUESTED':
      return 4;
    case 'ADDITIONAL_WORK_WAITING_ACCRUAL':
      return 3;
  }
}

function resolveOpenTaskTargetScreenId(taskKind: ManagerOpenTaskItem['task_kind']): ManagerOpenTaskTargetScreenId {
  switch (taskKind) {
    case 'ADDITIONAL_WORK_REQUESTED':
      return 'S03-AW10';
    case 'ADDITIONAL_WORK_WAITING_ACCRUAL':
      return 'S03-AW50';
    case 'CRITICAL_DOWNTIME_OPEN':
    case 'OPERATIONAL_DOWNTIME_OVER_15_MIN':
      return 'S03-M02';
  }
}

async function requireProductionManager(pool: DbPool, actor: ActorContext): Promise<void> {
  const manager = await readManagerIdentity(pool, actor.employeeId.toString());

  if (!manager) {
    throw new ApiError(403, 'forbidden', 'Production manager permission is required');
  }
}

async function requireProductionEmployee(pool: DbPool, employeeId: string): Promise<ManagerEmployeeReadModelRow> {
  const employee = await readManagerEmployeeReadModelRow(pool, employeeId);

  if (!employee) {
    throw new ApiError(404, 'not_found', 'Employee was not found');
  }

  return employee;
}

function resolveSeverity(criticalCount: number, operationalCount: number): ManagerWorkplaceSeverity {
  if (criticalCount > 0) {
    return 'critical';
  }

  if (operationalCount > 0) {
    return 'operational';
  }

  return 'none';
}

function resolveMachineUiState(
  row: ManagerMachineReadModelRow,
  downtimeType: ManagerMachineDowntimeType | null
): { ui_state: ManagerMachineUiState; ui_variant: ManagerMachineUiVariant } {
  if (downtimeType === 'critical') {
    return resolveManagerMachinePresentation('critical');
  }

  if (downtimeType === 'operational') {
    return resolveManagerMachinePresentation('warning');
  }

  if (row.active_break_id) {
    return resolveManagerMachinePresentation('warning');
  }

  if (row.active_production_operation_id) {
    return resolveManagerMachinePresentation('running');
  }

  return resolveManagerMachinePresentation('idle');
}

function resolveEmployeeUiState(
  row: ManagerEmployeeReadModelRow,
  downtimeType: ManagerMachineDowntimeType | null
): { ui_state: ManagerEmployeeUiState; ui_variant: ManagerEmployeeUiVariant } {
  if (downtimeType === 'critical') {
    return resolveManagerEmployeePresentation('critical_down');
  }

  if (downtimeType === 'operational') {
    return resolveManagerEmployeePresentation('operational_down');
  }

  if (row.active_break_id) {
    return resolveManagerEmployeePresentation('break');
  }

  if (row.active_production_operation_id) {
    return resolveManagerEmployeePresentation('production');
  }

  if (row.active_additional_work_id) {
    return resolveManagerEmployeePresentation('additional_work');
  }

  if (row.open_shift_id) {
    return resolveManagerEmployeePresentation('shift_idle');
  }

  return resolveManagerEmployeePresentation('shift_not_started');
}

function resolveAdditionalWorkActions(status: ManagerAdditionalWorkRow['status']): ManagerAdditionalWorkAction[] {
  switch (status) {
    case 'requested':
      return ['OPEN_ADDITIONAL_WORK_CARD', 'APPROVE_ADDITIONAL_WORK_REQUEST', 'REJECT_ADDITIONAL_WORK_REQUEST'];
    case 'approved':
      return ['OPEN_ADDITIONAL_WORK_CARD', 'CANCEL_ADDITIONAL_WORK'];
    case 'active':
      return ['OPEN_ADDITIONAL_WORK_CARD', 'FINISH_ADDITIONAL_WORK'];
    case 'waiting_accrual':
      return ['OPEN_ADDITIONAL_WORK_CARD', 'ACCRUE_ADDITIONAL_WORK_SALARY', 'MARK_WITHOUT_ACCRUAL'];
  }
}

function resolveManagerShiftBlockers(item: ManagerEmployeeReadModelItem) {
  return {
    production: item.active_production_operation_id
      ? {
          production_operation_id: item.active_production_operation_id,
          machine_id: item.active_machine_id,
          machine_name: item.active_machine_name,
          sku_name: item.active_sku_name
        }
      : null,
    break: item.active_break_id
      ? {
          target_employee_id: item.employee_id,
          operator_break_id: item.active_break_id
        }
      : null,
    additional_work: item.active_additional_work_id
      ? {
          additional_work_id: item.active_additional_work_id
        }
      : null
  };
}

function resolveCompletedWorkItem(row: ManagerCompletedWorkRow): ManagerCompletedWorkItem {
  return {
    work_item_id: row.work_item_id,
    work_type: row.work_type,
    operation_id: row.operation_id,
    employee_id: row.employee_id,
    employee_full_name: row.employee_full_name,
    completed_date: row.completed_date,
    production_operation_id: row.production_operation_id,
    additional_work_id: row.additional_work_id,
    machine_id: row.machine_id,
    machine_name: row.machine_name,
    sku_name: row.sku_name,
    sku_code: row.sku_code,
    quantity: row.quantity,
    additional_work_name: row.additional_work_name,
    salary_entry_id: row.salary_entry_id,
    salary_amount_uzs: row.salary_amount_uzs,
    amount_uzs: row.amount_uzs,
    old_quantity: row.old_quantity,
    correction_base_quantity: row.correction_base_quantity,
    current_quantity: row.current_quantity,
    can_correct: Boolean(row.can_correct),
    can_storno: Boolean(row.can_storno),
    is_reversed: Boolean(row.is_reversed),
    reversal_id: row.reversal_id
  };
}

function normalizeTextArray(value: string[] | string | null | undefined, fieldName: string): string[] {
  if (Array.isArray(value)) {
    return value.filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
      }
    } catch {
      return value.trim().length > 0 ? [value] : [];
    }
  }

  if (value === null || value === undefined) {
    return [];
  }

  throw new ApiError(500, 'database_error', `${fieldName} is not a valid text array`);
}

function normalizeTargetContext(
  value: Record<string, string | null> | string | null | undefined,
  row?: ManagerOpenTaskRow,
  targetScreenId?: ManagerOpenTaskTargetScreenId
): Record<string, string | null> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string | null>;
      }
    } catch {
      throw new ApiError(500, 'database_error', 'target_context is not valid JSON');
    }
  }

  if (row && targetScreenId) {
    const entityId = row.entity_id ?? row.source_id ?? null;
    if (targetScreenId === 'S03-M02') {
      return { machine_id: entityId };
    }

    return { additional_work_id: entityId };
  }

  return {};
}

function resolveDowntimeType(row: ManagerMachineReadModelRow): ManagerMachineDowntimeType | null {
  if (!row.active_downtime_id) {
    return null;
  }

  if (row.downtime_type === 'critical' || row.downtime_type === 'operational') {
    return row.downtime_type;
  }

  throw new ApiError(500, 'database_error', 'Active downtime is not classifiable');
}

function resolveEmployeeDowntimeType(row: ManagerEmployeeReadModelRow): ManagerMachineDowntimeType | null {
  if (!row.active_downtime_id) {
    return null;
  }

  if (row.downtime_type === 'critical' || row.downtime_type === 'operational') {
    return row.downtime_type;
  }

  throw new ApiError(500, 'database_error', 'Active downtime is not classifiable');
}

function readCount(value: string | number, fieldName: string): number {
  return readSafeInteger(value, fieldName);
}

function readSafeInteger(value: string | number, fieldName: string): number {
  const count = Number(value);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new ApiError(500, 'database_error', `${fieldName} is not a valid count`);
  }

  return count;
}
