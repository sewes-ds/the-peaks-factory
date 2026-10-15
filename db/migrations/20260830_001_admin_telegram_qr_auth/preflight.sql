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
    v_table_exists boolean;
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
            message = 'ADMIN_TELEGRAM_QR_PREFLIGHT_MIGRATION_OR_ADMIN_ROLE_REQUIRED';
    end if;

    if to_regclass('app.employees') is null
       or to_regclass('app.employee_roles') is null
       or to_regclass('app.roles') is null
       or to_regclass('app.admin_sessions') is null
       or to_regprocedure('app.start_admin_password_session(bigint,text,text,text,text)') is null
       or to_regprocedure('app.resolve_admin_session(text)') is null
       or to_regprocedure('app._insert_audit_event(bigint,text,text,bigint,jsonb,jsonb,text)') is null then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_TELEGRAM_QR_PREFLIGHT_REQUIRED_BASELINE_MISSING';
    end if;

    v_table_exists := to_regclass('app.admin_telegram_qr_challenges') is not null;

    select count(*)
    into v_function_count
    from unnest(array[
        'app.create_admin_telegram_qr_challenge(text,text,text,text)',
        'app.confirm_admin_telegram_qr_challenge(text,bigint)',
        'app.claim_admin_telegram_qr_challenge(bigint,text,text,text,text,text)'
    ]) expected(signature)
    where to_regprocedure(expected.signature) is not null;

    if not v_table_exists and v_function_count = 0 then
        return;
    end if;

    if v_table_exists and v_function_count = 3 then
        return;
    end if;

    raise exception using
        errcode = '55000',
        message = 'ADMIN_TELEGRAM_QR_PREFLIGHT_PARTIAL_OR_DIVERGENT_STATE';
end;
$preflight$;

select (
    to_regclass('app.admin_telegram_qr_challenges') is null
)::text as admin_telegram_qr_apply
\gset
