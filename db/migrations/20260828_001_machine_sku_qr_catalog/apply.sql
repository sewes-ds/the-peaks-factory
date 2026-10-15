\set ON_ERROR_STOP on

insert into app.machines (
    machine_id,
    machine_name,
    workshop_name,
    machine_qr_token,
    machine_status_id,
    machine_use_status_id,
    created_at,
    updated_at
)
overriding system value
select
    stage.source_machine_id,
    stage.machine_name,
    null,
    stage.generated_protected_qr_token,
    context.available_machine_status_id,
    context.available_machine_use_status_id,
    context.migration_timestamp,
    context.migration_timestamp
from _r3_machine_stage stage
cross join _r3_context context
where context.mode = 'APPLY'
order by stage.source_machine_id;

insert into app.skus (
    sku_id,
    sku_code,
    sku_name,
    sku_unit_id,
    planned_productivity_per_hour,
    current_sku_tariff_uzs,
    is_active,
    created_at,
    updated_at
)
overriding system value
select
    stage.source_sku_id,
    stage.sku_code,
    stage.sku_name,
    context.piece_sku_unit_id,
    null,
    stage.current_sku_tariff_uzs,
    true,
    context.migration_timestamp,
    context.migration_timestamp
from _r3_sku_stage stage
cross join _r3_context context
where context.mode = 'APPLY'
order by stage.source_sku_id;

do $migration_sequences$
begin
    if (select mode from _r3_context) = 'APPLY' then
        perform pg_catalog.setval(
            pg_catalog.pg_get_serial_sequence('app.machines', 'machine_id'),
            (select max(machine_id) from app.machines),
            true
        );
        perform pg_catalog.setval(
            pg_catalog.pg_get_serial_sequence('app.skus', 'sku_id'),
            (select max(sku_id) from app.skus),
            true
        );
    end if;
end;
$migration_sequences$;
