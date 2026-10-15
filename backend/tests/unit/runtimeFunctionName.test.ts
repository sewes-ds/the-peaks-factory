import { describe, expect, it } from 'vitest';
import {
  assertRuntimeApiFunctionName,
  assertRuntimeFunctionParameterCount
} from '../../src/db/callRuntimeFunction.js';
import { runtimeApiFunctionNames, runtimeApiRegistry } from '../../src/db/runtimeApiRegistry.js';

describe('runtime_api boundary', () => {
  it('contains exactly the accepted runtime_api function count', () => {
    expect(runtimeApiFunctionNames).toHaveLength(95);
  });

  it('accepts approved runtime_api function names only', () => {
    expect(() => assertRuntimeApiFunctionName('start_employee_shift')).not.toThrow();
    expect(() => assertRuntimeApiFunctionName('app.start_employee_shift')).toThrow('not approved runtime_api');
    expect(() => assertRuntimeApiFunctionName('_assert_actor_active')).toThrow('not approved runtime_api');
    expect(() => assertRuntimeApiFunctionName('rebuild_employee_salary_period_totals')).toThrow('not approved runtime_api');
    expect(() => assertRuntimeApiFunctionName('start_employee_shift;select')).toThrow('not approved runtime_api');
  });

  it('stores exact signatures and parameter counts', () => {
    expect(runtimeApiRegistry.start_employee_shift.signature).toBe('start_employee_shift(bigint)');
    expect(runtimeApiRegistry.create_employee.argTypes).toEqual(['bigint', 'text', 'text', 'bigint', 'text', 'bigint']);
    expect(() => assertRuntimeFunctionParameterCount('create_employee', 6)).not.toThrow();
    expect(() => assertRuntimeFunctionParameterCount('create_employee', 5)).toThrow('expected 6, got 5');
  });
});
