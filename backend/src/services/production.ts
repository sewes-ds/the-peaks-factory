import type { ActorContext } from '../auth/actorContext.js';
import { callRuntimeFunction } from '../db/callRuntimeFunction.js';
import { mapPostgresError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';

export type ProductionOperationResult = {
  production_operation_id: string;
};

export async function startProductionOperation(
  pool: DbPool,
  actor: ActorContext,
  machineId: string,
  skuId: string
): Promise<ProductionOperationResult> {
  return callProductionRuntimeFunction(pool, 'start_production_operation', [
    actor.employeeId.toString(),
    machineId,
    skuId
  ]);
}

export async function finishProductionOperation(
  pool: DbPool,
  actor: ActorContext,
  productionOperationId: string,
  quantityProduced: string,
  comment: string | null
): Promise<ProductionOperationResult> {
  return callProductionRuntimeFunction(pool, 'finish_production_operation', [
    actor.employeeId.toString(),
    productionOperationId,
    quantityProduced,
    comment
  ]);
}

export async function cancelProductionOperation(
  pool: DbPool,
  actor: ActorContext,
  productionOperationId: string,
  reason: string
): Promise<ProductionOperationResult> {
  return callProductionRuntimeFunction(pool, 'cancel_production_operation', [
    actor.employeeId.toString(),
    productionOperationId,
    reason
  ]);
}

async function callProductionRuntimeFunction(
  pool: DbPool,
  functionName: 'start_production_operation' | 'finish_production_operation' | 'cancel_production_operation',
  params: readonly unknown[]
): Promise<ProductionOperationResult> {
  try {
    const productionOperationId = await callRuntimeFunction<string | number | bigint>(pool, {
      functionName,
      params
    });

    return {
      production_operation_id: productionOperationId.toString()
    };
  } catch (error) {
    throw mapPostgresError(error);
  }
}
