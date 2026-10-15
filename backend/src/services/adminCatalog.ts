import type { ActorContext } from '../auth/actorContext.js';
import { callRuntimeFunction } from '../db/callRuntimeFunction.js';
import { mapPostgresError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';
import type { RuntimeApiFunctionName } from '../db/runtimeApiRegistry.js';

export type AdminCatalogResult = {
  id: string;
};

export async function callAdminCatalogRuntime(
  pool: DbPool,
  actor: ActorContext,
  functionName: RuntimeApiFunctionName,
  params: readonly unknown[]
): Promise<AdminCatalogResult> {
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
