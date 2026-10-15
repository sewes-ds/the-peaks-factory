import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import {
  getAvailableAdditionalWorkTypes,
  getAvailableDowntimeTypes,
  getOperatorAdditionalWorkState,
  getOperatorBreakTypes,
  getOperatorMachineByQr,
  getOperatorMachines,
  getOperatorSalaryHistory,
  getOperatorSalaryTotals,
  getOperatorSkus,
  getOperatorWorkplaceState
} from '../../src/readModels/operatorReadModels.js';

const { Client } = pg;
const harnessPath = fileURLToPath(import.meta.url);
const databaseName = process.env.WP_C_TEST_DATABASE ?? process.env.PGDATABASE ?? 'the_peaks_factory';
const adminDatabaseUrl = process.env.WP_C_TEST_ADMIN_DATABASE_URL;

const client = new Client(
  adminDatabaseUrl
    ? { connectionString: adminDatabaseUrl }
    : {
        database: databaseName,
        host: process.env.PGHOST ?? '/var/run/postgresql',
        port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
        user: process.env.PGUSER ?? 'postgres'
      }
);

const asPool = client as unknown as DbPool;
const actor = (n: number): ActorContext => ({
  employeeId: BigInt(-771000 - n),
  telegramUserId: BigInt(-880000 - n)
});

function includesAll(actual: readonly string[], expected: readonly string[]): void {
  for (const token of expected) {
    assert.ok(actual.includes(token), `Expected pipeline ${token}; actual=${actual.join(',')}`);
  }
}

function excludesAll(actual: readonly string[], forbidden: readonly string[]): void {
  for (const token of forbidden) {
    assert.ok(!actual.includes(token), `Forbidden pipeline ${token}; actual=${actual.join(',')}`);
  }
}

const setupSql = String.raw`
create temporary table wp_c_refs on commit drop as
select
  (select position_id from app.positions order by position_id limit 1) as position_id,
  (select employee_status_id from app.employee_statuses where is_active = true and is_active_for_login = true order by employee_status_id limit 1) as employee_status_id,
  (select production_operation_status_id from app.production_operation_statuses where is_active = true and is_open = true order by production_operation_status_id limit 1) as open_production_status_id,
  (select production_operation_status_id from app.production_operation_statuses where is_active = true and is_closed = true order by production_operation_status_id limit 1) as closed_production_status_id,
  (select machine_status_id from app.machine_statuses where is_active = true and is_available_for_start = true order by machine_status_id limit 1) as machine_status_id,
  (select machine_use_status_id from app.machine_use_statuses where is_active = true and is_available_for_operations = true order by machine_use_status_id limit 1) as machine_use_status_id,
  (select machine_downtime_type_id from app.machine_downtime_types where is_active = true and downtime_class = 'OPERATIONAL' order by display_order, machine_downtime_type_id limit 1) as operational_downtime_type_id,
  (select machine_downtime_type_id from app.machine_downtime_types where is_active = true and downtime_class = 'CRITICAL' order by display_order, machine_downtime_type_id limit 1) as critical_downtime_type_id,
  (select operator_break_type_id from app.operator_break_types where is_active = true order by operator_break_type_id limit 1) as operator_break_type_id,
  (select additional_work_type_id from app.additional_work_types where is_active = true order by additional_work_type_id limit 1) as additional_work_type_id,
  (select additional_work_approval_status_id from app.additional_work_approval_statuses where is_active = true and is_approved = true order by additional_work_approval_status_id limit 1) as approved_status_id,
  (select additional_work_approval_status_id from app.additional_work_approval_statuses where is_active = true and is_pending = true order by additional_work_approval_status_id limit 1) as pending_status_id,
  (select salary_entry_type_id from app.salary_entry_types where is_active = true and is_production_operation = true order by salary_entry_type_id limit 1) as production_salary_entry_type_id;

do $$
begin
  if exists (
    select 1 from wp_c_refs
    where position_id is null
       or employee_status_id is null
       or open_production_status_id is null
       or closed_production_status_id is null
       or machine_status_id is null
       or machine_use_status_id is null
       or operational_downtime_type_id is null
       or critical_downtime_type_id is null
       or operator_break_type_id is null
       or additional_work_type_id is null
       or approved_status_id is null
       or pending_status_id is null
       or production_salary_entry_type_id is null
  ) then
    raise exception 'Missing required semantic reference data for WP-C harness';
  end if;
end $$;

insert into app.employees (
  employee_id, full_name, phone_e164, telegram_user_id, position_id, employee_status_id
) overriding system value
select -771000 - n, 'WP-C Harness Employee ' || n, '+99890177' || lpad(n::text, 4, '0'), -880000 - n, position_id, employee_status_id
from generate_series(1, 12) n cross join wp_c_refs;

insert into app.sku_units (sku_unit_id, sku_unit_name, is_active) overriding system value
values (-771001, 'WP-C Harness Unit', true);

insert into app.skus (
  sku_id, sku_code, sku_name, sku_qr_token, sku_unit_id, current_sku_tariff_uzs, is_active
) overriding system value
values (-771001, 'WP-C-SKU', 'WP-C Harness SKU', repeat('W', 32), -771001, 1250, true);

insert into app.machines (
  machine_id, machine_name, workshop_name, machine_qr_token, machine_status_id, machine_use_status_id
) overriding system value
select -772000 - n, 'WP-C Harness Machine ' || n, 'WP-C', 'wp-c-qr-' || n, machine_status_id, machine_use_status_id
from generate_series(1, 12) n cross join wp_c_refs;

insert into app.employee_shifts (
  employee_shift_id, employee_id, started_at, started_by_employee_id, is_open
) overriding system value
select -773000 - n, -771000 - n, now() - interval '1 hour', -771000 - n, true
from generate_series(2, 12) n;

insert into app.production_operations (
  production_operation_id, employee_id, employee_shift_id, machine_id, sku_id,
  production_operation_status_id, is_open, started_at, started_by_employee_id
) overriding system value
select -774000 - n, -771000 - n, -773000 - n, -772000 - n, -771001,
       open_production_status_id, true, now() - interval '50 minutes', -771000 - n
from generate_series(3, 8) n cross join wp_c_refs;

insert into app.machine_downtimes (
  machine_downtime_id, machine_id, production_operation_id, machine_downtime_type_id,
  started_at, started_by_employee_id, is_open
) overriding system value
select -775004, -772004, -774004, operational_downtime_type_id, now() - interval '40 minutes', -771004, true from wp_c_refs
union all
select -775005, -772005, -774005, operational_downtime_type_id, now() - interval '40 minutes', -771005, true from wp_c_refs
union all
select -775006, -772006, -774006, operational_downtime_type_id, now() - interval '40 minutes', -771006, true from wp_c_refs
union all
select -775008, -772008, -774008, critical_downtime_type_id, now() - interval '40 minutes', -771008, true from wp_c_refs
union all
select -775009, -772009, null, critical_downtime_type_id, now() - interval '40 minutes', -771009, true from wp_c_refs;

insert into app.operator_breaks (
  operator_break_id, employee_id, employee_shift_id, operator_break_type_id, started_at, started_by_employee_id, is_open
) overriding system value
select -776005, -771005, -773005, operator_break_type_id, now() - interval '30 minutes', -771005, true from wp_c_refs
union all
select -776012, -771012, -773012, operator_break_type_id, now() - interval '30 minutes', -771012, true from wp_c_refs;

insert into app.additional_works (
  additional_work_id, employee_id, employee_shift_id, additional_work_type_id,
  assigned_by_employee_id, assigned_at, started_at, started_by_employee_id,
  additional_work_approval_status_id, is_assignment_finished
) overriding system value
select -777006, -771006, -773006, additional_work_type_id, -771006, now() - interval '1 hour', null::timestamptz, null::bigint, approved_status_id, false from wp_c_refs
union all
select -777007, -771007, -773007, additional_work_type_id, -771007, now() - interval '1 hour', null::timestamptz, null::bigint, approved_status_id, false from wp_c_refs
union all
select -777010, -771010, -773010, additional_work_type_id, -771010, now() - interval '1 hour', now() - interval '20 minutes', -771010, approved_status_id, false from wp_c_refs
union all
select -777011, -771011, -773011, additional_work_type_id, -771011, now() - interval '1 hour', null::timestamptz, null::bigint, pending_status_id, false from wp_c_refs;

insert into app.production_operations (
  production_operation_id, employee_id, employee_shift_id, machine_id, sku_id,
  production_operation_status_id, is_open, started_at, finished_at, quantity_produced,
  started_by_employee_id, finished_by_employee_id
) overriding system value
select -774101, -771003, -773003, -772010, -771001,
       closed_production_status_id, false, now() - interval '4 hours', now() - interval '3 hours', 5,
       -771003, -771003 from wp_c_refs
union all
select -774102, -771003, -773003, -772011, -771001,
       closed_production_status_id, false, now() - interval '40 days', now() - interval '39 days', 4,
       -771003, -771003 from wp_c_refs
union all
select -774103, -771003, -773003, -772012, -771001,
       closed_production_status_id, false, now() - interval '2 hours', now() - interval '1 hour', 3,
       -771003, -771003 from wp_c_refs;

insert into app.employee_salary_entries (
  employee_salary_entry_id, employee_id, employee_shift_id, salary_entry_type_id,
  production_operation_id, quantity, tariff_rate_uzs, amount_uzs, accrued_at,
  accrued_by_employee_id, salary_period_date, salary_week_start_date, salary_month_start_date
) overriding system value
select -778001, -771003, -773003, production_salary_entry_type_id,
       -774101, 5, 2000, 10000, now(), -771003,
       timezone('Asia/Tashkent', now())::date,
       date_trunc('week', timezone('Asia/Tashkent', now())::date)::date,
       date_trunc('month', timezone('Asia/Tashkent', now())::date)::date
from wp_c_refs
union all
select -778002, -771003, -773003, production_salary_entry_type_id,
       -774102, 4, 2000, 8000, now(), -771003,
       (timezone('Asia/Tashkent', now())::date - interval '35 days')::date,
       date_trunc('week', (timezone('Asia/Tashkent', now())::date - interval '35 days')::date)::date,
       date_trunc('month', (timezone('Asia/Tashkent', now())::date - interval '35 days')::date)::date
from wp_c_refs
union all
select -778003, -771003, -773003, production_salary_entry_type_id,
       -774103, 3, 2000, 6000, now(), -771003,
       (timezone('Asia/Tashkent', now())::date + interval '10 days')::date,
       date_trunc('week', (timezone('Asia/Tashkent', now())::date + interval '10 days')::date)::date,
       date_trunc('month', (timezone('Asia/Tashkent', now())::date + interval '10 days')::date)::date
from wp_c_refs;
`;

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const checksum = createHash('sha256').update(readFileSync(harnessPath)).digest('hex');
  console.log(`started_at=${startedAt}`);
  console.log(`harness_path=${harnessPath}`);
  console.log(`harness_sha256=${checksum}`);
  console.log(`database=${databaseName}`);

  await client.connect();
  await client.query('begin');

  try {
    await client.query(setupSql);

    const constraint = await client.query<{ conname: string }>(`
      select conname
      from pg_constraint
      where conrelid = 'app.machine_downtime_types'::regclass
        and conname = 'machine_downtime_types_profile_class_fk'
    `);
    assert.equal(constraint.rowCount, 1, 'Downtime type/profile class FK must exist');
    const additionalWorkTypeId = (
      await client.query<{ additional_work_type_id: string }>(`
        select additional_work_type_id::text
        from wp_c_refs
      `)
    ).rows[0]?.additional_work_type_id;
    assert.ok(additionalWorkTypeId, 'Additional work type reference must exist');

    await client.query('set local role app_runtime_role');
    const identity = await client.query<{ current_user: string }>('select current_user');
    assert.equal(identity.rows[0]?.current_user, 'app_runtime_role');
    console.log('read_phase_current_user=app_runtime_role');

    const noShift = await getOperatorWorkplaceState(asPool, actor(1));
    assert.equal(noShift.shift.is_active, false);
    assert.equal(noShift.finish_shift.can_finish_now, false);
    assert.equal(noShift.finish_shift.next_required_pipeline, null);
    assert.deepEqual(noShift.available_pipelines, ['START_SHIFT', 'VIEW_SALARY']);

    const activeShift = await getOperatorWorkplaceState(asPool, actor(2));
    assert.equal(activeShift.shift.is_active, true);
    includesAll(activeShift.available_pipelines, [
      'FINISH_SHIFT', 'START_PRODUCTION', 'START_BREAK', 'START_DOWNTIME',
      'OPEN_ADDITIONAL_WORK', 'REQUEST_ADDITIONAL_WORK', 'VIEW_SALARY'
    ]);

    const activeProduction = await getOperatorWorkplaceState(asPool, actor(3));
    assert.equal(activeProduction.production.is_active, true);
    includesAll(activeProduction.available_pipelines, ['FINISH_PRODUCTION', 'START_DOWNTIME', 'START_BREAK']);
    excludesAll(activeProduction.available_pipelines, ['START_ADDITIONAL_WORK']);

    const operational = await getOperatorWorkplaceState(asPool, actor(4));
    assert.equal(operational.downtime.slot_state, 'OPERATIONAL_ACTIVE');
    assert.equal(operational.finish_shift.next_required_pipeline, 'FINISH_DOWNTIME');
    includesAll(operational.available_pipelines, ['FINISH_DOWNTIME', 'START_BREAK']);
    excludesAll(operational.available_pipelines, ['FINISH_PRODUCTION', 'START_DOWNTIME']);

    const operationalBreak = await getOperatorWorkplaceState(asPool, actor(5));
    assert.equal(operationalBreak.finish_shift.next_required_pipeline, 'FINISH_DOWNTIME');
    includesAll(operationalBreak.available_pipelines, ['FINISH_DOWNTIME', 'FINISH_BREAK']);
    excludesAll(operationalBreak.available_pipelines, ['START_DOWNTIME', 'FINISH_PRODUCTION']);

    const operationalApprovedWork = await getOperatorWorkplaceState(asPool, actor(6));
    includesAll(operationalApprovedWork.available_pipelines, ['FINISH_DOWNTIME']);
    excludesAll(operationalApprovedWork.available_pipelines, ['START_ADDITIONAL_WORK']);

    const productionApprovedWork = await getOperatorWorkplaceState(asPool, actor(7));
    includesAll(productionApprovedWork.available_pipelines, ['FINISH_PRODUCTION']);
    excludesAll(productionApprovedWork.available_pipelines, ['START_ADDITIONAL_WORK']);

    const linkedCritical = await getOperatorWorkplaceState(asPool, actor(8));
    assert.equal(linkedCritical.downtime.slot_state, 'CRITICAL_ACTIVE');
    assert.ok(!linkedCritical.finish_shift.blockers.includes('OPERATIONAL_DOWNTIME'));
    includesAll(linkedCritical.available_pipelines, ['FINISH_DOWNTIME', 'FINISH_PRODUCTION', 'START_BREAK']);

    const machineLevelCritical = await getOperatorWorkplaceState(asPool, actor(9));
    assert.equal(machineLevelCritical.downtime.slot_state, 'NONE');
    excludesAll(machineLevelCritical.available_pipelines, ['FINISH_DOWNTIME']);

    const runningAdditionalWork = await getOperatorWorkplaceState(asPool, actor(10));
    includesAll(runningAdditionalWork.available_pipelines, ['FINISH_ADDITIONAL_WORK', 'START_PRODUCTION', 'START_DOWNTIME']);
    excludesAll(runningAdditionalWork.available_pipelines, ['START_BREAK', 'START_ADDITIONAL_WORK']);

    const pendingWorkplace = await getOperatorWorkplaceState(asPool, actor(11));
    assert.deepEqual(pendingWorkplace.finish_shift.warnings, []);
    excludesAll(pendingWorkplace.available_pipelines, ['START_ADDITIONAL_WORK']);

    const breakWithoutProduction = await getOperatorWorkplaceState(asPool, actor(12));
    assert.equal(breakWithoutProduction.break.is_active, true);
    includesAll(breakWithoutProduction.available_pipelines, ['FINISH_BREAK', 'START_PRODUCTION', 'START_DOWNTIME']);
    excludesAll(breakWithoutProduction.available_pipelines, ['START_BREAK', 'START_ADDITIONAL_WORK', 'FINISH_PRODUCTION']);

    const work6 = await getOperatorAdditionalWorkState(asPool, actor(6));
    assert.equal(work6.approved_additional_works.length, 1);
    const work10 = await getOperatorAdditionalWorkState(asPool, actor(10));
    assert.equal(work10.active_additional_works.length, 1);
    const work11 = await getOperatorAdditionalWorkState(asPool, actor(11));
    assert.equal(work11.pending_approval_additional_works.length, 1);

    const downtimeWithoutProduction = await getAvailableDowntimeTypes(asPool, actor(2));
    assert.ok(downtimeWithoutProduction.available_downtime_types.length > 0);
    assert.ok(downtimeWithoutProduction.available_downtime_types.every((item) => item.downtime_class === 'CRITICAL'));
    assert.ok(downtimeWithoutProduction.available_downtime_types.every((item) => item.requires_comment));

    const downtimeWithProduction = await getAvailableDowntimeTypes(asPool, actor(3));
    assert.ok(downtimeWithProduction.available_downtime_types.some((item) => item.downtime_class === 'OPERATIONAL'));
    assert.ok(downtimeWithProduction.available_downtime_types.some((item) => item.downtime_class === 'CRITICAL'));

    const machines = await getOperatorMachines(asPool, actor(3));
    assert.ok(machines.machines.some((item) => item.machine_id === '-772003'));
    const qrFound = await getOperatorMachineByQr(asPool, actor(3), 'wp-c-qr-3');
    assert.equal(qrFound.found, true);
    const qrMissing = await getOperatorMachineByQr(asPool, actor(3), 'wp-c-qr-missing');
    assert.deepEqual(qrMissing, { found: false, error_code: 'MACHINE_QR_NOT_FOUND' });

    const skus = await getOperatorSkus(asPool);
    assert.ok(skus.skus.some((item) => item.sku_id === '-771001' && typeof item.current_sku_tariff_uzs === 'number'));
    const breakTypes = await getOperatorBreakTypes(asPool);
    assert.ok(breakTypes.break_types.length > 0);
    const additionalWorkTypes = await getAvailableAdditionalWorkTypes(asPool, actor(2));
    assert.ok(
      additionalWorkTypes.additional_work_types.some((item) => item.additional_work_type_id === additionalWorkTypeId),
      'Additional work type catalog must expose active seeded type ids'
    );
    const pendingEmployeeAdditionalWorkTypes = await getAvailableAdditionalWorkTypes(asPool, actor(11));
    assert.ok(
      pendingEmployeeAdditionalWorkTypes.additional_work_types.every(
        (item) => item.additional_work_type_id !== additionalWorkTypeId
      ),
      'An unfinished employee/type assignment must be excluded from the request catalog'
    );

    const salary = await getOperatorSalaryTotals(asPool, actor(3));
    assert.deepEqual(salary.totals, { today_uzs: 10000, week_uzs: 10000, month_uzs: 10000 });
    assert.equal('breakdown' in salary, false);
    const salaryHistory = await getOperatorSalaryHistory(asPool, actor(3));
    assert.equal(salaryHistory.months.length, 2, 'Future salary row must be excluded from history');
    assert.equal(salaryHistory.months.reduce((sum, row) => sum + row.total_uzs, 0), 18000);

    const actor2 = await getOperatorWorkplaceState(asPool, actor(2));
    assert.equal(actor2.production.production_operation_id, null, 'Actor-scoped read must not expose another employee production');

    console.log('readmodels_executed=10');
    console.log('populated_combined_scenarios=22');
    console.log('WP_C_READMODEL_POSTGRES_HARNESS_PASS');
  } finally {
    try {
      await client.query('rollback');
    } finally {
      await client.end();
    }
  }

  console.log(`finished_at=${new Date().toISOString()}`);
}

main().catch((error: unknown) => {
  console.error('WP_C_READMODEL_POSTGRES_HARNESS_FAIL');
  console.error(error);
  process.exitCode = 1;
});
