import type {
  ActiveAdditionalWorkItem,
  AdditionalWorkTypesAvailableResponse,
  ApprovedAdditionalWorkItem,
  MachineQrLookupResponse,
  SkuQrLookupResponse,
  OperatorAdditionalWorkStateResponse,
  PendingAdditionalWorkItem,
} from '../foundation/contracts';
import type {
  OperatorAvailableDowntimeTypesResponse,
  OperatorBreakTypeItem,
  OperatorMachineItem as LegacyOperatorMachineItem,
  OperatorSalaryHistoryMonth,
  OperatorSalaryTotals,
  OperatorSkuItem,
  OperatorWorkplaceStateResponse,
  AdditionalWorkStartBlocker,
} from './operatorWorkplace';

export type OperatorMachineUiStatusToken = 'normal' | 'busy' | 'critical' | 'unavailable';

export type OperatorMachineItem = Omit<LegacyOperatorMachineItem, 'ui_status_token'> & Readonly<{
  ui_status_token: OperatorMachineUiStatusToken;
}>;

export type {
  AdditionalWorkStartBlocker,
  ActiveAdditionalWorkItem,
  AdditionalWorkTypesAvailableResponse,
  ApprovedAdditionalWorkItem,
  OperatorAdditionalWorkStateResponse,
  PendingAdditionalWorkItem,
  OperatorAvailableDowntimeTypesResponse,
  OperatorBreakTypeItem,
  OperatorSalaryHistoryMonth,
  OperatorSalaryTotals,
  OperatorSkuItem,
  OperatorWorkplaceStateResponse,
  MachineQrLookupResponse,
  SkuQrLookupResponse,
};

export const ADDITIONAL_WORK_START_BLOCKER_ORDER = Object.freeze([
  'NO_OPEN_SHIFT',
  'ACTIVE_PRODUCTION',
  'ACTIVE_BREAK',
  'OTHER_ADDITIONAL_WORK_RUNNING',
  'SELECTED_WORK_NOT_APPROVED',
  'SELECTED_WORK_NOT_STARTABLE',
] as const satisfies readonly AdditionalWorkStartBlocker[]);

export const ADDITIONAL_WORK_START_BLOCKER_MESSAGES: Readonly<Record<AdditionalWorkStartBlocker, string>> = Object.freeze({
  NO_OPEN_SHIFT: 'Доп. работа не может быть начата: смена не открыта.',
  ACTIVE_PRODUCTION: 'Доп. работа не может быть начата во время активного производства. Сначала завершите производство.',
  ACTIVE_BREAK: 'Доп. работа не может быть начата во время активного перерыва. Сначала завершите перерыв.',
  OTHER_ADDITIONAL_WORK_RUNNING: 'Доп. работа не может быть начата, пока выполняется другая доп. работа. Сначала завершите текущую доп. работу.',
  SELECTED_WORK_NOT_APPROVED: 'Доп. работа не согласована и не может быть начата.',
  SELECTED_WORK_NOT_STARTABLE: 'Доп. работа больше недоступна для начала. Обновите список.',
});

export class Section02ContractError extends Error {
  readonly contract: string;
  readonly path: string;

  constructor(contract: string, path: string) {
    super(`Invalid Section 02 ${contract} contract at ${path}.`);
    this.name = 'Section02ContractError';
    this.contract = contract;
    this.path = path;
    Object.freeze(this);
  }
}

type RecordValue = Readonly<Record<string, unknown>>;

function record(value: unknown, contract: string, path = '$'): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Section02ContractError(contract, path);
  }
  return value as RecordValue;
}

function array(value: unknown, contract: string, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Section02ContractError(contract, path);
  return value;
}

function text(value: unknown, contract: string, path: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Section02ContractError(contract, path);
  return value;
}

function bool(value: unknown, contract: string, path: string): boolean {
  if (typeof value !== 'boolean') throw new Section02ContractError(contract, path);
  return value;
}

function optionalText(value: unknown, contract: string, path: string): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw new Section02ContractError(contract, path);
  return value;
}

function optionalBool(value: unknown, contract: string, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  return bool(value, contract, path);
}

function machineUiStatusToken(value: unknown, contract: string, path: string): OperatorMachineUiStatusToken {
  if (value === 'normal' || value === 'busy' || value === 'critical' || value === 'unavailable') return value;
  throw new Section02ContractError(contract, path);
}

function stringArray(value: unknown, contract: string, path: string): readonly string[] {
  return Object.freeze(array(value, contract, path).map((item, index) => text(item, contract, `${path}[${index}]`)));
}

function nullableAmount(value: unknown, contract: string, path: string): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new Section02ContractError(contract, path);
}

function amount(value: unknown, contract: string, path: string): string {
  const resolved = nullableAmount(value, contract, path);
  if (resolved === null) throw new Section02ContractError(contract, path);
  return resolved;
}

export function decodeOperatorWorkplaceState(value: unknown): OperatorWorkplaceStateResponse {
  const contract = 'workplace-state';
  const source = record(value, contract);
  const shift = record(source.shift, contract, '$.shift');
  const additionalWorkStart = record(source.additional_work_start, contract, '$.additional_work_start');
  const blockerValues = stringArray(additionalWorkStart.blockers, contract, '$.additional_work_start.blockers');
  const blockerSet = new Set(blockerValues);
  const blockers = ADDITIONAL_WORK_START_BLOCKER_ORDER.filter((code) => blockerSet.has(code));
  if (blockers.length !== blockerValues.length || blockers.some((code, index) => code !== blockerValues[index])) {
    throw new Section02ContractError(contract, '$.additional_work_start.blockers');
  }
  const availablePipelines = source.available_pipelines === undefined
    ? undefined
    : stringArray(source.available_pipelines, contract, '$.available_pipelines');
  const output: OperatorWorkplaceStateResponse = {
    actor_employee_id: optionalText(source.actor_employee_id, contract, '$.actor_employee_id'),
    actor_full_name: text(source.actor_full_name, contract, '$.actor_full_name'),
    ...(availablePipelines === undefined ? {} : { available_pipelines: [...availablePipelines] }),
    shift: {
      is_active: bool(shift.is_active, contract, '$.shift.is_active'),
      employee_shift_id: optionalText(shift.employee_shift_id, contract, '$.shift.employee_shift_id'),
      started_at: optionalText(shift.started_at, contract, '$.shift.started_at'),
    },
    additional_work_start: { blockers: [...blockers] },
  };
  if (source.production !== undefined) {
    const item = record(source.production, contract, '$.production');
    output.production = {
      is_active: optionalBool(item.is_active, contract, '$.production.is_active'),
      production_operation_id: optionalText(item.production_operation_id, contract, '$.production.production_operation_id'),
      machine_id: optionalText(item.machine_id, contract, '$.production.machine_id'),
      machine_name: optionalText(item.machine_name, contract, '$.production.machine_name'),
      sku_id: optionalText(item.sku_id, contract, '$.production.sku_id'),
      sku_code: optionalText(item.sku_code, contract, '$.production.sku_code'),
      sku_name: optionalText(item.sku_name, contract, '$.production.sku_name'),
      started_at: optionalText(item.started_at, contract, '$.production.started_at'),
      can_finish_production: optionalBool(item.can_finish_production, contract, '$.production.can_finish_production'),
    };
  }
  if (source.break !== undefined) {
    const item = record(source.break, contract, '$.break');
    output.break = {
      is_active: optionalBool(item.is_active, contract, '$.break.is_active'),
      operator_break_id: optionalText(item.operator_break_id, contract, '$.break.operator_break_id'),
      break_type_id: optionalText(item.break_type_id, contract, '$.break.break_type_id'),
      break_type_name: optionalText(item.break_type_name, contract, '$.break.break_type_name'),
      can_finish_break: optionalBool(item.can_finish_break, contract, '$.break.can_finish_break'),
    };
  }
  if (source.downtime !== undefined) {
    const item = record(source.downtime, contract, '$.downtime');
    output.downtime = {
      slot_state: optionalText(item.slot_state, contract, '$.downtime.slot_state'),
      downtime_id: optionalText(item.downtime_id, contract, '$.downtime.downtime_id'),
      downtime_type_name: optionalText(item.downtime_type_name, contract, '$.downtime.downtime_type_name'),
      downtime_class: optionalText(item.downtime_class, contract, '$.downtime.downtime_class'),
      ui_color_token: optionalText(item.ui_color_token, contract, '$.downtime.ui_color_token'),
      can_start_downtime: optionalBool(item.can_start_downtime, contract, '$.downtime.can_start_downtime'),
      can_finish_downtime: optionalBool(item.can_finish_downtime, contract, '$.downtime.can_finish_downtime'),
    };
  }
  if (source.additional_work_summary !== undefined) {
    const item = record(source.additional_work_summary, contract, '$.additional_work_summary');
    output.additional_work_summary = {
      has_active_additional_work: optionalBool(item.has_active_additional_work, contract, '$.additional_work_summary.has_active_additional_work'),
      active_additional_work_id: optionalText(item.active_additional_work_id, contract, '$.additional_work_summary.active_additional_work_id'),
      active_additional_work_name: optionalText(item.active_additional_work_name, contract, '$.additional_work_summary.active_additional_work_name'),
    };
  }
  if (source.salary !== undefined) {
    const item = record(source.salary, contract, '$.salary');
    output.salary = { can_view_salary: optionalBool(item.can_view_salary, contract, '$.salary.can_view_salary') };
  }
  if (source.finish_shift !== undefined) {
    const item = record(source.finish_shift, contract, '$.finish_shift');
    const next = optionalText(item.next_required_pipeline, contract, '$.finish_shift.next_required_pipeline');
    const nextAllowed = ['FINISH_DOWNTIME', 'FINISH_BREAK', 'FINISH_ADDITIONAL_WORK', 'FINISH_PRODUCTION', 'CONFIRM_FINISH_SHIFT', 'CONFIRM_FINISH_SHIFT_WITH_WARNING'];
    if (next !== undefined && next !== null && !nextAllowed.includes(next)) {
      throw new Section02ContractError(contract, '$.finish_shift.next_required_pipeline');
    }
    output.finish_shift = {
      can_finish_now: optionalBool(item.can_finish_now, contract, '$.finish_shift.can_finish_now'),
      can_finish_shift: optionalBool(item.can_finish_shift, contract, '$.finish_shift.can_finish_shift'),
      blockers: item.blockers === undefined ? undefined : [...stringArray(item.blockers, contract, '$.finish_shift.blockers')],
      blocking_reasons: item.blocking_reasons === undefined ? undefined : [...stringArray(item.blocking_reasons, contract, '$.finish_shift.blocking_reasons')],
      warnings: item.warnings === undefined ? undefined : [...stringArray(item.warnings, contract, '$.finish_shift.warnings')],
      warning_messages: item.warning_messages === undefined ? undefined : [...stringArray(item.warning_messages, contract, '$.finish_shift.warning_messages')],
      next_required_pipeline: next as NonNullable<OperatorWorkplaceStateResponse['finish_shift']>['next_required_pipeline'],
    };
  }
  return Object.freeze(output);
}

export function decodeOperatorMachines(value: unknown): readonly OperatorMachineItem[] {
  const contract = 'machines';
  const source = record(value, contract);
  return Object.freeze(array(source.machines, contract, '$.machines').map((candidate, index) => {
    const row = record(candidate, contract, `$.machines[${index}]`);
    return Object.freeze({
      machine_id: text(row.machine_id, contract, `$.machines[${index}].machine_id`),
      machine_name: text(row.machine_name, contract, `$.machines[${index}].machine_name`),
      qr_code_token: optionalText(row.qr_code_token, contract, `$.machines[${index}].qr_code_token`),
      machine_status_name: optionalText(row.machine_status_name ?? row.machine_status, contract, `$.machines[${index}].machine_status_name`),
      machine_use_status_name: optionalText(row.machine_use_status_name ?? row.machine_use_status, contract, `$.machines[${index}].machine_use_status_name`),
      is_selectable_for_production: optionalBool(row.is_selectable_for_production, contract, `$.machines[${index}].is_selectable_for_production`),
      is_selectable_for_critical_downtime: optionalBool(row.is_selectable_for_critical_downtime, contract, `$.machines[${index}].is_selectable_for_critical_downtime`),
      ui_status_token: machineUiStatusToken(row.ui_status_token, contract, `$.machines[${index}].ui_status_token`),
    });
  }));
}

export function decodeOperatorMachineQr(value: unknown): MachineQrLookupResponse {
  const contract = 'machine-qr';
  const source = record(value, contract);
  if (source.found === false) {
    if (source.error_code !== 'MACHINE_QR_NOT_FOUND') {
      throw new Section02ContractError(contract, '$.error_code');
    }
    return Object.freeze({ found: false, error_code: 'MACHINE_QR_NOT_FOUND' });
  }
  if (source.found !== true) throw new Section02ContractError(contract, '$.found');

  const machine = record(source.machine, contract, '$.machine');
  const unavailabilitySource = machine.production_unavailability;
  let productionUnavailability: NonNullable<Extract<MachineQrLookupResponse, { found: true }>['machine']['production_unavailability']> | null = null;
  if (unavailabilitySource !== null) {
    const reason = record(unavailabilitySource, contract, '$.machine.production_unavailability');
    if (reason.code === 'OCCUPIED_BY_OPERATOR') {
      productionUnavailability = Object.freeze({
        code: 'OCCUPIED_BY_OPERATOR',
        operator_full_name: text(reason.operator_full_name, contract, '$.machine.production_unavailability.operator_full_name'),
      });
    } else if (reason.code === 'MACHINE_BROKEN' || reason.code === 'MACHINE_DOWNTIME' || reason.code === 'MACHINE_OUT_OF_SERVICE') {
      productionUnavailability = Object.freeze({ code: reason.code });
    } else if (reason.code === 'MACHINE_NOT_READY') {
      productionUnavailability = Object.freeze({
        code: 'MACHINE_NOT_READY',
        machine_status: optionalText(reason.machine_status, contract, '$.machine.production_unavailability.machine_status') ?? null,
      });
    } else {
      throw new Section02ContractError(contract, '$.machine.production_unavailability.code');
    }
  }

  return Object.freeze({
    found: true,
    machine: Object.freeze({
      machine_id: text(machine.machine_id, contract, '$.machine.machine_id'),
      machine_name: text(machine.machine_name, contract, '$.machine.machine_name'),
      workshop_name: optionalText(machine.workshop_name, contract, '$.machine.workshop_name') ?? null,
      machine_status: optionalText(machine.machine_status, contract, '$.machine.machine_status') ?? null,
      machine_use_status: optionalText(machine.machine_use_status, contract, '$.machine.machine_use_status') ?? null,
      is_selectable_for_production: bool(machine.is_selectable_for_production, contract, '$.machine.is_selectable_for_production'),
      is_selectable_for_critical_downtime: bool(machine.is_selectable_for_critical_downtime, contract, '$.machine.is_selectable_for_critical_downtime'),
      ui_status_token: machineUiStatusToken(machine.ui_status_token, contract, '$.machine.ui_status_token'),
      production_unavailability: productionUnavailability,
    }),
  });
}

export function decodeOperatorSkuQr(value: unknown): SkuQrLookupResponse {
  const contract = 'sku-qr';
  const source = record(value, contract);
  if (source.found === false) {
    if (source.error_code !== 'SKU_QR_NOT_FOUND') throw new Section02ContractError(contract, '$.error_code');
    return Object.freeze({ found: false, error_code: 'SKU_QR_NOT_FOUND' });
  }
  if (source.found !== true) throw new Section02ContractError(contract, '$.found');

  const sku = record(source.sku, contract, '$.sku');
  const unavailabilitySource = sku.production_unavailability;
  let productionUnavailability: { code: 'SKU_INACTIVE' } | null = null;
  if (unavailabilitySource !== null) {
    const reason = record(unavailabilitySource, contract, '$.sku.production_unavailability');
    if (reason.code !== 'SKU_INACTIVE') throw new Section02ContractError(contract, '$.sku.production_unavailability.code');
    productionUnavailability = Object.freeze({ code: 'SKU_INACTIVE' });
  }

  const tariff = sku.current_sku_tariff_uzs;
  if (tariff !== null && (typeof tariff !== 'number' || !Number.isFinite(tariff))) {
    throw new Section02ContractError(contract, '$.sku.current_sku_tariff_uzs');
  }
  return Object.freeze({
    found: true,
    sku: Object.freeze({
      sku_id: text(sku.sku_id, contract, '$.sku.sku_id'),
      sku_code: text(sku.sku_code, contract, '$.sku.sku_code'),
      sku_name: text(sku.sku_name, contract, '$.sku.sku_name'),
      sku_unit_name: optionalText(sku.sku_unit_name, contract, '$.sku.sku_unit_name') ?? null,
      current_sku_tariff_uzs: tariff as number | null,
      is_active: bool(sku.is_active, contract, '$.sku.is_active'),
      is_selectable_for_production: bool(sku.is_selectable_for_production, contract, '$.sku.is_selectable_for_production'),
      production_unavailability: productionUnavailability,
    }),
  });
}

export function decodeOperatorSkus(value: unknown): readonly OperatorSkuItem[] {
  const contract = 'skus';
  const source = record(value, contract);
  return Object.freeze(array(source.skus, contract, '$.skus').map((candidate, index) => {
    const row = record(candidate, contract, `$.skus[${index}]`);
    return Object.freeze({
      sku_id: text(row.sku_id, contract, `$.skus[${index}].sku_id`),
      sku_code: text(row.sku_code, contract, `$.skus[${index}].sku_code`),
      sku_name: text(row.sku_name, contract, `$.skus[${index}].sku_name`),
      unit_name: optionalText(row.unit_name ?? row.sku_unit_name, contract, `$.skus[${index}].unit_name`),
      current_sku_tariff_uzs: row.current_sku_tariff_uzs === undefined || row.current_sku_tariff_uzs === null
        ? row.current_sku_tariff_uzs
        : amount(row.current_sku_tariff_uzs, contract, `$.skus[${index}].current_sku_tariff_uzs`),
      is_active: optionalBool(row.is_active, contract, `$.skus[${index}].is_active`),
    });
  }));
}

export function decodeOperatorBreakTypes(value: unknown): readonly OperatorBreakTypeItem[] {
  const contract = 'break-types';
  const source = record(value, contract);
  return Object.freeze(array(source.break_types, contract, '$.break_types').map((candidate, index) => {
    const row = record(candidate, contract, `$.break_types[${index}]`);
    return Object.freeze({
      break_type_id: text(row.break_type_id, contract, `$.break_types[${index}].break_type_id`),
      display_name: text(row.display_name, contract, `$.break_types[${index}].display_name`),
      break_type_name: optionalText(row.break_type_name, contract, `$.break_types[${index}].break_type_name`),
      is_active: optionalBool(row.is_active, contract, `$.break_types[${index}].is_active`),
    });
  }));
}

export function decodeOperatorDowntimeTypes(value: unknown): OperatorAvailableDowntimeTypesResponse {
  const contract = 'downtime-types';
  const source = record(value, contract);
  const active = optionalText(source.active_production_operation_id, contract, '$.active_production_operation_id');
  if (active === undefined) throw new Section02ContractError(contract, '$.active_production_operation_id');
  const rows = array(source.available_downtime_types, contract, '$.available_downtime_types').map((candidate, index) => {
    const row = record(candidate, contract, `$.available_downtime_types[${index}]`);
    const downtimeClass = text(row.downtime_class, contract, `$.available_downtime_types[${index}].downtime_class`);
    const token = text(row.ui_color_token, contract, `$.available_downtime_types[${index}].ui_color_token`);
    if ((downtimeClass !== 'OPERATIONAL' && downtimeClass !== 'CRITICAL') || (token !== 'yellow' && token !== 'scarlet') || (downtimeClass === 'OPERATIONAL') !== (token === 'yellow')) {
      throw new Section02ContractError(contract, `$.available_downtime_types[${index}]`);
    }
    return Object.freeze({
      downtime_type_id: text(row.downtime_type_id, contract, `$.available_downtime_types[${index}].downtime_type_id`),
      display_name: text(row.display_name, contract, `$.available_downtime_types[${index}].display_name`),
      downtime_class: downtimeClass,
      ui_color_token: token,
      requires_production_operation: bool(row.requires_production_operation, contract, `$.available_downtime_types[${index}].requires_production_operation`),
      requires_comment: bool(row.requires_comment, contract, `$.available_downtime_types[${index}].requires_comment`),
    });
  });
  return Object.freeze({ active_production_operation_id: active, available_downtime_types: Object.freeze(rows) }) as OperatorAvailableDowntimeTypesResponse;
}

function decodeAdditionalWorkBase(row: RecordValue, contract: string, path: string) {
  return {
    additional_work_id: text(row.additional_work_id, contract, `${path}.additional_work_id`),
    additional_work_type_id: text(row.additional_work_type_id, contract, `${path}.additional_work_type_id`),
    display_name: text(row.display_name, contract, `${path}.display_name`),
  };
}

export function decodeOperatorAdditionalWorkState(value: unknown): OperatorAdditionalWorkStateResponse {
  const contract = 'additional-work-state';
  const source = record(value, contract);
  const decodeGroup = <T>(field: string, parse: (row: RecordValue, path: string) => T): readonly T[] => Object.freeze(
    array(source[field], contract, `$.${field}`).map((candidate, index) => parse(record(candidate, contract, `$.${field}[${index}]`), `$.${field}[${index}]`)),
  );
  const active = decodeGroup<ActiveAdditionalWorkItem>('active_additional_works', (row, path) => {
    if (row.ui_group !== 'ACTIVE' || row.ui_color_token !== 'green' || row.action !== 'FINISH_ADDITIONAL_WORK') throw new Section02ContractError(contract, path);
    return Object.freeze({ ...decodeAdditionalWorkBase(row, contract, path), ui_group: 'ACTIVE', ui_color_token: 'green', action: 'FINISH_ADDITIONAL_WORK' });
  });
  const approved = decodeGroup<ApprovedAdditionalWorkItem>('approved_additional_works', (row, path) => {
    if ((row.origin !== 'OPERATOR_REQUEST_APPROVED' && row.origin !== 'MANAGER_ASSIGNED') || row.ui_group !== 'APPROVED' || row.ui_color_token !== 'gray_green' || row.action !== 'START_ADDITIONAL_WORK') throw new Section02ContractError(contract, path);
    return Object.freeze({ ...decodeAdditionalWorkBase(row, contract, path), origin: row.origin, ui_group: 'APPROVED', ui_color_token: 'gray_green', action: 'START_ADDITIONAL_WORK' });
  });
  const pending = decodeGroup<PendingAdditionalWorkItem>('pending_approval_additional_works', (row, path) => {
    if (row.ui_group !== 'PENDING_APPROVAL' || row.ui_color_token !== 'white_gray_inactive' || row.action !== null) throw new Section02ContractError(contract, path);
    return Object.freeze({ ...decodeAdditionalWorkBase(row, contract, path), ui_group: 'PENDING_APPROVAL', ui_color_token: 'white_gray_inactive', action: null });
  });
  return Object.freeze({
    actor_employee_id: text(source.actor_employee_id, contract, '$.actor_employee_id'),
    active_additional_works: [...active],
    approved_additional_works: [...approved],
    pending_approval_additional_works: [...pending],
  });
}

export function decodeOperatorAdditionalWorkTypes(value: unknown): AdditionalWorkTypesAvailableResponse {
  const contract = 'additional-work-types';
  const source = record(value, contract);
  return Object.freeze({
    additional_work_types: array(source.additional_work_types, contract, '$.additional_work_types').map((candidate, index) => {
      const row = record(candidate, contract, `$.additional_work_types[${index}]`);
      return Object.freeze({
        additional_work_type_id: text(row.additional_work_type_id, contract, `$.additional_work_types[${index}].additional_work_type_id`),
        display_name: text(row.display_name, contract, `$.additional_work_types[${index}].display_name`),
      });
    }),
  });
}

export function decodeOperatorSalaryTotals(value: unknown): OperatorSalaryTotals {
  const contract = 'salary';
  const source = record(value, contract);
  const totals = source.totals === undefined ? source : record(source.totals, contract, '$.totals');
  return Object.freeze({
    today_uzs: amount(totals.today_uzs, contract, '$.totals.today_uzs'),
    week_uzs: amount(totals.week_uzs, contract, '$.totals.week_uzs'),
    month_uzs: amount(totals.month_uzs, contract, '$.totals.month_uzs'),
  });
}

export function decodeOperatorSalaryHistory(value: unknown): readonly OperatorSalaryHistoryMonth[] {
  const contract = 'salary-history';
  const source = Array.isArray(value) ? value : array(record(value, contract).months ?? record(value, contract).history, contract, '$.months');
  return Object.freeze(source.map((candidate, index) => {
    const row = record(candidate, contract, `$[${index}]`);
    return Object.freeze({
      month: text(row.month, contract, `$[${index}].month`),
      production_uzs: amount(row.production_uzs, contract, `$[${index}].production_uzs`),
      additional_work_uzs: amount(row.additional_work_uzs, contract, `$[${index}].additional_work_uzs`),
      corrections_uzs: nullableAmount(row.corrections_uzs, contract, `$[${index}].corrections_uzs`),
      reversals_uzs: nullableAmount(row.reversals_uzs, contract, `$[${index}].reversals_uzs`),
      total_uzs: amount(row.total_uzs, contract, `$[${index}].total_uzs`),
    });
  }));
}

export function decodeShiftMutationResult(value: unknown): Readonly<{ employee_shift_id: string }> {
  const source = record(value, 'shift-mutation');
  return Object.freeze({ employee_shift_id: text(source.employee_shift_id, 'shift-mutation', '$.employee_shift_id') });
}

export function decodeProductionMutationResult(value: unknown): Readonly<{ production_operation_id: string }> {
  const source = record(value, 'production-mutation');
  return Object.freeze({ production_operation_id: text(source.production_operation_id, 'production-mutation', '$.production_operation_id') });
}

export function decodeOperationMutationResult(value: unknown): Readonly<{ id: string }> {
  const source = record(value, 'operation-mutation');
  return Object.freeze({ id: text(source.id, 'operation-mutation', '$.id') });
}
