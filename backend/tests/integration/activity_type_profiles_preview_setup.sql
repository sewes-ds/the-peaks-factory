\set ON_ERROR_STOP on

begin;

do $$
begin
    if current_database() <> 'the_peaks_activity_profiles' then
        raise exception 'preview setup is restricted to database the_peaks_activity_profiles';
    end if;
end;
$$;

create temporary table activity_profile_preview_refs on commit drop as
select
    (select position_id from app.positions where is_active = true order by position_id limit 1) as position_id,
    (select employee_status_id from app.employee_statuses where is_active = true and is_active_for_login = true order by employee_status_id limit 1) as employee_status_id,
    (select role_id from app.roles where is_active = true and can_manage_dictionaries = true and can_manage_production = true order by role_id limit 1) as catalog_admin_role_id,
    (select role_id from app.roles where is_active = true and can_manage_production = true and can_manage_dictionaries = false order by role_id limit 1) as production_manager_role_id,
    (select role_id from app.roles where is_active = true and can_work_as_operator = true order by role_id limit 1) as operator_role_id,
    (select machine_status_id from app.machine_statuses where is_active = true and is_available_for_start = true order by machine_status_id limit 1) as machine_status_id,
    (select machine_use_status_id from app.machine_use_statuses where is_active = true and is_available_for_operations = true order by machine_use_status_id limit 1) as machine_use_status_id,
    (select sku_unit_id from app.sku_units where is_active = true order by sku_unit_id limit 1) as sku_unit_id;

do $$
begin
    if exists (
        select 1
        from activity_profile_preview_refs
        where position_id is null
           or employee_status_id is null
           or catalog_admin_role_id is null
           or production_manager_role_id is null
           or operator_role_id is null
           or machine_status_id is null
           or machine_use_status_id is null
           or sku_unit_id is null
    ) then
        raise exception 'activity profile preview reference data is incomplete';
    end if;
end;
$$;

insert into app.employees (
    employee_id,
    full_name,
    phone_e164,
    telegram_user_id,
    position_id,
    employee_status_id
) overriding system value
select 981001, 'Профиль Администратор Справочников', '+998909810001', 9981001, position_id, employee_status_id
from activity_profile_preview_refs
union all
select 981002, 'Профиль Оператор', '+998909810002', 9981002, position_id, employee_status_id
from activity_profile_preview_refs
union all
select 981003, 'Профиль Начальник Производства', '+998909810003', 9981003, position_id, employee_status_id
from activity_profile_preview_refs;

insert into app.employee_roles (
    employee_role_id,
    employee_id,
    role_id,
    assigned_by_employee_id
) overriding system value
select 981001, 981001, catalog_admin_role_id, 981001
from activity_profile_preview_refs
union all
select 981002, 981002, operator_role_id, 981001
from activity_profile_preview_refs
union all
select 981003, 981003, production_manager_role_id, 981001
from activity_profile_preview_refs;

insert into app.machines (
    machine_id,
    machine_name,
    workshop_name,
    machine_qr_token,
    machine_status_id,
    machine_use_status_id
) overriding system value
select 981001, 'Профиль 180 автомат', 'Изолированный preview', 'activity-profile-preview-machine', machine_status_id, machine_use_status_id
from activity_profile_preview_refs;

insert into app.skus (
    sku_id,
    sku_code,
    sku_name,
    sku_qr_token,
    sku_unit_id,
    current_sku_tariff_uzs,
    is_active
) overriding system value
select 981001, 'PROFILE-PREVIEW-SKU', 'Контрольная деталь', repeat('P', 32), sku_unit_id, 1000, true
from activity_profile_preview_refs;

select 'ACTIVITY_TYPE_PROFILES_PREVIEW_SETUP_PASS' as result;

commit;
