import { describe, expect, it } from 'vitest';
import type { DbPool } from '../src/db/pool.js';
import {
  getAppEntrypoint,
  normalizeRoleHint,
  resolveAppEntrypointFromRoleHints
} from '../src/readModels/appEntrypoint.js';

describe('app role entrypoint resolver', () => {
  it('routes director role to Section 04 with highest priority', () => {
    expect(resolveAppEntrypointFromRoleHints(['Начальник производства', 'Директор'], true)).toMatchObject({
      section: 'section04',
      screen: 'S04-N01',
      contour: 'director',
      resolution_source: 'director_role'
    });
  });

  it('routes production manager capability to Section 03', () => {
    expect(resolveAppEntrypointFromRoleHints([], true)).toMatchObject({
      section: 'section03',
      screen: 'S03-N01',
      contour: 'production_manager',
      resolution_source: 'production_manager_capability'
    });
  });

  it('routes production manager role hint to Section 03 when capability row is absent', () => {
    expect(resolveAppEntrypointFromRoleHints(['production_manager'], false)).toMatchObject({
      section: 'section03',
      screen: 'S03-N01',
      contour: 'production_manager',
      resolution_source: 'production_manager_role'
    });
  });

  it('does not treat the production-manager title as a generic director hint', () => {
    expect(resolveAppEntrypointFromRoleHints(['Руководитель производства'], true)).toMatchObject({
      section: 'section03',
      screen: 'S03-N01',
      contour: 'production_manager',
      resolution_source: 'production_manager_capability'
    });
  });

  it('routes default authenticated worker to Section 02', () => {
    expect(resolveAppEntrypointFromRoleHints(['Оператор'], false)).toMatchObject({
      section: 'section02',
      screen: 'S02-N01',
      contour: 'operator',
      resolution_source: 'operator_default'
    });
  });

  it('normalizes Russian role hints for comparison', () => {
    expect(normalizeRoleHint(' Начальник_производства ')).toBe('начальник производства');
  });

  it('reads the deployed role schema and keeps director priority over manager capability', async () => {
    const queries: string[] = [];
    const pool = {
      query: async (sqlValue: unknown) => {
        const sql = String(sqlValue);
        queries.push(sql);
        if (sql.includes('can_manage_production')) {
          return { rows: [{ manager_employee_id: '42', manager_full_name: 'Director' }] };
        }
        if (sql.includes('join app.positions')) {
          return { rows: [{ code: '', name: 'Директор', display_name: '' }] };
        }
        if (sql.includes('join app.roles')) {
          return { rows: [{ code: '', name: 'Директор', display_name: '' }] };
        }
        return { rows: [] };
      }
    } as unknown as DbPool;

    await expect(getAppEntrypoint(pool, {
      employeeId: 42n,
      telegramUserId: 777n
    })).resolves.toMatchObject({
      section: 'section04',
      screen: 'S04-N01',
      contour: 'director',
      resolution_source: 'director_role',
      role_hints: ['Директор']
    });
    expect(queries.some((sql) => sql.includes("''::text as code") && sql.includes('p.position_name::text'))).toBe(true);
    expect(queries.some((sql) => sql.includes("''::text as code") && sql.includes('r.role_name::text'))).toBe(true);
  });
});
