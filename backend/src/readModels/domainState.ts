import { ApiError } from '../db/errors.js';
import { toDtoNumber, toDtoUzsAmount } from './numericContract.js';
import {
  resolveAdditionalWorkState,
  resolveAdditionalWorkStartBlockers,
  resolveAvailablePipelines,
  resolveDowntimeClass,
  resolveDowntimeSlotState,
  resolveDowntimeUiColor,
  resolveFinishShiftBlockers,
  resolveFinishShiftNextPipeline,
  resolveFinishShiftWarnings,
  resolveMachineUiStatus
} from './resolvers.js';
import type {
  AdditionalWorkStartBlocker,
  DowntimeClass,
  DowntimeUiColorToken,
  FinishShiftBlocker,
  FinishShiftNextPipeline,
  FinishShiftWarning,
  MachineUiStatusToken,
  OperatorPipeline
} from './types.js';
import type {
  AdditionalWorkStateRow,
  DowntimeTypeStateRow,
  EmployeeWorkplaceSnapshotRow,
  MachineStateRow,
  SalaryHistoryStateRow,
  SalaryTotalsStateRow,
  SkuQrStateRow,
  SkuStateRow
} from './sharedQueries.js';

export type EmployeeWorkplaceDomainState = {
  shift: {
    is_active: boolean;
    employee_shift_id: string | null;
    started_at: string | null;
  };
  production: ActiveProductionDomainState | InactiveProductionDomainState;
  break: {
    is_active: boolean;
    operator_break_id: string | null;
    break_type_id: string | null;
    break_type_name: string | null;
    can_finish_break: boolean;
  };
  downtime: {
    slot_state: 'NONE' | 'OPERATIONAL_ACTIVE' | 'CRITICAL_ACTIVE';
    downtime_id: string | null;
    production_operation_id: string | null;
    machine_id: string | null;
    machine_name: string | null;
    downtime_type_id: string | null;
    downtime_type_name: string | null;
    downtime_class: DowntimeClass | null;
    ui_color_token: DowntimeUiColorToken | null;
    can_start_downtime: boolean;
    can_finish_downtime: boolean;
  };
  additional_work_summary: {
    has_active_additional_work: boolean;
    active_additional_work_id: string | null;
    active_additional_work_name: string | null;
  };
  additional_work_start: {
    blockers: AdditionalWorkStartBlocker[];
  };
  salary: {
    can_view_salary: boolean;
  };
  finish_shift: {
    can_finish_now: boolean;
    blockers: FinishShiftBlocker[];
    warnings: FinishShiftWarning[];
    next_required_pipeline: FinishShiftNextPipeline;
  };
  available_pipelines: OperatorPipeline[];
};

export type ActiveProductionDomainState = {
  is_active: true;
  production_operation_id: string;
  machine_id: string;
  machine_name: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  can_finish_production: boolean;
};

export type InactiveProductionDomainState = {
  is_active: false;
  production_operation_id: null;
  machine_id: null;
  machine_name: null;
  sku_id: null;
  sku_code: null;
  sku_name: null;
  can_finish_production: false;
};

export type AvailableDowntimeTypeDomainState = {
  downtime_type_id: string;
  display_name: string;
  downtime_class: DowntimeClass;
  ui_color_token: 'yellow' | 'scarlet';
  requires_production_operation: boolean;
  requires_comment: boolean;
};

export type MachineDomainState = {
  machine_id: string;
  machine_name: string;
  workshop_name: string | null;
  machine_status: string | null;
  machine_use_status: string | null;
  is_selectable_for_production: boolean;
  is_selectable_for_critical_downtime: boolean;
  ui_status_token: MachineUiStatusToken;
};

export type MachineQrDomainState = MachineDomainState & {
  production_unavailability:
    | { code: 'OCCUPIED_BY_OPERATOR'; operator_full_name: string }
    | { code: 'MACHINE_BROKEN' }
    | { code: 'MACHINE_DOWNTIME' }
    | { code: 'MACHINE_OUT_OF_SERVICE' }
    | { code: 'MACHINE_NOT_READY'; machine_status: string | null }
    | null;
};

export type SkuDomainState = {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  sku_unit_name: string | null;
  current_sku_tariff_uzs: number | null;
  is_active: boolean;
};

export type SkuQrDomainState = SkuDomainState & {
  is_selectable_for_production: boolean;
  production_unavailability: { code: 'SKU_INACTIVE' } | null;
};

export type SalaryTotalsDomainState = {
  employee_id: string;
  totals: {
    today_uzs: number;
    week_uzs: number;
    month_uzs: number;
  };
  breakdown?: {
    production_uzs: number;
    additional_work_uzs: number;
    corrections_uzs: number | null;
    reversals_uzs: number | null;
  };
};

export type SalaryHistoryDomainState = {
  employee_id: string;
  months: Array<{
    month: string;
    total_uzs: number;
    production_uzs: number;
    additional_work_uzs: number;
    corrections_uzs: number | null;
    reversals_uzs: number | null;
  }>;
};

export function resolveEmployeeWorkplaceState(
  row: EmployeeWorkplaceSnapshotRow | undefined
): EmployeeWorkplaceDomainState {
  const hasActiveShift = row?.employee_shift_id !== null && row?.employee_shift_id !== undefined;
  const hasActiveProduction = row?.production_operation_id !== null && row?.production_operation_id !== undefined;
  const hasActiveBreak = row?.operator_break_id !== null && row?.operator_break_id !== undefined;
  const hasRunningAdditionalWork = row?.active_additional_work_id !== null && row?.active_additional_work_id !== undefined;
  const downtimeClass = resolveLinkedDowntimeClass(row);
  const slotState = resolveDowntimeSlotState(downtimeClass);
  const operationalDowntimeActive = slotState === 'OPERATIONAL_ACTIVE';
  const canFinishDowntime = row?.linked_downtime_id != null;
  // PostgreSQL finish_production_operation blocks self-finish during an active
  // operator break and during linked operational downtime. Critical downtime
  // does not block production finish.
  const canFinishProduction = hasActiveProduction && !operationalDowntimeActive && !hasActiveBreak;
  // PostgreSQL start_machine_downtime does not use operator break or running
  // additional work as actor-level blockers. Machine/type/operation checks are
  // enforced by the runtime function and machine/type read models.
  const canStartDowntime = hasActiveShift && !canFinishDowntime;
  const hasApprovedUnstartedAdditionalWork = Number(row?.approved_unstarted_count ?? '0') > 0;
  const workState = {
    has_active_shift: hasActiveShift,
    has_active_production: hasActiveProduction,
    has_active_break: hasActiveBreak,
    has_running_additional_work: hasRunningAdditionalWork,
    has_approved_unstarted_additional_work: hasApprovedUnstartedAdditionalWork,
    operational_downtime_active: operationalDowntimeActive,
    can_start_downtime: canStartDowntime,
    can_finish_downtime: canFinishDowntime,
    can_finish_production: canFinishProduction
  };
  const blockers = resolveFinishShiftBlockers(workState);
  const warnings = resolveFinishShiftWarnings(workState);

  return {
    shift: {
      is_active: hasActiveShift,
      employee_shift_id: row?.employee_shift_id ?? null,
      started_at: row?.shift_started_at ?? null
    },
    production: resolveProductionState(row, hasActiveProduction, canFinishProduction),
    break: {
      is_active: hasActiveBreak,
      operator_break_id: row?.operator_break_id ?? null,
      break_type_id: row?.break_type_id ?? null,
      break_type_name: row?.break_type_name ?? null,
      can_finish_break: hasActiveBreak
    },
    downtime: {
      slot_state: slotState,
      downtime_id: row?.linked_downtime_id ?? null,
      production_operation_id: row?.linked_downtime_production_operation_id ?? null,
      machine_id: row?.linked_downtime_machine_id ?? null,
      machine_name: row?.linked_downtime_machine_name ?? null,
      downtime_type_id: row?.linked_downtime_type_id ?? null,
      downtime_type_name: row?.linked_downtime_type_name ?? null,
      downtime_class: downtimeClass,
      ui_color_token: resolveDowntimeUiColor(downtimeClass),
      can_start_downtime: canStartDowntime,
      can_finish_downtime: canFinishDowntime
    },
    additional_work_summary: {
      has_active_additional_work: hasRunningAdditionalWork,
      active_additional_work_id: row?.active_additional_work_id ?? null,
      active_additional_work_name: row?.active_additional_work_name ?? null
    },
    additional_work_start: {
      blockers: resolveAdditionalWorkStartBlockers(workState)
    },
    salary: {
      can_view_salary: true
    },
    finish_shift: {
      can_finish_now: hasActiveShift && blockers.length === 0,
      blockers,
      warnings,
      next_required_pipeline: resolveFinishShiftNextPipeline(blockers, warnings, hasActiveShift)
    },
    available_pipelines: resolveAvailablePipelines(workState)
  };
}

export function resolveAdditionalWorkProjection(rows: readonly AdditionalWorkStateRow[]) {
  return resolveAdditionalWorkState(rows);
}

export function resolveAvailableDowntimeTypeProjection(row: DowntimeTypeStateRow) {
  const downtimeClass = resolveDowntimeClass(row.downtime_class);

  return {
    downtime_type_id: row.downtime_type_id,
    display_name: row.display_name,
    downtime_class: downtimeClass,
    ui_color_token: row.ui_color_token,
    requires_production_operation: row.requires_production_operation,
    requires_comment: row.operator_requires_start_comment
  };
}

export function resolveAvailableDowntimeTypesForProductionState(
  hasActiveProduction: boolean,
  rows: readonly DowntimeTypeStateRow[]
): AvailableDowntimeTypeDomainState[] {
  return rows
    .map(resolveAvailableDowntimeTypeProjection)
    .filter((type) => hasActiveProduction || !type.requires_production_operation);
}

export function resolveMachineProjection(row: MachineStateRow): MachineDomainState {
  const isAvailableForOperations = row.is_available_for_operations && !row.is_decommissioned;
  const hasAnyOpenWork = row.has_open_production || row.has_open_downtime;

  return {
    machine_id: row.machine_id,
    machine_name: row.machine_name,
    workshop_name: row.workshop_name,
    machine_status: row.machine_status,
    machine_use_status: row.machine_use_status,
    is_selectable_for_production: isAvailableForOperations && row.is_available_for_start && !hasAnyOpenWork,
    is_selectable_for_critical_downtime:
      isAvailableForOperations
      && !row.has_open_downtime
      && (!row.has_open_production || row.has_open_production_by_actor),
    ui_status_token: resolveMachineUiStatus(row)
  };
}

export function resolveMachineQrProjection(row: MachineStateRow): MachineQrDomainState {
  const machine = resolveMachineProjection(row);
  if (machine.is_selectable_for_production) {
    return { ...machine, production_unavailability: null };
  }

  if (row.is_broken_status || row.has_open_critical_downtime) {
    return { ...machine, production_unavailability: { code: 'MACHINE_BROKEN' } };
  }

  if (row.has_open_production && row.active_production_employee_full_name !== null) {
    return {
      ...machine,
      production_unavailability: {
        code: 'OCCUPIED_BY_OPERATOR',
        operator_full_name: row.active_production_employee_full_name
      }
    };
  }

  if (row.has_open_downtime) {
    return { ...machine, production_unavailability: { code: 'MACHINE_DOWNTIME' } };
  }

  if (!row.is_available_for_operations || row.is_decommissioned) {
    return { ...machine, production_unavailability: { code: 'MACHINE_OUT_OF_SERVICE' } };
  }

  return {
    ...machine,
    production_unavailability: { code: 'MACHINE_NOT_READY', machine_status: row.machine_status }
  };
}

export function resolveSkuList(rows: readonly SkuStateRow[]): SkuDomainState[] {
  return rows.map((row) => ({
    sku_id: row.sku_id,
    sku_code: row.sku_code,
    sku_name: normalizeSkuName(row.sku_code, row.sku_name),
    sku_unit_name: row.sku_unit_name,
    current_sku_tariff_uzs: toDtoNumber(row.current_sku_tariff_uzs, 'current_sku_tariff_uzs', { nullable: true }),
    is_active: row.is_active
  }));
}

export function resolveSkuQrProjection(row: SkuQrStateRow): SkuQrDomainState {
  const sku = resolveSkuList([row])[0]!;
  const isSelectableForProduction = row.is_active && row.sku_unit_is_active;

  return {
    ...sku,
    is_selectable_for_production: isSelectableForProduction,
    production_unavailability: isSelectableForProduction ? null : { code: 'SKU_INACTIVE' }
  };
}

export function resolveSalaryTotals(actorEmployeeId: string, row: SalaryTotalsStateRow | undefined): SalaryTotalsDomainState {
  return {
    employee_id: actorEmployeeId,
    totals: {
      today_uzs: toDtoUzsAmount(row?.today_uzs ?? '0', 'totals.today_uzs'),
      week_uzs: toDtoUzsAmount(row?.week_uzs ?? '0', 'totals.week_uzs'),
      month_uzs: toDtoUzsAmount(row?.month_uzs ?? '0', 'totals.month_uzs')
    }
  };
}

export function resolveSalaryHistory(actorEmployeeId: string, rows: readonly SalaryHistoryStateRow[]): SalaryHistoryDomainState {
  return {
    employee_id: actorEmployeeId,
    months: rows.map((row) => ({
      month: row.month,
      total_uzs: toDtoUzsAmount(row.total_uzs, 'months[].total_uzs'),
      production_uzs: toDtoUzsAmount(row.production_uzs, 'months[].production_uzs'),
      additional_work_uzs: toDtoUzsAmount(row.additional_work_uzs, 'months[].additional_work_uzs'),
      corrections_uzs: row.corrections_uzs === null ? null : toDtoUzsAmount(row.corrections_uzs, 'months[].corrections_uzs'),
      reversals_uzs: row.reversals_uzs === null ? null : toDtoUzsAmount(row.reversals_uzs, 'months[].reversals_uzs')
    }))
  };
}

function resolveLinkedDowntimeClass(row: EmployeeWorkplaceSnapshotRow | undefined): DowntimeClass | null {
  if (!row?.linked_downtime_id) {
    return null;
  }

  return resolveDowntimeClass(row.linked_downtime_class);
}

function resolveProductionState(
  row: EmployeeWorkplaceSnapshotRow | undefined,
  hasActiveProduction: boolean,
  canFinishProduction: boolean
): EmployeeWorkplaceDomainState['production'] {
  if (!hasActiveProduction) {
    return {
      is_active: false,
      production_operation_id: null,
      machine_id: null,
      machine_name: null,
      sku_id: null,
      sku_code: null,
      sku_name: null,
      can_finish_production: false
    };
  }

  const productionOperationId = requireActiveProductionField(row?.production_operation_id, 'production.production_operation_id');
  const machineId = requireActiveProductionField(row?.production_machine_id, 'production.machine_id');
  const machineName = requireActiveProductionField(row?.production_machine_name, 'production.machine_name');
  const skuId = requireActiveProductionField(row?.sku_id, 'production.sku_id');
  const skuCode = requireActiveProductionField(row?.sku_code, 'production.sku_code');

  return {
    is_active: true,
    production_operation_id: productionOperationId,
    machine_id: machineId,
    machine_name: machineName,
    sku_id: skuId,
    sku_code: skuCode,
    sku_name: normalizeSkuName(skuCode, row?.sku_name ?? null),
    can_finish_production: canFinishProduction
  };
}

function requireActiveProductionField(value: string | null | undefined, fieldName: string): string {
  if (value == null) {
    throw new ApiError(500, 'database_error', `${fieldName} is required`);
  }

  return value;
}

function normalizeSkuName(skuCode: string, skuName: string | null): string {
  return skuName ?? skuCode;
}
