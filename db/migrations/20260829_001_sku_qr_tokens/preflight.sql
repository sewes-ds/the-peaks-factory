\set ON_ERROR_STOP on

set local lock_timeout = '5s';
set local statement_timeout = '5min';
set local idle_in_transaction_session_timeout = '5min';

select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(:'package_id', 0));

create temporary table _sku_qr_context (
    package_id text not null,
    target_commit text not null,
    column_existed boolean not null,
    skus_before bigint not null,
    production_operations_before bigint not null,
    machine_downtimes_before bigint not null,
    salary_entries_before bigint not null,
    mode text null
) on commit drop;

create temporary table _sku_qr_parameters (
    package_id text not null,
    target_commit text not null
) on commit drop;

insert into _sku_qr_parameters (package_id, target_commit)
values (:'package_id', :'target_commit');

create temporary table _sku_qr_stage (
    sku_id bigint not null,
    sku_code text not null,
    generated_protected_qr_token text not null
) on commit drop;

do $preflight$
declare
    v_is_superuser boolean;
    v_column_exists boolean;
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
        raise exception using errcode = '42501', message = 'SKU_QR_PREFLIGHT_MIGRATION_OR_ADMIN_ROLE_REQUIRED';
    end if;

    if to_regclass('app.skus') is null
       or to_regclass('app.production_operations') is null
       or to_regclass('app.machine_downtimes') is null
       or to_regclass('app.employee_salary_entries') is null
       or to_regprocedure('app._assert_nonempty_text(text,text)') is null
       or to_regprocedure('app._assert_actor_has_any_permission(bigint,text[])') is null
       or to_regprocedure('app._insert_audit_event(bigint,text,text,bigint,jsonb,jsonb,text)') is null then
        raise exception using errcode = '55000', message = 'SKU_QR_PREFLIGHT_REQUIRED_BASELINE_MISSING';
    end if;

    if (select count(*) from app.skus) <> 162 then
        raise exception using errcode = '55000', message = 'SKU_QR_PREFLIGHT_SKU_COUNT_MISMATCH';
    end if;

    select exists (
        select 1 from information_schema.columns
        where table_schema = 'app' and table_name = 'skus' and column_name = 'sku_qr_token'
    ) into v_column_exists;

    if not v_column_exists and to_regprocedure('app.rotate_sku_qr_token(bigint,bigint,text,text)') is not null then
        raise exception using errcode = '55000', message = 'SKU_QR_PREFLIGHT_PARTIAL_FUNCTION_STATE';
    end if;

    insert into _sku_qr_context (
        package_id, target_commit, column_existed, skus_before,
        production_operations_before, machine_downtimes_before, salary_entries_before
    )
    select
        p.package_id, p.target_commit, v_column_exists, (select count(*) from app.skus),
        (select count(*) from app.production_operations),
        (select count(*) from app.machine_downtimes),
        (select count(*) from app.employee_salary_entries)
    from _sku_qr_parameters p;
end;
$preflight$;
