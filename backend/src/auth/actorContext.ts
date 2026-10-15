import type { DbPool } from '../db/pool.js';

export type ActorContext = {
  employeeId: bigint;
  telegramUserId: bigint;
  telegramUsername?: string;
};

export type ActorEmployeeRow = {
  employee_id: string;
};

export type TelegramActorLookup =
  | {
      status: 'AUTHENTICATED';
      employeeId: bigint;
    }
  | {
      status: 'PHONE_BINDING_REQUIRED';
    }
  | {
      status: 'FORBIDDEN';
    };

export async function resolveActorEmployeeId(
  pool: DbPool,
  telegramUserId: bigint
): Promise<bigint | null> {
  const result = await pool.query<ActorEmployeeRow>(
    `
      select e.employee_id::text as employee_id
      from app.employees e
      join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
      where e.telegram_user_id = $1
        and es.is_active = true
        and es.is_active_for_login = true
      limit 1
    `,
    [telegramUserId.toString()]
  );

  const employeeId = result.rows[0]?.employee_id;
  return employeeId ? BigInt(employeeId) : null;
}

export async function resolveTelegramActorLookup(pool: DbPool, telegramUserId: bigint): Promise<TelegramActorLookup> {
  const result = await pool.query<{
    employee_id: string;
    is_active: boolean;
    is_active_for_login: boolean;
  }>(
    `
      select
        e.employee_id::text as employee_id,
        es.is_active,
        es.is_active_for_login
      from app.employees e
      join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
      where e.telegram_user_id = $1
      limit 1
    `,
    [telegramUserId.toString()]
  );

  const row = result.rows[0];
  if (!row) {
    return { status: 'PHONE_BINDING_REQUIRED' };
  }

  if (!row.is_active || !row.is_active_for_login) {
    return { status: 'FORBIDDEN' };
  }

  return {
    status: 'AUTHENTICATED',
    employeeId: BigInt(row.employee_id)
  };
}
