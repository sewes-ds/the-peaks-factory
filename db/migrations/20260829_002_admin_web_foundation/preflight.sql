\set ON_ERROR_STOP on

begin;
set local lock_timeout = '5s';
set local statement_timeout = '5min';
set local idle_in_transaction_session_timeout = '5min';

select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(:'package_id', 0)
);

do $preflight$
declare
    v_is_superuser boolean;
    v_column_exists boolean;
    v_credentials_table_exists boolean;
    v_sessions_table_exists boolean;
    v_function_count integer;
begin
    select r.rolsuper
    into strict v_is_superuser
    from pg_catalog.pg_roles r
    where r.rolname = current_user;

    if current_user = 'app_runtime_role'
       or not (
           v_is_superuser
           or current_user = 'migration_role'
           or pg_catalog.pg_has_role(current_user, 'migration_role', 'MEMBER')
       ) then
        raise exception using
            errcode = '42501',
            message = 'ADMIN_AUTH_PREFLIGHT_MIGRATION_OR_ADMIN_ROLE_REQUIRED';
    end if;

    if to_regclass('app.roles') is null
       or to_regclass('app.employees') is null
       or to_regclass('app.employee_roles') is null
       or to_regclass('app.audit_events') is null
       or to_regprocedure('app._insert_audit_event(bigint,text,text,bigint,jsonb,jsonb,text)') is null then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_AUTH_PREFLIGHT_REQUIRED_BASELINE_MISSING';
    end if;

    if (select count(*) from app.roles) <> 5
       or (
           select count(*)
           from app.roles
           where role_name in (
               'Рабочий',
               'Руководитель производства',
               'Руководитель администрации',
               'Директор',
               'Администратор системы'
           )
       ) <> 5 then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_AUTH_PREFLIGHT_ROLE_SEED_MISMATCH';
    end if;

    select exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'app'
          and c.table_name = 'roles'
          and c.column_name = 'can_access_admin_panel'
    ) into v_column_exists;

    v_credentials_table_exists := to_regclass('app.admin_password_credentials') is not null;
    v_sessions_table_exists := to_regclass('app.admin_sessions') is not null;

    select count(*)
    into v_function_count
    from unnest(array[
        'app.read_admin_password_credential(text)',
        'app.record_admin_password_failure(bigint)',
        'app.start_admin_password_session(bigint,text,text,text,text)',
        'app.resolve_admin_session(text)',
        'app.read_admin_password_credential_for_session(text)',
        'app.change_admin_password(text,text)',
        'app.revoke_admin_session(text,text)',
        'app.read_admin_overview(text)',
        'app.read_admin_directory(text)',
        'app.prepare_admin_qr_label(text,text,bigint)',
        'app.save_admin_employee(text,bigint,text,text,bigint,bigint,text)',
        'app.save_admin_position(text,bigint,text,text,boolean,boolean,text)',
        'app.save_admin_machine(text,bigint,text,text,bigint,text,text)',
        'app.save_admin_sku(text,bigint,text,text,bigint,numeric,numeric,boolean,text,text)',
        'app.save_admin_additional_work_type(text,bigint,text,boolean,text)',
        'app.create_admin_activity_type(text,text,text,text,integer,bigint,text)',
        'app.deactivate_admin_activity_type(text,text,bigint,text)'
    ]) expected(signature)
    where to_regprocedure(expected.signature) is not null;

    if not v_column_exists
       and not v_credentials_table_exists
       and not v_sessions_table_exists
       and v_function_count = 0 then
        return;
    end if;

    if v_column_exists
       and v_credentials_table_exists
       and v_sessions_table_exists
       and v_function_count = 17 then
        return;
    end if;

    raise exception using
        errcode = '55000',
        message = 'ADMIN_AUTH_PREFLIGHT_PARTIAL_OR_DIVERGENT_STATE';
end;
$preflight$;

select (
    not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'app'
          and c.table_name = 'roles'
          and c.column_name = 'can_access_admin_panel'
    )
)::text as admin_auth_apply
\gset
