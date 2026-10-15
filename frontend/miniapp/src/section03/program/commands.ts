import type { ApiClient } from '../../foundation/apiClient';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
} from '../../foundation/graphProtocol/command';
import {
  SECTION03_TECHNICAL_TEXT,
  decodeMutationResultId,
  requestAccrueAdditionalWork,
  requestApproveAdditionalWork,
  requestAssignAdditionalWork,
  requestCancelAdditionalWork,
  requestCloseShift,
  requestCreateAndApproveSalaryCorrection,
  requestCreateGoogleSheetsExport,
  requestCreateProductionCorrection,
  requestFinishAdditionalWork,
  requestFinishBreak,
  requestFinishOperationalDowntime,
  requestFinishProduction,
  requestManagerEmployeeCard,
  requestManagerAdditionalWorks,
  requestManagerAdditionalWorkTypes,
  requestManagerEmployees,
  requestMarkAdditionalWorkWithoutAccrual,
  requestRejectAdditionalWork,
  requestReverseSalaryEntry,
  requestStartDowntime,
} from '../api';
import { createSection03GraphContextSchema, type Section03Context } from './context';
import type { Section03BusinessActionId } from './business';
import {
  decodeManagerEmployeeCardResponse,
  decodeOperationIdResponse,
  decodeSection03ExportRunResponse,
} from '../contracts';
import { resolveSection03ExplicitReportRange } from './reportDates';

export type Section03CommandOutcome = 'PRIMARY' | 'SECONDARY' | 'TERTIARY';

function required(input: Section03Context, field: keyof Section03Context): string {
  const value = input[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Section 03 business action requires ${field}.`);
  }
  return value.trim();
}

export function section03EmployeeBlockersRemain(value: unknown): boolean {
  const blockers = decodeManagerEmployeeCardResponse(value).employee.blockers;
  return blockers.production !== null ||
    blockers.break !== null ||
    blockers.additional_work !== null;
}

async function execute(
  apiClient: ApiClient,
  actionId: Section03BusinessActionId,
  input: Section03Context,
): Promise<Readonly<{
  outcome: Section03CommandOutcome;
  entities: Readonly<{ result_id?: string; export_run_id?: string }>;
}>> {
  let raw: unknown;
  let outcome: Section03CommandOutcome = 'PRIMARY';
  if (actionId === 'FINISH_DOWNTIME') {
    const downtimeId = required(input, 'downtime_id');
    const comment = input.comment_finish === undefined
      ? SECTION03_TECHNICAL_TEXT.downtimeFinish
      : required(input, 'comment_finish');
    raw = await requestFinishOperationalDowntime(apiClient, {
      downtime_id: downtimeId,
      reason: comment,
      comment,
    });
    decodeOperationIdResponse(raw, downtimeId);
    outcome = input.downtime_follow_up === 'start_critical_downtime'
      ? 'PRIMARY'
      : 'TERTIARY';
  } else if (actionId === 'START_CRITICAL_DOWNTIME') {
    raw = await requestStartDowntime(apiClient, {
      machine_id: required(input, 'machine_id'),
      downtime_type_id: required(input, 'downtime_type_id'),
      production_operation_id: input.production_operation_id ?? null,
      comment: required(input, 'comment_start'),
    });
    outcome = 'PRIMARY';
  } else if (actionId === 'CLOSE_EMPLOYEE_SHIFT') {
    raw = await requestCloseShift(apiClient, required(input, 'employee_id'), required(input, 'shift_finish_reason'));
  } else if (actionId === 'FINISH_PRODUCTION_BLOCKER') {
    raw = await requestFinishProduction(apiClient, required(input, 'production_operation_id'), required(input, 'quantity_produced'));
    outcome = section03EmployeeBlockersRemain(await requestManagerEmployeeCard(apiClient, required(input, 'employee_id'))) ? 'PRIMARY' : 'SECONDARY';
  } else if (actionId === 'FINISH_BREAK_BLOCKER') {
    raw = await requestFinishBreak(apiClient, required(input, 'employee_id'));
    outcome = section03EmployeeBlockersRemain(await requestManagerEmployeeCard(apiClient, required(input, 'employee_id'))) ? 'PRIMARY' : 'SECONDARY';
  } else if (actionId === 'FINISH_ADDITIONAL_WORK') {
    const finishAdditionalWork = requestFinishAdditionalWork as (
      client: ApiClient,
      workId: string,
      comment: string,
    ) => Promise<unknown>;
    raw = await finishAdditionalWork(
      apiClient,
      required(input, 'additional_work_id'),
      input.employee_id === undefined
        ? SECTION03_TECHNICAL_TEXT.additionalWorkFinish
        : SECTION03_TECHNICAL_TEXT.shiftClose,
    );
    if (input.employee_id !== undefined) {
      outcome = section03EmployeeBlockersRemain(await requestManagerEmployeeCard(apiClient, input.employee_id)) ? 'PRIMARY' : 'SECONDARY';
    }
  } else if (actionId === 'APPROVE_ADDITIONAL_WORK') {
    raw = await requestApproveAdditionalWork(apiClient, required(input, 'additional_work_id'));
  } else if (actionId === 'REJECT_ADDITIONAL_WORK') {
    raw = await requestRejectAdditionalWork(apiClient, required(input, 'additional_work_id'));
  } else if (actionId === 'CANCEL_ADDITIONAL_WORK') {
    raw = await requestCancelAdditionalWork(apiClient, required(input, 'additional_work_id'));
  } else if (actionId === 'ASSIGN_ADDITIONAL_WORK') {
    try {
      raw = await requestAssignAdditionalWork(apiClient, required(input, 'employee_id'), required(input, 'additional_work_type_id'));
    } catch (error: unknown) {
      // A rejected assignment can mean that any prerequisite source became stale.
      // Refresh all three backend-owned sources before preserving the original error.
      await Promise.allSettled([
        requestManagerAdditionalWorks(apiClient),
        requestManagerEmployees(apiClient),
        requestManagerAdditionalWorkTypes(
          apiClient,
          required(input, 'employee_id'),
          required(input, 'additional_work_type_id'),
        ),
      ]);
      throw error;
    }
  } else if (actionId === 'ACCRUE_ADDITIONAL_WORK') {
    raw = await requestAccrueAdditionalWork(apiClient, required(input, 'additional_work_id'), required(input, 'amount_uzs'));
  } else if (actionId === 'MARK_WITHOUT_ACCRUAL') {
    raw = await requestMarkAdditionalWorkWithoutAccrual(apiClient, required(input, 'additional_work_id'), required(input, 'without_accrual_reason'));
  } else if (actionId === 'CREATE_APPROVE_SALARY_CORRECTION') {
    raw = await requestCreateAndApproveSalaryCorrection(apiClient, {
      employee_id: required(input, 'employee_id'),
      employee_shift_id: required(input, 'employee_shift_id'),
      salary_correction_type_id: required(input, 'salary_correction_type_id'),
      amount: required(input, 'amount_uzs'),
      reason: required(input, 'financial_correction_reason'),
    });
    decodeMutationResultId(raw);
  } else if (actionId === 'REVERSE_SALARY_ENTRY') {
    raw = await requestReverseSalaryEntry(apiClient, required(input, 'salary_entry_id'), required(input, 'reversal_reason'));
  } else if (actionId === 'CREATE_PRODUCTION_CORRECTION') {
    raw = await requestCreateProductionCorrection(apiClient, {
      production_operation_id: required(input, 'production_operation_id'),
      old_quantity: required(input, 'quantity_produced'),
      new_quantity: required(input, 'correction_quantity'),
      reason: required(input, 'production_correction_reason'),
    });
    decodeMutationResultId(raw);
  } else if (actionId === 'CREATE_GOOGLE_SHEETS_EXPORT') {
    if (input.from_date === undefined || input.to_date === undefined) {
      throw new Error('Section 03 export action requires explicit from_date and to_date.');
    }
    const range = resolveSection03ExplicitReportRange(input.from_date, input.to_date);
    raw = await requestCreateGoogleSheetsExport(apiClient, range.from_date, range.to_date);
    const response = decodeSection03ExportRunResponse(raw);
    return Object.freeze({
      outcome,
      entities: Object.freeze({ export_run_id: response.export_run_id }),
    });
  } else {
    const exhaustive: never = actionId;
    throw new Error(`Unsupported Section 03 business action ${exhaustive}.`);
  }
  void raw;
  return Object.freeze({ outcome, entities: Object.freeze({}) });
}

const commandEndpoints: Readonly<Record<Section03BusinessActionId, string>> = Object.freeze({
  FINISH_DOWNTIME: '/machine-downtimes/:downtime_id/finish',
  START_CRITICAL_DOWNTIME: '/machine-downtimes/start',
  CLOSE_EMPLOYEE_SHIFT: '/shifts/:employee_id/emergency-close',
  FINISH_PRODUCTION_BLOCKER: '/production-operations/:production_operation_id/finish',
  FINISH_BREAK_BLOCKER: '/operator-breaks/:employee_id/emergency-finish',
  FINISH_ADDITIONAL_WORK: '/additional-works/:additional_work_id/finish',
  APPROVE_ADDITIONAL_WORK: '/additional-works/:additional_work_id/approve-request',
  REJECT_ADDITIONAL_WORK: '/additional-works/:additional_work_id/reject-request',
  CANCEL_ADDITIONAL_WORK: '/additional-works/:additional_work_id/cancel',
  ASSIGN_ADDITIONAL_WORK: '/additional-works/assign',
  ACCRUE_ADDITIONAL_WORK: '/additional-works/:additional_work_id/accrue-salary',
  MARK_WITHOUT_ACCRUAL: '/additional-works/:additional_work_id/mark-without-accrual',
  CREATE_APPROVE_SALARY_CORRECTION: '/salary-corrections/apply',
  REVERSE_SALARY_ENTRY: '/salary-entries/:salary_entry_id/reverse',
  CREATE_PRODUCTION_CORRECTION: '/production-operation-corrections/apply',
  CREATE_GOOGLE_SHEETS_EXPORT: '/exports/google-sheets',
});

function createCommand(apiClient: ApiClient, actionId: Section03BusinessActionId) {
  const inputSchema = defineGraphCommandInput(createSection03GraphContextSchema());
  return graphCommandFor(inputSchema).define({
    command: actionId,
    method: 'POST',
    endpoint: commandEndpoints[actionId],
    outcomes: ['PRIMARY', 'SECONDARY', 'TERTIARY'],
    entities: defineGraphCommandEntities({
      result_id: graphCommandEntity.optionalId(),
      export_run_id: graphCommandEntity.optionalId(),
    }),
    request: async (input) => Object.freeze({
      command: actionId,
      ...(await execute(apiClient, actionId, input)),
    }),
  });
}

export function createSection03BusinessCommands(apiClient: ApiClient) {
  return Object.freeze({
    FINISH_DOWNTIME: createCommand(apiClient, 'FINISH_DOWNTIME'),
    START_CRITICAL_DOWNTIME: createCommand(apiClient, 'START_CRITICAL_DOWNTIME'),
    CLOSE_EMPLOYEE_SHIFT: createCommand(apiClient, 'CLOSE_EMPLOYEE_SHIFT'),
    FINISH_PRODUCTION_BLOCKER: createCommand(apiClient, 'FINISH_PRODUCTION_BLOCKER'),
    FINISH_BREAK_BLOCKER: createCommand(apiClient, 'FINISH_BREAK_BLOCKER'),
    FINISH_ADDITIONAL_WORK: createCommand(apiClient, 'FINISH_ADDITIONAL_WORK'),
    APPROVE_ADDITIONAL_WORK: createCommand(apiClient, 'APPROVE_ADDITIONAL_WORK'),
    REJECT_ADDITIONAL_WORK: createCommand(apiClient, 'REJECT_ADDITIONAL_WORK'),
    CANCEL_ADDITIONAL_WORK: createCommand(apiClient, 'CANCEL_ADDITIONAL_WORK'),
    ASSIGN_ADDITIONAL_WORK: createCommand(apiClient, 'ASSIGN_ADDITIONAL_WORK'),
    ACCRUE_ADDITIONAL_WORK: createCommand(apiClient, 'ACCRUE_ADDITIONAL_WORK'),
    MARK_WITHOUT_ACCRUAL: createCommand(apiClient, 'MARK_WITHOUT_ACCRUAL'),
    CREATE_APPROVE_SALARY_CORRECTION: createCommand(apiClient, 'CREATE_APPROVE_SALARY_CORRECTION'),
    REVERSE_SALARY_ENTRY: createCommand(apiClient, 'REVERSE_SALARY_ENTRY'),
    CREATE_PRODUCTION_CORRECTION: createCommand(apiClient, 'CREATE_PRODUCTION_CORRECTION'),
    CREATE_GOOGLE_SHEETS_EXPORT: createCommand(apiClient, 'CREATE_GOOGLE_SHEETS_EXPORT'),
  });
}

export type Section03BusinessCommands = ReturnType<typeof createSection03BusinessCommands>;
