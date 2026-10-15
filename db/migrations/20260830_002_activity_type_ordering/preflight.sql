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
    v_move_exists boolean;
    v_create_is_current boolean;
    v_global_name_constraint_exists boolean;
    v_class_name_constraint_exists boolean;
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
            message = 'ACTIVITY_ORDER_PREFLIGHT_MIGRATION_OR_ADMIN_ROLE_REQUIRED';
    end if;

    if to_regclass('app.operator_break_types') is null
       or to_regclass('app.machine_downtime_types') is null
       or to_regclass('app.admin_sessions') is null
       or to_regprocedure('app._require_admin_session_actor(text)') is null
       or to_regprocedure('app._insert_audit_event(bigint,text,text,bigint,jsonb,jsonb,text)') is null
       or to_regprocedure('app.create_admin_activity_type(text,text,text,text,integer,bigint,text)') is null
       or to_regprocedure('app.deactivate_admin_activity_type(text,text,bigint,text)') is null then
        raise exception using
            errcode = '55000',
            message = 'ACTIVITY_ORDER_PREFLIGHT_REQUIRED_BASELINE_MISSING';
    end if;

    v_move_exists := to_regprocedure(
        'app.move_admin_activity_type(text,text,bigint,text)'
    ) is not null;

    select exists (
        select 1
        from pg_catalog.pg_constraint c
        where c.conrelid = 'app.machine_downtime_types'::regclass
          and c.conname = 'machine_downtime_types_machine_downtime_type_name_uniq'
    ) into v_global_name_constraint_exists;
    select exists (
        select 1
        from pg_catalog.pg_constraint c
        where c.conrelid = 'app.machine_downtime_types'::regclass
          and c.conname = 'machine_downtime_types_class_name_uniq'
          and pg_get_constraintdef(c.oid) = 'UNIQUE (downtime_class, machine_downtime_type_name)'
    ) into v_class_name_constraint_exists;

    select position('p_technical_code is null' in lower(pg_get_functiondef(p.oid))) > 0
       and position('admin_activity_order:' in pg_get_functiondef(p.oid)) > 0
    into strict v_create_is_current
    from pg_catalog.pg_proc p
    where p.oid = 'app.create_admin_activity_type(text,text,text,text,integer,bigint,text)'::regprocedure;

    if not v_move_exists
       and not v_create_is_current
       and v_global_name_constraint_exists
       and not v_class_name_constraint_exists then
        return;
    end if;
    if v_move_exists
       and v_create_is_current
       and not v_global_name_constraint_exists
       and v_class_name_constraint_exists then
        return;
    end if;

    raise exception using
        errcode = '55000',
        message = 'ACTIVITY_ORDER_PREFLIGHT_PARTIAL_OR_DIVERGENT_STATE';
end;
$preflight$;

select (
    to_regprocedure('app.move_admin_activity_type(text,text,bigint,text)') is null
)::text as activity_order_apply
\gset
