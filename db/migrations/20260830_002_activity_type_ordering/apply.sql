\set ON_ERROR_STOP on

\if :activity_order_apply

alter table app.machine_downtime_types
    drop constraint machine_downtime_types_machine_downtime_type_name_uniq;
alter table app.machine_downtime_types
    add constraint machine_downtime_types_class_name_uniq
    unique (downtime_class, machine_downtime_type_name);

\ir ../../functions/functions.sql

revoke execute on function app.move_admin_activity_type(text, text, bigint, text)
    from public, readonly_role;
grant execute on function app.move_admin_activity_type(text, text, bigint, text)
    to app_runtime_role;

\endif
