
import { describe, expect, it } from 'vitest';

import {
  decodeGraphSource,
  graphSourcesFor,
} from './source';

type EmployeeContext = Readonly<{
  employee_id: string;
}>;

type EmployeeDto = Readonly<{
  employee_id: string;
  full_name: string;
}>;

function decodeEmployee(input: unknown): EmployeeDto {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Expected employee object.');
  }

  const value = input as Record<string, unknown>;
  if (
    typeof value.employee_id !== 'string' ||
    typeof value.full_name !== 'string'
  ) {
    throw new Error('Expected employee DTO.');
  }

  return {
    employee_id: value.employee_id,
    full_name: value.full_name,
  };
}

describe('Graph Protocol sources', () => {
  const sourceFactory = graphSourcesFor<EmployeeContext>();

  it('defines required endpoint sources with an unknown decoder boundary', () => {
    const employee = sourceFactory.required({
      sourceId: 'manager.employee.card',
      endpoint: '/manager/employees/:employee_id',
      request: async ({ employee_id }) => ({ employee_id }),
      decode: decodeEmployee,
    });

    expect(employee).toMatchObject({
      kind: 'endpoint',
      method: 'GET',
      sourceId: 'manager.employee.card',
      endpoint: '/manager/employees/:employee_id',
      requirement: 'required',
    });
    expect(Object.isFrozen(employee)).toBe(true);
    expect(
      decodeGraphSource(employee, {
        employee_id: '1',
        full_name: 'Петр',
      }),
    ).toEqual({
      employee_id: '1',
      full_name: 'Петр',
    });
  });

  it('keeps required and optional source semantics explicit in a named bundle', () => {
    const employee = sourceFactory.required({
      sourceId: 'manager.employee.card',
      endpoint: '/manager/employees/:employee_id',
      request: async ({ employee_id }) => ({ employee_id }),
      decode: decodeEmployee,
    });
    const hint = sourceFactory.optional({
      sourceId: 'manager.employee.hint',
      endpoint: '/manager/employees/:employee_id/hint',
      request: async ({ employee_id }) => ({ employee_id }),
      decode: (input: unknown) => String(input),
    });

    const bundle = sourceFactory.bundle({
      employee,
      hint,
    });
    const contract = sourceFactory.endpointBacked(bundle);

    expect(Object.keys(bundle.sources)).toEqual(['employee', 'hint']);
    expect(bundle.sources.employee.requirement).toBe('required');
    expect(bundle.sources.hint.requirement).toBe('optional');
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.isFrozen(bundle.sources)).toBe(true);
    expect(contract.kind).toBe('endpoint-backed');
    expect(contract.sourceBundle).toBe(bundle);
  });

  it('rejects an empty source bundle even when dynamic input bypasses type inference', () => {
    const bundleDynamic = sourceFactory.bundle as (
      sources: Readonly<Record<string, never>>,
    ) => unknown;

    expect(() => bundleDynamic({})).toThrow(
      'An endpoint-backed graph source bundle must contain at least one named source.',
    );
  });

  it('rejects invalid source identities and duplicate source IDs', () => {
    expect(() =>
      sourceFactory.required({
        sourceId: '',
        endpoint: '/manager/employees/:employee_id',
        request: async () => ({}),
        decode: (input: unknown) => input,
      }),
    ).toThrow('Graph sourceId must be a non-empty string.');

    expect(() =>
      sourceFactory.required({
        sourceId: 'manager.employee.card',
        endpoint: 'manager/employees/:employee_id',
        request: async () => ({}),
        decode: (input: unknown) => input,
      }),
    ).toThrow('Graph source endpoint must start with "/".');

    const first = sourceFactory.required({
      sourceId: 'duplicate.source',
      endpoint: '/first',
      request: async () => ({}),
      decode: (input: unknown) => input,
    });
    const second = sourceFactory.optional({
      sourceId: 'duplicate.source',
      endpoint: '/second',
      request: async () => ({}),
      decode: (input: unknown) => input,
    });

    expect(() =>
      sourceFactory.bundle({
        first,
        second,
      }),
    ).toThrow('Duplicate graph sourceId "duplicate.source" in one source bundle.');
  });

  it('keeps local-node source contracts separate from endpoint-backed contracts', () => {
    expect(sourceFactory.local()).toEqual({
      kind: 'local',
    });
  });
});
