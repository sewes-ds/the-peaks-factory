\set ON_ERROR_STOP on

do $verify$
declare
    v_create_definition text;
    v_move_definition text;
    v_runtime_api_count integer;
    v_internal_helper_count integer;
    v_maintenance_api_count integer;
begin
    if to_regprocedure('app.create_admin_activity_type(text,text,text,text,integer,bigint,text)') is null
       or to_regprocedure('app.move_admin_activity_type(text,text,bigint,text)') is null then
        raise exception using
            errcode = '55000',
            message = 'ACTIVITY_ORDER_VERIFY_FUNCTION_MISSING';
    end if;

    if exists (
        select 1
        from pg_catalog.pg_constraint c
        where c.conrelid = 'app.machine_downtime_types'::regclass
          and c.conname = 'machine_downtime_types_machine_downtime_type_name_uniq'
    ) or not exists (
        select 1
        from pg_catalog.pg_constraint c
        where c.conrelid = 'app.machine_downtime_types'::regclass
          and c.conname = 'machine_downtime_types_class_name_uniq'
          and pg_get_constraintdef(c.oid) = 'UNIQUE (downtime_class, machine_downtime_type_name)'
    ) then
        raise exception using
            errcode = '55000',
            message = 'ACTIVITY_ORDER_VERIFY_CLASS_NAME_UNIQUENESS_FAILED';
    end if;

    select pg_get_functiondef(
        'app.create_admin_activity_type(text,text,text,text,integer,bigint,text)'::regprocedure
    ) into v_create_definition;
    select pg_get_functiondef(
        'app.move_admin_activity_type(text,text,bigint,text)'::regprocedure
    ) into v_move_definition;

    if position('p_technical_code is null' in lower(v_create_definition)) = 0
       or position('admin_activity_order:' in v_create_definition) = 0
       or position('regexp_replace' in lower(v_create_definition)) = 0
       or position('with ordinality' in lower(v_move_definition)) = 0
       or position('admin_move_activity_type' in v_move_definition) = 0 then
        raise exception using
            errcode = '55000',
            message = 'ACTIVITY_ORDER_VERIFY_FUNCTION_CONTRACT_FAILED';
    end if;

    if not has_function_privilege(
        'app_runtime_role',
        'app.move_admin_activity_type(text,text,bigint,text)',
        'EXECUTE'
    ) or has_function_privilege(
        'readonly_role',
        'app.move_admin_activity_type(text,text,bigint,text)',
        'EXECUTE'
    ) or has_function_privilege(
        'public',
        'app.move_admin_activity_type(text,text,bigint,text)',
        'EXECUTE'
    ) then
        raise exception using
            errcode = '55000',
            message = 'ACTIVITY_ORDER_VERIFY_RUNTIME_ALLOWLIST_FAILED';
    end if;

    if exists (
        select 1 from app.operator_break_types where display_order < 0
        union all
        select 1 from app.machine_downtime_types where display_order < 0
    ) then
        raise exception using
            errcode = '55000',
            message = 'ACTIVITY_ORDER_VERIFY_DATA_CONTRACT_FAILED';
    end if;

    select
        count(*) filter (where d.description like 'runtime_api:%'),
        count(*) filter (where d.description like 'internal_helper:%'),
        count(*) filter (where d.description like 'maintenance_api:%')
    into v_runtime_api_count, v_internal_helper_count, v_maintenance_api_count
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n
      on n.oid = p.pronamespace
     and n.nspname = 'app'
    left join pg_catalog.pg_description d
      on d.objoid = p.oid
     and d.classoid = 'pg_proc'::regclass;

    if v_runtime_api_count <> 95
       or v_internal_helper_count <> 82
       or v_maintenance_api_count <> 1 then
        raise exception using
            errcode = '55000',
            message = 'ACTIVITY_ORDER_VERIFY_FUNCTION_CLASSIFICATION_FAILED';
    end if;
end;
$verify$;

select
    'ACTIVITY_ORDER_MIGRATION_PASS|mode='
    || case when :'activity_order_apply'::boolean then 'APPLY' else 'NOOP' end
    || '|break_types=' || (select count(*) from app.operator_break_types)
    || '|downtime_types=' || (select count(*) from app.machine_downtime_types);

commit;
