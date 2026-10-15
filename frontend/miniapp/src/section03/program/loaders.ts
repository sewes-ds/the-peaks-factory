import type { ApiClient } from '../../foundation/apiClient';
import {
  requestManagerAdditionalWorks,
  requestManagerAdditionalWorkTypes,
  requestManagerCriticalDowntimeTypes,
  requestManagerDowntimes,
  requestManagerEmployeeCard,
  requestManagerEmployeeCompletedWorkCard,
  requestManagerEmployeeCompletedWorks,
  requestManagerEmployees,
  requestManagerEmployeeSalary,
  requestManagerEmployeeSalaryHistory,
  requestManagerMachineCard,
  requestManagerMachineCompletedProductionOperations,
  requestManagerMachines,
  requestManagerNotifications,
  requestManagerSalaryCorrectionContext,
  requestManagerWorkplaceState,
} from '../api';
import { decodeSection03ReadModel, type Section03ReadRecord } from '../readModels';
import type {
  ManagerAdditionalWorksResponse,
  ManagerEmployeeCard,
  ManagerProductionCompletedOperationsResponse,
  ManagerSalaryCorrectionContextResponse,
  ManagerWorkplaceState,
} from '../contracts';
import type { Section03Context, Section03Period, Section03WorkType } from './context';
import type { Section03NodeId } from './ids';
import { SECTION03_NODE_REGISTRY, validateSection03NodeContext } from './registry';
import type { Section03LoaderKey } from './types';

export type Section03LoadedNodeData = Readonly<{
  loader: Section03LoaderKey | null;
  primary: Section03ReadRecord | null;
  supplemental: Section03ReadRecord | null;
  availableActions: readonly string[];
}>;

const loadedDataOwnership = new WeakSet<object>();

export const SECTION03_LOADER_ENDPOINTS = Object.freeze({
  main: '/manager/workplace-state',
  machines: '/manager/machines',
  'machine-card': '/manager/machines/:machine_id',
  downtimes: '/manager/downtimes',
  'critical-downtime-types': '/manager/downtime-types/critical',
  employees: '/manager/employees',
  'employee-card': '/manager/employees/:employee_id',
  'employee-completed-works': '/manager/employees/:employee_id/completed-works',
  'employee-completed-work-card': '/manager/employees/:employee_id/completed-works/:work_type/:operation_id',
  'production-completed-operations': '/manager/:scope/:id/completed-production-operations',
  'additional-works': '/manager/additional-works',
  'additional-work-types': '/manager/additional-work-types/available',
  'salary-correction-context': '/manager/salary-correction-context',
  'machine-completed-production-operations': '/manager/machines/:machine_id/completed-production-operations',
  'employee-salary': '/manager/employees/:employee_id/salary',
  'employee-salary-history': '/manager/employees/:employee_id/salary/history',
  notifications: '/manager/notifications/open-tasks',
} satisfies Readonly<Record<Section03LoaderKey, string>>);

function ownLoadedData(value: Section03LoadedNodeData): Section03LoadedNodeData {
  loadedDataOwnership.add(value);
  return value;
}

export function decodeSection03LoadedNodeData(value: unknown): Section03LoadedNodeData {
  if (typeof value !== 'object' || value === null || !loadedDataOwnership.has(value)) {
    throw new Error('Section 03 Graph source returned unowned loaded data.');
  }
  return value as Section03LoadedNodeData;
}

function required<TValue>(value: TValue | undefined, field: string): TValue {
  if (value === undefined) throw new Error(`Missing Section 03 loader context: ${field}.`);
  return value;
}

function collectAvailableActions(value: unknown, output: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectAvailableActions(item, output));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'available_actions' && Array.isArray(item)) {
      item.forEach((candidate) => {
        if (typeof candidate === 'string' && candidate.trim().length > 0) output.add(candidate);
      });
    } else {
      collectAvailableActions(item, output);
    }
  }
}

function loaded(
  loader: Section03LoaderKey | null,
  primary: Section03ReadRecord | null,
  supplemental: Section03ReadRecord | null,
  context: Section03Context,
): Section03LoadedNodeData {
  const actions = new Set<string>();
  if (loader === 'additional-works' && primary !== null) {
    const response = primary as unknown as ManagerAdditionalWorksResponse;
    response.available_actions.forEach((action) => actions.add(action));
    if (context.additional_work_id !== undefined) {
      const selected = Object.values(response.groups).flat().find(
        (item) => item.additional_work_id === context.additional_work_id,
      );
      selected?.available_actions.forEach((action) => actions.add(action));
    }
  } else {
    collectAvailableActions(primary, actions);
    collectAvailableActions(supplemental, actions);
  }
  if (loader === 'employee-card' && primary !== null) {
    const employee = (primary as unknown as ManagerEmployeeCard).employee;
    if (employee.blockers.production !== null) actions.add('FINISH_PRODUCTION');
    if (employee.blockers.break !== null) actions.add('FINISH_BREAK');
    if (employee.blockers.additional_work !== null) actions.add('FINISH_ADDITIONAL_WORK');
  }
  return ownLoadedData(Object.freeze({
    loader,
    primary,
    supplemental,
    availableActions: Object.freeze([...actions]),
  }));
}

async function loadPrimary(
  apiClient: ApiClient,
  loader: Section03LoaderKey,
  context: Section03Context,
): Promise<Section03ReadRecord> {
  const nonce = context.refresh_nonce;
  if (loader === 'main') return decodeSection03ReadModel(loader, await requestManagerWorkplaceState(apiClient, nonce));
  if (loader === 'machines') return decodeSection03ReadModel(loader, await requestManagerMachines(apiClient, nonce));
  if (loader === 'machine-card') return decodeSection03ReadModel(loader, await requestManagerMachineCard(apiClient, required(context.machine_id, 'machine_id'), nonce));
  if (loader === 'downtimes') return decodeSection03ReadModel(loader, await requestManagerDowntimes(apiClient, nonce));
  if (loader === 'critical-downtime-types') return decodeSection03ReadModel(loader, await requestManagerCriticalDowntimeTypes(apiClient));
  if (loader === 'employees') return decodeSection03ReadModel(loader, await requestManagerEmployees(apiClient, nonce));
  if (loader === 'employee-card') return decodeSection03ReadModel(loader, await requestManagerEmployeeCard(apiClient, required(context.employee_id, 'employee_id'), nonce));
  if (loader === 'employee-completed-works') {
    return decodeSection03ReadModel(loader, await requestManagerEmployeeCompletedWorks(apiClient, required(context.employee_id, 'employee_id'), required(context.period, 'period') as Section03Period, 'all'));
  }
  if (loader === 'employee-completed-work-card') {
    return decodeSection03ReadModel(loader, await requestManagerEmployeeCompletedWorkCard(apiClient, required(context.employee_id, 'employee_id'), required(context.work_type, 'work_type') as Section03WorkType, required(context.operation_id, 'operation_id')));
  }
  if (loader === 'production-completed-operations') {
    if (context.employee_id !== undefined) {
      return decodeSection03ReadModel(loader, await requestManagerEmployeeCompletedWorks(apiClient, context.employee_id, required(context.period, 'period') as Section03Period, 'production'));
    }
    return decodeSection03ReadModel(loader, await requestManagerMachineCompletedProductionOperations(apiClient, required(context.machine_id, 'machine_id'), required(context.period, 'period') as Section03Period));
  }
  if (loader === 'additional-works') return decodeSection03ReadModel(loader, await requestManagerAdditionalWorks(apiClient));
  if (loader === 'additional-work-types') return decodeSection03ReadModel(
    loader,
    await requestManagerAdditionalWorkTypes(
      apiClient,
      required(context.employee_id, 'employee_id'),
      context.additional_work_type_id,
    ),
  );
  if (loader === 'salary-correction-context') return decodeSection03ReadModel(loader, await requestManagerSalaryCorrectionContext(apiClient));
  if (loader === 'machine-completed-production-operations') {
    return decodeSection03ReadModel(loader, await requestManagerMachineCompletedProductionOperations(apiClient, required(context.machine_id, 'machine_id'), required(context.period, 'period') as Section03Period));
  }
  if (loader === 'employee-salary') return decodeSection03ReadModel(loader, await requestManagerEmployeeSalary(apiClient, required(context.employee_id, 'employee_id')));
  if (loader === 'employee-salary-history') return decodeSection03ReadModel(loader, await requestManagerEmployeeSalaryHistory(apiClient, required(context.employee_id, 'employee_id')));
  if (loader === 'notifications') return decodeSection03ReadModel(loader, await requestManagerNotifications(apiClient));
  const exhaustive: never = loader;
  throw new Error(`Unsupported Section 03 loader: ${exhaustive}`);
}

export async function loadSection03Node(
  apiClient: ApiClient,
  nodeId: Section03NodeId,
  context: Section03Context,
): Promise<Section03LoadedNodeData> {
  validateSection03NodeContext(nodeId, context);
  const loader = SECTION03_NODE_REGISTRY[nodeId].loader;
  if (loader === null) return loaded(loader, null, null, context);
  const primary = await loadPrimary(apiClient, loader, context);
  if (nodeId === 'S03-R13') {
    return ownLoadedData(Object.freeze({
      loader,
      primary,
      supplemental: null,
      availableActions: Object.freeze([]),
    }));
  }
  if (nodeId === 'S03-CP16') {
    const supplemental = decodeSection03ReadModel(
      'main',
      await requestManagerWorkplaceState(apiClient, context.refresh_nonce),
    );
    const operations = primary as unknown as ManagerProductionCompletedOperationsResponse;
    const workplace = supplemental as unknown as ManagerWorkplaceState;
    return ownLoadedData(Object.freeze({
      loader,
      primary,
      supplemental,
      availableActions: Object.freeze([
        ...operations.available_actions,
        ...(workplace.sections.corrections.available_actions.includes('OPEN_CORRECTIONS')
          ? ['OPEN_CORRECTIONS']
          : []),
      ]),
    }));
  }
  if (nodeId === 'S03-CF14') {
    const supplemental = decodeSection03ReadModel(
      'main',
      await requestManagerWorkplaceState(apiClient, context.refresh_nonce),
    );
    const correctionContext = primary as unknown as ManagerSalaryCorrectionContextResponse;
    const workplace = supplemental as unknown as ManagerWorkplaceState;
    const actions = Object.freeze([
      ...correctionContext.available_actions,
      ...(workplace.sections.corrections.available_actions.includes('OPEN_CORRECTIONS')
        ? ['OPEN_CORRECTIONS']
        : []),
    ]);
    return ownLoadedData(Object.freeze({
      loader,
      primary,
      supplemental,
      availableActions: actions,
    }));
  }
  if (nodeId === 'S03-CF25') {
    const supplemental = decodeSection03ReadModel(
      'main',
      await requestManagerWorkplaceState(apiClient, context.refresh_nonce),
    );
    const workplace = supplemental as unknown as ManagerWorkplaceState;
    const completedWork = primary as unknown as { readonly available_actions: readonly string[] };
    return ownLoadedData(Object.freeze({
      loader,
      primary,
      supplemental,
      availableActions: Object.freeze([
        ...completedWork.available_actions,
        ...(workplace.sections.corrections.available_actions.includes('OPEN_CORRECTIONS')
          ? ['OPEN_CORRECTIONS']
          : []),
      ]),
    }));
  }
  if (loader !== 'main') return loaded(loader, primary, null, context);
  try {
    const supplemental = decodeSection03ReadModel('notifications', await requestManagerNotifications(apiClient));
    return loaded(loader, primary, supplemental, context);
  } catch {
    return loaded(loader, primary, null, context);
  }
}
