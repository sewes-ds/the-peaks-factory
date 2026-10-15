import type { ApiClient } from '../foundation/apiClient';
import type { Section03Period, Section03WorkType } from './program/context';

export const SECTION03_TECHNICAL_TEXT = Object.freeze({
  shiftClose: 'Завершено начальником производства при завершении смены сотрудника',
  additionalWorkApprove: 'Согласовано начальником производства',
  additionalWorkReject: 'Отклонено начальником производства',
  additionalWorkCancel: 'Отменено начальником производства',
  additionalWorkFinish: 'Завершено начальником производства',
  downtimeFinish: 'Завершено начальником производства',
});

export const managerSection03Paths = Object.freeze({
  workplaceState: '/manager/workplace-state',
  machines: '/manager/machines',
  machineCard: (machineId: string) => `/manager/machines/${encodeURIComponent(machineId)}`,
  machineCompletedProductionOperations: (machineId: string, period: Section03Period) =>
    `/manager/machines/${encodeURIComponent(machineId)}/completed-production-operations?period=${encodeURIComponent(period)}`,
  downtimes: '/manager/downtimes',
  criticalDowntimeTypes: '/manager/downtime-types/critical',
  employees: '/manager/employees',
  employeeCard: (employeeId: string) => `/manager/employees/${encodeURIComponent(employeeId)}`,
  employeeSalary: (employeeId: string) => `/manager/employees/${encodeURIComponent(employeeId)}/salary`,
  employeeSalaryHistory: (employeeId: string) => `/manager/employees/${encodeURIComponent(employeeId)}/salary/history`,
  employeeCompletedWorks: (employeeId: string, period: Section03Period, type: 'all' | Section03WorkType = 'all') =>
    `/manager/employees/${encodeURIComponent(employeeId)}/completed-works?period=${encodeURIComponent(period)}&type=${encodeURIComponent(type)}`,
  employeeCompletedWorkCard: (employeeId: string, workType: Section03WorkType, operationId: string) =>
    `/manager/employees/${encodeURIComponent(employeeId)}/completed-works/${encodeURIComponent(workType)}/${encodeURIComponent(operationId)}`,
  additionalWorks: '/manager/additional-works',
  additionalWorkTypes: (employeeId: string, workTypeId?: string) => {
    const query = new URLSearchParams({ employee_id: employeeId });
    if (workTypeId !== undefined) query.set('additional_work_type_id', workTypeId);
    return `/manager/additional-work-types/available?${query.toString()}`;
  },
  notifications: '/manager/notifications/open-tasks',
  salaryCorrectionContext: '/manager/salary-correction-context',
  salaryCorrectionTypes: '/manager/salary-correction-types/available',
  exportGoogleSheets: '/exports/google-sheets',
  finishProduction: (operationId: string) => `/production-operations/${encodeURIComponent(operationId)}/finish`,
  finishBreak: (employeeId: string) => `/operator-breaks/${encodeURIComponent(employeeId)}/emergency-finish`,
  finishAdditionalWork: (workId: string) => `/additional-works/${encodeURIComponent(workId)}/finish`,
  closeShift: (employeeId: string) => `/shifts/${encodeURIComponent(employeeId)}/emergency-close`,
  finishDowntime: (downtimeId: string) => `/machine-downtimes/${encodeURIComponent(downtimeId)}/finish`,
  startDowntime: '/machine-downtimes/start',
  approveAdditionalWork: (workId: string) => `/additional-works/${encodeURIComponent(workId)}/approve-request`,
  rejectAdditionalWork: (workId: string) => `/additional-works/${encodeURIComponent(workId)}/reject-request`,
  cancelAdditionalWork: (workId: string) => `/additional-works/${encodeURIComponent(workId)}/cancel`,
  accrueAdditionalWork: (workId: string) => `/additional-works/${encodeURIComponent(workId)}/accrue-salary`,
  markAdditionalWorkWithoutAccrual: (workId: string) => `/additional-works/${encodeURIComponent(workId)}/mark-without-accrual`,
  assignAdditionalWork: '/additional-works/assign',
  createSalaryCorrection: '/salary-corrections',
  approveSalaryCorrection: (correctionId: string) => `/salary-corrections/${encodeURIComponent(correctionId)}/approve`,
  applySalaryCorrection: '/salary-corrections/apply',
  reverseSalaryEntry: (entryId: string) => `/salary-entries/${encodeURIComponent(entryId)}/reverse`,
  createProductionCorrection: '/production-operation-corrections',
  applyProductionCorrection: '/production-operation-corrections/apply',
});

function noCache(path: string, nonce: number): string {
  return `${path}${path.includes('?') ? '&' : '?'}_=${nonce}`;
}

function get(apiClient: ApiClient, path: string, cache: 'no-cache' | 'default', nonce = Date.now()): Promise<unknown> {
  return apiClient.request<unknown>(cache === 'no-cache' ? noCache(path, nonce) : path);
}

function post(apiClient: ApiClient, path: string, body?: unknown): Promise<unknown> {
  return apiClient.request<unknown>(path, { method: 'POST', ...(body === undefined ? {} : { body }) });
}

export function requestManagerWorkplaceState(apiClient: ApiClient, nonce?: number): Promise<unknown> {
  return get(apiClient, managerSection03Paths.workplaceState, 'no-cache', nonce);
}

export function requestManagerMachines(apiClient: ApiClient, nonce?: number): Promise<unknown> {
  return get(apiClient, managerSection03Paths.machines, 'no-cache', nonce);
}

export function requestManagerMachineCard(apiClient: ApiClient, machineId: string, nonce?: number): Promise<unknown> {
  return get(apiClient, managerSection03Paths.machineCard(machineId), 'no-cache', nonce);
}

export function requestManagerDowntimes(apiClient: ApiClient, nonce?: number): Promise<unknown> {
  return get(apiClient, managerSection03Paths.downtimes, 'no-cache', nonce);
}

export function requestManagerCriticalDowntimeTypes(apiClient: ApiClient): Promise<unknown> {
  return get(apiClient, managerSection03Paths.criticalDowntimeTypes, 'default');
}

export function requestManagerEmployees(apiClient: ApiClient, nonce?: number): Promise<unknown> {
  return get(apiClient, managerSection03Paths.employees, 'no-cache', nonce);
}

export function requestManagerEmployeeCard(apiClient: ApiClient, employeeId: string, nonce?: number): Promise<unknown> {
  return get(apiClient, managerSection03Paths.employeeCard(employeeId), 'no-cache', nonce);
}

export function requestManagerEmployeeSalary(apiClient: ApiClient, employeeId: string): Promise<unknown> {
  return get(apiClient, managerSection03Paths.employeeSalary(employeeId), 'default');
}

export function requestManagerEmployeeSalaryHistory(apiClient: ApiClient, employeeId: string): Promise<unknown> {
  return get(apiClient, managerSection03Paths.employeeSalaryHistory(employeeId), 'default');
}

export function requestManagerEmployeeCompletedWorks(apiClient: ApiClient, employeeId: string, period: Section03Period, type: 'all' | Section03WorkType = 'all'): Promise<unknown> {
  return get(apiClient, managerSection03Paths.employeeCompletedWorks(employeeId, period, type), 'default');
}

export function requestManagerEmployeeCompletedWorkCard(apiClient: ApiClient, employeeId: string, workType: Section03WorkType, operationId: string): Promise<unknown> {
  return get(apiClient, managerSection03Paths.employeeCompletedWorkCard(employeeId, workType, operationId), 'default');
}

export function requestManagerMachineCompletedProductionOperations(apiClient: ApiClient, machineId: string, period: Section03Period): Promise<unknown> {
  return get(apiClient, managerSection03Paths.machineCompletedProductionOperations(machineId, period), 'default');
}

export function requestManagerAdditionalWorks(apiClient: ApiClient): Promise<unknown> {
  return get(apiClient, managerSection03Paths.additionalWorks, 'default');
}

export function requestManagerAdditionalWorkTypes(
  apiClient: ApiClient,
  employeeId: string,
  workTypeId?: string,
): Promise<unknown> {
  return get(apiClient, managerSection03Paths.additionalWorkTypes(employeeId, workTypeId), 'no-cache');
}

export function requestManagerNotifications(apiClient: ApiClient): Promise<unknown> {
  return get(apiClient, managerSection03Paths.notifications, 'default');
}

export function requestManagerSalaryCorrectionContext(apiClient: ApiClient): Promise<unknown> {
  return get(apiClient, managerSection03Paths.salaryCorrectionContext, 'default');
}

export function requestManagerSalaryCorrectionTypes(apiClient: ApiClient): Promise<unknown> {
  return get(apiClient, managerSection03Paths.salaryCorrectionTypes, 'default');
}

export type FinishOperationalDowntimeRequestInput = Readonly<{ downtime_id: string; reason: string; comment?: string }>;

export function requestFinishOperationalDowntime(apiClient: ApiClient, input: FinishOperationalDowntimeRequestInput): Promise<unknown> {
  const comment = input.comment?.trim() || input.reason;
  return post(apiClient, managerSection03Paths.finishDowntime(input.downtime_id), { comment, reason: comment });
}

export function requestFinishProduction(apiClient: ApiClient, operationId: string, quantity: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.finishProduction(operationId), { quantity_produced: quantity, comment: SECTION03_TECHNICAL_TEXT.shiftClose });
}

export function requestFinishBreak(apiClient: ApiClient, employeeId: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.finishBreak(employeeId), { reason: SECTION03_TECHNICAL_TEXT.shiftClose });
}

export function requestFinishAdditionalWork(apiClient: ApiClient, workId: string, comment = SECTION03_TECHNICAL_TEXT.shiftClose): Promise<unknown> {
  return post(apiClient, managerSection03Paths.finishAdditionalWork(workId), { comment });
}

export function requestCloseShift(apiClient: ApiClient, employeeId: string, reason: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.closeShift(employeeId), { reason });
}

export function requestStartDowntime(apiClient: ApiClient, input: Readonly<{ machine_id: string; downtime_type_id: string; production_operation_id: string | null; comment: string }>): Promise<unknown> {
  return post(apiClient, managerSection03Paths.startDowntime, input);
}

export function requestApproveAdditionalWork(apiClient: ApiClient, workId: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.approveAdditionalWork(workId), { comment: SECTION03_TECHNICAL_TEXT.additionalWorkApprove });
}

export function requestRejectAdditionalWork(apiClient: ApiClient, workId: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.rejectAdditionalWork(workId), { reason: SECTION03_TECHNICAL_TEXT.additionalWorkReject });
}

export function requestCancelAdditionalWork(apiClient: ApiClient, workId: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.cancelAdditionalWork(workId), { reason: SECTION03_TECHNICAL_TEXT.additionalWorkCancel });
}

export function requestAccrueAdditionalWork(apiClient: ApiClient, workId: string, amount: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.accrueAdditionalWork(workId), { amount_uzs: amount, quantity: null });
}

export function requestMarkAdditionalWorkWithoutAccrual(apiClient: ApiClient, workId: string, reason: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.markAdditionalWorkWithoutAccrual(workId), { reason });
}

export function requestAssignAdditionalWork(apiClient: ApiClient, employeeId: string, workTypeId: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.assignAdditionalWork, { employee_id: employeeId, additional_work_type_id: workTypeId });
}

function responseId(value: unknown, keys: readonly string[]): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Mutation response must be an object.');
  const source = value as Readonly<Record<string, unknown>>;
  for (const key of keys) {
    const candidate = source[key];
    if ((typeof candidate === 'string' && candidate.trim()) || (typeof candidate === 'number' && Number.isFinite(candidate))) return String(candidate).trim();
  }
  throw new Error(`Mutation response lacks ${keys.join(' or ')}.`);
}

export async function requestCreateAndApproveSalaryCorrection(apiClient: ApiClient, input: Readonly<{ employee_id: string; employee_shift_id: string; salary_correction_type_id: string; amount: string; reason: string }>): Promise<unknown> {
  return post(apiClient, managerSection03Paths.applySalaryCorrection, input);
}

export function requestReverseSalaryEntry(apiClient: ApiClient, entryId: string, reason: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.reverseSalaryEntry(entryId), { reason });
}

export function requestCreateProductionCorrection(apiClient: ApiClient, input: Readonly<{ production_operation_id: string; old_quantity: string; new_quantity: string; reason: string }>): Promise<unknown> {
  return post(apiClient, managerSection03Paths.applyProductionCorrection, input);
}

export function requestCreateGoogleSheetsExport(apiClient: ApiClient, fromDate: string, toDate: string): Promise<unknown> {
  return post(apiClient, managerSection03Paths.exportGoogleSheets, { export_type: 'management_mvp_export', from_date: fromDate, to_date: toDate });
}

export function decodeMutationResultId(value: unknown): string {
  return responseId(value, ['id', 'operation_id', 'export_run_id', 'run_id']);
}
