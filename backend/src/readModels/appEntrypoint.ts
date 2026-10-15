import type { ActorContext } from '../auth/actorContext.js';
import type { DbPool } from '../db/pool.js';
import { readManagerIdentity } from './sharedQueries.js';

export type AppEntrypointSection = 'section02' | 'section03' | 'section04';

export type AppEntrypointResponse = {
  section: AppEntrypointSection;
  screen: 'S02-N01' | 'S03-N01' | 'S04-N01';
  contour: 'operator' | 'production_manager' | 'director';
  actor: {
    employee_id: string;
  };
  role_hints: string[];
  resolution_source: 'director_role' | 'production_manager_capability' | 'production_manager_role' | 'operator_default';
};

export type EntrypointDecision = Pick<AppEntrypointResponse, 'section' | 'screen' | 'contour' | 'resolution_source'>;

const DIRECTOR_HINTS = [
  'director',
  'general_director',
  'factory_director',
  'ceo',
  'owner',
  's04',
  'section04',
  'директор',
  'генеральный директор',
  'владелец'
];

const PRODUCTION_MANAGER_HINTS = [
  'production_manager',
  'production manager',
  'production_head',
  'head_of_production',
  'factory_manager',
  's03',
  'section03',
  'начальник производства',
  'руководитель производства',
  'заведующий производством'
];

export function normalizeRoleHint(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function hasHint(roleHints: readonly string[], acceptedHints: readonly string[]): boolean {
  const normalizedAccepted = acceptedHints.map(normalizeRoleHint);

  return roleHints
    .map(normalizeRoleHint)
    .some((hint) => normalizedAccepted.some((accepted) => hint === accepted || hint.includes(accepted)));
}

export function resolveAppEntrypointFromRoleHints(
  roleHints: readonly string[],
  hasProductionManagerCapability: boolean
): EntrypointDecision {
  if (hasHint(roleHints, DIRECTOR_HINTS)) {
    return {
      section: 'section04',
      screen: 'S04-N01',
      contour: 'director',
      resolution_source: 'director_role'
    };
  }

  if (hasProductionManagerCapability) {
    return {
      section: 'section03',
      screen: 'S03-N01',
      contour: 'production_manager',
      resolution_source: 'production_manager_capability'
    };
  }

  if (hasHint(roleHints, PRODUCTION_MANAGER_HINTS)) {
    return {
      section: 'section03',
      screen: 'S03-N01',
      contour: 'production_manager',
      resolution_source: 'production_manager_role'
    };
  }

  return {
    section: 'section02',
    screen: 'S02-N01',
    contour: 'operator',
    resolution_source: 'operator_default'
  };
}

export async function getAppEntrypoint(pool: DbPool, actor: ActorContext): Promise<AppEntrypointResponse> {
  const employeeId = actor.employeeId.toString();
  const [roleHints, productionManagerIdentity] = await Promise.all([
    readActorRoleHints(pool, employeeId),
    readManagerIdentity(pool, employeeId).catch(() => undefined)
  ]);
  const decision = resolveAppEntrypointFromRoleHints(roleHints, Boolean(productionManagerIdentity));

  return {
    ...decision,
    actor: {
      employee_id: employeeId
    },
    role_hints: roleHints
  };
}

async function readActorRoleHints(pool: DbPool, employeeId: string): Promise<string[]> {
  const hints = new Set<string>();

  for (const hint of await readEmployeePositionHints(pool, employeeId)) {
    hints.add(hint);
  }

  for (const hint of await readEmployeeRoleHintsFromKnownSchemas(pool, employeeId)) {
    hints.add(hint);
  }

  return [...hints].filter((hint) => hint.trim().length > 0).sort();
}

async function readEmployeePositionHints(pool: DbPool, employeeId: string): Promise<string[]> {
  const queries = [
    `
      select
        ''::text as code,
        coalesce(p.position_name::text, '') as name,
        ''::text as display_name
      from app.employees e
      join app.positions p on p.position_id = e.position_id
      where e.employee_id = $1
      limit 1
    `,
    `
      select
        coalesce(p.position_code::text, '') as code,
        coalesce(p.position_name::text, '') as name,
        coalesce(p.display_name::text, '') as display_name
      from app.employees e
      join app.positions p on p.position_id = e.position_id
      where e.employee_id = $1
      limit 1
    `,
    `
      select
        coalesce(p.code::text, '') as code,
        coalesce(p.name::text, '') as name,
        coalesce(p.display_name::text, '') as display_name
      from app.employees e
      join app.positions p on p.position_id = e.position_id
      where e.employee_id = $1
      limit 1
    `
  ];

  return readHintsWithFallback(pool, queries, employeeId);
}

async function readEmployeeRoleHintsFromKnownSchemas(pool: DbPool, employeeId: string): Promise<string[]> {
  const queries = [
    `
      select
        ''::text as code,
        coalesce(r.role_name::text, '') as name,
        ''::text as display_name
      from app.employee_roles er
      join app.roles r on r.role_id = er.role_id
      where er.employee_id = $1
        and er.revoked_at is null
        and r.is_active = true
    `,
    `
      select
        coalesce(r.role_code::text, '') as code,
        coalesce(r.role_name::text, '') as name,
        coalesce(r.display_name::text, '') as display_name
      from app.employee_roles er
      join app.roles r on r.role_id = er.role_id
      where er.employee_id = $1
        and coalesce(er.is_active, true) = true
        and (not exists (
          select 1
          from information_schema.columns
          where table_schema = 'app'
            and table_name = 'employee_roles'
            and column_name = 'revoked_at'
        ) or er.revoked_at is null)
    `,
    `
      select
        coalesce(r.role_code::text, '') as code,
        coalesce(r.role_name::text, '') as name,
        coalesce(r.display_name::text, '') as display_name
      from app.employee_role_assignments era
      join app.roles r on r.role_id = era.role_id
      where era.employee_id = $1
        and coalesce(era.is_active, true) = true
        and (not exists (
          select 1
          from information_schema.columns
          where table_schema = 'app'
            and table_name = 'employee_role_assignments'
            and column_name = 'revoked_at'
        ) or era.revoked_at is null)
    `,
    `
      select
        coalesce(r.code::text, '') as code,
        coalesce(r.name::text, '') as name,
        coalesce(r.display_name::text, '') as display_name
      from app.employee_roles er
      join app.roles r on r.role_id = er.role_id
      where er.employee_id = $1
        and coalesce(er.is_active, true) = true
    `,
    `
      select
        coalesce(r.code::text, '') as code,
        coalesce(r.name::text, '') as name,
        coalesce(r.display_name::text, '') as display_name
      from app.employee_role_assignments era
      join app.roles r on r.role_id = era.role_id
      where era.employee_id = $1
        and coalesce(era.is_active, true) = true
    `
  ];

  return readHintsWithFallback(pool, queries, employeeId);
}

async function readHintsWithFallback(pool: DbPool, queries: readonly string[], employeeId: string): Promise<string[]> {
  for (const query of queries) {
    try {
      const result = await pool.query<{ code: string; name: string; display_name: string }>(query, [employeeId]);
      return result.rows.flatMap((row) => [row.code, row.name, row.display_name]).filter((value) => value.trim().length > 0);
    } catch {
      // The project has evolved through several PostgreSQL naming iterations.
      // Try the next known schema shape; never fail login routing just because
      // one historical table/column name is absent.
    }
  }

  return [];
}
