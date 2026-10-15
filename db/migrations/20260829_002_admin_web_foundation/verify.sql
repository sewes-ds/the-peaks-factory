\set ON_ERROR_STOP on

do $verify$
declare
    v_bad_role_count integer;
    v_missing_function_count integer;
begin
    if not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'app'
          and c.table_name = 'roles'
          and c.column_name = 'can_access_admin_panel'
          and c.data_type = 'boolean'
          and c.is_nullable = 'NO'
    )
       or to_regclass('app.admin_password_credentials') is null
       or to_regclass('app.admin_sessions') is null then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_AUTH_VERIFY_SCHEMA_CONTRACT_FAILED';
    end if;

    select count(*)
    into v_bad_role_count
    from app.roles r
    where r.can_access_admin_panel is distinct from (
        r.role_name in (
            'Руководитель производства',
            'Руководитель администрации',
            'Директор',
            'Администратор системы'
        )
    );
    if v_bad_role_count <> 0 then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_AUTH_VERIFY_ROLE_CAPABILITY_FAILED';
    end if;

    select count(*)
    into v_missing_function_count
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
    where to_regprocedure(expected.signature) is null
       or not has_function_privilege('app_runtime_role', expected.signature, 'EXECUTE')
       or has_function_privilege('readonly_role', expected.signature, 'EXECUTE')
       or has_function_privilege('public', expected.signature, 'EXECUTE');
    if v_missing_function_count <> 0 then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_AUTH_VERIFY_RUNTIME_ALLOWLIST_FAILED';
    end if;

    if has_function_privilege('public', 'app._require_admin_session_actor(text)', 'EXECUTE')
       or has_function_privilege('readonly_role', 'app._require_admin_session_actor(text)', 'EXECUTE')
       or has_function_privilege('app_runtime_role', 'app._require_admin_session_actor(text)', 'EXECUTE') then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_AUTH_VERIFY_INTERNAL_HELPER_EXPOSED';
    end if;

    if has_table_privilege('app_runtime_role', 'app.admin_password_credentials', 'SELECT')
       or has_table_privilege('app_runtime_role', 'app.admin_password_credentials', 'INSERT')
       or has_table_privilege('app_runtime_role', 'app.admin_password_credentials', 'UPDATE')
       or has_table_privilege('app_runtime_role', 'app.admin_password_credentials', 'DELETE')
       or has_table_privilege('readonly_role', 'app.admin_password_credentials', 'SELECT')
       or has_table_privilege('app_runtime_role', 'app.admin_sessions', 'SELECT')
       or has_table_privilege('app_runtime_role', 'app.admin_sessions', 'INSERT')
       or has_table_privilege('app_runtime_role', 'app.admin_sessions', 'UPDATE')
       or has_table_privilege('app_runtime_role', 'app.admin_sessions', 'DELETE')
       or has_table_privilege('readonly_role', 'app.admin_sessions', 'SELECT') then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_AUTH_VERIFY_PRIVATE_TABLE_BOUNDARY_FAILED';
    end if;

    if exists (
        select 1
        from app.admin_password_credentials c
        where c.login_name !~ '^[a-z0-9][a-z0-9._-]{2,63}$'
           or c.password_hash !~ '^scrypt\$v1\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$'
           or c.failed_attempt_count not between 0 and 5
    )
       or exists (
           select 1
           from app.admin_sessions s
           where s.session_token_hash !~ '^[a-f0-9]{64}$'
              or s.csrf_token_hash !~ '^[a-f0-9]{64}$'
              or s.idle_expires_at > s.expires_at
       ) then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_AUTH_VERIFY_PRIVATE_DATA_CONTRACT_FAILED';
    end if;
end;
$verify$;

select
    'ADMIN_AUTH_MIGRATION_PASS|mode='
    || case when :'admin_auth_apply'::boolean then 'APPLY' else 'NOOP' end
    || '|credentials=' || (select count(*) from app.admin_password_credentials)
    || '|sessions=' || (select count(*) from app.admin_sessions);

commit;
