import assert from 'node:assert/strict';
import pg from 'pg';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import { ApiError } from '../../src/db/errors.js';
import { assignAdditionalWork } from '../../src/services/operations.js';

const { Client } = pg;
const databaseUrl = process.env.WP35_TEST_DATABASE_URL;

if (databaseUrl === undefined) {
  throw new Error('WP35_TEST_DATABASE_URL is required for the disposable-DB assignment harness.');
}

const client = new Client({ connectionString: databaseUrl });
const pool = client as unknown as DbPool;

function actor(employeeId: string): ActorContext {
  return { employeeId: BigInt(employeeId), telegramUserId: -1n };
}

async function expectApiError(
  operation: () => Promise<unknown>,
  expected: Readonly<{ statusCode: number; code: string; message: string }>,
): Promise<void> {
  try {
    await operation();
    assert.fail(`Expected ${expected.code}.`);
  } catch (error: unknown) {
    assert.ok(error instanceof ApiError, `Expected ApiError, received ${String(error)}.`);
    assert.equal(error.statusCode, expected.statusCode);
    assert.equal(error.code, expected.code);
    assert.equal(error.message, expected.message);
  }
}

await client.connect();
try {
  const identity = await client.query<{ database_name: string; server_port: number }>(
    'select current_database() as database_name, inet_server_port() as server_port',
  );
  assert.equal(identity.rows[0]?.database_name, 'wp35_test', 'Harness refuses a non-disposable database.');

  const references = await client.query<{
    active_status_id: string;
    inactive_status_id: string;
    manager_role_id: string;
    operator_role_id: string;
    position_id: string;
    type_one_id: string;
    type_two_id: string;
  }>(`
    select
      (select employee_status_id::text from app.employee_statuses where is_active and is_active_for_login order by employee_status_id limit 1) active_status_id,
      (select employee_status_id::text from app.employee_statuses where is_active and not is_active_for_login order by employee_status_id limit 1) inactive_status_id,
      (select role_id::text from app.roles where is_active and can_manage_production order by role_id limit 1) manager_role_id,
      (select role_id::text from app.roles where is_active and can_work_as_operator order by role_id limit 1) operator_role_id,
      (select position_id::text from app.positions where is_active order by position_id limit 1) position_id,
      (select additional_work_type_id::text from app.additional_work_types where is_active order by additional_work_type_id limit 1) type_one_id,
      (select additional_work_type_id::text from app.additional_work_types where is_active order by additional_work_type_id offset 1 limit 1) type_two_id
  `);
  const refs = references.rows[0];
  assert.ok(refs && Object.values(refs).every((value) => typeof value === 'string' && value.length > 0));

  const insertEmployee = async (suffix: string, statusId: string): Promise<string> => {
    const result = await client.query<{ employee_id: string }>(`
      insert into app.employees (full_name, phone_e164, position_id, employee_status_id)
      values ($1, $2, $3, $4)
      returning employee_id::text
    `, [`Harness ${suffix}`, `+99890000${suffix.padStart(5, '0')}`, refs.position_id, statusId]);
    return result.rows[0]!.employee_id;
  };
  const managerId = await insertEmployee('1', refs.active_status_id);
  const operatorId = await insertEmployee('2', refs.active_status_id);
  const inactiveOperatorId = await insertEmployee('3', refs.inactive_status_id);
  const nonOperatorId = await insertEmployee('4', refs.active_status_id);

  await client.query(`
    insert into app.employee_roles (employee_id, role_id)
    values ($1, $2), ($3, $4), ($5, $4), ($6, $2)
  `, [managerId, refs.manager_role_id, operatorId, refs.operator_role_id, inactiveOperatorId, nonOperatorId]);
  const inactiveType = await client.query<{ additional_work_type_id: string }>(`
    insert into app.additional_work_types (additional_work_type_name, is_active)
    values ('Harness inactive type', false)
    returning additional_work_type_id::text
  `);
  const inactiveTypeId = inactiveType.rows[0]!.additional_work_type_id;

  await client.query('set role app_runtime_role');
  const valid = await assignAdditionalWork(pool, actor(managerId), operatorId, refs.type_one_id);
  assert.match(valid.id, /^[1-9][0-9]*$/);

  await expectApiError(
    () => assignAdditionalWork(pool, actor(managerId), operatorId, refs.type_one_id),
    {
      statusCode: 409,
      code: 'additional_work_assignment_already_exists',
      message: 'Такая доп. работа уже назначена этому сотруднику и ещё не завершена.',
    },
  );
  await expectApiError(
    () => assignAdditionalWork(pool, actor(managerId), inactiveOperatorId, refs.type_two_id),
    {
      statusCode: 409,
      code: 'additional_work_target_not_available',
      message: 'Сотрудник недоступен для назначения доп. работы. Обновите список.',
    },
  );
  await expectApiError(
    () => assignAdditionalWork(pool, actor(managerId), nonOperatorId, refs.type_two_id),
    {
      statusCode: 409,
      code: 'additional_work_target_not_available',
      message: 'Сотрудник недоступен для назначения доп. работы. Обновите список.',
    },
  );
  await expectApiError(
    () => assignAdditionalWork(pool, actor(managerId), operatorId, inactiveTypeId),
    {
      statusCode: 409,
      code: 'additional_work_type_not_available',
      message: 'Этот вид доп. работы больше недоступен. Обновите список.',
    },
  );
  await expectApiError(
    () => assignAdditionalWork(pool, actor(operatorId), operatorId, refs.type_two_id),
    {
      statusCode: 403,
      code: 'additional_work_assignment_forbidden',
      message: 'Недостаточно прав для назначения доп. работы.',
    },
  );

  await client.query('reset role');
  const persisted = await client.query<{ count: string }>(`
    select count(*)::text as count
    from app.additional_works
    where assigned_by_employee_id = $1
  `, [managerId]);
  assert.equal(persisted.rows[0]?.count, '1', 'Exactly one valid assignment must be created.');

  process.stdout.write(JSON.stringify({
    database: identity.rows[0]?.database_name,
    port: identity.rows[0]?.server_port,
    valid_assignment_count: 1,
    duplicate: 'additional_work_assignment_already_exists',
    inactive_target: 'additional_work_target_not_available',
    non_operator_target: 'additional_work_target_not_available',
    inactive_type: 'additional_work_type_not_available',
    permission: 'additional_work_assignment_forbidden',
  }) + '\n');
} finally {
  await client.end();
}
