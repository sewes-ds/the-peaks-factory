import { describe, expect, it } from 'vitest';

import {
  GraphContextValidationError,
  defineGraphContext,
  graphContext,
  parseGraphContext,
} from './context';

describe('Graph Protocol context', () => {
  const schema = defineGraphContext({
    employee_id: graphContext.id(),
    comment: graphContext.optionalTextInput(),
    period: graphContext.period('today', 'week'),
    mode: graphContext.optionalMode('view', 'edit'),
  });

  it('parses the declared scalar context and preserves literal unions', () => {
    const context = parseGraphContext(schema, {
      employee_id: '1',
      comment: 'Комментарий',
      period: 'today',
      mode: 'view',
    });

    expect(context).toEqual({
      employee_id: '1',
      comment: 'Комментарий',
      period: 'today',
      mode: 'view',
    });
    expect(Object.isFrozen(context)).toBe(true);
  });

  it('allows omitted optional fields', () => {
    expect(
      parseGraphContext(schema, {
        employee_id: '1',
        period: 'week',
      }),
    ).toEqual({
      employee_id: '1',
      period: 'week',
    });
  });

  it('rejects display snapshots and unknown route fields at runtime', () => {
    expect(() =>
      parseGraphContext(schema, {
        employee_id: '1',
        period: 'today',
        employee: {
          employee_id: '1',
          full_name: 'Snapshot',
        },
      }),
    ).toThrowError(
      new GraphContextValidationError(
        'Unknown graph context field "employee".',
        'employee',
      ),
    );
  });

  it('rejects missing required fields and invalid enum values', () => {
    expect(() =>
      parseGraphContext(schema, {
        period: 'today',
      }),
    ).toThrow('Missing required graph context field "employee_id".');

    expect(() =>
      parseGraphContext(schema, {
        employee_id: '1',
        period: 'month',
      }),
    ).toThrow(
      'Invalid graph context field "period": Expected one of: today, week.',
    );
  });

  it('rejects non-plain context containers', () => {
    expect(() => parseGraphContext(schema, null)).toThrow(
      'Graph context must be a plain object.',
    );
    expect(() => parseGraphContext(schema, [])).toThrow(
      'Graph context must be a plain object.',
    );
    expect(() => parseGraphContext(schema, new Date())).toThrow(
      'Graph context must be a plain object.',
    );
  });

  it('rejects a decoder that lies about returning a scalar', () => {
    const unsafeDecoder = ((value: unknown) => ({
      snapshot: value,
    })) as unknown as (value: unknown) => string;

    const unsafeSchema = defineGraphContext({
      input: graphContext.scalarInput(unsafeDecoder),
    });

    expect(() =>
      parseGraphContext(unsafeSchema, {
        input: 'value',
      }),
    ).toThrow(
      'Invalid graph context field "input": decoder returned a non-scalar value.',
    );
  });
});
