import type { ActorContext } from '../auth/actorContext.js';
import { callRuntimeFunction } from '../db/callRuntimeFunction.js';
import { ApiError, mapPostgresError } from '../db/errors.js';
import type { DbExecutor, DbPool } from '../db/pool.js';
import type { RuntimeApiFunctionName } from '../db/runtimeApiRegistry.js';

export type SalaryActionResult = {
  id: string;
};

export async function callSalaryRuntime(
  pool: DbExecutor,
  actor: ActorContext,
  functionName: RuntimeApiFunctionName,
  params: readonly unknown[]
): Promise<SalaryActionResult> {
  try {
    const id = await callRuntimeFunction<string | number | bigint>(pool, {
      functionName,
      params: [actor.employeeId.toString(), ...params]
    });

    return { id: id.toString() };
  } catch (error) {
    throw mapPostgresError(error);
  }
}

export async function createAndApproveSalaryRuntime(
  pool: DbPool,
  actor: ActorContext,
  createFunction: 'create_salary_correction' | 'create_production_operation_correction',
  approveFunction: 'approve_salary_correction' | 'approve_production_operation_correction',
  createParams: readonly unknown[]
): Promise<SalaryActionResult> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const created = await callSalaryRuntime(client, actor, createFunction, createParams);
    await callSalaryRuntime(client, actor, approveFunction, [created.id]);
    await client.query('commit');
    return created;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // Preserve the mutation failure; connection cleanup still happens below.
    }
    if (error instanceof ApiError) throw error;
    throw mapPostgresError(error);
  } finally {
    client.release();
  }
}
