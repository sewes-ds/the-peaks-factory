import type { ApiClient } from '../foundation/apiClient';
import { operatorReadModelPaths } from '../foundation/apiClient';
import type { MachineQrFlowResponse, SkuQrFlowResponse } from '../foundation/contracts';
import { scanAndResolveMachineQr, scanAndResolveSkuQr, telegramQrScanner, type TelegramQrScanner } from '../foundation/telegramQr';
import type { Section02Context } from './context';
import {
  decodeOperatorAdditionalWorkState,
  decodeOperatorAdditionalWorkTypes,
  decodeOperatorBreakTypes,
  decodeOperatorDowntimeTypes,
  decodeOperatorMachines,
  decodeOperatorMachineQr,
  decodeOperatorSkuQr,
  decodeOperatorSalaryHistory,
  decodeOperatorSalaryTotals,
  decodeOperatorSkus,
  decodeOperatorWorkplaceState,
  ADDITIONAL_WORK_START_BLOCKER_ORDER,
  type AdditionalWorkStartBlocker,
  type AdditionalWorkTypesAvailableResponse,
  type OperatorAdditionalWorkStateResponse,
  type OperatorAvailableDowntimeTypesResponse,
  type OperatorBreakTypeItem,
  type OperatorMachineItem,
  type OperatorSalaryHistoryMonth,
  type OperatorSalaryTotals,
  type OperatorSkuItem,
  type OperatorWorkplaceStateResponse,
} from './contracts';
import type { Section02NodeId } from './ids';
import { SECTION02_NODE_REGISTRY, type Section02LoaderKey, validateSection02NodeContext } from './topology';

export const SECTION02_LOADER_ENDPOINTS = Object.freeze({
  workplace: Object.freeze([operatorReadModelPaths.workplaceState]),
  machines: Object.freeze([operatorReadModelPaths.machines]),
  'machine-qr': Object.freeze([operatorReadModelPaths.machineQr]),
  'sku-qr': Object.freeze([operatorReadModelPaths.skuQr]),
  skus: Object.freeze([operatorReadModelPaths.skus]),
  'break-types': Object.freeze([operatorReadModelPaths.breakTypes]),
  'downtime-start': Object.freeze([operatorReadModelPaths.workplaceState, operatorReadModelPaths.downtimeTypesAvailable]),
  'additional-work': Object.freeze([operatorReadModelPaths.workplaceState, operatorReadModelPaths.additionalWorkState]),
  'additional-work-types': Object.freeze([operatorReadModelPaths.workplaceState, operatorReadModelPaths.additionalWorkTypesAvailable]),
  salary: Object.freeze([operatorReadModelPaths.salary]),
  'salary-history': Object.freeze([operatorReadModelPaths.salaryHistory]),
} as const satisfies Readonly<Record<Section02LoaderKey, readonly string[]>>);

export type Section02LoadedNodeData = Readonly<{
  loader: Section02LoaderKey | null;
  workplace: OperatorWorkplaceStateResponse | null;
  machines: readonly OperatorMachineItem[];
  machineQr: MachineQrFlowResponse | null;
  skuQr: SkuQrFlowResponse | null;
  skus: readonly OperatorSkuItem[];
  breakTypes: readonly OperatorBreakTypeItem[];
  downtimeTypes: OperatorAvailableDowntimeTypesResponse | null;
  additionalWork: OperatorAdditionalWorkStateResponse | null;
  additionalWorkTypes: AdditionalWorkTypesAvailableResponse | null;
  salaryTotals: OperatorSalaryTotals | null;
  salaryMonths: readonly OperatorSalaryHistoryMonth[];
  additionalWorkStartBlockers: readonly AdditionalWorkStartBlocker[];
  availableActions: readonly string[];
}>;

const owned = new WeakSet<object>();

function freezeData(input: Omit<Section02LoadedNodeData, 'availableActions'> & Readonly<{ availableActions: Iterable<string> }>): Section02LoadedNodeData {
  const value = Object.freeze({ ...input, availableActions: Object.freeze([...new Set(input.availableActions)]) });
  owned.add(value);
  return value;
}

export function decodeSection02LoadedNodeData(value: unknown): Section02LoadedNodeData {
  if (typeof value !== 'object' || value === null || !owned.has(value)) throw new Error('Section 02 source returned unowned data.');
  return value as Section02LoadedNodeData;
}

export function emptySection02LoadedData(): Section02LoadedNodeData {
  return freezeData({
    loader: null, workplace: null, machines: Object.freeze([]), machineQr: null, skuQr: null, skus: Object.freeze([]), breakTypes: Object.freeze([]),
    downtimeTypes: null, additionalWork: null, additionalWorkTypes: null, salaryTotals: null,
    salaryMonths: Object.freeze([]), availableActions: Object.freeze([]),
    additionalWorkStartBlockers: Object.freeze([]),
  });
}

function workplaceActions(workplace: OperatorWorkplaceStateResponse): string[] {
  const actions = [...(workplace.available_pipelines ?? [])];
  if (workplace.shift.is_active === false) actions.push('START_SHIFT');
  if (workplace.shift.is_active === true) actions.push('FINISH_SHIFT');
  if (workplace.production?.can_finish_production === true) actions.push('FINISH_PRODUCTION');
  if (workplace.break?.can_finish_break === true) actions.push('FINISH_BREAK');
  if (workplace.downtime?.can_finish_downtime === true) actions.push('FINISH_DOWNTIME');
  if (workplace.salary?.can_view_salary !== false) actions.push('VIEW_SALARY');
  if (workplace.shift.is_active === true && !workplace.break?.is_active) actions.push('START_BREAK');
  return actions;
}

async function read<T>(apiClient: ApiClient, path: string, decode: (value: unknown) => T): Promise<T> {
  return decode(await apiClient.request<unknown>(path));
}

export async function loadSection02Node(
  apiClient: ApiClient,
  nodeId: Section02NodeId,
  context: Section02Context,
  qrScanner: TelegramQrScanner = telegramQrScanner,
): Promise<Section02LoadedNodeData> {
  validateSection02NodeContext(nodeId, context);
  const loader = SECTION02_NODE_REGISTRY[nodeId].loader;
  if (loader === null) return emptySection02LoadedData();
  let workplace: OperatorWorkplaceStateResponse | null = null;
  let machines: readonly OperatorMachineItem[] = Object.freeze([]);
  let machineQr: MachineQrFlowResponse | null = null;
  let skuQr: SkuQrFlowResponse | null = null;
  let skus: readonly OperatorSkuItem[] = Object.freeze([]);
  let breakTypes: readonly OperatorBreakTypeItem[] = Object.freeze([]);
  let downtimeTypes: OperatorAvailableDowntimeTypesResponse | null = null;
  let additionalWork: OperatorAdditionalWorkStateResponse | null = null;
  let additionalWorkTypes: AdditionalWorkTypesAvailableResponse | null = null;
  let salaryTotals: OperatorSalaryTotals | null = null;
  let salaryMonths: readonly OperatorSalaryHistoryMonth[] = Object.freeze([]);
  let additionalWorkStartBlockers: AdditionalWorkStartBlocker[] = [];
  if (loader === 'workplace') workplace = await read(apiClient, operatorReadModelPaths.workplaceState, decodeOperatorWorkplaceState);
  if (loader === 'machines') machines = await read(apiClient, operatorReadModelPaths.machines, decodeOperatorMachines);
  if (loader === 'machine-qr') {
    machineQr = await scanAndResolveMachineQr(qrScanner, async (qrPayload) => decodeOperatorMachineQr(
      await apiClient.request<unknown>(operatorReadModelPaths.machineQr, {
        method: 'POST',
        body: { qr_payload: qrPayload },
      }),
    ));
  }
  if (loader === 'sku-qr') {
    skuQr = await scanAndResolveSkuQr(qrScanner, async (qrPayload) => decodeOperatorSkuQr(
      await apiClient.request<unknown>(operatorReadModelPaths.skuQr, {
        method: 'POST',
        body: { qr_payload: qrPayload },
      }),
    ));
  }
  if (loader === 'skus') skus = await read(apiClient, operatorReadModelPaths.skus, decodeOperatorSkus);
  if (loader === 'break-types') breakTypes = await read(apiClient, operatorReadModelPaths.breakTypes, decodeOperatorBreakTypes);
  if (loader === 'downtime-start') {
    [workplace, downtimeTypes] = await Promise.all([
      read(apiClient, operatorReadModelPaths.workplaceState, decodeOperatorWorkplaceState),
      read(apiClient, operatorReadModelPaths.downtimeTypesAvailable, decodeOperatorDowntimeTypes),
    ]);
  }
  if (loader === 'additional-work') {
    [workplace, additionalWork] = await Promise.all([
      read(apiClient, operatorReadModelPaths.workplaceState, decodeOperatorWorkplaceState),
      read(apiClient, operatorReadModelPaths.additionalWorkState, decodeOperatorAdditionalWorkState),
    ]);
  }
  if (loader === 'additional-work-types') {
    [workplace, additionalWorkTypes] = await Promise.all([
      read(apiClient, operatorReadModelPaths.workplaceState, decodeOperatorWorkplaceState),
      read(apiClient, operatorReadModelPaths.additionalWorkTypesAvailable, decodeOperatorAdditionalWorkTypes),
    ]);
  }
  if (loader === 'salary') salaryTotals = await read(apiClient, operatorReadModelPaths.salary, decodeOperatorSalaryTotals);
  if (loader === 'salary-history') salaryMonths = await read(apiClient, operatorReadModelPaths.salaryHistory, decodeOperatorSalaryHistory);
  let actions = workplace === null ? [] : workplaceActions(workplace);
  if (additionalWork !== null && context.additional_work_id !== undefined) {
    actions = actions.filter((action) => action !== 'START_ADDITIONAL_WORK');
    additionalWorkStartBlockers = [...(workplace?.additional_work_start?.blockers ?? [])];
    const active = additionalWork.active_additional_works
      .find((item) => item.additional_work_id === context.additional_work_id);
    const approved = additionalWork.approved_additional_works
      .find((item) => item.additional_work_id === context.additional_work_id);
    const pending = additionalWork.pending_approval_additional_works
      .find((item) => item.additional_work_id === context.additional_work_id);
    if (active !== undefined) {
      actions.push(active.action);
      if (nodeId === 'S02-AW03') {
        additionalWorkStartBlockers.push('SELECTED_WORK_NOT_STARTABLE');
      }
    } else if (approved !== undefined) {
      const pipelineAllowsStart = workplace?.available_pipelines?.includes('START_ADDITIONAL_WORK') === true;
      if (pipelineAllowsStart && additionalWorkStartBlockers.length === 0) actions.push(approved.action);
      else if (additionalWorkStartBlockers.length === 0) additionalWorkStartBlockers.push('SELECTED_WORK_NOT_STARTABLE');
    } else if (pending !== undefined) {
      additionalWorkStartBlockers.push('SELECTED_WORK_NOT_APPROVED');
    } else {
      additionalWorkStartBlockers.push('SELECTED_WORK_NOT_STARTABLE');
    }
  }
  if (additionalWorkTypes !== null && workplace?.available_pipelines?.includes('REQUEST_ADDITIONAL_WORK')) actions.push('REQUEST_ADDITIONAL_WORK');
  if (loader === 'skus' || (loader === 'sku-qr' && skuQr?.found === true && skuQr.sku.is_selectable_for_production)) actions.push('START_PRODUCTION');
  if (loader === 'break-types') actions.push('START_BREAK');
  if (loader === 'downtime-start') actions.push('START_OPERATIONAL_DOWNTIME', 'START_CRITICAL_DOWNTIME');
  const blockerSet = new Set(additionalWorkStartBlockers);
  additionalWorkStartBlockers = ADDITIONAL_WORK_START_BLOCKER_ORDER.filter((code) => blockerSet.has(code));
  return freezeData({ loader, workplace, machines, machineQr, skuQr, skus, breakTypes, downtimeTypes, additionalWork, additionalWorkTypes, salaryTotals, salaryMonths, additionalWorkStartBlockers: Object.freeze(additionalWorkStartBlockers), availableActions: actions });
}
