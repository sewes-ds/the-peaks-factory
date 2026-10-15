import type {
  AdditionalWorkStartBlocker,
  AvailableDowntimeUiColorToken,
  DowntimeUiColorToken,
  DowntimeClass,
  DowntimeSlotState,
  FinishShiftBlocker,
  FinishShiftNextPipeline,
  FinishShiftWarning,
  MachineUiStatusToken,
  OperatorAdditionalWorkStateResponse,
  OperatorPipeline,
} from './types.js';
import { ApiError } from '../db/errors.js';

export type MachineStateInput = {
  is_available_for_operations: boolean;
  is_decommissioned: boolean;
  is_available_for_start: boolean;
  is_running_status: boolean;
  is_downtime_status: boolean;
  is_broken_status: boolean;
  has_open_production: boolean;
  has_open_downtime: boolean;
  has_open_critical_downtime: boolean;
};

export type EmployeeWorkStateInput = {
  has_active_shift: boolean;
  has_active_production: boolean;
  has_active_break: boolean;
  has_running_additional_work: boolean;
  has_approved_unstarted_additional_work: boolean;
  operational_downtime_active: boolean;
  can_start_downtime: boolean;
  can_finish_downtime: boolean;
  can_finish_production: boolean;
};

export type AdditionalWorkStateInput = {
  additional_work_id: string;
  additional_work_type_id: string;
  display_name: string;
  assigned_by_employee_id: string;
  employee_id: string;
  is_pending: boolean;
  is_approved: boolean;
  started_at: string | null;
};

export function resolveDowntimeClass(value: string | null): DowntimeClass {
  if (value !== 'OPERATIONAL' && value !== 'CRITICAL') {
    throw new ApiError(500, 'database_error', 'Invalid downtime class projection');
  }

  return value;
}

export function resolveDowntimeSlotState(downtimeClass: DowntimeClass | null): DowntimeSlotState {
  if (downtimeClass === 'OPERATIONAL') {
    return 'OPERATIONAL_ACTIVE';
  }

  if (downtimeClass === 'CRITICAL') {
    return 'CRITICAL_ACTIVE';
  }

  return 'NONE';
}

export function resolveDowntimeUiColor(downtimeClass: DowntimeClass | null): DowntimeUiColorToken | null {
  if (downtimeClass === 'OPERATIONAL') {
    return 'yellow';
  }

  if (downtimeClass === 'CRITICAL') {
    return 'scarlet';
  }

  return null;
}

export function resolveAvailableDowntimeUiColor(downtimeClass: DowntimeClass): AvailableDowntimeUiColorToken {
  return downtimeClass === 'CRITICAL' ? 'scarlet' : 'yellow';
}

export function resolveMachineUiStatus(input: MachineStateInput): MachineUiStatusToken {
  if (!input.is_available_for_operations || input.is_decommissioned) {
    return 'unavailable';
  }

  if (input.is_broken_status || input.has_open_critical_downtime) {
    return 'critical';
  }

  if (input.is_running_status || input.is_downtime_status || input.has_open_production || input.has_open_downtime) {
    return 'busy';
  }

  return 'normal';
}

export function resolveFinishShiftBlockers(input: EmployeeWorkStateInput): FinishShiftBlocker[] {
  if (!input.has_active_shift) {
    return [];
  }

  const blockers: FinishShiftBlocker[] = [];

  if (input.operational_downtime_active) {
    blockers.push('OPERATIONAL_DOWNTIME');
  }

  if (input.has_active_break) {
    blockers.push('BREAK');
  }

  if (input.has_running_additional_work) {
    blockers.push('ADDITIONAL_WORK');
  }

  if (input.has_active_production) {
    blockers.push('PRODUCTION');
  }

  return blockers;
}

export function resolveFinishShiftWarnings(input: EmployeeWorkStateInput): FinishShiftWarning[] {
  if (!input.has_active_shift) {
    return [];
  }

  return input.has_approved_unstarted_additional_work ? ['APPROVED_ADDITIONAL_WORKS_NOT_STARTED'] : [];
}

export function resolveFinishShiftNextPipeline(
  blockers: readonly FinishShiftBlocker[],
  warnings: readonly FinishShiftWarning[],
  hasActiveShift = true
): FinishShiftNextPipeline {
  if (!hasActiveShift) {
    return null;
  }

  if (blockers.includes('OPERATIONAL_DOWNTIME')) {
    return 'FINISH_DOWNTIME';
  }

  if (blockers.includes('BREAK')) {
    return 'FINISH_BREAK';
  }

  if (blockers.includes('ADDITIONAL_WORK')) {
    return 'FINISH_ADDITIONAL_WORK';
  }

  if (blockers.includes('PRODUCTION')) {
    return 'FINISH_PRODUCTION';
  }

  if (warnings.includes('APPROVED_ADDITIONAL_WORKS_NOT_STARTED')) {
    return 'CONFIRM_FINISH_SHIFT_WITH_WARNING';
  }

  return 'CONFIRM_FINISH_SHIFT';
}

export function resolveAvailablePipelines(input: EmployeeWorkStateInput): OperatorPipeline[] {
  const pipelines: OperatorPipeline[] = ['VIEW_SALARY'];

  if (!input.has_active_shift) {
    // start_employee_shift rejects incompatible orphan/open employee actions.
    if (!input.has_active_production && !input.has_active_break && !input.has_running_additional_work) {
      pipelines.unshift('START_SHIFT');
    }
    return pipelines;
  }

  // FINISH_SHIFT is the entry to the accepted blocker-resolution flow. The
  // direct PostgreSQL mutation remains protected by its own blocker checks.
  pipelines.unshift('FINISH_SHIFT');
  pipelines.push('OPEN_ADDITIONAL_WORK', 'REQUEST_ADDITIONAL_WORK');

  if (input.can_finish_downtime) {
    pipelines.push('FINISH_DOWNTIME');
  }

  if (input.has_active_break) {
    pipelines.push('FINISH_BREAK');
  }

  if (input.has_running_additional_work) {
    pipelines.push('FINISH_ADDITIONAL_WORK');
  }

  if (input.has_active_production) {
    if (input.can_finish_production) {
      pipelines.push('FINISH_PRODUCTION');
    }
  } else {
    // The accepted PostgreSQL start_production_operation contract requires an
    // open shift and no open production operation. It does not classify an
    // active break or running additional work as start blockers.
    pipelines.push('START_PRODUCTION');
  }

  if (input.can_start_downtime) {
    // start_machine_downtime intentionally remains available during a break or
    // additional work; PostgreSQL applies machine/type/operation authorization.
    pipelines.push('START_DOWNTIME');
  }

  if (!input.has_active_break && !input.has_running_additional_work) {
    // start_operator_break explicitly allows an open production operation.
    pipelines.push('START_BREAK');
  }

  if (
    input.has_approved_unstarted_additional_work
    && resolveAdditionalWorkStartBlockers(input).length === 0
  ) {
    pipelines.push('START_ADDITIONAL_WORK');
  }

  return pipelines;
}

export function resolveAdditionalWorkStartBlockers(
  input: EmployeeWorkStateInput
): AdditionalWorkStartBlocker[] {
  const blockers: AdditionalWorkStartBlocker[] = [];
  if (!input.has_active_shift) blockers.push('NO_OPEN_SHIFT');
  if (input.has_active_production) blockers.push('ACTIVE_PRODUCTION');
  if (input.has_active_break) blockers.push('ACTIVE_BREAK');
  if (input.has_running_additional_work) blockers.push('OTHER_ADDITIONAL_WORK_RUNNING');
  return blockers;
}

export function resolveAdditionalWorkState(
  rows: readonly AdditionalWorkStateInput[]
): Omit<OperatorAdditionalWorkStateResponse, 'actor_employee_id'> {
  return {
    active_additional_works: rows
      .filter((row) => row.is_approved && row.started_at !== null)
      .map((row) => ({
        additional_work_id: row.additional_work_id,
        additional_work_type_id: row.additional_work_type_id,
        display_name: row.display_name,
        ui_group: 'ACTIVE',
        ui_color_token: 'green',
        action: 'FINISH_ADDITIONAL_WORK'
      })),
    approved_additional_works: rows
      .filter((row) => row.is_approved && row.started_at === null)
      .map((row) => ({
        additional_work_id: row.additional_work_id,
        additional_work_type_id: row.additional_work_type_id,
        display_name: row.display_name,
        origin: row.assigned_by_employee_id === row.employee_id ? 'OPERATOR_REQUEST_APPROVED' : 'MANAGER_ASSIGNED',
        ui_group: 'APPROVED',
        ui_color_token: 'gray_green',
        action: 'START_ADDITIONAL_WORK'
      })),
    pending_approval_additional_works: rows
      .filter((row) => row.is_pending && row.started_at === null)
      .map((row) => ({
        additional_work_id: row.additional_work_id,
        additional_work_type_id: row.additional_work_type_id,
        display_name: row.display_name,
        ui_group: 'PENDING_APPROVAL',
        ui_color_token: 'white_gray_inactive',
        action: null
      }))
  };
}
