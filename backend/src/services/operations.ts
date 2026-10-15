import type { ActorContext } from '../auth/actorContext.js';
import { callRuntimeFunction } from '../db/callRuntimeFunction.js';
import { ApiError, mapPostgresError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';
import type { RuntimeApiFunctionName } from '../db/runtimeApiRegistry.js';
import { additionalWorkAssignmentApiError } from '../additionalWorkAssignmentContract.js';

export type OperationResult = {
  id: string;
};

export type DowntimeStartInput = {
  machineId: string;
  downtimeTypeId: string;
  productionOperationId?: string | null;
  comment: string | null;
};

export type AccrueAdditionalWorkInput = {
  additionalWorkId: string;
  amountUzs: string;
  quantity?: string | null;
};

export async function startMachineDowntime(
  pool: DbPool,
  actor: ActorContext,
  input: DowntimeStartInput
): Promise<OperationResult> {
  return callOperation(pool, 'start_machine_downtime', [
    actor.employeeId.toString(),
    input.machineId,
    input.downtimeTypeId,
    input.productionOperationId ?? null,
    input.comment
  ]);
}

export async function finishMachineDowntime(
  pool: DbPool,
  actor: ActorContext,
  downtimeId: string,
  comment: string | null,
  reason: string | null = comment
): Promise<OperationResult> {
  return callOperation(pool, 'finish_machine_downtime', [actor.employeeId.toString(), downtimeId, comment, reason]);
}

export async function cancelMachineDowntime(
  pool: DbPool,
  actor: ActorContext,
  downtimeId: string,
  reason: string
): Promise<OperationResult> {
  return callOperation(pool, 'cancel_machine_downtime', [actor.employeeId.toString(), downtimeId, reason]);
}

export async function startOperatorBreak(pool: DbPool, actor: ActorContext, breakTypeId: string): Promise<OperationResult> {
  return callOperation(pool, 'start_operator_break', [actor.employeeId.toString(), breakTypeId]);
}

export async function finishOperatorBreak(pool: DbPool, actor: ActorContext): Promise<OperationResult> {
  return callOperation(pool, 'finish_operator_break', [actor.employeeId.toString()]);
}

export async function emergencyFinishOperatorBreak(
  pool: DbPool,
  actor: ActorContext,
  targetEmployeeId: string,
  reason: string
): Promise<OperationResult> {
  return callOperation(pool, 'emergency_finish_operator_break', [actor.employeeId.toString(), targetEmployeeId, reason]);
}

export async function assignAdditionalWork(
  pool: DbPool,
  actor: ActorContext,
  employeeId: string,
  additionalWorkTypeId: string
): Promise<OperationResult> {
  try {
    const id = await callRuntimeFunction<string | number | bigint>(pool, {
      functionName: 'assign_additional_work',
      params: [actor.employeeId.toString(), employeeId, additionalWorkTypeId]
    });
    return { id: id.toString() };
  } catch (error) {
    throw mapAdditionalWorkAssignmentError(error);
  }
}

type PostgresAssignmentError = Readonly<{
  code?: string;
  constraint?: string;
  message?: string;
}>;

export function mapAdditionalWorkAssignmentError(error: unknown): ApiError {
  const dbError = error as PostgresAssignmentError;
  if (dbError.code === '42501' || dbError.message === 'actor lacks any required permission') {
    return additionalWorkAssignmentApiError('additional_work_assignment_forbidden');
  }
  if (
    dbError.constraint === 'additional_works_one_unfinished_assignment_per_type_idx' ||
    dbError.message === 'unfinished Допработа already exists for employee and type'
  ) {
    return additionalWorkAssignmentApiError('additional_work_assignment_already_exists');
  }
  if (dbError.message === 'active operator target employee is required') {
    return additionalWorkAssignmentApiError('additional_work_target_not_available');
  }
  if (dbError.message === 'active Допработа type is required') {
    return additionalWorkAssignmentApiError('additional_work_type_not_available');
  }
  if (
    dbError.code === 'P0001' || dbError.code === '23503' || dbError.code === '23505' ||
    dbError.code === '22023' || dbError.code === '40001' || dbError.code === '40P01'
  ) {
    return additionalWorkAssignmentApiError('additional_work_assignment_conflict');
  }
  return mapPostgresError(error);
}

export async function requestAdditionalWork(
  pool: DbPool,
  actor: ActorContext,
  additionalWorkTypeId: string
): Promise<OperationResult> {
  return callOperation(pool, 'request_additional_work', [actor.employeeId.toString(), additionalWorkTypeId]);
}

export async function startAdditionalWork(pool: DbPool, actor: ActorContext, additionalWorkId: string): Promise<OperationResult> {
  try {
    return await callOperation(pool, 'start_additional_work', [actor.employeeId.toString(), additionalWorkId]);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) {
      throw new ApiError(
        409,
        'additional_work_start_blocked',
        'Additional work start is blocked by current business state'
      );
    }
    throw error;
  }
}

export async function finishAdditionalWork(
  pool: DbPool,
  actor: ActorContext,
  additionalWorkId: string,
  comment: string | null
): Promise<OperationResult> {
  return callOperation(pool, 'finish_additional_work', [actor.employeeId.toString(), additionalWorkId, comment]);
}

export async function approveAdditionalWorkRequest(
  pool: DbPool,
  actor: ActorContext,
  additionalWorkId: string,
  comment: string | null
): Promise<OperationResult> {
  return callOperation(pool, 'approve_additional_work_request', [actor.employeeId.toString(), additionalWorkId, comment]);
}

export async function rejectAdditionalWorkRequest(
  pool: DbPool,
  actor: ActorContext,
  additionalWorkId: string,
  reason: string
): Promise<OperationResult> {
  return callOperation(pool, 'reject_additional_work_request', [actor.employeeId.toString(), additionalWorkId, reason]);
}

export async function cancelAdditionalWork(
  pool: DbPool,
  actor: ActorContext,
  additionalWorkId: string,
  reason: string
): Promise<OperationResult> {
  return callOperation(pool, 'cancel_additional_work', [actor.employeeId.toString(), additionalWorkId, reason]);
}

export async function markAdditionalWorkWithoutAccrual(
  pool: DbPool,
  actor: ActorContext,
  additionalWorkId: string,
  reason: string
): Promise<OperationResult> {
  return callOperation(pool, 'mark_additional_work_without_accrual', [
    actor.employeeId.toString(),
    additionalWorkId,
    reason
  ]);
}

export async function accrueAdditionalWorkSalary(
  pool: DbPool,
  actor: ActorContext,
  input: AccrueAdditionalWorkInput
): Promise<OperationResult> {
  return callOperation(pool, 'accrue_additional_work_salary', [
    actor.employeeId.toString(),
    input.additionalWorkId,
    input.amountUzs,
    input.quantity ?? null
  ]);
}

async function callOperation(
  pool: DbPool,
  functionName: RuntimeApiFunctionName,
  params: readonly unknown[]
): Promise<OperationResult> {
  try {
    const id = await callRuntimeFunction<string | number | bigint>(pool, {
      functionName,
      params
    });

    return { id: id.toString() };
  } catch (error) {
    throw mapPostgresError(error);
  }
}
