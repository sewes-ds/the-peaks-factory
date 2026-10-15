import { ApiClient, mutationPaths, operatorReadModelPaths } from '../foundation/apiClient';
import type {
  ActiveAdditionalWorkItem,
  AdditionalWorkTypesAvailableResponse,
  ApprovedAdditionalWorkItem,
  OperatorAdditionalWorkStateResponse,
  PendingAdditionalWorkItem
} from '../foundation/contracts';

export type {
  ActiveAdditionalWorkItem,
  AdditionalWorkTypesAvailableResponse,
  ApprovedAdditionalWorkItem,
  OperatorAdditionalWorkStateResponse,
  PendingAdditionalWorkItem
} from '../foundation/contracts';

export type OperatorWorkplaceStateResponse = {
  actor_employee_id?: string | null;
  actor_full_name?: string;
  available_pipelines?: string[];
  shift: {
    is_active: boolean;
    employee_shift_id?: string | null;
    started_at?: string | null;
  };
  production?: {
    is_active?: boolean;
    production_operation_id?: string | null;
    machine_id?: string | null;
    machine_name?: string | null;
    sku_id?: string | null;
    sku_code?: string | null;
    sku_name?: string | null;
    started_at?: string | null;
    can_finish_production?: boolean;
  };
  break?: {
    is_active?: boolean;
    operator_break_id?: string | null;
    break_type_id?: string | null;
    break_type_name?: string | null;
    can_finish_break?: boolean;
  };
  downtime?: {
    slot_state?: string | null;
    downtime_id?: string | null;
    downtime_type_name?: string | null;
    downtime_class?: string | null;
    ui_color_token?: string | null;
    can_start_downtime?: boolean;
    can_finish_downtime?: boolean;
  };
  additional_work_summary?: {
    has_active_additional_work?: boolean;
    active_additional_work_id?: string | null;
    active_additional_work_name?: string | null;
  };
  additional_work_start?: {
    blockers: AdditionalWorkStartBlocker[];
  };
  salary?: {
    can_view_salary?: boolean;
  };
  finish_shift?: {
    can_finish_now?: boolean;
    can_finish_shift?: boolean;
    blockers?: string[];
    blocking_reasons?: string[];
    warnings?: string[];
    warning_messages?: string[];
    next_required_pipeline?:
      | 'FINISH_DOWNTIME'
      | 'FINISH_BREAK'
      | 'FINISH_ADDITIONAL_WORK'
      | 'FINISH_PRODUCTION'
      | 'CONFIRM_FINISH_SHIFT'
      | 'CONFIRM_FINISH_SHIFT_WITH_WARNING'
      | null;
  };
};

export type AdditionalWorkStartBlocker =
  | 'NO_OPEN_SHIFT'
  | 'ACTIVE_PRODUCTION'
  | 'ACTIVE_BREAK'
  | 'OTHER_ADDITIONAL_WORK_RUNNING'
  | 'SELECTED_WORK_NOT_APPROVED'
  | 'SELECTED_WORK_NOT_STARTABLE';


export type OperatorSalaryTotals = {
  today_uzs: string;
  week_uzs: string;
  month_uzs: string;
};

export type OperatorSalaryHistoryMonth = {
  month: string;
  production_uzs: string;
  additional_work_uzs: string;
  corrections_uzs: string | null;
  reversals_uzs: string | null;
  total_uzs: string;
};

export type OperatorSalaryStateResponse = {
  totals: OperatorSalaryTotals;
  months: OperatorSalaryHistoryMonth[];
};

export type OperatorEntrypointScreenId = 'S02-N01' | 'S02-N02';

export type OperatorMachineItem = {
  machine_id: string;
  machine_name: string;
  qr_code_token?: string | null;
  machine_status_name?: string | null;
  machine_use_status_name?: string | null;
  is_selectable_for_production?: boolean;
  is_selectable_for_critical_downtime?: boolean;
};

export type OperatorCriticalDowntimeMachineItem = {
  machine_id: string;
  machine_name: string;
  is_selectable_for_critical_downtime: boolean;
};

export type OperatorDowntimeMachineReference = {
  machine_id: string;
  machine_name: string;
};

export type OperatorSkuItem = {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  unit_name?: string | null;
  current_sku_tariff_uzs?: string | number | null;
  is_active?: boolean;
};


export type OperatorBreakTypeItem = {
  break_type_id: string;
  display_name: string;
  break_type_name?: string | null;
  is_active?: boolean;
};

export type OperatorDowntimeClass = 'OPERATIONAL' | 'CRITICAL';

export type OperatorAvailableDowntimeTypeItem = {
  downtime_type_id: string;
  display_name: string;
  downtime_class: OperatorDowntimeClass;
  ui_color_token: 'yellow' | 'scarlet';
  requires_production_operation: boolean;
  requires_comment: boolean;
};

export type OperatorAvailableDowntimeTypesResponse = {
  active_production_operation_id: string | null;
  available_downtime_types: OperatorAvailableDowntimeTypeItem[];
};

export class OperatorReadModelContractError extends Error {
  constructor(
    readonly readModel:
      | 'available_downtime_types'
      | 'additional_work_state'
      | 'additional_work_types_available'
  ) {
    super(`Invalid ${readModel} response contract`);
    this.name = 'OperatorReadModelContractError';
  }
}

export function getOperatorWorkplaceState(apiClient: ApiClient): Promise<OperatorWorkplaceStateResponse> {
  return apiClient.request<OperatorWorkplaceStateResponse>(operatorReadModelPaths.workplaceState);
}

function isSalaryRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function salaryString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '0';
}

function nullableSalaryString(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readSalaryTotals(payload: unknown): OperatorSalaryTotals {
  const totals = isSalaryRecord(payload) && isSalaryRecord(payload.totals) ? payload.totals : payload;

  if (!isSalaryRecord(totals)) {
    return { today_uzs: '0', week_uzs: '0', month_uzs: '0' };
  }

  return {
    today_uzs: salaryString(totals.today_uzs),
    week_uzs: salaryString(totals.week_uzs),
    month_uzs: salaryString(totals.month_uzs)
  };
}

function readSalaryMonths(payload: unknown): OperatorSalaryHistoryMonth[] {
  const monthsPayload = Array.isArray(payload)
    ? payload
    : isSalaryRecord(payload) && Array.isArray(payload.months)
      ? payload.months
      : isSalaryRecord(payload) && Array.isArray(payload.history)
        ? payload.history
        : [];

  return monthsPayload.filter(isSalaryRecord).map((month) => ({
    month: typeof month.month === 'string' ? month.month : String(month.month ?? ''),
    production_uzs: salaryString(month.production_uzs),
    additional_work_uzs: salaryString(month.additional_work_uzs),
    corrections_uzs: nullableSalaryString(month.corrections_uzs),
    reversals_uzs: nullableSalaryString(month.reversals_uzs),
    total_uzs: salaryString(month.total_uzs)
  }));
}

export async function getOperatorSalaryState(apiClient: ApiClient): Promise<OperatorSalaryStateResponse> {
  const [totalsPayload, historyPayload] = await Promise.all([
    apiClient.request<unknown>(operatorReadModelPaths.salary),
    apiClient.request<unknown>(operatorReadModelPaths.salaryHistory)
  ]);

  return {
    totals: readSalaryTotals(totalsPayload),
    months: readSalaryMonths(historyPayload)
  };
}

export async function getOperatorMachines(apiClient: ApiClient): Promise<OperatorMachineItem[]> {
  const payload = await apiClient.request<unknown>(operatorReadModelPaths.machines);
  return extractArray(payload, ['machines', 'items', 'data']).map(toMachineItem).filter((item) => item.machine_id !== '');
}

export async function getOperatorCriticalDowntimeMachines(
  apiClient: ApiClient
): Promise<OperatorCriticalDowntimeMachineItem[]> {
  const payload = await apiClient.request<unknown>(operatorReadModelPaths.machines);
  if (!isRecord(payload) || !Array.isArray(payload.machines)) {
    return [];
  }

  return payload.machines.map(toCriticalDowntimeMachineItem).filter(isCriticalDowntimeMachineItem);
}

export async function getOperatorSkus(apiClient: ApiClient): Promise<OperatorSkuItem[]> {
  const payload = await apiClient.request<unknown>(operatorReadModelPaths.skus);
  return extractArray(payload, ['skus', 'items', 'data']).map(toSkuItem).filter((item) => item.sku_id !== '');
}


export async function getOperatorBreakTypes(apiClient: ApiClient): Promise<OperatorBreakTypeItem[]> {
  const payload = await apiClient.request<unknown>(operatorReadModelPaths.breakTypes);
  return extractArray(payload, ['break_types', 'items', 'data']).map(toBreakTypeItem).filter((item) => item.break_type_id !== '');
}

export async function getOperatorAvailableDowntimeTypes(
  apiClient: ApiClient
): Promise<OperatorAvailableDowntimeTypesResponse> {
  const payload = await apiClient.request<unknown>(operatorReadModelPaths.downtimeTypesAvailable);
  if (
    !isRecord(payload) ||
    !isNonemptyStringOrNull(payload.active_production_operation_id) ||
    !Array.isArray(payload.available_downtime_types)
  ) {
    throw new OperatorReadModelContractError('available_downtime_types');
  }

  const rows = payload.available_downtime_types.map(parseAvailableDowntimeType);
  if (rows.some((row) => row === null)) {
    throw new OperatorReadModelContractError('available_downtime_types');
  }

  return {
    active_production_operation_id: payload.active_production_operation_id,
    available_downtime_types: rows as OperatorAvailableDowntimeTypeItem[]
  };
}

export async function getOperatorAdditionalWorkState(
  apiClient: ApiClient
): Promise<OperatorAdditionalWorkStateResponse> {
  const payload = await apiClient.request<unknown>(operatorReadModelPaths.additionalWorkState);
  if (
    !isRecord(payload) ||
    !isNonemptyString(payload.actor_employee_id) ||
    !Array.isArray(payload.active_additional_works) ||
    !Array.isArray(payload.approved_additional_works) ||
    !Array.isArray(payload.pending_approval_additional_works)
  ) {
    throw new OperatorReadModelContractError('additional_work_state');
  }

  const activeAdditionalWorks = payload.active_additional_works.map(parseActiveAdditionalWork);
  const approvedAdditionalWorks = payload.approved_additional_works.map(parseApprovedAdditionalWork);
  const pendingApprovalAdditionalWorks =
    payload.pending_approval_additional_works.map(parsePendingAdditionalWork);

  if (
    activeAdditionalWorks.some((row) => row === null) ||
    approvedAdditionalWorks.some((row) => row === null) ||
    pendingApprovalAdditionalWorks.some((row) => row === null)
  ) {
    throw new OperatorReadModelContractError('additional_work_state');
  }

  return {
    actor_employee_id: payload.actor_employee_id,
    active_additional_works: activeAdditionalWorks as ActiveAdditionalWorkItem[],
    approved_additional_works: approvedAdditionalWorks as ApprovedAdditionalWorkItem[],
    pending_approval_additional_works: pendingApprovalAdditionalWorks as PendingAdditionalWorkItem[]
  };
}

export async function getOperatorAdditionalWorkTypesAvailable(
  apiClient: ApiClient
): Promise<AdditionalWorkTypesAvailableResponse> {
  const payload = await apiClient.request<unknown>(operatorReadModelPaths.additionalWorkTypesAvailable);
  if (!isRecord(payload) || !Array.isArray(payload.additional_work_types)) {
    throw new OperatorReadModelContractError('additional_work_types_available');
  }

  const additionalWorkTypes = payload.additional_work_types.map(parseAdditionalWorkType);
  if (additionalWorkTypes.some((row) => row === null)) {
    throw new OperatorReadModelContractError('additional_work_types_available');
  }

  return {
    additional_work_types: additionalWorkTypes as AdditionalWorkTypesAvailableResponse['additional_work_types']
  };
}

export function orderOperatorAvailableDowntimeTypes(
  downtimeTypes: readonly OperatorAvailableDowntimeTypeItem[]
): OperatorAvailableDowntimeTypeItem[] {
  const classOrder: Record<OperatorDowntimeClass, number> = {
    OPERATIONAL: 0,
    CRITICAL: 1
  };

  return downtimeTypes
    .map((downtimeType, originalIndex) => ({ downtimeType, originalIndex }))
    .sort(
      (left, right) =>
        classOrder[left.downtimeType.downtime_class] - classOrder[right.downtimeType.downtime_class] ||
        left.originalIndex - right.originalIndex
    )
    .map(({ downtimeType }) => downtimeType);
}

export function startOperatorShift(apiClient: ApiClient): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.startShift, {
    method: 'POST',
    body: {}
  });
}

export function finishOperatorShift(apiClient: ApiClient): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.finishShift, {
    method: 'POST',
    body: {}
  });
}


export function startOperatorBreak(apiClient: ApiClient, breakTypeId: string): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.startBreak, {
    method: 'POST',
    body: {
      break_type_id: breakTypeId
    }
  });
}

export function finishOperatorBreak(apiClient: ApiClient): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.finishBreak, {
    method: 'POST',
    body: {}
  });
}

export function startOperatorDowntime(
  apiClient: ApiClient,
  request: {
    machine_id: string;
    downtime_type_id: string;
    production_operation_id: string | null;
    comment: string | null;
  }
): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.startDowntime, {
    method: 'POST',
    body: request
  });
}

export function finishOperatorDowntime(apiClient: ApiClient, downtimeId: string): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.finishDowntime(downtimeId), {
    method: 'POST',
    body: {}
  });
}

export function requestOperatorAdditionalWork(
  apiClient: ApiClient,
  additionalWorkTypeId: string
): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.requestAdditionalWork, {
    method: 'POST',
    body: {
      additional_work_type_id: additionalWorkTypeId
    }
  });
}

export function startOperatorAdditionalWork(
  apiClient: ApiClient,
  additionalWorkId: string
): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.startAdditionalWork(additionalWorkId), {
    method: 'POST',
    body: {}
  });
}

export function finishOperatorAdditionalWork(
  apiClient: ApiClient,
  additionalWorkId: string
): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.finishAdditionalWork(additionalWorkId), {
    method: 'POST',
    body: {}
  });
}

export function startProductionOperation(apiClient: ApiClient, machineId: string, skuId: string): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.startProduction, {
    method: 'POST',
    body: {
      machine_id: machineId,
      sku_id: skuId
    }
  });
}

export function finishProductionOperation(
  apiClient: ApiClient,
  productionOperationId: string,
  quantityProduced: string
): Promise<unknown> {
  return apiClient.request<unknown>(mutationPaths.finishProduction(productionOperationId), {
    method: 'POST',
    body: {
      quantity_produced: quantityProduced
    }
  });
}

export function resolveOperatorEntrypointByWorkplaceState(
  workplaceState: OperatorWorkplaceStateResponse
): OperatorEntrypointScreenId {
  if (workplaceState.shift?.is_active === false) {
    return 'S02-N01';
  }

  if (workplaceState.shift?.is_active === true) {
    return 'S02-N02';
  }

  throw new Error('Unsupported operator workplace shift state');
}

function extractArray(payload: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

function toMachineItem(row: Record<string, unknown>): OperatorMachineItem {
  return {
    machine_id: toStringValue(row.machine_id ?? row.id),
    machine_name: toStringValue(row.machine_name ?? row.name ?? row.title),
    qr_code_token: toOptionalString(row.qr_code_token ?? row.qr_token),
    machine_status_name: toOptionalString(row.machine_status_name ?? row.status_name),
    machine_use_status_name: toOptionalString(row.machine_use_status_name ?? row.use_status_name),
    is_selectable_for_production: toOptionalBoolean(row.is_selectable_for_production ?? row.is_available_for_start),
    is_selectable_for_critical_downtime: toOptionalBoolean(row.is_selectable_for_critical_downtime)
  };
}

function toCriticalDowntimeMachineItem(row: unknown): OperatorCriticalDowntimeMachineItem | null {
  if (
    !isRecord(row) ||
    typeof row.machine_id !== 'string' ||
    row.machine_id === '' ||
    typeof row.machine_name !== 'string' ||
    row.machine_name === '' ||
    !isNullableString(row.workshop_name) ||
    !isNullableString(row.machine_status) ||
    !isNullableString(row.machine_use_status) ||
    typeof row.is_selectable_for_production !== 'boolean' ||
    typeof row.is_selectable_for_critical_downtime !== 'boolean' ||
    !isMachineUiStatusToken(row.ui_status_token)
  ) {
    return null;
  }

  return {
    machine_id: row.machine_id,
    machine_name: row.machine_name,
    is_selectable_for_critical_downtime: row.is_selectable_for_critical_downtime
  };
}

function parseAvailableDowntimeType(row: unknown): OperatorAvailableDowntimeTypeItem | null {
  if (
    !isRecord(row) ||
    !isNonemptyString(row.downtime_type_id) ||
    !isNonemptyString(row.display_name) ||
    (row.downtime_class !== 'OPERATIONAL' && row.downtime_class !== 'CRITICAL') ||
    (row.ui_color_token !== 'yellow' && row.ui_color_token !== 'scarlet') ||
    typeof row.requires_production_operation !== 'boolean' ||
    typeof row.requires_comment !== 'boolean' ||
    (row.downtime_class === 'OPERATIONAL' && row.ui_color_token !== 'yellow') ||
    (row.downtime_class === 'CRITICAL' && row.ui_color_token !== 'scarlet')
  ) {
    return null;
  }

  return {
    downtime_type_id: row.downtime_type_id,
    display_name: row.display_name,
    downtime_class: row.downtime_class,
    ui_color_token: row.ui_color_token,
    requires_production_operation: row.requires_production_operation,
    requires_comment: row.requires_comment
  };
}

function parseActiveAdditionalWork(row: unknown): ActiveAdditionalWorkItem | null {
  if (
    !hasBaseAdditionalWorkFields(row) ||
    row.ui_group !== 'ACTIVE' ||
    row.ui_color_token !== 'green' ||
    row.action !== 'FINISH_ADDITIONAL_WORK'
  ) {
    return null;
  }

  return {
    additional_work_id: row.additional_work_id,
    additional_work_type_id: row.additional_work_type_id,
    display_name: row.display_name,
    ui_group: row.ui_group,
    ui_color_token: row.ui_color_token,
    action: row.action
  };
}

function parseApprovedAdditionalWork(row: unknown): ApprovedAdditionalWorkItem | null {
  if (
    !hasBaseAdditionalWorkFields(row) ||
    (row.origin !== 'OPERATOR_REQUEST_APPROVED' && row.origin !== 'MANAGER_ASSIGNED') ||
    row.ui_group !== 'APPROVED' ||
    row.ui_color_token !== 'gray_green' ||
    row.action !== 'START_ADDITIONAL_WORK'
  ) {
    return null;
  }

  return {
    additional_work_id: row.additional_work_id,
    additional_work_type_id: row.additional_work_type_id,
    display_name: row.display_name,
    origin: row.origin,
    ui_group: row.ui_group,
    ui_color_token: row.ui_color_token,
    action: row.action
  };
}

function parsePendingAdditionalWork(row: unknown): PendingAdditionalWorkItem | null {
  if (
    !hasBaseAdditionalWorkFields(row) ||
    row.ui_group !== 'PENDING_APPROVAL' ||
    row.ui_color_token !== 'white_gray_inactive' ||
    row.action !== null
  ) {
    return null;
  }

  return {
    additional_work_id: row.additional_work_id,
    additional_work_type_id: row.additional_work_type_id,
    display_name: row.display_name,
    ui_group: row.ui_group,
    ui_color_token: row.ui_color_token,
    action: null
  };
}

function parseAdditionalWorkType(
  row: unknown
): AdditionalWorkTypesAvailableResponse['additional_work_types'][number] | null {
  if (
    !isRecord(row) ||
    !isNonemptyString(row.additional_work_type_id) ||
    !isNonemptyString(row.display_name)
  ) {
    return null;
  }

  return {
    additional_work_type_id: row.additional_work_type_id,
    display_name: row.display_name
  };
}

function hasBaseAdditionalWorkFields(
  row: unknown
): row is Record<string, unknown> & {
  additional_work_id: string;
  additional_work_type_id: string;
  display_name: string;
} {
  return (
    isRecord(row) &&
    isNonemptyString(row.additional_work_id) &&
    isNonemptyString(row.additional_work_type_id) &&
    isNonemptyString(row.display_name)
  );
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonemptyStringOrNull(value: unknown): value is string | null {
  return value === null || isNonemptyString(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isMachineUiStatusToken(value: unknown): value is 'normal' | 'busy' | 'critical' | 'unavailable' {
  return value === 'normal' || value === 'busy' || value === 'critical' || value === 'unavailable';
}

function isCriticalDowntimeMachineItem(
  item: OperatorCriticalDowntimeMachineItem | null
): item is OperatorCriticalDowntimeMachineItem {
  return item !== null;
}

function toSkuItem(row: Record<string, unknown>): OperatorSkuItem {
  return {
    sku_id: toStringValue(row.sku_id ?? row.id),
    sku_code: toStringValue(row.sku_code ?? row.code),
    sku_name: toStringValue(row.sku_name ?? row.name ?? row.title),
    unit_name: toOptionalString(row.unit_name ?? row.sku_unit_name),
    current_sku_tariff_uzs: toOptionalString(row.current_sku_tariff_uzs ?? row.tariff_uzs),
    is_active: toOptionalBoolean(row.is_active)
  };
}


function toBreakTypeItem(row: Record<string, unknown>): OperatorBreakTypeItem {
  const displayName = toStringValue(row.display_name ?? row.break_type_name ?? row.name ?? row.title);

  return {
    break_type_id: toStringValue(row.break_type_id ?? row.id),
    display_name: displayName,
    break_type_name: toOptionalString(row.break_type_name ?? row.name ?? row.title ?? row.display_name),
    is_active: toOptionalBoolean(row.is_active)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function toOptionalString(value: unknown): string | null {
  const stringValue = toStringValue(value);
  return stringValue === '' ? null : stringValue;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
}
