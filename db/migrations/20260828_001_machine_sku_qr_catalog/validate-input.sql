\set ON_ERROR_STOP on

do $migration_input_validation$
declare
    v_context _r3_context%rowtype;
    v_machine_difference boolean;
    v_sku_difference boolean;
begin
    select * into strict v_context from _r3_context;

    if (select count(*) from _r3_machine_stage) <> 14
       or (select count(distinct source_machine_id) from _r3_machine_stage) <> 14
       or (select min(source_machine_id) from _r3_machine_stage) <> 1
       or (select max(source_machine_id) from _r3_machine_stage) <> 14 then
        raise exception using errcode = '22023', message = 'R3_INPUT_MACHINE_COUNT_OR_ID_CONTRACT_FAILED';
    end if;

    if exists (
        select 1 from _r3_machine_stage
        where machine_name <> btrim(machine_name)
           or machine_name = ''
           or generated_protected_qr_token <> btrim(generated_protected_qr_token)
           or generated_protected_qr_token !~ '^[A-Za-z0-9_-]{32}$'
    ) or (select count(distinct lower(machine_name)) from _r3_machine_stage) <> 14
      or (select count(distinct generated_protected_qr_token) from _r3_machine_stage) <> 14 then
        raise exception using errcode = '22023', message = 'R3_INPUT_MACHINE_VALUE_CONTRACT_FAILED';
    end if;

    if (select count(*) from _r3_sku_stage) <> 162
       or (select count(distinct source_sku_id) from _r3_sku_stage) <> 162
       or (select min(source_sku_id) from _r3_sku_stage) <> 1
       or (select max(source_sku_id) from _r3_sku_stage) <> 162 then
        raise exception using errcode = '22023', message = 'R3_INPUT_SKU_COUNT_OR_ID_CONTRACT_FAILED';
    end if;

    if exists (
        select 1 from _r3_sku_stage
        where sku_code <> btrim(sku_code)
           or sku_code = ''
           or sku_name <> btrim(sku_name)
           or sku_name = ''
           or source_sku_unit_name <> 'шт'
           or current_sku_tariff_uzs <= 0
    ) or (select count(distinct lower(sku_code)) from _r3_sku_stage) <> 162
      or (select count(distinct lower(sku_name)) from _r3_sku_stage) <> 162 then
        raise exception using errcode = '22023', message = 'R3_INPUT_SKU_VALUE_CONTRACT_FAILED';
    end if;

    if v_context.machines_before = 0 and v_context.skus_before = 0 then
        update _r3_context set mode = 'APPLY';
        return;
    end if;

    select exists (
        (
            select
                m.machine_id,
                m.machine_name,
                m.workshop_name,
                m.machine_qr_token,
                m.machine_status_id,
                m.machine_use_status_id,
                m.created_at,
                m.updated_at
            from app.machines m
            except
            select
                s.source_machine_id,
                s.machine_name,
                null::text,
                s.generated_protected_qr_token,
                v_context.available_machine_status_id,
                v_context.available_machine_use_status_id,
                v_context.migration_timestamp,
                v_context.migration_timestamp
            from _r3_machine_stage s
        )
        union all
        (
            select
                s.source_machine_id,
                s.machine_name,
                null::text,
                s.generated_protected_qr_token,
                v_context.available_machine_status_id,
                v_context.available_machine_use_status_id,
                v_context.migration_timestamp,
                v_context.migration_timestamp
            from _r3_machine_stage s
            except
            select
                m.machine_id,
                m.machine_name,
                m.workshop_name,
                m.machine_qr_token,
                m.machine_status_id,
                m.machine_use_status_id,
                m.created_at,
                m.updated_at
            from app.machines m
        )
    ) into v_machine_difference;

    select exists (
        (
            select
                s.sku_id,
                s.sku_code,
                s.sku_name,
                s.sku_unit_id,
                s.planned_productivity_per_hour,
                s.current_sku_tariff_uzs,
                s.is_active,
                s.created_at,
                s.updated_at
            from app.skus s
            except
            select
                stage.source_sku_id,
                stage.sku_code,
                stage.sku_name,
                v_context.piece_sku_unit_id,
                null::numeric(18,3),
                stage.current_sku_tariff_uzs,
                true,
                v_context.migration_timestamp,
                v_context.migration_timestamp
            from _r3_sku_stage stage
        )
        union all
        (
            select
                stage.source_sku_id,
                stage.sku_code,
                stage.sku_name,
                v_context.piece_sku_unit_id,
                null::numeric(18,3),
                stage.current_sku_tariff_uzs,
                true,
                v_context.migration_timestamp,
                v_context.migration_timestamp
            from _r3_sku_stage stage
            except
            select
                s.sku_id,
                s.sku_code,
                s.sku_name,
                s.sku_unit_id,
                s.planned_productivity_per_hour,
                s.current_sku_tariff_uzs,
                s.is_active,
                s.created_at,
                s.updated_at
            from app.skus s
        )
    ) into v_sku_difference;

    if v_machine_difference or v_sku_difference then
        raise exception using errcode = '55000', message = 'R3_PREFLIGHT_EXISTING_CATALOG_DIVERGES';
    end if;

    update _r3_context set mode = 'NOOP';
end;
$migration_input_validation$;
