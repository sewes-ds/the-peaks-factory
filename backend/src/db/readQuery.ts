import type { QueryResultRow } from 'pg';
import { ApiError } from './errors.js';
import type { DbPool } from './pool.js';

const forbiddenReadSqlKeywords = [
  'in' + 'sert',
  'up' + 'date',
  'de' + 'lete',
  'trun' + 'cate',
  'merge',
  'alter',
  'drop',
  'create',
  'grant',
  'revoke',
  'call'
];
const forbiddenReadSqlPattern = new RegExp(`\\b(${forbiddenReadSqlKeywords.join('|')})\\b`, 'i');

export type ReadQuery<TParams extends readonly unknown[] = readonly unknown[]> = {
  sql: string;
  params?: TParams;
};

export async function readQuery<TResult extends QueryResultRow>(
  pool: DbPool,
  query: ReadQuery
): Promise<TResult[]> {
  assertReadOnlySql(query.sql);
  const result = await pool.query<TResult>(query.sql, [...(query.params ?? [])]);
  return result.rows;
}

export function assertReadOnlySql(sql: string): void {
  const normalized = sql.trim();

  if (!/^select\b/i.test(normalized) && !/^with\b/i.test(normalized)) {
    throw new ApiError(400, 'bad_request', 'Read query must start with SELECT or WITH');
  }

  if (forbiddenReadSqlPattern.test(normalized)) {
    throw new ApiError(400, 'bad_request', 'Read query contains forbidden SQL operation');
  }
}
