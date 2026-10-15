import type { DbExecutor } from './pool.js';
import {
  getRuntimeApiMetadata,
  isRuntimeApiFunctionName,
  type RuntimeApiFunctionName
} from './runtimeApiRegistry.js';

export type RuntimeFunctionCall<TParams extends readonly unknown[] = readonly unknown[]> = {
  functionName: RuntimeApiFunctionName;
  params?: TParams;
};

export async function callRuntimeFunction<TResult>(
  pool: DbExecutor,
  call: RuntimeFunctionCall
): Promise<TResult> {
  assertRuntimeApiFunctionName(call.functionName);

  const params = call.params ?? [];
  assertRuntimeFunctionParameterCount(call.functionName, params.length);

  const placeholders = params.map((_, index) => `$${index + 1}`).join(', ');
  const sql = `select app.${call.functionName}(${placeholders}) as result`;
  const result = await pool.query<{ result: TResult }>(sql, [...params]);

  return result.rows[0]?.result as TResult;
}

export function assertRuntimeApiFunctionName(functionName: string): asserts functionName is RuntimeApiFunctionName {
  if (!isRuntimeApiFunctionName(functionName)) {
    throw new Error('Function is not approved runtime_api');
  }
}

export function assertRuntimeFunctionParameterCount(functionName: RuntimeApiFunctionName, actualCount: number): void {
  const expectedCount = getRuntimeApiMetadata(functionName).argTypes.length;

  if (actualCount !== expectedCount) {
    throw new Error(`Invalid runtime_api parameter count for ${functionName}: expected ${expectedCount}, got ${actualCount}`);
  }
}
