\set ON_ERROR_STOP on

set local lock_timeout = '5s';
set local statement_timeout = '5min';
set local idle_in_transaction_session_timeout = '5min';

select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(:'package_id', 0)
);

create temporary table _r3_context (
    package_id text not null,
    target_commit text not null,
    migration_timestamp timestamptz not null,
    available_machine_status_id bigint not null,
    available_machine_use_status_id bigint not null,
    piece_sku_unit_id bigint not null,
    machines_before bigint not null,
    skus_before bigint not null,
    production_operations_before bigint not null,
    machine_downtimes_before bigint not null,
    machine_status_events_before bigint not null,
    salary_entries_before bigint not null,
    mode text null
) on commit drop;

create temporary table _r3_parameters (
    package_id text not null,
    target_commit text not null,
    migration_timestamp timestamptz not null
) on commit drop;

insert into _r3_parameters (package_id, target_commit, migration_timestamp)
values (:'package_id', :'target_commit', :'migration_timestamp'::timestamptz);

create temporary table _r3_machine_stage (
    source_machine_id bigint not null,
    machine_name text not null,
    generated_protected_qr_token text not null
) on commit drop;

create temporary table _r3_sku_stage (
    source_sku_id bigint not null,
    sku_code text not null,
    sku_name text not null,
    source_sku_unit_name text not null,
    current_sku_tariff_uzs numeric(18,4) not null
) on commit drop;

do $migration_preflight$
declare
    v_is_superuser boolean;
    v_machine_status_id bigint;
    v_machine_use_status_id bigint;
    v_sku_unit_id bigint;
    v_machines bigint;
    v_skus bigint;
begin
    select r.rolsuper into strict v_is_superuser
    from pg_catalog.pg_roles r
    where r.rolname = current_user;

    if current_user = 'app_runtime_role'
       or not (
           v_is_superuser
           or current_user = 'migration_role'
           or pg_catalog.pg_has_role(current_user, 'migration_role', 'MEMBER')
       ) then
        raise exception using errcode = '42501', message = 'R3_PREFLIGHT_MIGRATION_OR_ADMIN_ROLE_REQUIRED';
    end if;

    if not v_is_superuser and not (
        has_table_privilege(current_user, 'app.machines', 'INSERT')
        and has_table_privilege(current_user, 'app.skus', 'INSERT')
        and has_sequence_privilege(current_user, 'app.machines_machine_id_seq', 'UPDATE')
        and has_sequence_privilege(current_user, 'app.skus_sku_id_seq', 'UPDATE')
    ) then
        raise exception using errcode = '42501', message = 'R3_PREFLIGHT_REQUIRED_DML_PRIVILEGES_MISSING';
    end if;

    if to_regclass('app.machines') is null
       or to_regclass('app.skus') is null
       or to_regclass('app.machine_statuses') is null
       or to_regclass('app.machine_use_statuses') is null
       or to_regclass('app.sku_units') is null
       or to_regclass('app.production_operations') is null
       or to_regclass('app.machine_downtimes') is null
       or to_regclass('app.machine_status_events') is null
       or to_regclass('app.employee_salary_entries') is null then
        raise exception using errcode = '55000', message = 'R3_PREFLIGHT_REQUIRED_SCHEMA_MISSING';
    end if;

    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'app' and table_name = 'machines'
          and column_name = 'machine_id' and is_identity = 'YES' and identity_generation = 'ALWAYS'
    ) or not exists (
        select 1 from information_schema.columns
        where table_schema = 'app' and table_name = 'skus'
          and column_name = 'sku_id' and is_identity = 'YES' and identity_generation = 'ALWAYS'
    ) then
        raise exception using errcode = '55000', message = 'R3_PREFLIGHT_IDENTITY_CONTRACT_MISMATCH';
    end if;

    select ms.machine_status_id into strict v_machine_status_id
    from app.machine_statuses ms
    where ms.machine_status_name = 'Свободен'
      and ms.is_active = true
      and ms.is_available_for_start = true
      and ms.is_running_status = false
      and ms.is_downtime_status = false
      and ms.is_broken_status = false;

    select mus.machine_use_status_id into strict v_machine_use_status_id
    from app.machine_use_statuses mus
    where mus.machine_use_status_name = 'Используется'
      and mus.is_active = true
      and mus.is_available_for_operations = true
      and mus.is_decommissioned = false;

    select su.sku_unit_id into strict v_sku_unit_id
    from app.sku_units su
    where su.sku_unit_name = 'шт'
      and su.is_active = true
      and su.allows_fractional_quantity = false;

    select count(*) into v_machines from app.machines;
    select count(*) into v_skus from app.skus;

    if not ((v_machines = 0 and v_skus = 0) or (v_machines = 14 and v_skus = 162)) then
        raise exception using errcode = '55000', message = 'R3_PREFLIGHT_PARTIAL_OR_UNEXPECTED_TARGET_COUNTS';
    end if;

    insert into _r3_context (
        package_id,
        target_commit,
        migration_timestamp,
        available_machine_status_id,
        available_machine_use_status_id,
        piece_sku_unit_id,
        machines_before,
        skus_before,
        production_operations_before,
        machine_downtimes_before,
        machine_status_events_before,
        salary_entries_before
    )
    select
        p.package_id,
        p.target_commit,
        p.migration_timestamp,
        v_machine_status_id,
        v_machine_use_status_id,
        v_sku_unit_id,
        v_machines,
        v_skus,
        (select count(*) from app.production_operations),
        (select count(*) from app.machine_downtimes),
        (select count(*) from app.machine_status_events),
        (select count(*) from app.employee_salary_entries)
    from _r3_parameters p;
end;
$migration_preflight$;
