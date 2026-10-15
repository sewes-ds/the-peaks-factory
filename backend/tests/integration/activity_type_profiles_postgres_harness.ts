import assert from 'node:assert/strict';
import { Client } from 'pg';
import { callRuntimeFunction } from '../../src/db/callRuntimeFunction.js';
import type { DbPool } from '../../src/db/pool.js';
import {
  getManagerCriticalDowntimeTypes,
  getManagerEmployees
} from '../../src/readModels/managerReadModels.js';
import {
  getAvailableDowntimeTypes,
  getOperatorBreakTypes,
  getOperatorMachines,
  getOperatorWorkplaceState
} from '../../src/readModels/operatorReadModels.js';

const databaseUrl = process.env.ACTIVITY_PROFILE_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('ACTIVITY_PROFILE_DATABASE_URL is required');
}

const client = new Client({ connectionString: databaseUrl });
const pool = client as unknown as DbPool;
const dictionaryManagerId = '-981001';
const operatorId = '-981002';
const otherOperatorId = '-981003';
const machineId = '-981001';
const skuId = '-981001';

const setupSql = String.raw`
create temporary table activity_profile_refs on commit drop as
select
  (select position_id from app.positions where is_active = true order by position_id limit 1) as position_id,
  (select employee_status_id from app.employee_statuses where is_active = true and is_active_for_login = true order by employee_status_id limit 1) as employee_status_id,
  (select role_id from app.roles where is_active = true and can_manage_dictionaries = true and can_manage_production = true order by role_id limit 1) as dictionary_manager_role_id,
  (select role_id from app.roles where is_active = true and can_work_as_operator = true order by role_id limit 1) as operator_role_id,
  (select machine_status_id from app.machine_statuses where is_active = true and is_available_for_start = true order by machine_status_id limit 1) as available_machine_status_id,
  (select machine_use_status_id from app.machine_use_statuses where is_active = true and is_available_for_operations = true order by machine_use_status_id limit 1) as machine_use_status_id,
  (select sku_unit_id from app.sku_units where is_active = true order by sku_unit_id limit 1) as sku_unit_id,
  (select operator_break_behavior_profile_id from app.operator_break_behavior_profiles where technical_code = 'standard_operator_break_v1' and is_active = true) as break_profile_id,
  (select machine_downtime_behavior_profile_id from app.machine_downtime_behavior_profiles where technical_code = 'operational_downtime_v1' and is_active = true) as operational_profile_id,
  (select machine_downtime_behavior_profile_id from app.machine_downtime_behavior_profiles where technical_code = 'critical_repair_downtime_v1' and is_active = true) as critical_profile_id;

do $$
begin
  if exists (
    select 1
    from activity_profile_refs
    where position_id is null
       or employee_status_id is null
       or dictionary_manager_role_id is null
       or operator_role_id is null
       or available_machine_status_id is null
       or machine_use_status_id is null
       or sku_unit_id is null
       or break_profile_id is null
       or operational_profile_id is null
       or critical_profile_id is null
  ) then
    raise exception 'activity profile harness reference data is incomplete';
  end if;
end $$;

insert into app.employees (
  employee_id, full_name, phone_e164, telegram_user_id, position_id, employee_status_id
) overriding system value
select -981001, 'Activity Profile Manager', '+998909810001', -981001, position_id, employee_status_id
from activity_profile_refs
union all
select -981002, 'Activity Profile Operator', '+998909810002', -981002, position_id, employee_status_id
from activity_profile_refs
union all
select -981003, 'Activity Profile Other Operator', '+998909810003', -981003, position_id, employee_status_id
from activity_profile_refs;

insert into app.employee_roles (
  employee_role_id, employee_id, role_id, assigned_by_employee_id
) overriding system value
select -981001, -981001, dictionary_manager_role_id, -981001 from activity_profile_refs
union all
select -981002, -981002, operator_role_id, -981001 from activity_profile_refs
union all
select -981003, -981003, operator_role_id, -981001 from activity_profile_refs;

insert into app.machines (
  machine_id, machine_name, workshop_name, machine_qr_token, machine_status_id, machine_use_status_id
) overriding system value
select -981001, 'Activity Profile Machine', 'Isolated Preview', 'activity-profile-machine', available_machine_status_id, machine_use_status_id
from activity_profile_refs;

insert into app.skus (
  sku_id, sku_code, sku_name, sku_qr_token, sku_unit_id, current_sku_tariff_uzs, is_active
) overriding system value
select -981001, 'ACTIVITY-PROFILE-SKU', 'Activity Profile SKU', repeat('A', 32), sku_unit_id, 1000, true
from activity_profile_refs;
`;

async function runtime<TResult>(
  functionName: Parameters<typeof callRuntimeFunction<TResult>>[1]['functionName'],
  params: readonly unknown[]
): Promise<TResult> {
  return callRuntimeFunction<TResult>(pool, { functionName, params });
}

async function expectSqlState(action: () => Promise<unknown>, expectedCode: string): Promise<void> {
  await client.query('savepoint expected_failure');
  try {
    await assert.rejects(action, (error: unknown) => (error as { code?: string }).code === expectedCode);
  } finally {
    await client.query('rollback to savepoint expected_failure');
    await client.query('release savepoint expected_failure');
  }
}

async function main(): Promise<void> {
  await client.connect();
  await client.query('begin');

  try {
    await client.query(setupSql);
    const refs = (
      await client.query<{
        break_profile_id: string;
        operational_profile_id: string;
        critical_profile_id: string;
      }>('select break_profile_id::text, operational_profile_id::text, critical_profile_id::text from activity_profile_refs')
    ).rows[0];
    assert.ok(refs);

    await client.query('set local role app_runtime_role');
    const identity = await client.query<{ current_user: string }>('select current_user');
    assert.equal(identity.rows[0]?.current_user, 'app_runtime_role');

    const previewBreakProfileId = String(await runtime<string | number | bigint>('create_operator_break_behavior_profile', [
      dictionaryManagerId,
      'preview_operator_break_v1',
      'Контрольный профиль перерыва v1',
      true,
      true,
      true,
      true,
      true,
      'Проверка создания профиля перерыва через API'
    ]));
    assert.ok(previewBreakProfileId);
    const previewOperationalProfileId = String(await runtime<string | number | bigint>('create_operational_downtime_behavior_profile', [
      dictionaryManagerId,
      'preview_operational_downtime_v1',
      'Контрольный профиль операционного простоя v1',
      false,
      true,
      true,
      'Проверка создания профиля операционного простоя через API'
    ]));
    await runtime('create_operational_downtime_notification_rule', [
      dictionaryManagerId,
      previewOperationalProfileId,
      'production_after_15m_preview',
      15,
      'can_receive_production_notifications',
      'ELAPSED_THRESHOLD',
      10,
      'Проверка уведомления производства через API'
    ]);
    await runtime('create_operational_downtime_notification_rule', [
      dictionaryManagerId,
      previewOperationalProfileId,
      'director_after_30m_preview',
      30,
      'can_receive_director_notifications',
      'ELAPSED_THRESHOLD',
      20,
      'Проверка уведомления директора через API'
    ]);
    const previewCriticalProfileId = String(await runtime<string | number | bigint>('create_critical_downtime_behavior_profile', [
      dictionaryManagerId,
      'preview_critical_downtime_v1',
      'Контрольный профиль критического простоя v1',
      true,
      false,
      false,
      'BROKEN',
      'Проверка создания профиля критического простоя через API'
    ]));
    const previewCriticalProductionRuleId = String(await runtime<string | number | bigint>('create_critical_downtime_notification_rule', [
      dictionaryManagerId,
      previewCriticalProfileId,
      'production_immediate_preview',
      0,
      'can_receive_production_notifications',
      'TYPE_IMMEDIATE',
      10,
      'Проверка немедленного уведомления производства через API'
    ]));
    const previewCriticalDirectorRuleId = String(await runtime<string | number | bigint>('create_critical_downtime_notification_rule', [
      dictionaryManagerId,
      previewCriticalProfileId,
      'director_after_30m_preview',
      30,
      'can_receive_director_notifications',
      'ELAPSED_THRESHOLD',
      20,
      'Проверка уведомления директора через API'
    ]));
    const profileBackedOperationalTypeId = String(await runtime<string | number | bigint>('create_operational_downtime_type', [
      dictionaryManagerId,
      'profile_backed_operational_preview',
      'Контроль нового профиля',
      40,
      previewOperationalProfileId,
      'Проверка назначения нового валидированного профиля через API'
    ]));
    assert.ok(profileBackedOperationalTypeId);

    const breakTypeId = String(await runtime<string | number | bigint>('create_operator_break_type', [
      dictionaryManagerId,
      'technical_break_preview',
      'Технический перерыв',
      30,
      refs.break_profile_id,
      'Проверка расширяемости перерывов'
    ]));
    const operationalTypeId = String(await runtime<string | number | bigint>('create_operational_downtime_type', [
      dictionaryManagerId,
      'parts_waiting_preview',
      'Ожидание комплектующих',
      30,
      refs.operational_profile_id,
      'Проверка расширяемости операционных простоев'
    ]));
    const criticalTypeId = String(await runtime<string | number | bigint>('create_critical_downtime_type', [
      dictionaryManagerId,
      'electrical_failure_preview',
      'Авария электрики',
      30,
      refs.critical_profile_id,
      'Проверка расширяемости критических простоев'
    ]));

    await expectSqlState(
      () => runtime('create_operational_downtime_type', [
        dictionaryManagerId,
        'invalid_cross_class_preview',
        'Недопустимое межклассовое назначение',
        40,
        previewCriticalProfileId,
        'Негативная проверка класса'
      ]),
      '22023'
    );

    await runtime('deactivate_operator_break_behavior_profile', [
      dictionaryManagerId,
      previewBreakProfileId,
      'Проверка деактивации неиспользованного профиля перерыва'
    ]);
    await runtime('deactivate_operational_downtime_type', [
      dictionaryManagerId,
      profileBackedOperationalTypeId,
      'Проверка деактивации неиспользованного вида простоя'
    ]);
    await runtime('deactivate_operational_downtime_behavior_profile', [
      dictionaryManagerId,
      previewOperationalProfileId,
      'Проверка деактивации профиля после деактивации вида'
    ]);
    await runtime('deactivate_critical_downtime_notification_rule', [
      dictionaryManagerId,
      previewCriticalProductionRuleId,
      'Проверка деактивации неиспользованного правила'
    ]);
    await runtime('deactivate_critical_downtime_notification_rule', [
      dictionaryManagerId,
      previewCriticalDirectorRuleId,
      'Проверка деактивации неиспользованного правила'
    ]);
    await runtime('deactivate_critical_downtime_behavior_profile', [
      dictionaryManagerId,
      previewCriticalProfileId,
      'Проверка деактивации неиспользованного критического профиля'
    ]);

    const breakCatalog = await getOperatorBreakTypes(pool);
    assert.ok(breakCatalog.break_types.some((item) => item.break_type_id === breakTypeId && item.display_name === 'Технический перерыв'));

    const noProductionDowntimes = await getAvailableDowntimeTypes(pool, {
      employeeId: BigInt(operatorId),
      telegramUserId: -981002n
    });
    assert.ok(noProductionDowntimes.available_downtime_types.some((item) =>
      item.downtime_type_id === criticalTypeId
      && item.downtime_class === 'CRITICAL'
      && item.requires_comment
      && item.ui_color_token === 'scarlet'
    ));
    assert.ok(!noProductionDowntimes.available_downtime_types.some((item) => item.downtime_type_id === operationalTypeId));

    const managerCriticalCatalog = await getManagerCriticalDowntimeTypes(pool, {
      employeeId: BigInt(dictionaryManagerId),
      telegramUserId: -981001n
    });
    assert.ok(managerCriticalCatalog.downtime_types.some((item) =>
      item.downtime_type_id === criticalTypeId && item.downtime_type_name === 'Авария электрики'
    ));

    const shiftId = String(await runtime<string | number | bigint>('start_employee_shift', [operatorId]));
    assert.ok(shiftId);
    const otherShiftId = String(await runtime<string | number | bigint>('start_employee_shift', [otherOperatorId]));
    assert.ok(otherShiftId);
    const breakId = String(await runtime<string | number | bigint>('start_operator_break', [operatorId, breakTypeId]));
    assert.ok(breakId);
    const duringBreak = await getOperatorWorkplaceState(pool, {
      employeeId: BigInt(operatorId),
      telegramUserId: -981002n
    });
    assert.equal(duringBreak.break.break_type_name, 'Технический перерыв');
    assert.ok(duringBreak.finish_shift.blockers.includes('BREAK'));
    await runtime('finish_operator_break', [operatorId]);

    const productionId = String(await runtime<string | number | bigint>('start_production_operation', [operatorId, machineId, skuId]));
    const ownMachineList = await getOperatorMachines(pool, {
      employeeId: BigInt(operatorId), telegramUserId: -981002n
    });
    const foreignMachineList = await getOperatorMachines(pool, {
      employeeId: BigInt(otherOperatorId), telegramUserId: -981003n
    });
    assert.equal(
      ownMachineList.machines.find((item) => item.machine_id === machineId)?.is_selectable_for_critical_downtime,
      true
    );
    assert.equal(
      foreignMachineList.machines.find((item) => item.machine_id === machineId)?.is_selectable_for_critical_downtime,
      false
    );
    const withProduction = await getAvailableDowntimeTypes(pool, {
      employeeId: BigInt(operatorId),
      telegramUserId: -981002n
    });
    assert.ok(withProduction.available_downtime_types.some((item) =>
      item.downtime_type_id === operationalTypeId
      && item.downtime_class === 'OPERATIONAL'
      && item.requires_production_operation
      && !item.requires_comment
      && item.ui_color_token === 'yellow'
    ));

    const operationalDowntimeId = String(await runtime<string | number | bigint>('start_machine_downtime', [
      operatorId,
      machineId,
      operationalTypeId,
      productionId,
      null
    ]));
    const operationalState = await getOperatorWorkplaceState(pool, {
      employeeId: BigInt(operatorId),
      telegramUserId: -981002n
    });
    assert.equal(operationalState.downtime.slot_state, 'OPERATIONAL_ACTIVE');
    assert.ok(operationalState.finish_shift.blockers.includes('OPERATIONAL_DOWNTIME'));

    await client.query('reset role');
    await client.query(
      "update app.machine_downtimes set started_at = now() - interval '16 minutes' where machine_downtime_id = $1",
      [operationalDowntimeId]
    );
    await client.query('set local role app_runtime_role');
    await runtime('scan_active_downtimes_for_notifications', []);
    const operationalNotifications = await client.query<{ title: string }>(`
      select n.title
      from app.notifications n
      where n.cause_table_name = 'machine_downtimes'
        and n.cause_record_id = $1
    `, [operationalDowntimeId]);
    assert.ok(operationalNotifications.rows.some((row) => row.title === 'Простой больше 15 минут'));

    await runtime('finish_machine_downtime', [operatorId, operationalDowntimeId, null, null]);

    await expectSqlState(
      () => runtime('start_machine_downtime', [
        otherOperatorId,
        machineId,
        criticalTypeId,
        null,
        'Попытка изменить чужой занятый станок'
      ]),
      '42501'
    );

    const managerCriticalDowntimeId = String(await runtime<string | number | bigint>('start_machine_downtime', [
      dictionaryManagerId,
      machineId,
      criticalTypeId,
      null,
      'Критический простой Начальника производства'
    ]));
    const managerCriticalLink = await client.query<{ production_operation_id: string | null }>(`
      select production_operation_id::text
      from app.machine_downtimes
      where machine_downtime_id = $1
    `, [managerCriticalDowntimeId]);
    assert.equal(managerCriticalLink.rows[0]?.production_operation_id, productionId);

    const managerEmployees = await getManagerEmployees(pool, {
      employeeId: BigInt(dictionaryManagerId), telegramUserId: -981001n
    });
    const workingEmployee = managerEmployees.employees.find((employee) => employee.employee_id === operatorId);
    assert.ok(workingEmployee);
    assert.equal(workingEmployee.ui_state, 'critical_down');
    assert.equal(workingEmployee.ui_variant, 'red');

    const operatorCriticalState = await getOperatorWorkplaceState(pool, {
      employeeId: BigInt(operatorId), telegramUserId: -981002n
    });
    assert.equal(operatorCriticalState.downtime.slot_state, 'CRITICAL_ACTIVE');
    assert.equal(operatorCriticalState.downtime.downtime_id, managerCriticalDowntimeId);

    await runtime('finish_machine_downtime', [
      dictionaryManagerId,
      managerCriticalDowntimeId,
      'Контроль завершён',
      'Завершение cross-role проверки'
    ]);
    await runtime('finish_production_operation', [operatorId, productionId, 1, null]);

    const criticalDowntimeId = String(await runtime<string | number | bigint>('start_machine_downtime', [
      operatorId,
      machineId,
      criticalTypeId,
      null,
      'Повреждение силового кабеля'
    ]));
    const machineStatus = await client.query<{ machine_status_name: string }>(`
      select ms.machine_status_name
      from app.machines m
      join app.machine_statuses ms on ms.machine_status_id = m.machine_status_id
      where m.machine_id = $1
    `, [machineId]);
    assert.equal(machineStatus.rows[0]?.machine_status_name, 'Сломан');

    await runtime('scan_active_downtimes_for_notifications', []);
    const criticalNotifications = await client.query<{ title: string; message_text: string }>(`
      select n.title, n.message_text
      from app.notifications n
      where n.cause_table_name = 'machine_downtimes'
        and n.cause_record_id = $1
    `, [criticalDowntimeId]);
    assert.ok(criticalNotifications.rows.some((row) =>
      row.title === 'Авария электрики'
      && row.message_text === 'Станок #-981001: авария электрики.'
    ));

    await expectSqlState(
      () => runtime('deactivate_critical_downtime_type', [
        dictionaryManagerId,
        criticalTypeId,
        'Негативная проверка открытого простоя'
      ]),
      'P0001'
    );

    await runtime('finish_employee_shift', [operatorId]);
    await runtime('finish_employee_shift', [otherOperatorId]);
    await runtime('finish_machine_downtime', [
      dictionaryManagerId,
      criticalDowntimeId,
      'Неисправность устранена',
      'Завершение контрольного критического простоя'
    ]);

    await client.query('reset role');
    const auditRows = await client.query<{ action_name: string }>(`
      select action_name
      from app.audit_events
      where actor_employee_id = $1
        and action_name in (
          'create_operator_break_behavior_profile',
          'create_operator_break_type',
          'create_operational_downtime_behavior_profile',
          'create_operational_downtime_notification_rule',
          'create_operational_downtime_type',
          'create_critical_downtime_behavior_profile',
          'create_critical_downtime_notification_rule',
          'create_critical_downtime_type'
        )
      order by action_name
    `, [dictionaryManagerId]);
    assert.equal(auditRows.rowCount, 11);

    console.log('ACTIVITY_TYPE_PROFILES_POSTGRES_HARNESS_PASS');
  } finally {
    await client.query('rollback');
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('ACTIVITY_TYPE_PROFILES_POSTGRES_HARNESS_FAIL');
  console.error(error);
  process.exitCode = 1;
});
