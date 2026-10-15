\set ON_ERROR_STOP on

do $migration_postconditions$
declare
    v_context _r3_context%rowtype;
    v_machine_sequence bigint;
    v_sku_sequence bigint;
begin
    select * into strict v_context from _r3_context;

    if v_context.mode not in ('APPLY', 'NOOP') then
        raise exception using errcode = '55000', message = 'R3_VERIFY_MODE_MISSING';
    end if;

    if (select count(*) from app.machines) <> 14
       or (select count(*) from app.skus) <> 162
       or (select count(distinct machine_qr_token) from app.machines) <> 14 then
        raise exception using errcode = '55000', message = 'R3_VERIFY_TARGET_COUNTS_FAILED';
    end if;

    if exists (
        select 1
        from app.machines m
        join _r3_machine_stage stage on stage.source_machine_id = m.machine_id
        where m.machine_name is distinct from stage.machine_name
           or m.workshop_name is not null
           or m.machine_qr_token is distinct from stage.generated_protected_qr_token
           or m.machine_status_id <> v_context.available_machine_status_id
           or m.machine_use_status_id <> v_context.available_machine_use_status_id
           or m.created_at <> v_context.migration_timestamp
           or m.updated_at <> v_context.migration_timestamp
    ) or (select count(*) from app.machines m join _r3_machine_stage stage on stage.source_machine_id = m.machine_id) <> 14 then
        raise exception using errcode = '55000', message = 'R3_VERIFY_MACHINE_EQUALITY_FAILED';
    end if;

    if exists (
        select 1
        from app.skus s
        join _r3_sku_stage stage on stage.source_sku_id = s.sku_id
        where s.sku_code is distinct from stage.sku_code
           or s.sku_name is distinct from stage.sku_name
           or s.sku_unit_id <> v_context.piece_sku_unit_id
           or s.planned_productivity_per_hour is not null
           or s.current_sku_tariff_uzs is distinct from stage.current_sku_tariff_uzs
           or s.is_active is not true
           or s.created_at <> v_context.migration_timestamp
           or s.updated_at <> v_context.migration_timestamp
    ) or (select count(*) from app.skus s join _r3_sku_stage stage on stage.source_sku_id = s.sku_id) <> 162 then
        raise exception using errcode = '55000', message = 'R3_VERIFY_SKU_EQUALITY_FAILED';
    end if;

    if (select count(*) from app.production_operations) <> v_context.production_operations_before
       or (select count(*) from app.machine_downtimes) <> v_context.machine_downtimes_before
       or (select count(*) from app.machine_status_events) <> v_context.machine_status_events_before
       or (select count(*) from app.employee_salary_entries) <> v_context.salary_entries_before then
        raise exception using errcode = '55000', message = 'R3_VERIFY_UNRELATED_TABLE_CHANGED';
    end if;

    select last_value into v_machine_sequence from app.machines_machine_id_seq;
    select last_value into v_sku_sequence from app.skus_sku_id_seq;
    if v_machine_sequence < 14 or v_sku_sequence < 162 then
        raise exception using errcode = '55000', message = 'R3_VERIFY_IDENTITY_SEQUENCE_FAILED';
    end if;
end;
$migration_postconditions$;

select
    'R3_MIGRATION_PASS'
    || '|mode=' || mode
    || '|machines=14'
    || '|skus=162'
    || '|qr_distinct=14'
from _r3_context;
