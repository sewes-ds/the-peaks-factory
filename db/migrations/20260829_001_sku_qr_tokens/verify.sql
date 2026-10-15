\set ON_ERROR_STOP on

do $verify$
declare
    v_context _sku_qr_context%rowtype;
begin
    select * into strict v_context from _sku_qr_context;
    if v_context.mode not in ('APPLY', 'NOOP') then
        raise exception using errcode = '55000', message = 'SKU_QR_VERIFY_MODE_MISSING';
    end if;
    if (select count(*) from app.skus) <> 162
       or (select count(distinct sku_qr_token) from app.skus) <> 162
       or exists (select 1 from app.skus where sku_qr_token !~ '^[A-Za-z0-9_-]{32}$') then
        raise exception using errcode = '55000', message = 'SKU_QR_VERIFY_TOKEN_CONTRACT_FAILED';
    end if;
    if exists (
        select 1 from app.skus s join _sku_qr_stage i on i.sku_id = s.sku_id
        where s.sku_code is distinct from i.sku_code
           or s.sku_qr_token is distinct from i.generated_protected_qr_token
    ) then
        raise exception using errcode = '55000', message = 'SKU_QR_VERIFY_PROTECTED_EQUALITY_FAILED';
    end if;
    if to_regprocedure('app.rotate_sku_qr_token(bigint,bigint,text,text)') is null
       or not pg_catalog.has_function_privilege(
           'app_runtime_role', 'app.rotate_sku_qr_token(bigint,bigint,text,text)', 'EXECUTE'
       ) then
        raise exception using errcode = '55000', message = 'SKU_QR_VERIFY_RUNTIME_API_FAILED';
    end if;
    if (select count(*) from app.production_operations) <> v_context.production_operations_before
       or (select count(*) from app.machine_downtimes) <> v_context.machine_downtimes_before
       or (select count(*) from app.employee_salary_entries) <> v_context.salary_entries_before then
        raise exception using errcode = '55000', message = 'SKU_QR_VERIFY_UNRELATED_DATA_CHANGED';
    end if;
end;
$verify$;

select 'SKU_QR_MIGRATION_PASS|mode=' || mode || '|skus=162|qr_distinct=162'
from _sku_qr_context;
