import type { ActorContext } from '../auth/actorContext.js';
import { callRuntimeFunction } from '../db/callRuntimeFunction.js';
import { mapPostgresError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';

export type ShiftOperationResult = {
  employee_shift_id: string;
};

export async function startEmployeeShift(pool: DbPool, actor: ActorContext): Promise<ShiftOperationResult> {
  return callShiftRuntimeFunction(pool, 'start_employee_shift', [actor.employeeId.toString()]);
}

export async function finishEmployeeShift(pool: DbPool, actor: ActorContext): Promise<ShiftOperationResult> {
  return callShiftRuntimeFunction(pool, 'finish_employee_shift', [actor.employeeId.toString()]);
}

export async function emergencyCloseEmployeeShift(
  pool: DbPool,
  actor: ActorContext,
  targetEmployeeId: string,
  reason: string
): Promise<ShiftOperationResult> {
  return callShiftRuntimeFunction(pool, 'emergency_close_employee_shift', [
    actor.employeeId.toString(),
    targetEmployeeId,
    reason
  ]);
}

async function callShiftRuntimeFunction(
  pool: DbPool,
  functionName: 'start_employee_shift' | 'finish_employee_shift' | 'emergency_close_employee_shift',
  params: readonly unknown[]
): Promise<ShiftOperationResult> {
  try {
    const employeeShiftId = await callRuntimeFunction<string | number | bigint>(pool, {
      functionName,
      params
    });

    return {
      employee_shift_id: employeeShiftId.toString()
    };
  } catch (error) {
    throw mapPostgresError(error);
  }
}
