import { callRuntimeFunction } from '../db/callRuntimeFunction.js';
import { mapPostgresError } from '../db/errors.js';
import type { DbExecutor } from '../db/pool.js';
import type { RuntimeApiFunctionName } from '../db/runtimeApiRegistry.js';

export type NotificationResult = {
  id: string;
};

export async function callNotificationRuntime(
  pool: DbExecutor,
  functionName: RuntimeApiFunctionName,
  params: readonly unknown[] = []
): Promise<NotificationResult> {
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
