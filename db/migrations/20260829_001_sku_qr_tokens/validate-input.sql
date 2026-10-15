\set ON_ERROR_STOP on

do $validate$
declare
    v_context _sku_qr_context%rowtype;
    v_function_ok boolean;
begin
    select * into strict v_context from _sku_qr_context;

    if (select count(*) from _sku_qr_stage) <> 162
       or (select count(distinct sku_id) from _sku_qr_stage) <> 162
       or (select count(distinct sku_code) from _sku_qr_stage) <> 162
       or (select count(distinct generated_protected_qr_token) from _sku_qr_stage) <> 162 then
        raise exception using errcode = '22023', message = 'SKU_QR_INPUT_COUNT_OR_UNIQUENESS_FAILED';
    end if;

    if exists (
        select 1 from _sku_qr_stage
        where sku_code = ''
           or sku_code <> btrim(sku_code)
           or generated_protected_qr_token !~ '^[A-Za-z0-9_-]{32}$'
    ) then
        raise exception using errcode = '22023', message = 'SKU_QR_INPUT_VALUE_CONTRACT_FAILED';
    end if;

    if exists (
        (select s.sku_id, s.sku_code from app.skus s except select i.sku_id, i.sku_code from _sku_qr_stage i)
        union all
        (select i.sku_id, i.sku_code from _sku_qr_stage i except select s.sku_id, s.sku_code from app.skus s)
    ) then
        raise exception using errcode = '55000', message = 'SKU_QR_INPUT_SKU_IDENTITY_DIVERGES';
    end if;

    if not v_context.column_existed then
        update _sku_qr_context set mode = 'APPLY';
        return;
    end if;

    select exists (
        select 1
        from pg_catalog.pg_proc p
        where p.oid = to_regprocedure('app.rotate_sku_qr_token(bigint,bigint,text,text)')
          and p.prosecdef = true
          and p.proconfig = array['search_path=app, pg_catalog']
          and pg_catalog.obj_description(p.oid, 'pg_proc') like 'runtime_api:%'
          and pg_catalog.has_function_privilege('app_runtime_role', p.oid, 'EXECUTE')
          and not pg_catalog.has_function_privilege('readonly_role', p.oid, 'EXECUTE')
          and p.proowner <> (select oid from pg_catalog.pg_roles where rolname = 'app_runtime_role')
          and not exists (
              select 1 from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
              where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
          )
    ) into v_function_ok;

    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'app' and table_name = 'skus' and column_name = 'sku_qr_token'
          and data_type = 'text' and is_nullable = 'NO'
    ) or not exists (
        select 1 from pg_catalog.pg_constraint
        where conrelid = 'app.skus'::regclass and conname = 'skus_sku_qr_token_uniq' and contype = 'u'
    ) or not exists (
        select 1 from pg_catalog.pg_constraint
        where conrelid = 'app.skus'::regclass and conname = 'skus_sku_qr_token_format_chk' and contype = 'c'
    ) or not v_function_ok
      or exists (
        select 1
        from app.skus s
        join _sku_qr_stage i on i.sku_id = s.sku_id
        where s.sku_code is distinct from i.sku_code
           or s.sku_qr_token is distinct from i.generated_protected_qr_token
    ) then
        raise exception using errcode = '55000', message = 'SKU_QR_PREFLIGHT_PARTIAL_OR_DIVERGENT_TARGET';
    end if;

    update _sku_qr_context set mode = 'NOOP';
end;
$validate$;
