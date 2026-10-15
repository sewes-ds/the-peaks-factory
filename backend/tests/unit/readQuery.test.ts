import { describe, expect, it } from 'vitest';
import { assertReadOnlySql, readQuery } from '../../src/db/readQuery.js';
import type { DbPool } from '../../src/db/pool.js';

describe('read query boundary', () => {
  it('allows SELECT read queries', () => {
    expect(() => assertReadOnlySql('select * from app.employees')).not.toThrow();
  });

  it('allows WITH read queries', () => {
    expect(() => assertReadOnlySql('with rows as (select 1) select * from rows')).not.toThrow();
  });

  it('rejects non-read query starts', () => {
    expect(() => assertReadOnlySql('values (1)')).toThrow('Read query must start');
  });

  it('rejects forbidden operations inside read boundary', () => {
    expect(() => assertReadOnlySql('select * from app.employees; drop table app.employees')).toThrow(
      'forbidden SQL operation'
    );
  });

  it('executes accepted read query with params', async () => {
    const pool = {
      query: async (sql: string, params: readonly unknown[]) => {
        expect(sql).toBe('select employee_id from app.employees where employee_id = $1');
        expect(params).toEqual(['7']);
        return { rows: [{ employee_id: '7' }] };
      }
    } as unknown as DbPool;

    await expect(
      readQuery<{ employee_id: string }>(pool, {
        sql: 'select employee_id from app.employees where employee_id = $1',
        params: ['7']
      })
    ).resolves.toEqual([{ employee_id: '7' }]);
  });
});
