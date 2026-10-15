\set ON_ERROR_STOP on

do $verify$
declare
    v_missing_function_count integer;
    v_runtime_api_count integer;
    v_internal_helper_count integer;
    v_maintenance_api_count integer;
begin
    if to_regclass('app.admin_telegram_qr_challenges') is null then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_TELEGRAM_QR_VERIFY_TABLE_MISSING';
    end if;

    if not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'app'
          and c.table_name = 'admin_telegram_qr_challenges'
          and c.column_name = 'confirmation_token_hash'
          and c.data_type = 'text'
          and c.is_nullable = 'NO'
    ) or not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'app'
          and c.table_name = 'admin_telegram_qr_challenges'
          and c.column_name = 'browser_token_hash'
          and c.data_type = 'text'
          and c.is_nullable = 'NO'
    ) then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_TELEGRAM_QR_VERIFY_COLUMN_CONTRACT_FAILED';
    end if;

    select count(*)
    into v_missing_function_count
    from unnest(array[
        'app.create_admin_telegram_qr_challenge(text,text,text,text)',
        'app.confirm_admin_telegram_qr_challenge(text,bigint)',
        'app.claim_admin_telegram_qr_challenge(bigint,text,text,text,text,text)'
    ]) expected(signature)
    where to_regprocedure(expected.signature) is null
       or not has_function_privilege('app_runtime_role', expected.signature, 'EXECUTE')
       or has_function_privilege('readonly_role', expected.signature, 'EXECUTE')
       or has_function_privilege('public', expected.signature, 'EXECUTE');

    if v_missing_function_count <> 0 then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_TELEGRAM_QR_VERIFY_RUNTIME_ALLOWLIST_FAILED';
    end if;

    if has_table_privilege('app_runtime_role', 'app.admin_telegram_qr_challenges', 'SELECT')
       or has_table_privilege('app_runtime_role', 'app.admin_telegram_qr_challenges', 'INSERT')
       or has_table_privilege('app_runtime_role', 'app.admin_telegram_qr_challenges', 'UPDATE')
       or has_table_privilege('app_runtime_role', 'app.admin_telegram_qr_challenges', 'DELETE')
       or has_table_privilege('readonly_role', 'app.admin_telegram_qr_challenges', 'SELECT') then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_TELEGRAM_QR_VERIFY_PRIVATE_TABLE_BOUNDARY_FAILED';
    end if;

    if exists (
        select 1
        from app.admin_telegram_qr_challenges c
        where c.confirmation_token_hash !~ '^[a-f0-9]{64}$'
           or c.browser_token_hash !~ '^[a-f0-9]{64}$'
           or c.expires_at <= c.created_at
           or (c.confirmed_employee_id is null) is distinct from (c.confirmed_at is null)
           or (c.claimed_admin_session_id is null) is distinct from (c.claimed_at is null)
           or (c.claimed_at is not null and c.confirmed_at is null)
    ) then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_TELEGRAM_QR_VERIFY_DATA_CONTRACT_FAILED';
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

    if v_runtime_api_count <> 94
       or v_internal_helper_count <> 82
       or v_maintenance_api_count <> 1 then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_TELEGRAM_QR_VERIFY_FUNCTION_CLASSIFICATION_FAILED';
    end if;

end;
$verify$;

\if :admin_telegram_qr_apply
do $apply_verify$
begin
    if (select count(*) from app.admin_telegram_qr_challenges) <> 0 then
        raise exception using
            errcode = '55000',
            message = 'ADMIN_TELEGRAM_QR_VERIFY_APPLY_CREATED_DATA';
    end if;
end;
$apply_verify$;
\endif

select
    'ADMIN_TELEGRAM_QR_MIGRATION_PASS|mode='
    || case when :'admin_telegram_qr_apply'::boolean then 'APPLY' else 'NOOP' end
    || '|challenges=' || (select count(*) from app.admin_telegram_qr_challenges)
    || '|sessions=' || (select count(*) from app.admin_sessions);

commit;
