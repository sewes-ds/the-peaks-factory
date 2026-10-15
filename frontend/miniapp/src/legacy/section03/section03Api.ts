import type { ApiClient } from '../../foundation/apiClient';

export type S03Period = 'today' | 'week' | 'month' | 'last_30_days';
export type S03WorkType = 'production' | 'additional_work';
export type S03AnyRecord = Record<string, any>;

function noCachePath(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}_=${Date.now()}`;
}

export const SECTION03_API_PATHS = {
  workplaceState: '/manager/workplace-state',
  machines: '/manager/machines',
  machineCard: (machineId: string) => `/manager/machines/${encodeURIComponent(machineId)}`,
  machineCompletedProductionOperations: (machineId: string, period: S03Period) =>
    `/manager/machines/${encodeURIComponent(machineId)}/completed-production-operations?period=${encodeURIComponent(period)}`,
  downtimes: '/manager/downtimes',
  downtimeTypesCritical: '/manager/downtime-types/critical',
  employees: '/manager/employees',
  employeeCard: (employeeId: string) => `/manager/employees/${encodeURIComponent(employeeId)}`,
  employeeSalary: (employeeId: string) => `/manager/employees/${encodeURIComponent(employeeId)}/salary`,
  employeeSalaryHistory: (employeeId: string) => `/manager/employees/${encodeURIComponent(employeeId)}/salary/history`,
  employeeCompletedWorks: (employeeId: string, period: S03Period, type: 'all' | S03WorkType = 'all') =>
    `/manager/employees/${encodeURIComponent(employeeId)}/completed-works?period=${encodeURIComponent(period)}&type=${encodeURIComponent(type)}`,
  employeeCompletedWorkCard: (employeeId: string, workType: S03WorkType, operationId: string) =>
    `/manager/employees/${encodeURIComponent(employeeId)}/completed-works/${encodeURIComponent(workType)}/${encodeURIComponent(operationId)}`,
  additionalWorks: '/manager/additional-works',
  additionalWorkTypesAvailable: '/manager/additional-work-types/available',
  notificationsOpenTasks: '/manager/notifications/open-tasks',
  salaryCorrectionContext: '/manager/salary-correction-context',
  salaryCorrectionTypesAvailable: '/manager/salary-correction-types/available',
  exportGoogleSheets: '/exports/google-sheets'
} as const;

export const SECTION03_MUTATION_PATHS = {
  finishProduction: (productionOperationId: string) => `/production-operations/${encodeURIComponent(productionOperationId)}/finish`,
  emergencyFinishBreak: (targetEmployeeId: string) => `/operator-breaks/${encodeURIComponent(targetEmployeeId)}/emergency-finish`,
  finishAdditionalWork: (additionalWorkId: string) => `/additional-works/${encodeURIComponent(additionalWorkId)}/finish`,
  emergencyCloseShift: (targetEmployeeId: string) => `/shifts/${encodeURIComponent(targetEmployeeId)}/emergency-close`,
  finishDowntime: (downtimeId: string) => `/machine-downtimes/${encodeURIComponent(downtimeId)}/finish`,
  startDowntime: '/machine-downtimes/start',
  approveAdditionalWorkRequest: (additionalWorkId: string) => `/additional-works/${encodeURIComponent(additionalWorkId)}/approve-request`,
  rejectAdditionalWorkRequest: (additionalWorkId: string) => `/additional-works/${encodeURIComponent(additionalWorkId)}/reject-request`,
  cancelAdditionalWork: (additionalWorkId: string) => `/additional-works/${encodeURIComponent(additionalWorkId)}/cancel`,
  accrueAdditionalWorkSalary: (additionalWorkId: string) => `/additional-works/${encodeURIComponent(additionalWorkId)}/accrue-salary`,
  markAdditionalWorkWithoutAccrual: (additionalWorkId: string) =>
    `/additional-works/${encodeURIComponent(additionalWorkId)}/mark-without-accrual`,
  assignAdditionalWork: '/additional-works/assign',
  createSalaryCorrection: '/salary-corrections',
  approveSalaryCorrection: (salaryCorrectionId: string) => `/salary-corrections/${encodeURIComponent(salaryCorrectionId)}/approve`,
  reverseSalaryEntry: (salaryEntryId: string) => `/salary-entries/${encodeURIComponent(salaryEntryId)}/reverse`,
  createProductionOperationCorrection: '/production-operation-corrections'
} as const;

export const TECHNICAL_MANAGER_SHIFT_CLOSE_REASON = 'Завершено начальником производства при завершении смены сотрудника';
export const TECHNICAL_AW_APPROVE_COMMENT = 'Согласовано начальником производства';
export const TECHNICAL_AW_REJECT_REASON = 'Отклонено начальником производства';
export const TECHNICAL_AW_CANCEL_REASON = 'Отменено начальником производства';
export const TECHNICAL_AW_FINISH_COMMENT = 'Завершено начальником производства';
export const TECHNICAL_MANAGER_DOWNTIME_FINISH_COMMENT = 'Завершено начальником производства';

export function getManagerWorkplaceState(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(noCachePath(SECTION03_API_PATHS.workplaceState));
}

export function getManagerMachines(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(noCachePath(SECTION03_API_PATHS.machines));
}

export function getManagerMachineCard(apiClient: ApiClient, machineId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(noCachePath(SECTION03_API_PATHS.machineCard(machineId)));
}

export function getManagerDowntimes(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(noCachePath(SECTION03_API_PATHS.downtimes));
}

export function getManagerCriticalDowntimeTypes(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.downtimeTypesCritical);
}

export function getManagerEmployees(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(noCachePath(SECTION03_API_PATHS.employees));
}

export function getManagerEmployeeCard(apiClient: ApiClient, employeeId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(noCachePath(SECTION03_API_PATHS.employeeCard(employeeId)));
}

export function getManagerEmployeeSalary(apiClient: ApiClient, employeeId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.employeeSalary(employeeId));
}

export function getManagerEmployeeSalaryHistory(apiClient: ApiClient, employeeId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.employeeSalaryHistory(employeeId));
}

export function getManagerAdditionalWorks(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.additionalWorks);
}

export function getManagerAdditionalWorkTypesAvailable(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.additionalWorkTypesAvailable);
}

export function getManagerNotificationsOpenTasks(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.notificationsOpenTasks);
}

export function getManagerSalaryCorrectionContext(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.salaryCorrectionContext);
}

export function getManagerSalaryCorrectionTypesAvailable(apiClient: ApiClient): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.salaryCorrectionTypesAvailable);
}

export function getManagerEmployeeCompletedWorks(
  apiClient: ApiClient,
  employeeId: string,
  period: S03Period,
  type: 'all' | S03WorkType = 'all'
): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.employeeCompletedWorks(employeeId, period, type));
}

export function getManagerEmployeeCompletedWorkCard(
  apiClient: ApiClient,
  employeeId: string,
  workType: S03WorkType,
  operationId: string
): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.employeeCompletedWorkCard(employeeId, workType, operationId));
}

export function getManagerMachineCompletedProductionOperations(
  apiClient: ApiClient,
  machineId: string,
  period: S03Period
): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.machineCompletedProductionOperations(machineId, period));
}

export function finishManagerProductionBlocker(apiClient: ApiClient, productionOperationId: string, quantityProduced: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.finishProduction(productionOperationId), {
    method: 'POST',
    body: {
      quantity_produced: quantityProduced,
      comment: TECHNICAL_MANAGER_SHIFT_CLOSE_REASON
    }
  });
}

export function finishManagerBreakBlocker(apiClient: ApiClient, targetEmployeeId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.emergencyFinishBreak(targetEmployeeId), {
    method: 'POST',
    body: { reason: TECHNICAL_MANAGER_SHIFT_CLOSE_REASON }
  });
}

export function finishManagerAdditionalWork(apiClient: ApiClient, additionalWorkId: string, comment = TECHNICAL_MANAGER_SHIFT_CLOSE_REASON): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.finishAdditionalWork(additionalWorkId), {
    method: 'POST',
    body: { comment }
  });
}

export function closeEmployeeShiftByManager(apiClient: ApiClient, targetEmployeeId: string, reason: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.emergencyCloseShift(targetEmployeeId), {
    method: 'POST',
    body: { reason }
  });
}

export function finishMachineDowntime(apiClient: ApiClient, downtimeId: string, comment?: string | null): Promise<S03AnyRecord> {
  const normalizedComment = typeof comment === 'string' ? comment.trim() : '';
  const finishComment = normalizedComment.length > 0 ? normalizedComment : TECHNICAL_MANAGER_DOWNTIME_FINISH_COMMENT;

  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.finishDowntime(downtimeId), {
    method: 'POST',
    body: { comment: finishComment, reason: finishComment }
  });
}

export function startManagerCriticalDowntime(
  apiClient: ApiClient,
  machineId: string,
  downtimeTypeId: string,
  productionOperationId: string | null,
  comment: string
): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.startDowntime, {
    method: 'POST',
    body: {
      machine_id: machineId,
      downtime_type_id: downtimeTypeId,
      production_operation_id: productionOperationId,
      comment
    }
  });
}

export function approveAdditionalWorkRequest(apiClient: ApiClient, additionalWorkId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.approveAdditionalWorkRequest(additionalWorkId), {
    method: 'POST',
    body: { comment: TECHNICAL_AW_APPROVE_COMMENT }
  });
}

export function rejectAdditionalWorkRequest(apiClient: ApiClient, additionalWorkId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.rejectAdditionalWorkRequest(additionalWorkId), {
    method: 'POST',
    body: { reason: TECHNICAL_AW_REJECT_REASON }
  });
}

export function cancelAdditionalWork(apiClient: ApiClient, additionalWorkId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.cancelAdditionalWork(additionalWorkId), {
    method: 'POST',
    body: { reason: TECHNICAL_AW_CANCEL_REASON }
  });
}

export function accrueAdditionalWorkSalary(apiClient: ApiClient, additionalWorkId: string, amountUzs: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.accrueAdditionalWorkSalary(additionalWorkId), {
    method: 'POST',
    body: { amount_uzs: amountUzs, quantity: null }
  });
}

export function markAdditionalWorkWithoutAccrual(apiClient: ApiClient, additionalWorkId: string, reason: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.markAdditionalWorkWithoutAccrual(additionalWorkId), {
    method: 'POST',
    body: { reason }
  });
}

export function assignAdditionalWork(apiClient: ApiClient, employeeId: string, additionalWorkTypeId: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.assignAdditionalWork, {
    method: 'POST',
    body: { employee_id: employeeId, additional_work_type_id: additionalWorkTypeId }
  });
}

export async function createAndApproveSalaryCorrection(
  apiClient: ApiClient,
  body: {
    employee_id: string;
    employee_shift_id: string;
    salary_correction_type_id: string;
    amount: string;
    reason: string;
  }
): Promise<S03AnyRecord> {
  const created = await apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.createSalaryCorrection, {
    method: 'POST',
    body
  });
  const correctionId = String(created.salary_correction_id ?? created.id ?? created.correction_id ?? '');
  if (!correctionId) {
    throw new Error('salary_correction_id is missing in POST /salary-corrections response');
  }
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.approveSalaryCorrection(correctionId), {
    method: 'POST'
  });
}

export function reverseSalaryEntry(apiClient: ApiClient, salaryEntryId: string, reason: string): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.reverseSalaryEntry(salaryEntryId), {
    method: 'POST',
    body: { reason }
  });
}

export function createProductionOperationCorrection(
  apiClient: ApiClient,
  body: {
    production_operation_id: string;
    old_quantity: string;
    new_quantity: string;
    reason: string;
  }
): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_MUTATION_PATHS.createProductionOperationCorrection, {
    method: 'POST',
    body
  });
}

export function createGoogleSheetsExport(
  apiClient: ApiClient,
  fromDate: string,
  toDate: string
): Promise<S03AnyRecord> {
  return apiClient.request<S03AnyRecord>(SECTION03_API_PATHS.exportGoogleSheets, {
    method: 'POST',
    body: {
      export_type: 'management_mvp_export',
      from_date: fromDate,
      to_date: toDate
    }
  });
}
