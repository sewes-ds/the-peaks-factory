-- functions.sql assembled from accepted/candidate WP fragments.
-- Canonical public function baseline.
-- Assembly order: WP-01..WP-09.


-- BEGIN db/functions/_work/wp_01_foundation_helpers/functions.sql

create or replace function app._assert_nonempty_text(
    p_value text,
    p_parameter_name text
)
returns text
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if p_value is null or btrim(p_value) = '' then
        raise exception '% is required', p_parameter_name
            using errcode = '22023';
    end if;

    return btrim(p_value);
end;
$$;

comment on function app._assert_nonempty_text(text, text)
    is 'internal_helper: validates and trims required reason/comment/text inputs.';

create or replace function app._assert_actor_active(
    p_actor_employee_id bigint
)
returns void
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if p_actor_employee_id is null then
        raise exception 'p_actor_employee_id is required'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from app.employees e
        join app.employee_statuses es
            on es.employee_status_id = e.employee_status_id
        where e.employee_id = p_actor_employee_id
          and es.is_active = true
          and es.is_active_for_login = true
    ) then
        raise exception 'actor employee is not active for runtime action'
            using errcode = 'P0001';
    end if;
end;
$$;

comment on function app._assert_actor_active(bigint)
    is 'internal_helper: validates runtime actor employee identity through active login-enabled employee status.';

create or replace function app._get_actor_effective_role_permissions(
    p_actor_employee_id bigint
)
returns table (
    can_work_as_operator boolean,
    can_manage_production boolean,
    can_manage_admin boolean,
    can_manage_telegram_binding boolean,
    can_view_audit boolean,
    can_change_sku_tariff boolean,
    can_salary_correction_production boolean,
    can_salary_correction_general boolean,
    can_salary_correction_all boolean,
    can_reverse_salary_production boolean,
    can_reverse_salary_all boolean,
    can_correct_production_operations boolean,
    can_manage_employees boolean,
    can_manage_positions boolean,
    can_manage_roles_limited boolean,
    can_manage_roles_all boolean,
    can_manage_dictionaries boolean,
    can_view_admin_reports boolean,
    can_reverse_salary_corrections_only boolean,
    can_receive_production_notifications boolean,
    can_receive_director_notifications boolean,
    can_system_emergency_actions boolean
)
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_active_role_count integer;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select count(*)
    into v_active_role_count
    from app.employee_roles er
    join app.roles r
        on r.role_id = er.role_id
    where er.employee_id = p_actor_employee_id
      and er.revoked_at is null
      and r.is_active = true;

    if v_active_role_count <> 1 then
        raise exception 'actor must have exactly one active role'
            using errcode = 'P0001';
    end if;

    return query
    select
        r.can_work_as_operator,
        r.can_manage_production,
        r.can_manage_admin,
        r.can_manage_telegram_binding,
        r.can_view_audit,
        r.can_change_sku_tariff,
        r.can_salary_correction_production,
        r.can_salary_correction_general,
        r.can_salary_correction_all,
        r.can_reverse_salary_production,
        r.can_reverse_salary_all,
        r.can_correct_production_operations,
        r.can_manage_employees,
        r.can_manage_positions,
        r.can_manage_roles_limited,
        r.can_manage_roles_all,
        r.can_manage_dictionaries,
        r.can_view_admin_reports,
        r.can_reverse_salary_corrections_only,
        r.can_receive_production_notifications,
        r.can_receive_director_notifications,
        r.can_system_emergency_actions
    from app.employee_roles er
    join app.roles r
        on r.role_id = er.role_id
    where er.employee_id = p_actor_employee_id
      and er.revoked_at is null
      and r.is_active = true;
end;
$$;

comment on function app._get_actor_effective_role_permissions(bigint)
    is 'internal_helper: returns permission flags from the actor single active employee_role joined to active roles.';

create or replace function app._actor_has_permission(
    p_actor_employee_id bigint,
    p_permission_name text
)
returns boolean
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_permissions record;
begin
    select *
    into v_permissions
    from app._get_actor_effective_role_permissions(p_actor_employee_id);

    case p_permission_name
        when 'can_work_as_operator' then return v_permissions.can_work_as_operator;
        when 'can_manage_production' then return v_permissions.can_manage_production;
        when 'can_manage_admin' then return v_permissions.can_manage_admin;
        when 'can_manage_telegram_binding' then return v_permissions.can_manage_telegram_binding;
        when 'can_view_audit' then return v_permissions.can_view_audit;
        when 'can_change_sku_tariff' then return v_permissions.can_change_sku_tariff;
        when 'can_salary_correction_production' then return v_permissions.can_salary_correction_production;
        when 'can_salary_correction_general' then return v_permissions.can_salary_correction_general;
        when 'can_salary_correction_all' then return v_permissions.can_salary_correction_all;
        when 'can_reverse_salary_production' then return v_permissions.can_reverse_salary_production;
        when 'can_reverse_salary_all' then return v_permissions.can_reverse_salary_all;
        when 'can_correct_production_operations' then return v_permissions.can_correct_production_operations;
        when 'can_manage_employees' then return v_permissions.can_manage_employees;
        when 'can_manage_positions' then return v_permissions.can_manage_positions;
        when 'can_manage_roles_limited' then return v_permissions.can_manage_roles_limited;
        when 'can_manage_roles_all' then return v_permissions.can_manage_roles_all;
        when 'can_manage_dictionaries' then return v_permissions.can_manage_dictionaries;
        when 'can_view_admin_reports' then return v_permissions.can_view_admin_reports;
        when 'can_reverse_salary_corrections_only' then return v_permissions.can_reverse_salary_corrections_only;
        when 'can_receive_production_notifications' then return v_permissions.can_receive_production_notifications;
        when 'can_receive_director_notifications' then return v_permissions.can_receive_director_notifications;
        when 'can_system_emergency_actions' then return v_permissions.can_system_emergency_actions;
        else
            raise exception 'unknown permission flag: %', p_permission_name
                using errcode = '22023';
    end case;
end;
$$;

comment on function app._actor_has_permission(bigint, text)
    is 'internal_helper: checks one allowlisted permission flag by explicit CASE over roles permission columns; no dynamic SQL.';

create or replace function app._assert_actor_has_permission(
    p_actor_employee_id bigint,
    p_permission_name text
)
returns void
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if not app._actor_has_permission(p_actor_employee_id, p_permission_name) then
        raise exception 'actor lacks required permission: %', p_permission_name
            using errcode = '42501';
    end if;
end;
$$;

comment on function app._assert_actor_has_permission(bigint, text)
    is 'internal_helper: requires one explicit permission flag from the actor active role.';

create or replace function app._assert_actor_has_any_permission(
    p_actor_employee_id bigint,
    p_permission_names text[]
)
returns void
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_permission_name text;
begin
    if p_permission_names is null or cardinality(p_permission_names) = 0 then
        raise exception 'permission list is required'
            using errcode = '22023';
    end if;

    foreach v_permission_name in array p_permission_names loop
        if app._actor_has_permission(p_actor_employee_id, v_permission_name) then
            return;
        end if;
    end loop;

    raise exception 'actor lacks any required permission'
        using errcode = '42501';
end;
$$;

comment on function app._assert_actor_has_any_permission(bigint, text[])
    is 'internal_helper: requires at least one allowlisted permission flag from the actor active role.';

create or replace function app._assert_actor_is_employee_self(
    p_actor_employee_id bigint,
    p_employee_id bigint
)
returns void
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    perform app._assert_actor_active(p_actor_employee_id);

    if p_employee_id is null or p_actor_employee_id <> p_employee_id then
        raise exception 'actor must be the target employee'
            using errcode = '42501';
    end if;
end;
$$;

comment on function app._assert_actor_is_employee_self(bigint, bigint)
    is 'internal_helper: enforces self-service target scope.';

create or replace function app._require_lookup_id(
    p_lookup_name text,
    p_lookup_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if p_lookup_id is null then
        raise exception 'required semantic lookup not found: %', p_lookup_name
            using errcode = 'P0001';
    end if;

    return p_lookup_id;
end;
$$;

comment on function app._require_lookup_id(text, bigint)
    is 'internal_helper: fails closed when a required semantic seed lookup is missing.';

create or replace function app._get_machine_status_available_for_start_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'machine_status.available_for_start',
        (
            select ms.machine_status_id
            from app.machine_statuses ms
            where ms.is_active = true
              and ms.is_available_for_start = true
        )
    )
$$;

comment on function app._get_machine_status_available_for_start_id()
    is 'internal_helper: semantic lookup for the single active machine status available for start.';

create or replace function app._get_machine_status_running_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'machine_status.running',
        (
            select ms.machine_status_id
            from app.machine_statuses ms
            where ms.is_active = true
              and ms.is_running_status = true
        )
    )
$$;

comment on function app._get_machine_status_running_id()
    is 'internal_helper: semantic lookup for the single active running machine status.';

create or replace function app._get_machine_status_non_broken_downtime_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'machine_status.non_broken_downtime',
        (
            select ms.machine_status_id
            from app.machine_statuses ms
            where ms.is_active = true
              and ms.is_downtime_status = true
              and ms.is_broken_status = false
        )
    )
$$;

comment on function app._get_machine_status_non_broken_downtime_id()
    is 'internal_helper: semantic lookup for the single active non-broken downtime machine status.';

create or replace function app._get_machine_status_broken_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'machine_status.broken',
        (
            select ms.machine_status_id
            from app.machine_statuses ms
            where ms.is_active = true
              and ms.is_broken_status = true
        )
    )
$$;

comment on function app._get_machine_status_broken_id()
    is 'internal_helper: semantic lookup for the single active broken machine status.';

create or replace function app._get_machine_use_available_for_operations_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'machine_use_status.available_for_operations',
        (
            select mus.machine_use_status_id
            from app.machine_use_statuses mus
            where mus.is_active = true
              and mus.is_available_for_operations = true
        )
    )
$$;

comment on function app._get_machine_use_available_for_operations_id()
    is 'internal_helper: semantic lookup for the single active machine use status available for operations.';

create or replace function app._get_machine_use_decommissioned_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'machine_use_status.decommissioned',
        (
            select mus.machine_use_status_id
            from app.machine_use_statuses mus
            where mus.is_active = true
              and mus.is_decommissioned = true
        )
    )
$$;

comment on function app._get_machine_use_decommissioned_id()
    is 'internal_helper: semantic lookup for the single active decommissioned machine use status.';

create or replace function app._get_production_operation_status_open_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'production_operation_status.open',
        (
            select pos.production_operation_status_id
            from app.production_operation_statuses pos
            where pos.is_active = true
              and pos.is_open = true
        )
    )
$$;

comment on function app._get_production_operation_status_open_id()
    is 'internal_helper: semantic lookup for the single active open production operation status.';

create or replace function app._get_production_operation_status_closed_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'production_operation_status.closed',
        (
            select pos.production_operation_status_id
            from app.production_operation_statuses pos
            where pos.is_active = true
              and pos.is_closed = true
        )
    )
$$;

comment on function app._get_production_operation_status_closed_id()
    is 'internal_helper: semantic lookup for the single active closed production operation status.';

create or replace function app._get_production_operation_status_cancelled_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'production_operation_status.cancelled',
        (
            select pos.production_operation_status_id
            from app.production_operation_statuses pos
            where pos.is_active = true
              and pos.is_cancelled = true
        )
    )
$$;

comment on function app._get_production_operation_status_cancelled_id()
    is 'internal_helper: semantic lookup for the single active cancelled production operation status.';

create or replace function app._get_salary_entry_type_reversal_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_entry_type.reversal',
        (
            select sety.salary_entry_type_id
            from app.salary_entry_types sety
            where sety.is_active = true
              and sety.is_reversal = true
        )
    )
$$;

comment on function app._get_salary_entry_type_reversal_id()
    is 'internal_helper: semantic lookup for the single active reversal salary entry type.';

create or replace function app._get_period_type_day_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'period_type.day',
        (
            select pt.period_type_id
            from app.period_types pt
            where pt.is_active = true
              and pt.is_day = true
        )
    )
$$;

comment on function app._get_period_type_day_id()
    is 'internal_helper: semantic lookup for the single active day period type.';

create or replace function app._get_period_type_week_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'period_type.week',
        (
            select pt.period_type_id
            from app.period_types pt
            where pt.is_active = true
              and pt.is_week = true
        )
    )
$$;

comment on function app._get_period_type_week_id()
    is 'internal_helper: semantic lookup for the single active week period type.';

create or replace function app._get_period_type_month_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'period_type.month',
        (
            select pt.period_type_id
            from app.period_types pt
            where pt.is_active = true
              and pt.is_month = true
        )
    )
$$;

comment on function app._get_period_type_month_id()
    is 'internal_helper: semantic lookup for the single active month period type.';

-- END db/functions/_work/wp_01_foundation_helpers/functions.sql


-- BEGIN db/functions/_work/wp_02_employee_shift_roles_telegram/functions.sql

create or replace function app._insert_audit_event(
    p_actor_employee_id bigint,
    p_action_name text,
    p_entity_table_name text,
    p_entity_record_id bigint,
    p_before_data_json jsonb,
    p_after_data_json jsonb,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_audit_event_id bigint;
    v_action_name text;
    v_entity_table_name text;
    v_reason text;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    v_action_name := app._assert_nonempty_text(p_action_name, 'p_action_name');
    v_entity_table_name := app._assert_nonempty_text(p_entity_table_name, 'p_entity_table_name');

    if v_action_name !~ '^[a-z][a-z0-9_]*$' then
        raise exception 'p_action_name must be snake_case'
            using errcode = '22023';
    end if;

    if p_entity_record_id is null then
        raise exception 'p_entity_record_id is required'
            using errcode = '22023';
    end if;

    if p_reason is null then
        v_reason := null;
    else
        v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    end if;

    insert into app.audit_events (
        actor_employee_id,
        action_name,
        entity_table_name,
        entity_record_id,
        before_data_json,
        after_data_json,
        reason
    )
    values (
        p_actor_employee_id,
        v_action_name,
        v_entity_table_name,
        p_entity_record_id,
        p_before_data_json,
        p_after_data_json,
        v_reason
    )
    returning audit_event_id into v_audit_event_id;

    return v_audit_event_id;
end;
$$;

comment on function app._insert_audit_event(bigint, text, text, bigint, jsonb, jsonb, text)
    is 'internal_helper: inserts one audit_events row for audited runtime_api actions.';

create or replace function app._role_is_limited_manageable_worker(
    p_role_id bigint
)
returns boolean
language sql
security definer
set search_path = app, pg_catalog
as $$
    select exists (
        select 1
        from app.roles r
        where r.role_id = p_role_id
          and r.is_active = true
          and r.can_work_as_operator = true
          and r.can_manage_production = false
          and r.can_manage_admin = false
          and r.can_manage_telegram_binding = false
          and r.can_view_audit = false
          and r.can_change_sku_tariff = false
          and r.can_salary_correction_production = false
          and r.can_salary_correction_general = false
          and r.can_salary_correction_all = false
          and r.can_reverse_salary_production = false
          and r.can_reverse_salary_all = false
          and r.can_correct_production_operations = false
          and r.can_manage_employees = false
          and r.can_manage_positions = false
          and r.can_manage_roles_limited = false
          and r.can_manage_roles_all = false
          and r.can_manage_dictionaries = false
          and r.can_view_admin_reports = false
          and r.can_reverse_salary_corrections_only = false
          and r.can_receive_production_notifications = false
          and r.can_receive_director_notifications = false
          and r.can_system_emergency_actions = false
    )
$$;

comment on function app._role_is_limited_manageable_worker(bigint)
    is 'internal_helper: identifies the single limited-manageable worker role by permission profile, not by name or numeric id.';

create or replace function app._employee_has_active_high_privilege_role(
    p_employee_id bigint
)
returns boolean
language sql
security definer
set search_path = app, pg_catalog
as $$
    select exists (
        select 1
        from app.employee_roles er
        join app.roles r
            on r.role_id = er.role_id
        where er.employee_id = p_employee_id
          and er.revoked_at is null
          and r.is_active = true
          and (
              r.can_manage_roles_all = true
              or r.can_reverse_salary_all = true
              or r.can_salary_correction_all = true
              or r.can_system_emergency_actions = true
          )
    )
$$;

comment on function app._employee_has_active_high_privilege_role(bigint)
    is 'internal_helper: detects high-privilege active role flags for protected Telegram and role-management paths.';

create or replace function app.start_employee_shift(
    p_actor_employee_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_employee_shift_id bigint;
begin
    perform app._assert_actor_is_employee_self(p_actor_employee_id, p_actor_employee_id);
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');

    perform 1
    from app.employees e
    where e.employee_id = p_actor_employee_id
    for update;

    perform 1
    from app.employee_shifts esh
    where esh.employee_id = p_actor_employee_id
      and esh.is_open = true
    for update;

    if found then
        raise exception 'employee already has open shift'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.production_operations po
        where po.employee_id = p_actor_employee_id
          and po.is_open = true
    ) or exists (
        select 1
        from app.operator_breaks ob
        where ob.employee_id = p_actor_employee_id
          and ob.is_open = true
    ) or exists (
        select 1
        from app.additional_works aw
        where aw.employee_id = p_actor_employee_id
          and aw.started_at is not null
          and aw.finished_at is null
          and aw.cancelled_at is null
    ) then
        raise exception 'employee has incompatible open operational action'
            using errcode = 'P0001';
    end if;

    insert into app.employee_shifts (
        employee_id,
        started_at,
        started_by_employee_id,
        is_open
    )
    values (
        p_actor_employee_id,
        now(),
        p_actor_employee_id,
        true
    )
    returning employee_shift_id into v_employee_shift_id;

    return v_employee_shift_id;
end;
$$;

comment on function app.start_employee_shift(bigint)
    is 'runtime_api: starts the actor employee own open shift.';

create or replace function app.finish_employee_shift(
    p_actor_employee_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_employee_shift_id bigint;
begin
    perform app._assert_actor_is_employee_self(p_actor_employee_id, p_actor_employee_id);
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');

    perform 1
    from app.employees e
    where e.employee_id = p_actor_employee_id
    for update;

    select esh.employee_shift_id
    into v_employee_shift_id
    from app.employee_shifts esh
    where esh.employee_id = p_actor_employee_id
      and esh.is_open = true
    for update;

    if v_employee_shift_id is null then
        raise exception 'employee has no open shift'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.production_operations po
    where po.employee_id = p_actor_employee_id
      and po.is_open = true
    for update;

    if found then
        raise exception 'open production operation blocks shift finish'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.operator_breaks ob
    join app.operator_break_types obt
        on obt.operator_break_type_id = ob.operator_break_type_id
    join app.operator_break_behavior_profiles obbp
        on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
    where ob.employee_id = p_actor_employee_id
      and ob.is_open = true
      and obbp.blocks_shift_finish = true
    for update;

    if found then
        raise exception 'open operator break blocks shift finish'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.additional_works aw
    where aw.employee_id = p_actor_employee_id
      and aw.started_at is not null
      and aw.finished_at is null
      and aw.cancelled_at is null
    for update;

    if found then
        raise exception 'running additional work blocks shift finish'
            using errcode = 'P0001';
    end if;

    update app.employee_shifts
    set
        is_open = false,
        finished_at = now(),
        finished_by_employee_id = p_actor_employee_id
    where employee_shift_id = v_employee_shift_id;

    return v_employee_shift_id;
end;
$$;

comment on function app.finish_employee_shift(bigint)
    is 'runtime_api: finishes the actor employee own open shift after blocking open work checks.';

create or replace function app.emergency_close_employee_shift(
    p_actor_employee_id bigint,
    p_target_employee_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_employee_shift_id bigint;
    v_before jsonb;
    v_after jsonb;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_manage_production', 'can_manage_admin', 'can_system_emergency_actions']
    );

    if p_target_employee_id is null then
        raise exception 'p_target_employee_id is required'
            using errcode = '22023';
    end if;

    perform 1
    from app.employees e
    where e.employee_id = p_target_employee_id
    for update;

    if not found then
        raise exception 'target employee not found'
            using errcode = 'P0001';
    end if;

    select esh.employee_shift_id,
           jsonb_build_object(
               'employee_shift_id', esh.employee_shift_id,
               'employee_id', esh.employee_id,
               'started_at', esh.started_at,
               'is_open', esh.is_open
           )
    into v_employee_shift_id, v_before
    from app.employee_shifts esh
    where esh.employee_id = p_target_employee_id
      and esh.is_open = true
    for update;

    if v_employee_shift_id is null then
        raise exception 'target employee has no open shift'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.production_operations po
    where po.employee_id = p_target_employee_id
      and po.is_open = true
    for update;

    if found then
        raise exception 'open production operation blocks emergency shift close'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.operator_breaks ob
    join app.operator_break_types obt
        on obt.operator_break_type_id = ob.operator_break_type_id
    join app.operator_break_behavior_profiles obbp
        on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
    where ob.employee_id = p_target_employee_id
      and ob.is_open = true
      and obbp.blocks_shift_finish = true
    for update;

    if found then
        raise exception 'open operator break blocks emergency shift close'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.additional_works aw
    where aw.employee_id = p_target_employee_id
      and aw.started_at is not null
      and aw.finished_at is null
      and aw.cancelled_at is null
    for update;

    if found then
        raise exception 'running additional work blocks emergency shift close'
            using errcode = 'P0001';
    end if;

    update app.employee_shifts esh
    set
        is_open = false,
        finished_at = now(),
        finished_by_employee_id = p_actor_employee_id,
        emergency_close_reason = v_reason
    where esh.employee_shift_id = v_employee_shift_id
    returning jsonb_build_object(
        'employee_shift_id', esh.employee_shift_id,
        'employee_id', esh.employee_id,
        'finished_at', esh.finished_at,
        'finished_by_employee_id', esh.finished_by_employee_id,
        'is_open', esh.is_open,
        'emergency_close_reason', esh.emergency_close_reason
    )
    into v_after;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'emergency_close_employee_shift',
        'employee_shifts',
        v_employee_shift_id,
        v_before,
        v_after,
        v_reason
    );

    return v_employee_shift_id;
end;
$$;

comment on function app.emergency_close_employee_shift(bigint, bigint, text)
    is 'runtime_api: emergency closes a target employee shift with reason and audit, without auto-closing dependent work.';

create or replace function app.create_employee(
    p_actor_employee_id bigint,
    p_full_name text,
    p_phone_e164 text,
    p_position_id bigint,
    p_tariff_category text,
    p_employee_status_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_employee_id bigint;
    v_full_name text;
    v_phone_e164 text;
    v_tariff_category text;
    v_after jsonb;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_employees');

    v_full_name := app._assert_nonempty_text(p_full_name, 'p_full_name');
    v_phone_e164 := app._assert_nonempty_text(p_phone_e164, 'p_phone_e164');
    v_tariff_category := nullif(btrim(p_tariff_category), '');

    if p_position_id is null or not exists (
        select 1
        from app.positions p
        where p.position_id = p_position_id
          and p.is_active = true
    ) then
        raise exception 'active position is required'
            using errcode = '22023';
    end if;

    if p_employee_status_id is null or not exists (
        select 1
        from app.employee_statuses es
        where es.employee_status_id = p_employee_status_id
          and es.is_active = true
    ) then
        raise exception 'active employee status is required'
            using errcode = '22023';
    end if;

    insert into app.employees (
        full_name,
        phone_e164,
        position_id,
        tariff_category,
        employee_status_id
    )
    values (
        v_full_name,
        v_phone_e164,
        p_position_id,
        v_tariff_category,
        p_employee_status_id
    )
    returning employee_id,
              jsonb_build_object(
                  'employee_id', employee_id,
                  'full_name', full_name,
                  'phone_e164', phone_e164,
                  'position_id', position_id,
                  'tariff_category', tariff_category,
                  'employee_status_id', employee_status_id
              )
    into v_employee_id, v_after;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'create_employee',
        'employees',
        v_employee_id,
        null,
        v_after,
        null
    );

    return v_employee_id;
end;
$$;

comment on function app.create_employee(bigint, text, text, bigint, text, bigint)
    is 'runtime_api: creates an employee after employee-management authorization and writes audit.';

create or replace function app.update_employee(
    p_actor_employee_id bigint,
    p_target_employee_id bigint,
    p_full_name text,
    p_phone_e164 text,
    p_position_id bigint,
    p_tariff_category text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_before_row app.employees%rowtype;
    v_after_row app.employees%rowtype;
    v_full_name text;
    v_phone_e164 text;
    v_tariff_category text;
    v_before jsonb;
    v_after jsonb;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_employees');

    v_full_name := app._assert_nonempty_text(p_full_name, 'p_full_name');
    v_phone_e164 := app._assert_nonempty_text(p_phone_e164, 'p_phone_e164');
    v_tariff_category := nullif(btrim(p_tariff_category), '');

    select *
    into v_before_row
    from app.employees e
    where e.employee_id = p_target_employee_id
    for update;

    if not found then
        raise exception 'target employee not found'
            using errcode = 'P0001';
    end if;

    if p_position_id is null or not exists (
        select 1
        from app.positions p
        where p.position_id = p_position_id
          and p.is_active = true
    ) then
        raise exception 'active position is required'
            using errcode = '22023';
    end if;

    if v_before_row.full_name is not distinct from v_full_name
       and v_before_row.phone_e164 is not distinct from v_phone_e164
       and v_before_row.position_id is not distinct from p_position_id
       and v_before_row.tariff_category is not distinct from v_tariff_category then
        return p_target_employee_id;
    end if;

    update app.employees e
    set
        full_name = v_full_name,
        phone_e164 = v_phone_e164,
        position_id = p_position_id,
        tariff_category = v_tariff_category,
        updated_at = now()
    where e.employee_id = p_target_employee_id
    returning *
    into v_after_row;

    v_before := jsonb_build_object(
        'employee_id', v_before_row.employee_id,
        'full_name', v_before_row.full_name,
        'phone_e164', v_before_row.phone_e164,
        'position_id', v_before_row.position_id,
        'tariff_category', v_before_row.tariff_category
    );

    v_after := jsonb_build_object(
        'employee_id', v_after_row.employee_id,
        'full_name', v_after_row.full_name,
        'phone_e164', v_after_row.phone_e164,
        'position_id', v_after_row.position_id,
        'tariff_category', v_after_row.tariff_category
    );

    perform app._insert_audit_event(
        p_actor_employee_id,
        'update_employee',
        'employees',
        p_target_employee_id,
        v_before,
        v_after,
        null
    );

    return p_target_employee_id;
end;
$$;

comment on function app.update_employee(bigint, bigint, text, text, bigint, text)
    is 'runtime_api: updates material employee fields only and writes audit for changed fields.';

create or replace function app.change_employee_status(
    p_actor_employee_id bigint,
    p_target_employee_id bigint,
    p_employee_status_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before_status_id bigint;
    v_target_is_active_for_login boolean;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_employees');

    select e.employee_status_id
    into v_before_status_id
    from app.employees e
    where e.employee_id = p_target_employee_id
    for update;

    if not found then
        raise exception 'target employee not found'
            using errcode = 'P0001';
    end if;

    select es.is_active_for_login
    into v_target_is_active_for_login
    from app.employee_statuses es
    where es.employee_status_id = p_employee_status_id
      and es.is_active = true;

    if v_target_is_active_for_login is null then
        raise exception 'active employee status is required'
            using errcode = '22023';
    end if;

    if v_before_status_id = p_employee_status_id then
        return p_target_employee_id;
    end if;

    if v_target_is_active_for_login = false then
        perform 1
        from app.employee_shifts esh
        where esh.employee_id = p_target_employee_id
          and esh.is_open = true
        for update;

        if found then
            raise exception 'open shift or work actions block inactive employee status transition'
                using errcode = 'P0001';
        end if;

        perform 1
        from app.production_operations po
        where po.employee_id = p_target_employee_id
          and po.is_open = true
        for update;

        if found then
            raise exception 'open shift or work actions block inactive employee status transition'
                using errcode = 'P0001';
        end if;

        perform 1
        from app.operator_breaks ob
        where ob.employee_id = p_target_employee_id
          and ob.is_open = true
        for update;

        if found then
            raise exception 'open shift or work actions block inactive employee status transition'
                using errcode = 'P0001';
        end if;

        perform 1
        from app.additional_works aw
        where aw.employee_id = p_target_employee_id
          and aw.started_at is not null
          and aw.finished_at is null
          and aw.cancelled_at is null
        for update;

        if found then
            raise exception 'open shift or work actions block inactive employee status transition'
                using errcode = 'P0001';
        end if;
    end if;

    update app.employees
    set
        employee_status_id = p_employee_status_id,
        updated_at = now()
    where employee_id = p_target_employee_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'change_employee_status',
        'employees',
        p_target_employee_id,
        jsonb_build_object(
            'employee_id', p_target_employee_id,
            'employee_status_id', v_before_status_id
        ),
        jsonb_build_object(
            'employee_id', p_target_employee_id,
            'employee_status_id', p_employee_status_id
        ),
        v_reason
    );

    return p_target_employee_id;
end;
$$;

comment on function app.change_employee_status(bigint, bigint, bigint, text)
    is 'runtime_api: changes employee status with reason, blocking inactive transitions while shift/work is open.';

create or replace function app.assign_employee_role(
    p_actor_employee_id bigint,
    p_target_employee_id bigint,
    p_role_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_actor_can_manage_roles_all boolean;
    v_actor_can_manage_roles_limited boolean;
    v_target_role app.roles%rowtype;
    v_employee_role_id bigint;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select p.can_manage_roles_all, p.can_manage_roles_limited
    into v_actor_can_manage_roles_all, v_actor_can_manage_roles_limited
    from app._get_actor_effective_role_permissions(p_actor_employee_id) p;

    if not (v_actor_can_manage_roles_all or v_actor_can_manage_roles_limited) then
        raise exception 'actor lacks role management permission'
            using errcode = '42501';
    end if;

    if p_actor_employee_id = p_target_employee_id then
        raise exception 'actor cannot assign role to self'
            using errcode = '42501';
    end if;

    perform 1
    from app.employees e
    join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
    where e.employee_id = p_target_employee_id
      and es.is_active = true
      and es.is_active_for_login = true
    for update;

    if not found then
        raise exception 'target employee must exist and be active for login'
            using errcode = 'P0001';
    end if;

    select *
    into v_target_role
    from app.roles r
    where r.role_id = p_role_id
      and r.is_active = true
    for update;

    if not found then
        raise exception 'target role must exist and be active'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.employee_roles er
    where er.employee_id = p_target_employee_id
      and er.revoked_at is null
    for update;

    if found then
        raise exception 'target employee already has active role; revoke first'
            using errcode = 'P0001';
    end if;

    if v_actor_can_manage_roles_limited
       and not v_actor_can_manage_roles_all
       and not app._role_is_limited_manageable_worker(p_role_id) then
        raise exception 'limited role manager may assign only limited-manageable worker role'
            using errcode = '42501';
    end if;

    if v_target_role.can_system_emergency_actions = true
       and not v_actor_can_manage_roles_all then
        raise exception 'system emergency role assignment requires full role management'
            using errcode = '42501';
    end if;

    insert into app.employee_roles (
        employee_id,
        role_id,
        assigned_by_employee_id
    )
    values (
        p_target_employee_id,
        p_role_id,
        p_actor_employee_id
    )
    returning employee_role_id into v_employee_role_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'assign_employee_role',
        'employee_roles',
        v_employee_role_id,
        null,
        jsonb_build_object(
            'employee_role_id', v_employee_role_id,
            'employee_id', p_target_employee_id,
            'role_id', p_role_id,
            'assigned_by_employee_id', p_actor_employee_id
        ),
        v_reason
    );

    return v_employee_role_id;
end;
$$;

comment on function app.assign_employee_role(bigint, bigint, bigint, text)
    is 'runtime_api: assigns one active employee role using permission-profile restrictions and audit.';

create or replace function app.revoke_employee_role(
    p_actor_employee_id bigint,
    p_employee_role_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_actor_can_manage_roles_all boolean;
    v_actor_can_manage_roles_limited boolean;
    v_target_employee_id bigint;
    v_role_id bigint;
    v_target_role app.roles%rowtype;
    v_after jsonb;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select p.can_manage_roles_all, p.can_manage_roles_limited
    into v_actor_can_manage_roles_all, v_actor_can_manage_roles_limited
    from app._get_actor_effective_role_permissions(p_actor_employee_id) p;

    if not (v_actor_can_manage_roles_all or v_actor_can_manage_roles_limited) then
        raise exception 'actor lacks role management permission'
            using errcode = '42501';
    end if;

    select er.employee_id, er.role_id
    into v_target_employee_id, v_role_id
    from app.employee_roles er
    where er.employee_role_id = p_employee_role_id
      and er.revoked_at is null
    for update;

    if v_target_employee_id is null then
        raise exception 'active employee role not found'
            using errcode = 'P0001';
    end if;

    if p_actor_employee_id = v_target_employee_id then
        raise exception 'actor cannot revoke own role'
            using errcode = '42501';
    end if;

    perform 1
    from app.employees e
    where e.employee_id = v_target_employee_id
    for update;

    select *
    into v_target_role
    from app.roles r
    where r.role_id = v_role_id
    for update;

    if v_actor_can_manage_roles_limited
       and not v_actor_can_manage_roles_all
       and not app._role_is_limited_manageable_worker(v_role_id) then
        raise exception 'limited role manager may revoke only limited-manageable worker role'
            using errcode = '42501';
    end if;

    if v_target_role.can_manage_roles_all = true
       and (
           select count(*)
           from app.employee_roles er
           join app.roles r
               on r.role_id = er.role_id
           where er.revoked_at is null
             and r.is_active = true
             and r.can_manage_roles_all = true
       ) <= 1 then
        raise exception 'cannot remove last active full role manager'
            using errcode = 'P0001';
    end if;

    update app.employee_roles er
    set
        revoked_at = now(),
        revoked_by_employee_id = p_actor_employee_id,
        revoke_reason = v_reason
    where er.employee_role_id = p_employee_role_id
    returning jsonb_build_object(
        'employee_role_id', er.employee_role_id,
        'employee_id', er.employee_id,
        'role_id', er.role_id,
        'revoked_at', er.revoked_at,
        'revoked_by_employee_id', er.revoked_by_employee_id,
        'revoke_reason', er.revoke_reason
    )
    into v_after;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'revoke_employee_role',
        'employee_roles',
        p_employee_role_id,
        jsonb_build_object(
            'employee_role_id', p_employee_role_id,
            'employee_id', v_target_employee_id,
            'role_id', v_role_id,
            'revoked_at', null,
            'revoked_by_employee_id', null
        ),
        v_after,
        v_reason
    );

    return p_employee_role_id;
end;
$$;

comment on function app.revoke_employee_role(bigint, bigint, text)
    is 'runtime_api: revokes one active employee role with reason, permission-profile restrictions and audit.';

create or replace function app.bind_employee_telegram_user(
    p_actor_employee_id bigint,
    p_target_employee_id bigint,
    p_telegram_user_id bigint,
    p_telegram_username text,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_actor_permissions record;
    v_before app.employees%rowtype;
    v_username text;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select *
    into v_actor_permissions
    from app._get_actor_effective_role_permissions(p_actor_employee_id);

    if not v_actor_permissions.can_manage_telegram_binding then
        raise exception 'actor lacks telegram binding permission'
            using errcode = '42501';
    end if;

    if p_telegram_user_id is null then
        raise exception 'p_telegram_user_id is required'
            using errcode = '22023';
    end if;

    v_username := nullif(btrim(p_telegram_username), '');

    select e.*
    into v_before
    from app.employees e
    join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
    where e.employee_id = p_target_employee_id
      and es.is_active = true
      and es.is_active_for_login = true
    for update;

    if not found then
        raise exception 'target employee must exist and be active for telegram binding'
            using errcode = 'P0001';
    end if;

    if v_before.telegram_user_id is not null then
        raise exception 'target employee already has telegram binding; reset first'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.employees e
        where e.telegram_user_id = p_telegram_user_id
          and e.employee_id <> p_target_employee_id
    ) then
        raise exception 'telegram user is already bound to another employee'
            using errcode = '23505';
    end if;

    if v_actor_permissions.can_system_emergency_actions
       and not (v_actor_permissions.can_manage_admin or v_actor_permissions.can_manage_roles_all) then
        raise exception 'system administrator telegram path may reset binding only'
            using errcode = '42501';
    end if;

    update app.employees e
    set
        telegram_user_id = p_telegram_user_id,
        telegram_username = v_username,
        updated_at = now()
    where e.employee_id = p_target_employee_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'bind_employee_telegram_user',
        'employees',
        p_target_employee_id,
        jsonb_build_object(
            'employee_id', p_target_employee_id,
            'telegram_user_id', v_before.telegram_user_id,
            'telegram_username', v_before.telegram_username
        ),
        jsonb_build_object(
            'employee_id', p_target_employee_id,
            'telegram_user_id', p_telegram_user_id,
            'telegram_username', v_username
        ),
        v_reason
    );

    return p_target_employee_id;
end;
$$;

comment on function app.bind_employee_telegram_user(bigint, bigint, bigint, text, text)
    is 'runtime_api: binds Telegram identity to an active employee with reason, restricted system path and audit.';

create or replace function app.reset_employee_telegram_user(
    p_actor_employee_id bigint,
    p_target_employee_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_actor_permissions record;
    v_before app.employees%rowtype;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select *
    into v_actor_permissions
    from app._get_actor_effective_role_permissions(p_actor_employee_id);

    if not v_actor_permissions.can_manage_telegram_binding then
        raise exception 'actor lacks telegram binding permission'
            using errcode = '42501';
    end if;

    select e.*
    into v_before
    from app.employees e
    where e.employee_id = p_target_employee_id
    for update;

    if not found then
        raise exception 'target employee not found'
            using errcode = 'P0001';
    end if;

    if v_actor_permissions.can_system_emergency_actions
       and not (v_actor_permissions.can_manage_admin or v_actor_permissions.can_manage_roles_all)
       and (
           p_actor_employee_id = p_target_employee_id
           or app._employee_has_active_high_privilege_role(p_target_employee_id)
       ) then
        raise exception 'system administrator telegram reset path is restricted'
            using errcode = '42501';
    end if;

    if v_before.telegram_user_id is null and v_before.telegram_username is null then
        return p_target_employee_id;
    end if;

    update app.employees e
    set
        telegram_user_id = null,
        telegram_username = null,
        updated_at = now()
    where e.employee_id = p_target_employee_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'reset_employee_telegram_user',
        'employees',
        p_target_employee_id,
        jsonb_build_object(
            'employee_id', p_target_employee_id,
            'telegram_user_id', v_before.telegram_user_id,
            'telegram_username', v_before.telegram_username
        ),
        jsonb_build_object(
            'employee_id', p_target_employee_id,
            'telegram_user_id', null,
            'telegram_username', null
        ),
        v_reason
    );

    return p_target_employee_id;
end;
$$;

comment on function app.reset_employee_telegram_user(bigint, bigint, text)
    is 'runtime_api: clears Telegram identity with reason, restricted system path and audit.';

create or replace function app.identify_employee_for_telegram_self_binding(
    p_phone_e164 text,
    p_telegram_user_id bigint
)
returns table (
    status text,
    employee_id bigint,
    full_name text
)
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_phone_e164 text;
    v_employee record;
begin
    if p_telegram_user_id is null then
        raise exception 'p_telegram_user_id is required'
            using errcode = '22023';
    end if;

    v_phone_e164 := app._assert_nonempty_text(p_phone_e164, 'p_phone_e164');

    if v_phone_e164 !~ '^\+[0-9]{7,15}$' then
        return query select 'PHONE_NOT_FOUND'::text, null::bigint, null::text;
        return;
    end if;

    select
        e.employee_id,
        e.full_name,
        e.telegram_user_id,
        es.is_active,
        es.is_active_for_login
    into v_employee
    from app.employees e
    join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
    where e.phone_e164 = v_phone_e164;

    if not found then
        return query select 'PHONE_NOT_FOUND'::text, null::bigint, null::text;
        return;
    end if;

    if v_employee.is_active is not true
       or v_employee.is_active_for_login is not true then
        return query select 'EMPLOYEE_INACTIVE'::text, null::bigint, null::text;
        return;
    end if;

    if v_employee.telegram_user_id is not null then
        return query select 'EMPLOYEE_ALREADY_BOUND'::text, null::bigint, null::text;
        return;
    end if;

    if exists (
        select 1
        from app.employees e
        where e.telegram_user_id = p_telegram_user_id
          and e.employee_id <> v_employee.employee_id
    ) then
        return query select 'TELEGRAM_ALREADY_BOUND'::text, null::bigint, null::text;
        return;
    end if;

    return query
    select
        'CONFIRM_EMPLOYEE'::text,
        v_employee.employee_id,
        v_employee.full_name;
end;
$$;

comment on function app.identify_employee_for_telegram_self_binding(text, bigint)
    is 'runtime_api: identifies an active unbound employee by verified Telegram contact phone for first-login self-binding without writing data.';

create or replace function app.confirm_employee_telegram_self_binding(
    p_employee_id bigint,
    p_phone_e164 text,
    p_telegram_user_id bigint,
    p_telegram_username text
)
returns table (
    status text,
    employee_id bigint
)
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_phone_e164 text;
    v_before record;
    v_username text;
begin
    if p_employee_id is null then
        raise exception 'p_employee_id is required'
            using errcode = '22023';
    end if;

    if p_telegram_user_id is null then
        raise exception 'p_telegram_user_id is required'
            using errcode = '22023';
    end if;

    v_phone_e164 := app._assert_nonempty_text(p_phone_e164, 'p_phone_e164');
    v_username := nullif(btrim(p_telegram_username), '');

    if v_phone_e164 !~ '^\+[0-9]{7,15}$' then
        return query select 'BINDING_STATE_CHANGED'::text, null::bigint;
        return;
    end if;

    select
        e.employee_id,
        e.full_name,
        e.phone_e164,
        e.telegram_user_id,
        e.telegram_username,
        es.is_active,
        es.is_active_for_login
    into v_before
    from app.employees e
    join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
    where e.employee_id = p_employee_id
    for update of e;

    if not found then
        return query select 'BINDING_STATE_CHANGED'::text, null::bigint;
        return;
    end if;

    if v_before.phone_e164 is distinct from v_phone_e164 then
        return query select 'BINDING_STATE_CHANGED'::text, null::bigint;
        return;
    end if;

    if v_before.is_active is not true
       or v_before.is_active_for_login is not true then
        return query select 'BINDING_STATE_CHANGED'::text, null::bigint;
        return;
    end if;

    if v_before.telegram_user_id is not null then
        return query select 'BINDING_STATE_CHANGED'::text, null::bigint;
        return;
    end if;

    if exists (
        select 1
        from app.employees e
        where e.telegram_user_id = p_telegram_user_id
          and e.employee_id <> p_employee_id
    ) then
        return query select 'BINDING_CONFLICT'::text, null::bigint;
        return;
    end if;

    begin
        update app.employees e
        set
            telegram_user_id = p_telegram_user_id,
            telegram_username = v_username,
            updated_at = now()
        where e.employee_id = p_employee_id;
    exception
        when unique_violation then
            return query select 'BINDING_CONFLICT'::text, null::bigint;
            return;
    end;

    perform app._insert_audit_event(
        p_employee_id,
        'self_bind_employee_telegram_user',
        'employees',
        p_employee_id,
        jsonb_build_object(
            'employee_id', p_employee_id,
            'phone_e164', v_before.phone_e164,
            'telegram_user_id', v_before.telegram_user_id,
            'telegram_username', v_before.telegram_username
        ),
        jsonb_build_object(
            'employee_id', p_employee_id,
            'phone_e164', v_before.phone_e164,
            'telegram_user_id', p_telegram_user_id,
            'telegram_username', v_username
        ),
        'Telegram first-login self-binding'
    );

    return query select 'BOUND'::text, p_employee_id;
end;
$$;

comment on function app.confirm_employee_telegram_self_binding(bigint, text, bigint, text)
    is 'runtime_api: atomically confirms Telegram first-login self-binding after backend token validation, repeats DB checks and writes audit event.';

create or replace function app.record_telegram_contact_proof(
    p_telegram_user_id bigint,
    p_phone_e164 text,
    p_telegram_username text,
    p_bot_update_id bigint,
    p_bot_message_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_phone_e164 text;
    v_username text;
    v_existing_proof_id bigint;
    v_proof_id bigint;
begin
    if p_telegram_user_id is null then
        raise exception 'p_telegram_user_id is required'
            using errcode = '22023';
    end if;

    if p_bot_update_id is null then
        raise exception 'p_bot_update_id is required'
            using errcode = '22023';
    end if;

    v_phone_e164 := app._assert_nonempty_text(p_phone_e164, 'p_phone_e164');

    if v_phone_e164 !~ '^\+[0-9]{7,15}$' then
        raise exception 'p_phone_e164 must be E.164'
            using errcode = '22023';
    end if;

    v_username := nullif(btrim(p_telegram_username), '');

    select tcp.telegram_contact_proof_id
    into v_existing_proof_id
    from app.telegram_contact_proofs tcp
    where tcp.bot_update_id = p_bot_update_id;

    if found then
        return v_existing_proof_id;
    end if;

    update app.telegram_contact_proofs tcp
    set
        proof_status = 'superseded',
        updated_at = now()
    where tcp.telegram_user_id = p_telegram_user_id
      and tcp.proof_status in ('active', 'used_for_confirmation');

    insert into app.telegram_contact_proofs (
        telegram_user_id,
        phone_e164,
        telegram_username,
        bot_update_id,
        bot_message_id,
        proof_status,
        expires_at
    )
    values (
        p_telegram_user_id,
        v_phone_e164,
        v_username,
        p_bot_update_id,
        p_bot_message_id,
        'active',
        now() + interval '10 minutes'
    )
    returning telegram_contact_proof_id into v_proof_id;

    return v_proof_id;
exception
    when unique_violation then
        select tcp.telegram_contact_proof_id
        into v_existing_proof_id
        from app.telegram_contact_proofs tcp
        where tcp.bot_update_id = p_bot_update_id;

        if found then
            return v_existing_proof_id;
        end if;

        raise;
end;
$$;

comment on function app.record_telegram_contact_proof(bigint, text, text, bigint, bigint)
    is 'runtime_api: records idempotent server-side Telegram bot contact proof for first-login self-binding.';

create or replace function app.consume_telegram_contact_proof(
    p_telegram_user_id bigint
)
returns table (
    status text,
    telegram_contact_proof_id bigint,
    phone_e164 text
)
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_proof app.telegram_contact_proofs%rowtype;
begin
    if p_telegram_user_id is null then
        raise exception 'p_telegram_user_id is required'
            using errcode = '22023';
    end if;

    select *
    into v_proof
    from app.telegram_contact_proofs tcp
    where tcp.telegram_user_id = p_telegram_user_id
      and tcp.proof_status = 'active'
    order by tcp.created_at desc
    limit 1
    for update;

    if not found then
        return query select 'CONTACT_PROOF_REQUIRED'::text, null::bigint, null::text;
        return;
    end if;

    if v_proof.expires_at <= now() then
        update app.telegram_contact_proofs tcp
        set
            proof_status = 'expired',
            updated_at = now()
        where tcp.telegram_contact_proof_id = v_proof.telegram_contact_proof_id;

        return query select 'CONTACT_PROOF_EXPIRED'::text, null::bigint, null::text;
        return;
    end if;

    update app.telegram_contact_proofs tcp
    set
        proof_status = 'used_for_confirmation',
        used_for_confirmation_at = now(),
        updated_at = now()
    where tcp.telegram_contact_proof_id = v_proof.telegram_contact_proof_id;

    return query
    select
        'CONTACT_PROOF_READY'::text,
        v_proof.telegram_contact_proof_id,
        v_proof.phone_e164;
end;
$$;

comment on function app.consume_telegram_contact_proof(bigint)
    is 'runtime_api: reserves active Telegram contact proof for self-binding identify without trusting Mini App phone input.';

create or replace function app.finalize_telegram_contact_proof(
    p_telegram_contact_proof_id bigint,
    p_telegram_user_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_proof app.telegram_contact_proofs%rowtype;
begin
    if p_telegram_contact_proof_id is null then
        raise exception 'p_telegram_contact_proof_id is required'
            using errcode = '22023';
    end if;

    if p_telegram_user_id is null then
        raise exception 'p_telegram_user_id is required'
            using errcode = '22023';
    end if;

    select *
    into v_proof
    from app.telegram_contact_proofs tcp
    where tcp.telegram_contact_proof_id = p_telegram_contact_proof_id
    for update;

    if not found then
        raise exception 'telegram contact proof not found'
            using errcode = 'P0001';
    end if;

    if v_proof.telegram_user_id <> p_telegram_user_id then
        raise exception 'telegram contact proof user mismatch'
            using errcode = '42501';
    end if;

    if v_proof.proof_status <> 'used_for_confirmation' then
        raise exception 'telegram contact proof is not reserved for confirmation'
            using errcode = 'P0001';
    end if;

    if v_proof.expires_at <= now() then
        update app.telegram_contact_proofs tcp
        set
            proof_status = 'expired',
            updated_at = now()
        where tcp.telegram_contact_proof_id = p_telegram_contact_proof_id;

        raise exception 'telegram contact proof expired'
            using errcode = 'P0001';
    end if;

    update app.telegram_contact_proofs tcp
    set
        proof_status = 'consumed',
        consumed_at = now(),
        updated_at = now()
    where tcp.telegram_contact_proof_id = p_telegram_contact_proof_id;

    return p_telegram_contact_proof_id;
end;
$$;

comment on function app.finalize_telegram_contact_proof(bigint, bigint)
    is 'runtime_api: finalizes reserved Telegram contact proof before employee self-binding confirmation.';

-- END db/functions/_work/wp_02_employee_shift_roles_telegram/functions.sql


-- BEGIN db/functions/_work/wp_03_machine_sku/functions.sql

create or replace function app.set_machine_status(
    p_actor_employee_id bigint,
    p_machine_id bigint,
    p_new_machine_status_id bigint,
    p_cause_table_name text,
    p_cause_record_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_old_machine_status_id bigint;
    v_cause_table_name text;
    v_reason text;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    if p_machine_id is null then
        raise exception 'p_machine_id is required'
            using errcode = '22023';
    end if;

    if p_new_machine_status_id is null or not exists (
        select 1
        from app.machine_statuses ms
        where ms.machine_status_id = p_new_machine_status_id
          and ms.is_active = true
    ) then
        raise exception 'active machine status is required'
            using errcode = '22023';
    end if;

    if (p_cause_table_name is null) <> (p_cause_record_id is null) then
        raise exception 'cause table and cause record must be supplied together'
            using errcode = '22023';
    end if;

    v_cause_table_name := nullif(btrim(p_cause_table_name), '');
    v_reason := nullif(btrim(p_reason), '');

    if v_cause_table_name is not null
       and v_cause_table_name not in ('production_operations', 'machine_downtimes', 'machines') then
        raise exception 'unsupported machine status cause table'
            using errcode = '22023';
    end if;

    select m.machine_status_id
    into v_old_machine_status_id
    from app.machines m
    where m.machine_id = p_machine_id
    for update;

    if not found then
        raise exception 'machine not found'
            using errcode = 'P0001';
    end if;

    if p_new_machine_status_id = app._get_machine_status_running_id() then
        if v_cause_table_name <> 'production_operations' or not exists (
            select 1
            from app.production_operations po
            where po.production_operation_id = p_cause_record_id
              and po.machine_id = p_machine_id
              and po.is_open = true
        ) then
            raise exception 'running machine status requires open production operation cause'
                using errcode = 'P0001';
        end if;
    elsif p_new_machine_status_id in (
        app._get_machine_status_non_broken_downtime_id(),
        app._get_machine_status_broken_id()
    ) then
        if v_cause_table_name <> 'machine_downtimes' or not exists (
            select 1
            from app.machine_downtimes md
            where md.machine_downtime_id = p_cause_record_id
              and md.machine_id = p_machine_id
              and md.is_open = true
        ) then
            raise exception 'downtime machine status requires open machine downtime cause'
                using errcode = 'P0001';
        end if;
    elsif p_new_machine_status_id = app._get_machine_status_available_for_start_id() then
        if exists (
            select 1
            from app.production_operations po
            where po.machine_id = p_machine_id
              and po.is_open = true
        ) or exists (
            select 1
            from app.machine_downtimes md
            where md.machine_id = p_machine_id
              and md.is_open = true
        ) then
            raise exception 'available machine status requires no open production operation or downtime'
                using errcode = 'P0001';
        end if;
    end if;

    if v_old_machine_status_id <> p_new_machine_status_id then
        update app.machines
        set
            machine_status_id = p_new_machine_status_id,
            updated_at = now()
        where machine_id = p_machine_id;
    end if;

    insert into app.machine_status_events (
        machine_id,
        old_machine_status_id,
        new_machine_status_id,
        changed_by_employee_id,
        cause_table_name,
        cause_record_id,
        reason
    )
    values (
        p_machine_id,
        v_old_machine_status_id,
        p_new_machine_status_id,
        p_actor_employee_id,
        v_cause_table_name,
        p_cause_record_id,
        v_reason
    );

    return p_machine_id;
end;
$$;

comment on function app.set_machine_status(bigint, bigint, bigint, text, bigint, text)
    is 'internal_helper: updates machine status and writes machine_status_events for approved parent causes.';

create or replace function app.rotate_machine_qr_token(
    p_actor_employee_id bigint,
    p_machine_id bigint,
    p_new_machine_qr_token text,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_new_token text;
    v_old_token text;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    v_new_token := app._assert_nonempty_text(p_new_machine_qr_token, 'p_new_machine_qr_token');

    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_manage_production', 'can_system_emergency_actions']
    );

    select m.machine_qr_token
    into v_old_token
    from app.machines m
    where m.machine_id = p_machine_id
    for update;

    if not found then
        raise exception 'machine not found'
            using errcode = 'P0001';
    end if;

    if v_old_token = v_new_token then
        raise exception 'new machine QR token must differ from current token'
            using errcode = '22023';
    end if;

    update app.machines
    set
        machine_qr_token = v_new_token,
        updated_at = now()
    where machine_id = p_machine_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'rotate_machine_qr_token',
        'machines',
        p_machine_id,
        jsonb_build_object(
            'machine_id', p_machine_id,
            'machine_qr_token_present', true,
            'machine_qr_token_length', length(v_old_token)
        ),
        jsonb_build_object(
            'machine_id', p_machine_id,
            'machine_qr_token_rotated', true,
            'machine_qr_token_length', length(v_new_token)
        ),
        v_reason
    );

    return p_machine_id;
end;
$$;

comment on function app.rotate_machine_qr_token(bigint, bigint, text, text)
    is 'runtime_api: rotates a machine QR token with reason and redacted audit evidence.';

create or replace function app.rotate_sku_qr_token(
    p_actor_employee_id bigint,
    p_sku_id bigint,
    p_new_sku_qr_token text,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_new_token text;
    v_old_token text;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    v_new_token := app._assert_nonempty_text(p_new_sku_qr_token, 'p_new_sku_qr_token');

    if v_new_token !~ '^[A-Za-z0-9_-]{32}$' then
        raise exception 'new SKU QR token must contain exactly 32 base64url characters'
            using errcode = '22023';
    end if;

    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_manage_production', 'can_system_emergency_actions']
    );

    select s.sku_qr_token
    into v_old_token
    from app.skus s
    where s.sku_id = p_sku_id
    for update;

    if not found then
        raise exception 'SKU not found'
            using errcode = 'P0001';
    end if;

    if v_old_token = v_new_token then
        raise exception 'new SKU QR token must differ from current token'
            using errcode = '22023';
    end if;

    update app.skus
    set
        sku_qr_token = v_new_token,
        updated_at = now()
    where sku_id = p_sku_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'rotate_sku_qr_token',
        'skus',
        p_sku_id,
        jsonb_build_object(
            'sku_id', p_sku_id,
            'sku_qr_token_present', true,
            'sku_qr_token_length', length(v_old_token)
        ),
        jsonb_build_object(
            'sku_id', p_sku_id,
            'sku_qr_token_rotated', true,
            'sku_qr_token_length', length(v_new_token)
        ),
        v_reason
    );

    return p_sku_id;
end;
$$;

comment on function app.rotate_sku_qr_token(bigint, bigint, text, text)
    is 'runtime_api: rotates a SKU QR token with reason and redacted audit evidence.';

create or replace function app.update_sku_tariff(
    p_actor_employee_id bigint,
    p_sku_id bigint,
    p_new_current_sku_tariff_uzs numeric,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_old_tariff numeric(18,4);
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_change_sku_tariff');

    if p_new_current_sku_tariff_uzs is null or p_new_current_sku_tariff_uzs < 0 then
        raise exception 'new SKU tariff must be non-negative'
            using errcode = '22023';
    end if;

    select s.current_sku_tariff_uzs
    into v_old_tariff
    from app.skus s
    where s.sku_id = p_sku_id
      and s.is_active = true
    for update;

    if not found then
        raise exception 'active SKU not found'
            using errcode = 'P0001';
    end if;

    if v_old_tariff = p_new_current_sku_tariff_uzs then
        return p_sku_id;
    end if;

    update app.skus
    set
        current_sku_tariff_uzs = p_new_current_sku_tariff_uzs,
        updated_at = now()
    where sku_id = p_sku_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'update_sku_tariff',
        'skus',
        p_sku_id,
        jsonb_build_object(
            'sku_id', p_sku_id,
            'current_sku_tariff_uzs', v_old_tariff
        ),
        jsonb_build_object(
            'sku_id', p_sku_id,
            'current_sku_tariff_uzs', p_new_current_sku_tariff_uzs
        ),
        v_reason
    );

    return p_sku_id;
end;
$$;

comment on function app.update_sku_tariff(bigint, bigint, numeric, text)
    is 'runtime_api: updates current SKU tariff with reason and audit without rewriting historical salary entries.';


-- END db/functions/_work/wp_03_machine_sku/functions.sql


-- BEGIN db/functions/_work/wp_04_production_operations/functions.sql

create or replace function app._get_salary_entry_type_production_operation_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_entry_type.production_operation',
        (
            select sety.salary_entry_type_id
            from app.salary_entry_types sety
            where sety.is_active = true
              and sety.is_production_operation = true
        )
    )
$$;

comment on function app._get_salary_entry_type_production_operation_id()
    is 'internal_helper: returns the active salary entry type id for production operation salary entries by semantic flag.';

create or replace function app._assert_sku_quantity_allowed(
    p_sku_id bigint,
    p_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_allows_fractional_quantity boolean;
begin
    if p_quantity is null or p_quantity < 0 then
        raise exception 'p_quantity must be non-negative'
            using errcode = '22023';
    end if;

    select su.allows_fractional_quantity
    into v_allows_fractional_quantity
    from app.skus s
    join app.sku_units su
        on su.sku_unit_id = s.sku_unit_id
    where s.sku_id = p_sku_id
      and s.is_active = true
      and su.is_active = true;

    if v_allows_fractional_quantity is null then
        raise exception 'active SKU with active unit is required'
            using errcode = '22023';
    end if;

    if v_allows_fractional_quantity = false and p_quantity <> trunc(p_quantity) then
        raise exception 'SKU unit does not allow fractional quantity'
            using errcode = '22023';
    end if;
end;
$$;

comment on function app._assert_sku_quantity_allowed(bigint, numeric)
    is 'internal_helper: validates production quantity against the SKU active unit fractional rule.';

create or replace function app._upsert_employee_salary_period_total(
    p_employee_id bigint,
    p_period_type_id bigint,
    p_period_start_date date,
    p_period_end_date date
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_total_id bigint;
    v_production_salary_uzs numeric(18,4);
    v_production_correction_salary_uzs numeric(18,4);
    v_additional_work_salary_uzs numeric(18,4);
    v_salary_correction_uzs numeric(18,4);
    v_source_ledger_max_id bigint;
begin
    perform 1
    from app.employee_salary_period_totals espt
    where espt.employee_id = p_employee_id
      and espt.salary_period_type_id = p_period_type_id
      and espt.period_start_date = p_period_start_date
    for update;

    select
        coalesce(sum(
            case
                when sety.is_production_operation = true
                    or original_sety.is_production_operation = true
                then ese.amount_uzs
                else 0
            end
        ), 0),
        coalesce(sum(
            case
                when sety.is_production_operation_correction = true
                    or original_sety.is_production_operation_correction = true
                then ese.amount_uzs
                else 0
            end
        ), 0),
        coalesce(sum(
            case
                when sety.is_additional_work = true
                    or original_sety.is_additional_work = true
                then ese.amount_uzs
                else 0
            end
        ), 0),
        coalesce(sum(
            case
                when sety.is_salary_correction = true
                    or original_sety.is_salary_correction = true
                then ese.amount_uzs
                else 0
            end
        ), 0),
        max(ese.employee_salary_entry_id)
    into
        v_production_salary_uzs,
        v_production_correction_salary_uzs,
        v_additional_work_salary_uzs,
        v_salary_correction_uzs,
        v_source_ledger_max_id
    from app.employee_salary_entries ese
    join app.salary_entry_types sety
        on sety.salary_entry_type_id = ese.salary_entry_type_id
    left join app.employee_salary_entries original_ese
        on original_ese.employee_salary_entry_id = ese.reversed_salary_entry_id
    left join app.salary_entry_types original_sety
        on original_sety.salary_entry_type_id = original_ese.salary_entry_type_id
    where ese.employee_id = p_employee_id
      and ese.salary_period_date between p_period_start_date and p_period_end_date;

    insert into app.employee_salary_period_totals (
        employee_id,
        salary_period_type_id,
        period_start_date,
        period_end_date,
        production_salary_uzs,
        production_correction_salary_uzs,
        additional_work_salary_uzs,
        salary_correction_uzs,
        total_salary_uzs,
        recalculated_at,
        source_ledger_max_id
    )
    values (
        p_employee_id,
        p_period_type_id,
        p_period_start_date,
        p_period_end_date,
        v_production_salary_uzs,
        v_production_correction_salary_uzs,
        v_additional_work_salary_uzs,
        v_salary_correction_uzs,
        v_production_salary_uzs
            + v_production_correction_salary_uzs
            + v_additional_work_salary_uzs
            + v_salary_correction_uzs,
        now(),
        v_source_ledger_max_id
    )
    on conflict (employee_id, salary_period_type_id, period_start_date) do update
    set
        period_end_date = excluded.period_end_date,
        production_salary_uzs = excluded.production_salary_uzs,
        production_correction_salary_uzs = excluded.production_correction_salary_uzs,
        additional_work_salary_uzs = excluded.additional_work_salary_uzs,
        salary_correction_uzs = excluded.salary_correction_uzs,
        total_salary_uzs = excluded.total_salary_uzs,
        recalculated_at = excluded.recalculated_at,
        source_ledger_max_id = excluded.source_ledger_max_id,
        updated_at = now()
    returning employee_salary_period_total_id into v_total_id;

    return v_total_id;
end;
$$;

comment on function app._upsert_employee_salary_period_total(bigint, bigint, date, date)
    is 'internal_helper: locks and rebuilds one salary period total row from employee_salary_entries.';

create or replace function app.recalculate_employee_salary_periods_for_entry(
    p_employee_salary_entry_id bigint
)
returns void
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_entry app.employee_salary_entries%rowtype;
    v_month_end_date date;
begin
    select *
    into v_entry
    from app.employee_salary_entries ese
    where ese.employee_salary_entry_id = p_employee_salary_entry_id
    for update;

    if not found then
        raise exception 'salary entry not found'
            using errcode = 'P0001';
    end if;

    v_month_end_date := (
        v_entry.salary_month_start_date + interval '1 month - 1 day'
    )::date;

    perform app._upsert_employee_salary_period_total(
        v_entry.employee_id,
        app._get_period_type_day_id(),
        v_entry.salary_period_date,
        v_entry.salary_period_date
    );

    perform app._upsert_employee_salary_period_total(
        v_entry.employee_id,
        app._get_period_type_week_id(),
        v_entry.salary_week_start_date,
        v_entry.salary_week_start_date + 6
    );

    perform app._upsert_employee_salary_period_total(
        v_entry.employee_id,
        app._get_period_type_month_id(),
        v_entry.salary_month_start_date,
        v_month_end_date
    );
end;
$$;

comment on function app.recalculate_employee_salary_periods_for_entry(bigint)
    is 'internal_helper: rebuilds day, week, and month salary totals from employee_salary_entries after one ledger entry.';

create or replace function app.accrue_production_operation_salary(
    p_actor_employee_id bigint,
    p_production_operation_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_operation app.production_operations%rowtype;
    v_sku app.skus%rowtype;
    v_accrued_at timestamptz;
    v_salary_period_date date;
    v_salary_week_start_date date;
    v_salary_month_start_date date;
    v_employee_roles_snapshot_json jsonb;
    v_employee_salary_entry_id bigint;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select *
    into v_operation
    from app.production_operations po
    where po.production_operation_id = p_production_operation_id
    for update;

    if not found then
        raise exception 'production operation not found'
            using errcode = 'P0001';
    end if;

    if v_operation.is_open = true
       or v_operation.finished_at is null
       or v_operation.quantity_produced is null
       or v_operation.cancelled_at is not null then
        raise exception 'production operation is not closed for salary accrual'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.employee_salary_entries ese
        where ese.production_operation_id = p_production_operation_id
          and ese.reversed_salary_entry_id is null
    ) then
        raise exception 'production operation salary entry already exists'
            using errcode = '23505';
    end if;

    select *
    into v_sku
    from app.skus s
    where s.sku_id = v_operation.sku_id
      and s.is_active = true
    for update;

    if not found then
        raise exception 'active SKU not found for production salary accrual'
            using errcode = 'P0001';
    end if;

    v_accrued_at := v_operation.finished_at;
    v_salary_period_date := (v_accrued_at at time zone 'Asia/Tashkent')::date;
    v_salary_week_start_date := date_trunc(
        'week',
        v_accrued_at at time zone 'Asia/Tashkent'
    )::date;
    v_salary_month_start_date := date_trunc(
        'month',
        v_accrued_at at time zone 'Asia/Tashkent'
    )::date;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'role_id', er.role_id,
                'assigned_at', er.assigned_at
            )
            order by er.employee_role_id
        ),
        '[]'::jsonb
    )
    into v_employee_roles_snapshot_json
    from app.employee_roles er
    join app.roles r
        on r.role_id = er.role_id
    where er.employee_id = v_operation.employee_id
      and er.revoked_at is null
      and r.is_active = true;

    insert into app.employee_salary_entries (
        employee_id,
        employee_shift_id,
        salary_entry_type_id,
        production_operation_id,
        quantity,
        tariff_rate_uzs,
        amount_uzs,
        accrued_at,
        accrued_by_employee_id,
        employee_roles_snapshot_json,
        machine_id_snapshot,
        sku_id_snapshot,
        sku_code_snapshot,
        sku_name_snapshot,
        salary_period_date,
        salary_week_start_date,
        salary_month_start_date
    )
    values (
        v_operation.employee_id,
        v_operation.employee_shift_id,
        app._get_salary_entry_type_production_operation_id(),
        v_operation.production_operation_id,
        v_operation.quantity_produced,
        v_sku.current_sku_tariff_uzs,
        v_operation.quantity_produced * v_sku.current_sku_tariff_uzs,
        v_accrued_at,
        p_actor_employee_id,
        v_employee_roles_snapshot_json,
        v_operation.machine_id,
        v_operation.sku_id,
        v_sku.sku_code,
        v_sku.sku_name,
        v_salary_period_date,
        v_salary_week_start_date,
        v_salary_month_start_date
    )
    returning employee_salary_entry_id into v_employee_salary_entry_id;

    perform app.recalculate_employee_salary_periods_for_entry(v_employee_salary_entry_id);

    return v_employee_salary_entry_id;
end;
$$;

comment on function app.accrue_production_operation_salary(bigint, bigint)
    is 'internal_helper: inserts production operation salary ledger entry and rebuilds affected salary totals in the same transaction.';

create or replace function app._get_machine_status_target_after_operation_terminal(
    p_machine_id bigint
)
returns table (
    machine_status_id bigint,
    cause_table_name text,
    cause_record_id bigint,
    reason text
)
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_downtime app.machine_downtimes%rowtype;
    v_machine_status_effect text;
begin
    select md.*
    into v_downtime
    from app.machine_downtimes md
    join app.machine_downtime_types mdt
        on mdt.machine_downtime_type_id = md.machine_downtime_type_id
    join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
    where md.machine_id = p_machine_id
      and md.is_open = true
      and mdt.is_active = true
      and mdbp.is_active = true
    order by
        (mdbp.machine_status_effect = 'BROKEN') desc,
        md.started_at desc,
        md.machine_downtime_id desc
    limit 1;

    if found then
        select mdbp.machine_status_effect
        into v_machine_status_effect
        from app.machine_downtime_types mdt
        join app.machine_downtime_behavior_profiles mdbp
            on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
        where mdt.machine_downtime_type_id = v_downtime.machine_downtime_type_id;

        if v_machine_status_effect = 'BROKEN' then
            machine_status_id := app._get_machine_status_broken_id();
        else
            machine_status_id := app._get_machine_status_non_broken_downtime_id();
        end if;

        cause_table_name := 'machine_downtimes';
        cause_record_id := v_downtime.machine_downtime_id;
        reason := 'production operation terminal state preserves active downtime status';
        return next;
        return;
    end if;

    machine_status_id := app._get_machine_status_available_for_start_id();
    cause_table_name := 'production_operations';
    cause_record_id := null;
    reason := 'production operation terminal state leaves machine available';
    return next;
end;
$$;

comment on function app._get_machine_status_target_after_operation_terminal(bigint)
    is 'internal_helper: selects the semantic machine status target after a production operation is finished or cancelled.';

create or replace function app.start_production_operation(
    p_actor_employee_id bigint,
    p_machine_id bigint,
    p_sku_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_employee_shift_id bigint;
    v_machine_status_id bigint;
    v_machine_use_status_id bigint;
    v_production_operation_id bigint;
begin
    perform app._assert_actor_is_employee_self(p_actor_employee_id, p_actor_employee_id);
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');

    perform 1
    from app.employees e
    where e.employee_id = p_actor_employee_id
    for update;

    select esh.employee_shift_id
    into v_employee_shift_id
    from app.employee_shifts esh
    where esh.employee_id = p_actor_employee_id
      and esh.is_open = true
    for update;

    if v_employee_shift_id is null then
        raise exception 'employee has no open shift'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.production_operations po
    where po.employee_id = p_actor_employee_id
      and po.is_open = true
    for update;

    if found then
        raise exception 'employee already has open production operation'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.operator_breaks ob
    join app.operator_break_types obt
        on obt.operator_break_type_id = ob.operator_break_type_id
    join app.operator_break_behavior_profiles obbp
        on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
    where ob.employee_id = p_actor_employee_id
      and ob.is_open = true
      and obbp.blocks_production_start = true
    for update;

    if found then
        raise exception 'active operator break blocks production start'
            using errcode = 'P0001';
    end if;

    select m.machine_status_id, m.machine_use_status_id
    into v_machine_status_id, v_machine_use_status_id
    from app.machines m
    where m.machine_id = p_machine_id
    for update;

    if not found then
        raise exception 'machine not found'
            using errcode = 'P0001';
    end if;

    if v_machine_use_status_id <> app._get_machine_use_available_for_operations_id() then
        raise exception 'machine is not available for operations'
            using errcode = 'P0001';
    end if;

    if v_machine_status_id <> app._get_machine_status_available_for_start_id() then
        raise exception 'machine is not available for production start'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.production_operations po
    where po.machine_id = p_machine_id
      and po.is_open = true
    for update;

    if found then
        raise exception 'machine already has open production operation'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.machine_downtimes md
    where md.machine_id = p_machine_id
      and md.is_open = true
    for update;

    if found then
        raise exception 'active machine downtime blocks production start'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.skus s
    join app.sku_units su
        on su.sku_unit_id = s.sku_unit_id
    where s.sku_id = p_sku_id
      and s.is_active = true
      and su.is_active = true
    for update of s;

    if not found then
        raise exception 'active SKU with active unit is required'
            using errcode = '22023';
    end if;

    insert into app.production_operations (
        employee_id,
        employee_shift_id,
        machine_id,
        sku_id,
        production_operation_status_id,
        is_open,
        started_at,
        started_by_employee_id
    )
    values (
        p_actor_employee_id,
        v_employee_shift_id,
        p_machine_id,
        p_sku_id,
        app._get_production_operation_status_open_id(),
        true,
        now(),
        p_actor_employee_id
    )
    returning production_operation_id into v_production_operation_id;

    perform app.set_machine_status(
        p_actor_employee_id,
        p_machine_id,
        app._get_machine_status_running_id(),
        'production_operations',
        v_production_operation_id,
        'production operation started'
    );

    return v_production_operation_id;
end;
$$;

comment on function app.start_production_operation(bigint, bigint, bigint)
    is 'runtime_api: starts the actor employee own production operation on an available machine for an active SKU.';

create or replace function app.finish_production_operation(
    p_actor_employee_id bigint,
    p_production_operation_id bigint,
    p_quantity_produced numeric,
    p_finish_comment text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_operation app.production_operations%rowtype;
    v_finish_comment text;
    v_is_self_finish boolean;
    v_before jsonb;
    v_after jsonb;
    v_salary_entry_id bigint;
    v_target record;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select *
    into v_operation
    from app.production_operations po
    where po.production_operation_id = p_production_operation_id
    for update;

    if not found then
        raise exception 'production operation not found'
            using errcode = 'P0001';
    end if;

    if v_operation.is_open = false then
        raise exception 'production operation is not open'
            using errcode = 'P0001';
    end if;

    v_is_self_finish := p_actor_employee_id = v_operation.employee_id;

    if v_is_self_finish then
        perform app._assert_actor_is_employee_self(p_actor_employee_id, v_operation.employee_id);
        perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');
    else
        v_finish_comment := app._assert_nonempty_text(p_finish_comment, 'p_finish_comment');
        perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_production');
    end if;

    perform app._assert_sku_quantity_allowed(v_operation.sku_id, p_quantity_produced);

    perform 1
    from app.employees e
    where e.employee_id = v_operation.employee_id
    for update;

    perform 1
    from app.employee_shifts esh
    where esh.employee_shift_id = v_operation.employee_shift_id
      and esh.employee_id = v_operation.employee_id
      and esh.is_open = true
    for update;

    if not found then
        raise exception 'operation employee shift is not open'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.operator_breaks ob
    join app.operator_break_types obt
        on obt.operator_break_type_id = ob.operator_break_type_id
    join app.operator_break_behavior_profiles obbp
        on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
    where ob.employee_id = v_operation.employee_id
      and ob.is_open = true
      and obbp.blocks_self_production_finish = true
    for update;

    if v_is_self_finish and found then
        raise exception 'active operator break blocks self production finish'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.machines m
    where m.machine_id = v_operation.machine_id
    for update;

    perform 1
    from app.skus s
    where s.sku_id = v_operation.sku_id
    for update;

    perform 1
    from app.machine_downtimes md
    join app.machine_downtime_types mdt
        on mdt.machine_downtime_type_id = md.machine_downtime_type_id
    join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
    where md.production_operation_id = p_production_operation_id
      and md.is_open = true
      and mdt.is_active = true
      and mdbp.is_active = true
      and mdbp.blocks_production_finish = true
    for update;

    if found then
        raise exception 'active operational downtime linked to operation blocks production finish'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.machine_downtimes md
    where md.machine_id = v_operation.machine_id
      and md.is_open = true
    for update;

    v_before := jsonb_build_object(
        'production_operation_id', v_operation.production_operation_id,
        'employee_id', v_operation.employee_id,
        'machine_id', v_operation.machine_id,
        'sku_id', v_operation.sku_id,
        'is_open', v_operation.is_open,
        'production_operation_status_id', v_operation.production_operation_status_id
    );

    update app.production_operations po
    set
        production_operation_status_id = app._get_production_operation_status_closed_id(),
        is_open = false,
        finished_at = now(),
        finished_by_employee_id = p_actor_employee_id,
        quantity_produced = p_quantity_produced,
        finish_comment = nullif(btrim(p_finish_comment), ''),
        updated_at = now()
    where po.production_operation_id = p_production_operation_id
    returning *
    into v_operation;

    v_after := jsonb_build_object(
        'production_operation_id', v_operation.production_operation_id,
        'is_open', v_operation.is_open,
        'production_operation_status_id', v_operation.production_operation_status_id,
        'finished_at', v_operation.finished_at,
        'finished_by_employee_id', v_operation.finished_by_employee_id,
        'quantity_produced', v_operation.quantity_produced,
        'finish_comment', v_operation.finish_comment
    );

    v_salary_entry_id := app.accrue_production_operation_salary(
        p_actor_employee_id,
        p_production_operation_id
    );

    select *
    into v_target
    from app._get_machine_status_target_after_operation_terminal(v_operation.machine_id);

    perform app.set_machine_status(
        p_actor_employee_id,
        v_operation.machine_id,
        v_target.machine_status_id,
        coalesce(v_target.cause_table_name, 'production_operations'),
        coalesce(v_target.cause_record_id, p_production_operation_id),
        v_target.reason
    );

    if not v_is_self_finish then
        perform app._insert_audit_event(
            p_actor_employee_id,
            'finish_production_operation_manager',
            'production_operations',
            p_production_operation_id,
            v_before,
            v_after || jsonb_build_object('employee_salary_entry_id', v_salary_entry_id),
            v_finish_comment
        );
    end if;

    return p_production_operation_id;
end;
$$;

comment on function app.finish_production_operation(bigint, bigint, numeric, text)
    is 'runtime_api: closes an open production operation, accrues production salary, and updates machine status.';

create or replace function app.cancel_production_operation(
    p_actor_employee_id bigint,
    p_production_operation_id bigint,
    p_cancel_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_cancel_reason text;
    v_operation app.production_operations%rowtype;
    v_before jsonb;
    v_after jsonb;
    v_target record;
begin
    v_cancel_reason := app._assert_nonempty_text(p_cancel_reason, 'p_cancel_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_manage_production', 'can_system_emergency_actions']
    );

    select *
    into v_operation
    from app.production_operations po
    where po.production_operation_id = p_production_operation_id
    for update;

    if not found then
        raise exception 'production operation not found'
            using errcode = 'P0001';
    end if;

    if v_operation.is_open = false then
        raise exception 'production operation is not open'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.employee_salary_entries ese
        where ese.production_operation_id = p_production_operation_id
          and ese.reversed_salary_entry_id is null
    ) then
        raise exception 'production operation with salary entry cannot be cancelled'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.employees e
    where e.employee_id = v_operation.employee_id
    for update;

    perform 1
    from app.employee_shifts esh
    where esh.employee_shift_id = v_operation.employee_shift_id
    for update;

    perform 1
    from app.machines m
    where m.machine_id = v_operation.machine_id
    for update;

    perform 1
    from app.machine_downtimes md
    where md.machine_id = v_operation.machine_id
      and md.is_open = true
    for update;

    v_before := jsonb_build_object(
        'production_operation_id', v_operation.production_operation_id,
        'employee_id', v_operation.employee_id,
        'machine_id', v_operation.machine_id,
        'sku_id', v_operation.sku_id,
        'is_open', v_operation.is_open,
        'production_operation_status_id', v_operation.production_operation_status_id
    );

    update app.machine_downtimes md
    set
        is_open = false,
        cancelled_at = now(),
        cancelled_by_employee_id = p_actor_employee_id,
        cancel_reason = v_cancel_reason,
        updated_at = now()
    from app.machine_downtime_types mdt
    join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
    where mdt.machine_downtime_type_id = md.machine_downtime_type_id
      and md.production_operation_id = p_production_operation_id
      and md.is_open = true
      and mdt.is_active = true
      and mdbp.is_active = true
      and mdbp.downtime_class = 'OPERATIONAL';

    update app.production_operations po
    set
        production_operation_status_id = app._get_production_operation_status_cancelled_id(),
        is_open = false,
        cancelled_at = now(),
        cancelled_by_employee_id = p_actor_employee_id,
        cancel_reason = v_cancel_reason,
        updated_at = now()
    where po.production_operation_id = p_production_operation_id
    returning *
    into v_operation;

    v_after := jsonb_build_object(
        'production_operation_id', v_operation.production_operation_id,
        'is_open', v_operation.is_open,
        'production_operation_status_id', v_operation.production_operation_status_id,
        'cancelled_at', v_operation.cancelled_at,
        'cancelled_by_employee_id', v_operation.cancelled_by_employee_id,
        'cancel_reason', v_operation.cancel_reason
    );

    select *
    into v_target
    from app._get_machine_status_target_after_operation_terminal(v_operation.machine_id);

    perform app.set_machine_status(
        p_actor_employee_id,
        v_operation.machine_id,
        v_target.machine_status_id,
        coalesce(v_target.cause_table_name, 'production_operations'),
        coalesce(v_target.cause_record_id, p_production_operation_id),
        v_target.reason
    );

    perform app._insert_audit_event(
        p_actor_employee_id,
        'cancel_production_operation',
        'production_operations',
        p_production_operation_id,
        v_before,
        v_after,
        v_cancel_reason
    );

    return p_production_operation_id;
end;
$$;

comment on function app.cancel_production_operation(bigint, bigint, text)
    is 'runtime_api: cancels an open production operation with reason, audit, and no salary entry creation.';

-- END db/functions/_work/wp_04_production_operations/functions.sql


-- BEGIN db/functions/_work/wp_05_downtime_breaks_additional_work/functions.sql

create or replace function app._get_additional_work_approval_pending_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'additional_work_approval_status.pending',
        (
            select aws.additional_work_approval_status_id
            from app.additional_work_approval_statuses aws
            where aws.is_active = true
              and aws.is_pending = true
        )
    )
$$;

comment on function app._get_additional_work_approval_pending_id()
    is 'internal_helper: semantic lookup for the single active pending additional work approval status.';

create or replace function app._get_additional_work_approval_approved_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'additional_work_approval_status.approved',
        (
            select aws.additional_work_approval_status_id
            from app.additional_work_approval_statuses aws
            where aws.is_active = true
              and aws.is_approved = true
        )
    )
$$;

comment on function app._get_additional_work_approval_approved_id()
    is 'internal_helper: semantic lookup for the single active approved additional work approval status.';

create or replace function app._get_additional_work_approval_rejected_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'additional_work_approval_status.rejected',
        (
            select aws.additional_work_approval_status_id
            from app.additional_work_approval_statuses aws
            where aws.is_active = true
              and aws.is_rejected = true
        )
    )
$$;

comment on function app._get_additional_work_approval_rejected_id()
    is 'internal_helper: semantic lookup for the single active rejected additional work approval status.';

create or replace function app._get_additional_work_approval_cancelled_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'additional_work_approval_status.cancelled',
        (
            select aws.additional_work_approval_status_id
            from app.additional_work_approval_statuses aws
            where aws.is_active = true
              and aws.is_cancelled = true
        )
    )
$$;

comment on function app._get_additional_work_approval_cancelled_id()
    is 'internal_helper: semantic lookup for the single active cancelled additional work approval status.';

create or replace function app._get_additional_work_accrual_waiting_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'additional_work_accrual_status.waiting_accrual',
        (
            select awas.additional_work_accrual_status_id
            from app.additional_work_accrual_statuses awas
            where awas.is_active = true
              and awas.is_waiting_accrual = true
        )
    )
$$;

comment on function app._get_additional_work_accrual_waiting_id()
    is 'internal_helper: semantic lookup for the single active waiting-accrual additional work status.';

create or replace function app._get_additional_work_accrual_accrued_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'additional_work_accrual_status.accrued',
        (
            select awas.additional_work_accrual_status_id
            from app.additional_work_accrual_statuses awas
            where awas.is_active = true
              and awas.is_accrued = true
        )
    )
$$;

comment on function app._get_additional_work_accrual_accrued_id()
    is 'internal_helper: semantic lookup for the single active accrued additional work status.';

create or replace function app._get_additional_work_accrual_without_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'additional_work_accrual_status.without_accrual',
        (
            select awas.additional_work_accrual_status_id
            from app.additional_work_accrual_statuses awas
            where awas.is_active = true
              and awas.is_without_accrual = true
        )
    )
$$;

comment on function app._get_additional_work_accrual_without_id()
    is 'internal_helper: semantic lookup for the single active without-accrual additional work status.';

create or replace function app._get_salary_entry_type_additional_work_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_entry_type.additional_work',
        (
            select sety.salary_entry_type_id
            from app.salary_entry_types sety
            where sety.is_active = true
              and sety.is_additional_work = true
        )
    )
$$;

comment on function app._get_salary_entry_type_additional_work_id()
    is 'internal_helper: semantic lookup for the single active additional work salary entry type.';

create or replace function app._recalculate_machine_status_for_machine(
    p_actor_employee_id bigint,
    p_machine_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_machine_use_status_id bigint;
    v_new_machine_status_id bigint;
    v_cause_table_name text;
    v_cause_record_id bigint;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select m.machine_use_status_id
    into v_machine_use_status_id
    from app.machines m
    where m.machine_id = p_machine_id
    for update;

    if not found then
        raise exception 'machine not found'
            using errcode = 'P0001';
    end if;

    if v_machine_use_status_id = app._get_machine_use_decommissioned_id() then
        raise exception 'decommissioned machine status recalculation is not allowed in WP-05'
            using errcode = 'P0001';
    end if;

    select
        case
            when mdbp.machine_status_effect = 'BROKEN' then app._get_machine_status_broken_id()
            else app._get_machine_status_non_broken_downtime_id()
        end,
        'machine_downtimes',
        md.machine_downtime_id
    into v_new_machine_status_id, v_cause_table_name, v_cause_record_id
    from app.machine_downtimes md
    join app.machine_downtime_types mdt
        on mdt.machine_downtime_type_id = md.machine_downtime_type_id
    join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
    where md.machine_id = p_machine_id
      and md.is_open = true
      and mdt.is_active = true
      and mdbp.is_active = true
    order by
        (mdbp.machine_status_effect = 'BROKEN') desc,
        (mdbp.downtime_class = 'CRITICAL') desc,
        md.started_at asc,
        md.machine_downtime_id asc
    limit 1;

    if v_new_machine_status_id is null then
        select app._get_machine_status_running_id(),
               'production_operations',
               po.production_operation_id
        into v_new_machine_status_id, v_cause_table_name, v_cause_record_id
        from app.production_operations po
        where po.machine_id = p_machine_id
          and po.is_open = true
        order by po.started_at asc, po.production_operation_id asc
        limit 1;
    end if;

    if v_new_machine_status_id is null then
        v_new_machine_status_id := app._get_machine_status_available_for_start_id();
        v_cause_table_name := null;
        v_cause_record_id := null;
    end if;

    perform app.set_machine_status(
        p_actor_employee_id,
        p_machine_id,
        v_new_machine_status_id,
        v_cause_table_name,
        v_cause_record_id,
        p_reason
    );

    return p_machine_id;
end;
$$;

comment on function app._recalculate_machine_status_for_machine(bigint, bigint, text)
    is 'internal_helper: recalculates machine status from active downtime and production-operation priority for WP-05 downtime transitions.';

create or replace function app.start_machine_downtime(
    p_actor_employee_id bigint,
    p_machine_id bigint,
    p_machine_downtime_type_id bigint,
    p_production_operation_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_type record;
    v_is_operator_path boolean := false;
    v_can_manage boolean;
    v_can_emergency boolean;
    v_actor_can_work boolean;
    v_machine_downtime_id bigint;
    v_production_operation app.production_operations%rowtype;
    v_effective_production_operation_id bigint := p_production_operation_id;
    v_employee_shift_id bigint;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select p.can_manage_production, p.can_system_emergency_actions, p.can_work_as_operator
    into v_can_manage, v_can_emergency, v_actor_can_work
    from app._get_actor_effective_role_permissions(p_actor_employee_id) p;

    if v_actor_can_work then
        perform 1
        from app.employees e
        where e.employee_id = p_actor_employee_id
        for update;

        select esh.employee_shift_id
        into v_employee_shift_id
        from app.employee_shifts esh
        where esh.employee_id = p_actor_employee_id
          and esh.is_open = true
        for update;
    end if;

    select
        mdt.*,
        mdbp.requires_production_operation,
        mdbp.operator_requires_start_comment,
        mdbp.privileged_actor_requires_start_reason,
        mdbp.downtime_class as profile_downtime_class
    into v_type
    from app.machine_downtime_types mdt
    join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
    where mdt.machine_downtime_type_id = p_machine_downtime_type_id
      and mdt.is_active = true
      and mdbp.is_active = true;

    if not found then
        raise exception 'active machine downtime type is required'
            using errcode = '22023';
    end if;

    perform 1
    from app.machines m
    where m.machine_id = p_machine_id
      and m.machine_use_status_id = app._get_machine_use_available_for_operations_id()
    for update;

    if not found then
        raise exception 'machine is not available for downtime transition'
            using errcode = 'P0001';
    end if;

    if p_production_operation_id is not null then
        select *
        into v_production_operation
        from app.production_operations po
        where po.production_operation_id = p_production_operation_id
          and po.machine_id = p_machine_id
          and po.is_open = true
        for update;

        if not found then
            raise exception 'open production operation on the same machine is required'
                using errcode = 'P0001';
        end if;

        v_is_operator_path := (
            v_employee_shift_id is not null
            and v_production_operation.employee_id = p_actor_employee_id
            and v_actor_can_work
        );
    end if;

    if not v_type.requires_production_operation
       and p_production_operation_id is null then
        select *
        into v_production_operation
        from app.production_operations po
        where po.machine_id = p_machine_id
          and po.is_open = true
        for update;

        if found then
            v_effective_production_operation_id := v_production_operation.production_operation_id;
            v_is_operator_path := (
                v_employee_shift_id is not null
                and v_production_operation.employee_id = p_actor_employee_id
                and v_actor_can_work
            );
        elsif v_actor_can_work and v_employee_shift_id is not null then
            v_is_operator_path := true;
        end if;
    end if;

    if v_type.requires_production_operation and p_production_operation_id is null then
        raise exception 'selected machine downtime profile requires production operation'
            using errcode = '22023';
    end if;

    if not v_type.requires_production_operation
       and p_production_operation_id is not null
       and not v_production_operation.is_open then
        raise exception 'critical downtime referenced operation must be open when supplied'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.machine_downtimes md
    where md.machine_id = p_machine_id
      and md.is_open = true
    for update;

    if found then
        raise exception 'machine already has open downtime'
            using errcode = 'P0001';
    end if;

    if not v_is_operator_path then
        if not (v_can_manage or v_can_emergency) then
            raise exception 'actor lacks downtime start permission'
                using errcode = '42501';
        end if;
    end if;

    if v_is_operator_path then
        if v_type.operator_requires_start_comment then
            v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
        else
            v_reason := nullif(btrim(p_reason), '');
        end if;
    else
        if v_type.privileged_actor_requires_start_reason then
            v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
        else
            v_reason := nullif(btrim(p_reason), '');
        end if;
    end if;

    insert into app.machine_downtimes (
        machine_id,
        production_operation_id,
        machine_downtime_type_id,
        started_at,
        started_by_employee_id,
        is_open
    )
    values (
        p_machine_id,
        v_effective_production_operation_id,
        p_machine_downtime_type_id,
        now(),
        p_actor_employee_id,
        true
    )
    returning machine_downtime_id into v_machine_downtime_id;

    perform app._recalculate_machine_status_for_machine(p_actor_employee_id, p_machine_id, v_reason);

    if not v_is_operator_path then
        perform app._insert_audit_event(
            p_actor_employee_id,
            case when v_can_emergency and not v_can_manage then 'start_machine_downtime_emergency' else 'start_machine_downtime_manager' end,
            'machine_downtimes',
            v_machine_downtime_id,
            null,
            jsonb_build_object(
                'machine_downtime_id', v_machine_downtime_id,
                'machine_id', p_machine_id,
                'production_operation_id', v_effective_production_operation_id,
                'machine_downtime_type_id', p_machine_downtime_type_id,
                'is_open', true
            ),
            v_reason
        );
    end if;

    return v_machine_downtime_id;
end;
$$;

comment on function app.start_machine_downtime(bigint, bigint, bigint, bigint, text)
    is 'runtime_api: starts operational or critical machine downtime using semantic downtime type rules; critical downtime auto-links active machine production and rejects an operator acting on another operator''s occupied machine.';

create or replace function app.finish_machine_downtime(
    p_actor_employee_id bigint,
    p_machine_downtime_id bigint,
    p_finish_comment text,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_finish_comment text;
    v_downtime app.machine_downtimes%rowtype;
    v_is_operator_path boolean := false;
    v_can_manage boolean;
    v_can_emergency boolean;
    v_actor_can_work boolean;
    v_employee_shift_id bigint;
    v_before jsonb;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select p.can_manage_production, p.can_system_emergency_actions, p.can_work_as_operator
    into v_can_manage, v_can_emergency, v_actor_can_work
    from app._get_actor_effective_role_permissions(p_actor_employee_id) p;

    if v_actor_can_work then
        perform 1
        from app.employees e
        where e.employee_id = p_actor_employee_id
        for update;

        select esh.employee_shift_id
        into v_employee_shift_id
        from app.employee_shifts esh
        where esh.employee_id = p_actor_employee_id
          and esh.is_open = true
        for update;
    end if;

    select *
    into v_downtime
    from app.machine_downtimes md
    where md.machine_downtime_id = p_machine_downtime_id
      and md.is_open = true
    for update;

    if not found then
        raise exception 'open machine downtime not found'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.machines m
    where m.machine_id = v_downtime.machine_id
    for update;

    if v_downtime.production_operation_id is not null then
        perform 1
        from app.production_operations po
        where po.production_operation_id = v_downtime.production_operation_id
        for update;

        v_is_operator_path := exists (
            select 1
            from app.production_operations po
            join app.employee_shifts esh
                on esh.employee_id = po.employee_id
               and esh.is_open = true
            where po.production_operation_id = v_downtime.production_operation_id
              and po.is_open = true
              and po.employee_id = p_actor_employee_id
              and v_employee_shift_id is not null
              and v_actor_can_work
        );
    end if;

    if not v_is_operator_path then
        if not (v_can_manage or v_can_emergency) then
            raise exception 'actor lacks downtime finish permission'
                using errcode = '42501';
        end if;

        v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    else
        v_reason := nullif(btrim(p_reason), '');
    end if;

    v_finish_comment := nullif(btrim(p_finish_comment), '');

    v_before := jsonb_build_object(
        'machine_downtime_id', v_downtime.machine_downtime_id,
        'machine_id', v_downtime.machine_id,
        'production_operation_id', v_downtime.production_operation_id,
        'machine_downtime_type_id', v_downtime.machine_downtime_type_id,
        'is_open', v_downtime.is_open
    );

    update app.machine_downtimes
    set
        is_open = false,
        finished_at = now(),
        finished_by_employee_id = p_actor_employee_id,
        finish_comment = v_finish_comment,
        updated_at = now()
    where machine_downtime_id = p_machine_downtime_id;

    perform app._recalculate_machine_status_for_machine(p_actor_employee_id, v_downtime.machine_id, v_reason);

    if not v_is_operator_path then
        perform app._insert_audit_event(
            p_actor_employee_id,
            case when v_can_emergency and not v_can_manage then 'finish_machine_downtime_emergency' else 'finish_machine_downtime_manager' end,
            'machine_downtimes',
            p_machine_downtime_id,
            v_before,
            jsonb_build_object(
                'machine_downtime_id', p_machine_downtime_id,
                'machine_id', v_downtime.machine_id,
                'production_operation_id', v_downtime.production_operation_id,
                'is_open', false,
                'finished_by_employee_id', p_actor_employee_id
            ),
            v_reason
        );
    end if;

    return p_machine_downtime_id;
end;
$$;

comment on function app.finish_machine_downtime(bigint, bigint, text, text)
    is 'runtime_api: finishes open machine downtime, preserves production operation linkage and audits manager/emergency finish paths.';

create or replace function app.cancel_machine_downtime(
    p_actor_employee_id bigint,
    p_machine_downtime_id bigint,
    p_cancel_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_downtime app.machine_downtimes%rowtype;
begin
    v_reason := app._assert_nonempty_text(p_cancel_reason, 'p_cancel_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_manage_production', 'can_system_emergency_actions']
    );

    select *
    into v_downtime
    from app.machine_downtimes md
    where md.machine_downtime_id = p_machine_downtime_id
      and md.is_open = true
    for update;

    if not found then
        raise exception 'open machine downtime not found'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.machines m
    where m.machine_id = v_downtime.machine_id
    for update;

    update app.machine_downtimes
    set
        is_open = false,
        cancelled_at = now(),
        cancelled_by_employee_id = p_actor_employee_id,
        cancel_reason = v_reason,
        updated_at = now()
    where machine_downtime_id = p_machine_downtime_id;

    perform app._recalculate_machine_status_for_machine(p_actor_employee_id, v_downtime.machine_id, v_reason);

    perform app._insert_audit_event(
        p_actor_employee_id,
        'cancel_machine_downtime',
        'machine_downtimes',
        p_machine_downtime_id,
        jsonb_build_object(
            'machine_downtime_id', v_downtime.machine_downtime_id,
            'machine_id', v_downtime.machine_id,
            'production_operation_id', v_downtime.production_operation_id,
            'machine_downtime_type_id', v_downtime.machine_downtime_type_id,
            'is_open', v_downtime.is_open
        ),
        jsonb_build_object(
            'machine_downtime_id', p_machine_downtime_id,
            'machine_id', v_downtime.machine_id,
            'production_operation_id', v_downtime.production_operation_id,
            'is_open', false,
            'cancelled_by_employee_id', p_actor_employee_id
        ),
        v_reason
    );

    return p_machine_downtime_id;
end;
$$;

comment on function app.cancel_machine_downtime(bigint, bigint, text)
    is 'runtime_api: cancels open machine downtime with required reason, audit and deterministic machine status recalculation.';

create or replace function app.start_operator_break(
    p_actor_employee_id bigint,
    p_operator_break_type_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_employee_shift_id bigint;
    v_operator_break_id bigint;
    v_break_profile record;
begin
    perform app._assert_actor_is_employee_self(p_actor_employee_id, p_actor_employee_id);
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');

    perform 1
    from app.employees e
    where e.employee_id = p_actor_employee_id
    for update;

    select esh.employee_shift_id
    into v_employee_shift_id
    from app.employee_shifts esh
    where esh.employee_id = p_actor_employee_id
      and esh.is_open = true
    for update;

    if v_employee_shift_id is null then
        raise exception 'employee has no open shift'
            using errcode = 'P0001';
    end if;

    select obbp.*
    into v_break_profile
    from app.operator_break_types obt
    join app.operator_break_behavior_profiles obbp
        on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
    where obt.operator_break_type_id = p_operator_break_type_id
      and obt.is_active = true
      and obbp.is_active = true;

    if not found then
        raise exception 'active operator break type is required'
            using errcode = '22023';
    end if;

    if not v_break_profile.allows_during_open_production and exists (
        select 1
        from app.production_operations po
        where po.employee_id = p_actor_employee_id
          and po.is_open = true
    ) then
        raise exception 'selected operator break profile does not allow open production'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.operator_breaks ob
    where ob.employee_id = p_actor_employee_id
      and ob.is_open = true
    for update;

    if found then
        raise exception 'employee already has open operator break'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.additional_works aw
    where aw.employee_id = p_actor_employee_id
      and aw.started_at is not null
      and aw.finished_at is null
      and aw.cancelled_at is null
    for update;

    if found then
        raise exception 'running additional work blocks operator break start'
            using errcode = 'P0001';
    end if;

    insert into app.operator_breaks (
        employee_id,
        employee_shift_id,
        operator_break_type_id,
        started_at,
        started_by_employee_id,
        is_open
    )
    values (
        p_actor_employee_id,
        v_employee_shift_id,
        p_operator_break_type_id,
        now(),
        p_actor_employee_id,
        true
    )
    returning operator_break_id into v_operator_break_id;

    return v_operator_break_id;
end;
$$;

comment on function app.start_operator_break(bigint, bigint)
    is 'runtime_api: starts the actor employee own operator break without changing production operation or machine status.';

create or replace function app.finish_operator_break(
    p_actor_employee_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_operator_break_id bigint;
begin
    perform app._assert_actor_is_employee_self(p_actor_employee_id, p_actor_employee_id);
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');

    perform 1
    from app.employees e
    where e.employee_id = p_actor_employee_id
    for update;

    perform 1
    from app.employee_shifts esh
    where esh.employee_id = p_actor_employee_id
      and esh.is_open = true
    for update;

    if not found then
        raise exception 'employee has no open shift'
            using errcode = 'P0001';
    end if;

    select ob.operator_break_id
    into v_operator_break_id
    from app.operator_breaks ob
    where ob.employee_id = p_actor_employee_id
      and ob.is_open = true
    for update;

    if v_operator_break_id is null then
        raise exception 'employee has no open operator break'
            using errcode = 'P0001';
    end if;

    update app.operator_breaks
    set
        is_open = false,
        finished_at = now(),
        finished_by_employee_id = p_actor_employee_id,
        updated_at = now()
    where operator_break_id = v_operator_break_id;

    return v_operator_break_id;
end;
$$;

comment on function app.finish_operator_break(bigint)
    is 'runtime_api: finishes the actor employee own open operator break without audit or machine status changes.';

create or replace function app.emergency_finish_operator_break(
    p_actor_employee_id bigint,
    p_target_employee_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_break app.operator_breaks%rowtype;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_manage_production', 'can_manage_admin', 'can_system_emergency_actions']
    );

    if p_target_employee_id is null or p_target_employee_id = p_actor_employee_id then
        raise exception 'target employee must differ from emergency actor'
            using errcode = '22023';
    end if;

    perform 1
    from app.employees e
    where e.employee_id = p_target_employee_id
    for update;

    if not found then
        raise exception 'target employee not found'
            using errcode = 'P0001';
    end if;

    select *
    into v_break
    from app.operator_breaks ob
    where ob.employee_id = p_target_employee_id
      and ob.is_open = true
    for update;

    if not found then
        raise exception 'target employee has no open operator break'
            using errcode = 'P0001';
    end if;

    update app.operator_breaks
    set
        is_open = false,
        finished_at = now(),
        finished_by_employee_id = p_actor_employee_id,
        emergency_finish_reason = v_reason,
        updated_at = now()
    where operator_break_id = v_break.operator_break_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'emergency_finish_operator_break',
        'operator_breaks',
        v_break.operator_break_id,
        jsonb_build_object(
            'operator_break_id', v_break.operator_break_id,
            'employee_id', v_break.employee_id,
            'employee_shift_id', v_break.employee_shift_id,
            'operator_break_type_id', v_break.operator_break_type_id,
            'is_open', true
        ),
        jsonb_build_object(
            'operator_break_id', v_break.operator_break_id,
            'employee_id', v_break.employee_id,
            'is_open', false,
            'finished_by_employee_id', p_actor_employee_id,
            'emergency_finish_reason_present', true
        ),
        v_reason
    );

    return v_break.operator_break_id;
end;
$$;

comment on function app.emergency_finish_operator_break(bigint, bigint, text)
    is 'runtime_api: emergency/admin finishes another employee open operator break with required reason and audit.';

create or replace function app._create_additional_work_notification_for_permission(
    p_additional_work_id bigint,
    p_permission_name text,
    p_task_key text,
    p_title text,
    p_message_text text
)
returns integer
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_recipient record;
    v_created_count integer := 0;
    v_before_notification_id bigint;
    v_after_notification_id bigint;
    v_deduplication_key text;
begin
    if p_additional_work_id is null then
        raise exception 'p_additional_work_id is required'
            using errcode = '22023';
    end if;

    v_deduplication_key := app._assert_nonempty_text(p_task_key, 'p_task_key');

    for v_recipient in
        select recipient_employee_id
        from app._get_notification_recipients_by_permission(p_permission_name)
    loop
        select n.notification_id
        into v_before_notification_id
        from app.notifications n
        join app.notification_statuses ns
            on ns.notification_status_id = n.notification_status_id
        where n.recipient_employee_id = v_recipient.recipient_employee_id
          and n.notification_channel_id = app._get_notification_channel_telegram_id()
          and n.deduplication_key = v_deduplication_key || '_' || v_recipient.recipient_employee_id::text
          and ns.is_cancelled = false
        order by n.notification_id
        limit 1;

        v_after_notification_id := app.create_notification(
            v_recipient.recipient_employee_id,
            'additional_works',
            p_additional_work_id,
            p_title,
            p_message_text,
            v_deduplication_key || '_' || v_recipient.recipient_employee_id::text
        );

        if v_before_notification_id is null
           and app._notification_is_active_for_deduplication(v_after_notification_id) then
            v_created_count := v_created_count + 1;
        end if;
    end loop;

    return v_created_count;
end;
$$;

comment on function app._create_additional_work_notification_for_permission(bigint, text, text, text, text)
    is 'internal_helper: creates Допработа task notifications for recipients routed by allowlisted permission flags.';

create or replace function app._create_additional_work_notification_for_employee(
    p_additional_work_id bigint,
    p_recipient_employee_id bigint,
    p_task_key text,
    p_title text,
    p_message_text text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if p_additional_work_id is null then
        raise exception 'p_additional_work_id is required'
            using errcode = '22023';
    end if;

    return app.create_notification(
        p_recipient_employee_id,
        'additional_works',
        p_additional_work_id,
        p_title,
        p_message_text,
        app._assert_nonempty_text(p_task_key, 'p_task_key') || '_' || p_recipient_employee_id::text
    );
end;
$$;

comment on function app._create_additional_work_notification_for_employee(bigint, bigint, text, text, text)
    is 'internal_helper: creates direct employee Допработа notifications with stable deduplication keys.';

create or replace function app._cancel_additional_work_task_notifications(
    p_additional_work_id bigint,
    p_task_key_prefix text
)
returns integer
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_task_key_prefix text;
    v_cancelled_count integer;
begin
    if p_additional_work_id is null then
        raise exception 'p_additional_work_id is required'
            using errcode = '22023';
    end if;

    v_task_key_prefix := app._assert_nonempty_text(p_task_key_prefix, 'p_task_key_prefix');

    update app.notifications n
    set
        notification_status_id = app._get_notification_status_cancelled_id()
    from app.notification_statuses ns
    where ns.notification_status_id = n.notification_status_id
      and ns.is_cancelled = false
      and n.cause_table_name = 'additional_works'
      and n.cause_record_id = p_additional_work_id
      and n.deduplication_key like v_task_key_prefix || '_%';

    get diagnostics v_cancelled_count = row_count;
    return v_cancelled_count;
end;
$$;

comment on function app._cancel_additional_work_task_notifications(bigint, text)
    is 'internal_helper: cancels fulfilled Допработа task notifications in DB without deleting rows or claiming provider chat hide.';

create or replace function app._get_additional_work_notification_context(
    p_additional_work_id bigint
)
returns table (
    employee_id bigint,
    employee_full_name text,
    additional_work_type_name text
)
language sql
security definer
set search_path = app, pg_catalog
as $$
    select
        aw.employee_id,
        e.full_name,
        awt.additional_work_type_name
    from app.additional_works aw
    join app.employees e
        on e.employee_id = aw.employee_id
    join app.additional_work_types awt
        on awt.additional_work_type_id = aw.additional_work_type_id
    where aw.additional_work_id = p_additional_work_id
$$;

comment on function app._get_additional_work_notification_context(bigint)
    is 'internal_helper: returns Допработа notification template context with employee full name and type name.';

create or replace function app.request_additional_work(
    p_actor_employee_id bigint,
    p_additional_work_type_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_additional_work_id bigint;
    v_shift_id bigint;
    v_type_name text;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');

    perform 1
    from app.employees e
    join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
    where e.employee_id = p_actor_employee_id
      and es.is_active = true
      and es.is_active_for_login = true
    for update;

    if not found then
        raise exception 'active employee is required'
            using errcode = 'P0001';
    end if;

    select esh.employee_shift_id
    into v_shift_id
    from app.employee_shifts esh
    where esh.employee_id = p_actor_employee_id
      and esh.is_open = true
    for update;

    if v_shift_id is null then
        raise exception 'employee has no open shift'
            using errcode = 'P0001';
    end if;

    select awt.additional_work_type_name
    into v_type_name
    from app.additional_work_types awt
    where awt.additional_work_type_id = p_additional_work_type_id
      and awt.is_active = true;

    if v_type_name is null then
        raise exception 'active Допработа type is required'
            using errcode = '22023';
    end if;

    perform 1
    from app.additional_works aw
    where aw.employee_id = p_actor_employee_id
      and aw.additional_work_type_id = p_additional_work_type_id
      and aw.is_assignment_finished = false
    for update;

    if found then
        raise exception 'unfinished Допработа already exists for employee and type'
            using errcode = 'P0001';
    end if;

    insert into app.additional_works (
        employee_id,
        additional_work_type_id,
        assigned_at,
        assigned_by_employee_id,
        is_assignment_finished,
        additional_work_approval_status_id
    )
    values (
        p_actor_employee_id,
        p_additional_work_type_id,
        now(),
        p_actor_employee_id,
        false,
        app._get_additional_work_approval_pending_id()
    )
    returning additional_work_id into v_additional_work_id;

    perform app._create_additional_work_notification_for_permission(
        v_additional_work_id,
        'can_receive_production_notifications',
        'additional_work_' || v_additional_work_id::text || '_request',
        'Допработа ожидает согласования',
        'Допработа: ' || v_type_name || ', работник: ' || (select full_name from app.employees where employee_id = p_actor_employee_id) || ' ожидает согласования.'
    );

    return v_additional_work_id;
end;
$$;

comment on function app.request_additional_work(bigint, bigint)
    is 'runtime_api: creates operator-requested Допработа in pending state and creates production-manager task notifications.';

create or replace function app.approve_additional_work_request(
    p_actor_employee_id bigint,
    p_additional_work_id bigint,
    p_manager_comment text default null
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_comment text;
    v_work app.additional_works%rowtype;
    v_context record;
begin
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_manage_production', 'can_manage_admin']
    );

    v_comment := nullif(btrim(p_manager_comment), '');

    select *
    into v_work
    from app.additional_works aw
    where aw.additional_work_id = p_additional_work_id
    for update;

    if not found then
        raise exception 'Допработа not found'
            using errcode = 'P0001';
    end if;

    if v_work.additional_work_approval_status_id <> app._get_additional_work_approval_pending_id()
       or v_work.started_at is not null
       or v_work.finished_at is not null
       or v_work.cancelled_at is not null
       or v_work.is_assignment_finished
       or v_work.decision_at is not null then
        raise exception 'Допработа request is not approvable'
            using errcode = 'P0001';
    end if;

    update app.additional_works
    set
        additional_work_approval_status_id = app._get_additional_work_approval_approved_id(),
        decision_by_employee_id = p_actor_employee_id,
        decision_at = now(),
        manager_decision_comment = v_comment,
        updated_at = now()
    where additional_work_id = p_additional_work_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'approve_additional_work_request',
        'additional_works',
        p_additional_work_id,
        jsonb_build_object('additional_work_id', v_work.additional_work_id, 'approval_status_id', v_work.additional_work_approval_status_id),
        jsonb_build_object('additional_work_id', p_additional_work_id, 'approval_status_id', app._get_additional_work_approval_approved_id(), 'decision_by_employee_id', p_actor_employee_id),
        v_comment
    );

    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_request');

    select * into v_context from app._get_additional_work_notification_context(p_additional_work_id);

    perform app._create_additional_work_notification_for_employee(
        p_additional_work_id,
        v_work.employee_id,
        'additional_work_' || p_additional_work_id::text || '_request_approved',
        'Допработа согласована',
        'Допработа: ' || v_context.additional_work_type_name || ' согласована.'
    );

    return p_additional_work_id;
end;
$$;

comment on function app.approve_additional_work_request(bigint, bigint, text)
    is 'runtime_api: approves requested Допработа before execution with optional manager comment, closes manager task notifications and notifies the operator.';

create or replace function app.reject_additional_work_request(
    p_actor_employee_id bigint,
    p_additional_work_id bigint,
    p_manager_comment text default null
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_comment text;
    v_work app.additional_works%rowtype;
    v_context record;
begin
    v_comment := app._assert_nonempty_text(p_manager_comment, 'p_manager_comment');

    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_manage_production', 'can_manage_admin']
    );

    select *
    into v_work
    from app.additional_works aw
    where aw.additional_work_id = p_additional_work_id
    for update;

    if not found then
        raise exception 'Допработа not found'
            using errcode = 'P0001';
    end if;

    if v_work.additional_work_approval_status_id <> app._get_additional_work_approval_pending_id()
       or v_work.started_at is not null
       or v_work.finished_at is not null
       or v_work.cancelled_at is not null
       or v_work.is_assignment_finished
       or v_work.decision_at is not null then
        raise exception 'Допработа request is not rejectable'
            using errcode = 'P0001';
    end if;

    update app.additional_works
    set
        additional_work_approval_status_id = app._get_additional_work_approval_rejected_id(),
        decision_by_employee_id = p_actor_employee_id,
        decision_at = now(),
        manager_decision_comment = v_comment,
        is_assignment_finished = true,
        updated_at = now()
    where additional_work_id = p_additional_work_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'reject_additional_work_request',
        'additional_works',
        p_additional_work_id,
        jsonb_build_object('additional_work_id', v_work.additional_work_id, 'approval_status_id', v_work.additional_work_approval_status_id),
        jsonb_build_object('additional_work_id', p_additional_work_id, 'approval_status_id', app._get_additional_work_approval_rejected_id(), 'decision_by_employee_id', p_actor_employee_id, 'is_assignment_finished', true),
        v_comment
    );

    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_request');

    select * into v_context from app._get_additional_work_notification_context(p_additional_work_id);

    perform app._create_additional_work_notification_for_employee(
        p_additional_work_id,
        v_work.employee_id,
        'additional_work_' || p_additional_work_id::text || '_request_rejected',
        'Допработа отклонена',
        'Допработа: ' || v_context.additional_work_type_name || ' отклонена.'
    );

    return p_additional_work_id;
end;
$$;

comment on function app.reject_additional_work_request(bigint, bigint, text)
    is 'runtime_api: rejects requested Допработа before execution with mandatory manager comment, closes manager task notifications and notifies the operator.';

create or replace function app.assign_additional_work(
    p_actor_employee_id bigint,
    p_target_employee_id bigint,
    p_additional_work_type_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_additional_work_id bigint;
    v_type_name text;
    v_employee_full_name text;
begin
    perform app._assert_actor_has_any_permission(p_actor_employee_id, array['can_manage_production', 'can_manage_admin']);

    select e.full_name
    into v_employee_full_name
    from app.employees e
    join app.employee_statuses es on es.employee_status_id = e.employee_status_id
    where e.employee_id = p_target_employee_id
      and es.is_active = true
      and es.is_active_for_login = true
      and exists (
          select 1
          from app.employee_roles er
          join app.roles r
              on r.role_id = er.role_id
          where er.employee_id = e.employee_id
            and er.revoked_at is null
            and r.is_active = true
            and r.can_work_as_operator = true
      )
    for update;

    if v_employee_full_name is null then
        raise exception 'active operator target employee is required'
            using errcode = 'P0001';
    end if;

    select awt.additional_work_type_name
    into v_type_name
    from app.additional_work_types awt
    where awt.additional_work_type_id = p_additional_work_type_id
      and awt.is_active = true;

    if v_type_name is null then
        raise exception 'active Допработа type is required'
            using errcode = '22023';
    end if;

    perform 1
    from app.additional_works aw
    where aw.employee_id = p_target_employee_id
      and aw.additional_work_type_id = p_additional_work_type_id
      and aw.is_assignment_finished = false
    for update;

    if found then
        raise exception 'unfinished Допработа already exists for employee and type'
            using errcode = 'P0001';
    end if;

    insert into app.additional_works (
        employee_id,
        additional_work_type_id,
        assigned_at,
        assigned_by_employee_id,
        is_assignment_finished,
        additional_work_approval_status_id,
        decision_by_employee_id,
        decision_at
    )
    values (
        p_target_employee_id,
        p_additional_work_type_id,
        now(),
        p_actor_employee_id,
        false,
        app._get_additional_work_approval_approved_id(),
        p_actor_employee_id,
        now()
    )
    returning additional_work_id into v_additional_work_id;

    perform app._create_additional_work_notification_for_employee(
        v_additional_work_id,
        p_target_employee_id,
        'additional_work_' || v_additional_work_id::text || '_assigned',
        'Назначена Допработа',
        'Допработа: ' || v_type_name || ' назначена.'
    );

    return v_additional_work_id;
end;
$$;

comment on function app.assign_additional_work(bigint, bigint, bigint)
    is 'runtime_api: assigns confirmed Допработа to an active employee and notifies the operator.';

create or replace function app.start_additional_work(
    p_actor_employee_id bigint,
    p_additional_work_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_shift_id bigint;
    v_employee_id bigint;
    v_work app.additional_works%rowtype;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');

    select aw.employee_id into v_employee_id from app.additional_works aw where aw.additional_work_id = p_additional_work_id;

    if not found then
        raise exception 'Допработа not found'
            using errcode = 'P0001';
    end if;

    perform app._assert_actor_is_employee_self(p_actor_employee_id, v_employee_id);

    perform 1 from app.employees e where e.employee_id = p_actor_employee_id for update;

    select esh.employee_shift_id
    into v_shift_id
    from app.employee_shifts esh
    where esh.employee_id = p_actor_employee_id
      and esh.is_open = true
    for update;

    if v_shift_id is null then
        raise exception 'employee has no open shift'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.operator_breaks ob
    join app.operator_break_types obt
        on obt.operator_break_type_id = ob.operator_break_type_id
    join app.operator_break_behavior_profiles obbp
        on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
    where ob.employee_id = p_actor_employee_id
      and ob.is_open = true
      and obbp.blocks_additional_work_start = true
    for update;
    if found then
        raise exception 'active operator break blocks Допработа start'
            using errcode = 'P0001';
    end if;

    perform 1 from app.production_operations po where po.employee_id = p_actor_employee_id and po.is_open = true for update;
    if found then
        raise exception 'open production operation blocks Допработа start'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.additional_works aw
    where aw.employee_id = p_actor_employee_id
      and aw.additional_work_id <> p_additional_work_id
      and aw.started_at is not null
      and aw.finished_at is null
      and aw.cancelled_at is null
    for update;

    if found then
        raise exception 'running Допработа blocks Допработа start'
            using errcode = 'P0001';
    end if;

    select * into v_work from app.additional_works aw where aw.additional_work_id = p_additional_work_id for update;

    if v_work.employee_id <> p_actor_employee_id
       or v_work.is_assignment_finished
       or v_work.started_at is not null
       or v_work.finished_at is not null
       or v_work.cancelled_at is not null then
        raise exception 'Допработа is not startable'
            using errcode = 'P0001';
    end if;

    if v_work.additional_work_approval_status_id <> app._get_additional_work_approval_approved_id() then
        raise exception 'Допработа must be confirmed before start'
            using errcode = 'P0001';
    end if;

    update app.additional_works
    set employee_shift_id = v_shift_id,
        started_at = now(),
        started_by_employee_id = p_actor_employee_id,
        updated_at = now()
    where additional_work_id = p_additional_work_id;

    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_assigned');
    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_request_approved');

    return p_additional_work_id;
end;
$$;

comment on function app.start_additional_work(bigint, bigint)
    is 'runtime_api: starts only confirmed Допработа for the assigned employee with shift, break, production and running-work blockers.';

create or replace function app.finish_additional_work(
    p_actor_employee_id bigint,
    p_additional_work_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_work app.additional_works%rowtype;
    v_is_self_path boolean;
    v_employee_id bigint;
    v_employee_shift_id bigint;
    v_reason text;
    v_context record;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select aw.employee_id, aw.employee_shift_id
    into v_employee_id, v_employee_shift_id
    from app.additional_works aw
    where aw.additional_work_id = p_additional_work_id;

    if not found then
        raise exception 'Допработа not found'
            using errcode = 'P0001';
    end if;

    v_is_self_path := (p_actor_employee_id = v_employee_id);

    if v_is_self_path then
        perform app._assert_actor_has_permission(p_actor_employee_id, 'can_work_as_operator');
        perform 1 from app.employees e where e.employee_id = p_actor_employee_id for update;
        perform 1
        from app.employee_shifts esh
        where esh.employee_shift_id = v_employee_shift_id
          and esh.employee_id = p_actor_employee_id
          and esh.is_open = true
        for update;
        if not found then
            raise exception 'employee has no open shift for Допработа finish'
                using errcode = 'P0001';
        end if;
        v_reason := nullif(btrim(p_reason), '');
    else
        perform app._assert_actor_has_any_permission(p_actor_employee_id, array['can_manage_production', 'can_manage_admin', 'can_system_emergency_actions']);
        v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
        perform 1 from app.employees e where e.employee_id = v_employee_id for update;
        if v_employee_shift_id is not null then
            perform 1 from app.employee_shifts esh where esh.employee_shift_id = v_employee_shift_id for update;
        end if;
    end if;

    select * into v_work from app.additional_works aw where aw.additional_work_id = p_additional_work_id for update;

    if v_work.is_assignment_finished
       or v_work.started_at is null
       or v_work.finished_at is not null
       or v_work.cancelled_at is not null
       or v_work.additional_work_approval_status_id <> app._get_additional_work_approval_approved_id() then
        raise exception 'Допработа is not finishable'
            using errcode = 'P0001';
    end if;

    update app.additional_works
    set finished_at = now(),
        finished_by_employee_id = p_actor_employee_id,
        additional_work_accrual_status_id = app._get_additional_work_accrual_waiting_id(),
        updated_at = now()
    where additional_work_id = p_additional_work_id;

    if not v_is_self_path then
        perform app._insert_audit_event(
            p_actor_employee_id,
            case
                when app._actor_has_permission(p_actor_employee_id, 'can_system_emergency_actions')
                     and not (app._actor_has_permission(p_actor_employee_id, 'can_manage_production') or app._actor_has_permission(p_actor_employee_id, 'can_manage_admin'))
                    then 'finish_additional_work_emergency'
                else 'finish_additional_work_manager'
            end,
            'additional_works',
            p_additional_work_id,
            jsonb_build_object('additional_work_id', v_work.additional_work_id),
            jsonb_build_object('additional_work_id', p_additional_work_id, 'finished_by_employee_id', p_actor_employee_id),
            v_reason
        );
    end if;

    select * into v_context from app._get_additional_work_notification_context(p_additional_work_id);

    perform app._create_additional_work_notification_for_permission(
        p_additional_work_id,
        'can_receive_production_notifications',
        'additional_work_' || p_additional_work_id::text || '_payment',
        'Допработа: требуется решение по оплате',
        'Допработа: ' || v_context.additional_work_type_name || ', работник: ' || v_context.employee_full_name || ' завершена, требуется решение по оплате.'
    );

    return p_additional_work_id;
end;
$$;

comment on function app.finish_additional_work(bigint, bigint, text)
    is 'runtime_api: finishes confirmed running Допработа and creates manager payment-decision task notifications.';

create or replace function app.approve_additional_work(
    p_actor_employee_id bigint,
    p_additional_work_id bigint,
    p_manager_decision_comment text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    raise exception 'approve_additional_work is DEPRECATED / NOT USED; use approve_additional_work_request before execution'
        using errcode = 'P0001';
end;
$$;

comment on function app.approve_additional_work(bigint, bigint, text)
    is 'runtime_api: DEPRECATED / NOT USED: old post-finish Допработа approval function retained only for compatibility boundary.';

create or replace function app.reject_additional_work(
    p_actor_employee_id bigint,
    p_additional_work_id bigint,
    p_manager_decision_comment text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    raise exception 'reject_additional_work is DEPRECATED / NOT USED; performed Допработа cannot be rejected'
        using errcode = 'P0001';
end;
$$;

comment on function app.reject_additional_work(bigint, bigint, text)
    is 'runtime_api: DEPRECATED / NOT USED: old post-finish Допработа rejection function retained only for compatibility boundary.';

create or replace function app.cancel_additional_work(
    p_actor_employee_id bigint,
    p_additional_work_id bigint,
    p_cancel_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_work app.additional_works%rowtype;
begin
    v_reason := app._assert_nonempty_text(p_cancel_reason, 'p_cancel_reason');
    perform app._assert_actor_has_any_permission(p_actor_employee_id, array['can_manage_production', 'can_manage_admin']);

    select * into v_work from app.additional_works aw where aw.additional_work_id = p_additional_work_id for update;

    if not found then
        raise exception 'Допработа not found'
            using errcode = 'P0001';
    end if;

    if v_work.is_assignment_finished
       or v_work.started_at is not null
       or v_work.finished_at is not null
       or v_work.cancelled_at is not null
       or v_work.additional_work_approval_status_id in (
           app._get_additional_work_approval_rejected_id(),
           app._get_additional_work_approval_cancelled_id()
       )
       or v_work.additional_work_accrual_status_id is not null
       or exists (
           select 1
           from app.employee_salary_entries ese
           where ese.additional_work_id = p_additional_work_id
             and ese.reversed_salary_entry_id is null
       ) then
        raise exception 'Допработа is not cancellable after terminal, closed, started, completed, paid or rejected state'
            using errcode = 'P0001';
    end if;

    update app.additional_works
    set cancelled_at = now(),
        cancelled_by_employee_id = p_actor_employee_id,
        cancel_reason = v_reason,
        additional_work_approval_status_id = app._get_additional_work_approval_cancelled_id(),
        is_assignment_finished = true,
        updated_at = now()
    where additional_work_id = p_additional_work_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'cancel_additional_work',
        'additional_works',
        p_additional_work_id,
        jsonb_build_object('additional_work_id', v_work.additional_work_id, 'approval_status_id', v_work.additional_work_approval_status_id, 'is_assignment_finished', v_work.is_assignment_finished),
        jsonb_build_object('additional_work_id', p_additional_work_id, 'approval_status_id', app._get_additional_work_approval_cancelled_id(), 'cancelled_by_employee_id', p_actor_employee_id, 'is_assignment_finished', true),
        v_reason
    );

    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_request');
    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_assigned');
    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_request_approved');
    return p_additional_work_id;
end;
$$;

comment on function app.cancel_additional_work(bigint, bigint, text)
    is 'runtime_api: cancels not-started Допработа only, closes active task notifications and forbids cancellation after start or completion.';

create or replace function app.mark_additional_work_without_accrual(
    p_actor_employee_id bigint,
    p_additional_work_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_work app.additional_works%rowtype;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_any_permission(p_actor_employee_id, array['can_manage_production', 'can_manage_admin']);

    select * into v_work from app.additional_works aw where aw.additional_work_id = p_additional_work_id for update;

    if not found then
        raise exception 'Допработа not found'
            using errcode = 'P0001';
    end if;

    if v_work.finished_at is null
       or v_work.cancelled_at is not null
       or v_work.is_assignment_finished
       or v_work.additional_work_approval_status_id <> app._get_additional_work_approval_approved_id()
       or v_work.additional_work_accrual_status_id <> app._get_additional_work_accrual_waiting_id()
       or exists (
           select 1
           from app.employee_salary_entries ese
           where ese.additional_work_id = p_additional_work_id
             and ese.reversed_salary_entry_id is null
       ) then
        raise exception 'Допработа is not eligible for without-accrual closure'
            using errcode = 'P0001';
    end if;

    update app.additional_works
    set additional_work_accrual_status_id = app._get_additional_work_accrual_without_id(),
        amount_uzs = 0,
        is_assignment_finished = true,
        accrued_at = now(),
        updated_at = now()
    where additional_work_id = p_additional_work_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'mark_additional_work_without_accrual',
        'additional_works',
        p_additional_work_id,
        jsonb_build_object('additional_work_id', v_work.additional_work_id, 'amount_uzs', v_work.amount_uzs, 'accrual_status_id', v_work.additional_work_accrual_status_id, 'is_assignment_finished', v_work.is_assignment_finished),
        jsonb_build_object('additional_work_id', p_additional_work_id, 'amount_uzs', 0, 'accrual_status_id', app._get_additional_work_accrual_without_id(), 'is_assignment_finished', true),
        v_reason
    );

    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_payment');

    return p_additional_work_id;
end;
$$;

comment on function app.mark_additional_work_without_accrual(bigint, bigint, text)
    is 'runtime_api: closes finished Допработа without salary ledger entry, audits reason and closes manager payment task notifications.';

create or replace function app.accrue_additional_work_salary(
    p_actor_employee_id bigint,
    p_additional_work_id bigint,
    p_amount_uzs numeric,
    p_quantity numeric
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_work app.additional_works%rowtype;
    v_salary_entry_id bigint;
    v_accrued_at timestamptz := now();
    v_salary_period_date date;
    v_salary_week_start_date date;
    v_salary_month_start_date date;
    v_quantity numeric(18,3);
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_salary_correction_all');

    if p_amount_uzs is null or p_amount_uzs <= 0 then
        raise exception 'p_amount_uzs must be positive for Допработа accrual'
            using errcode = '22023';
    end if;

    if p_quantity is not null and p_quantity <= 0 then
        raise exception 'p_quantity must be positive when supplied'
            using errcode = '22023';
    end if;

    v_quantity := p_quantity;

    select * into v_work from app.additional_works aw where aw.additional_work_id = p_additional_work_id for update;

    if not found then
        raise exception 'Допработа not found'
            using errcode = 'P0001';
    end if;

    if v_work.finished_at is null
       or v_work.cancelled_at is not null
       or v_work.is_assignment_finished
       or v_work.additional_work_approval_status_id <> app._get_additional_work_approval_approved_id()
       or v_work.additional_work_accrual_status_id <> app._get_additional_work_accrual_waiting_id() then
        raise exception 'Допработа is not eligible for salary accrual'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.employee_salary_entries ese
    where ese.additional_work_id = p_additional_work_id
      and ese.reversed_salary_entry_id is null
    for update;

    if found then
        raise exception 'Допработа salary entry already exists'
            using errcode = 'P0001';
    end if;

    v_salary_period_date := (v_accrued_at at time zone 'Asia/Tashkent')::date;
    v_salary_week_start_date := v_salary_period_date - (extract(isodow from v_salary_period_date)::integer - 1);
    v_salary_month_start_date := date_trunc('month', v_salary_period_date)::date;

    insert into app.employee_salary_entries (
        employee_id,
        employee_shift_id,
        salary_entry_type_id,
        additional_work_id,
        quantity,
        amount_uzs,
        accrued_at,
        accrued_by_employee_id,
        salary_period_date,
        salary_week_start_date,
        salary_month_start_date
    )
    values (
        v_work.employee_id,
        v_work.employee_shift_id,
        app._get_salary_entry_type_additional_work_id(),
        p_additional_work_id,
        v_quantity,
        p_amount_uzs,
        v_accrued_at,
        p_actor_employee_id,
        v_salary_period_date,
        v_salary_week_start_date,
        v_salary_month_start_date
    )
    returning employee_salary_entry_id into v_salary_entry_id;

    update app.additional_works
    set quantity = v_quantity,
        amount_uzs = p_amount_uzs,
        additional_work_accrual_status_id = app._get_additional_work_accrual_accrued_id(),
        accrued_at = v_accrued_at,
        is_assignment_finished = true,
        updated_at = now()
    where additional_work_id = p_additional_work_id;

    perform app.recalculate_employee_salary_periods_for_entry(v_salary_entry_id);

    perform app._insert_audit_event(
        p_actor_employee_id,
        'accrue_additional_work_salary',
        'additional_works',
        p_additional_work_id,
        jsonb_build_object('additional_work_id', v_work.additional_work_id, 'amount_uzs', v_work.amount_uzs, 'accrual_status_id', v_work.additional_work_accrual_status_id, 'is_assignment_finished', v_work.is_assignment_finished),
        jsonb_build_object('additional_work_id', p_additional_work_id, 'amount_uzs', p_amount_uzs, 'quantity', v_quantity, 'accrual_status_id', app._get_additional_work_accrual_accrued_id(), 'employee_salary_entry_id', v_salary_entry_id, 'is_assignment_finished', true),
        null
    );

    perform app._cancel_additional_work_task_notifications(p_additional_work_id, 'additional_work_' || p_additional_work_id::text || '_payment');

    return v_salary_entry_id;
end;
$$;

comment on function app.accrue_additional_work_salary(bigint, bigint, numeric, numeric)
    is 'runtime_api: accrues finished Допработа salary, rebuilds totals and closes manager payment task notifications.';

-- END db/functions/_work/wp_05_downtime_breaks_additional_work/functions.sql


-- BEGIN db/functions/_work/wp_06_salary_ledger/functions.sql

create or replace function app._get_salary_entry_type_salary_correction_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_entry_type.salary_correction',
        (
            select sety.salary_entry_type_id
            from app.salary_entry_types sety
            where sety.is_active = true
              and sety.is_salary_correction = true
        )
    )
$$;

comment on function app._get_salary_entry_type_salary_correction_id()
    is 'internal_helper: semantic lookup for the single active salary correction salary entry type.';

create or replace function app._get_salary_entry_type_production_operation_correction_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_entry_type.production_operation_correction',
        (
            select sety.salary_entry_type_id
            from app.salary_entry_types sety
            where sety.is_active = true
              and sety.is_production_operation_correction = true
        )
    )
$$;

comment on function app._get_salary_entry_type_production_operation_correction_id()
    is 'internal_helper: semantic lookup for the single active production operation correction salary entry type.';

create or replace function app._get_salary_correction_status_pending_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_correction_status.pending',
        (
            select scs.salary_correction_status_id
            from app.salary_correction_statuses scs
            where scs.is_active = true
              and scs.is_pending = true
        )
    )
$$;

comment on function app._get_salary_correction_status_pending_id()
    is 'internal_helper: semantic lookup for the single active pending salary correction status.';

create or replace function app._get_salary_correction_status_approved_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_correction_status.approved',
        (
            select scs.salary_correction_status_id
            from app.salary_correction_statuses scs
            where scs.is_active = true
              and scs.is_approved = true
        )
    )
$$;

comment on function app._get_salary_correction_status_approved_id()
    is 'internal_helper: semantic lookup for the single active approved salary correction status.';

create or replace function app._get_salary_correction_status_rejected_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_correction_status.rejected',
        (
            select scs.salary_correction_status_id
            from app.salary_correction_statuses scs
            where scs.is_active = true
              and scs.is_rejected = true
        )
    )
$$;

comment on function app._get_salary_correction_status_rejected_id()
    is 'internal_helper: semantic lookup for the single active rejected salary correction status.';

create or replace function app._get_salary_correction_status_cancelled_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'salary_correction_status.cancelled',
        (
            select scs.salary_correction_status_id
            from app.salary_correction_statuses scs
            where scs.is_active = true
              and scs.is_cancelled = true
        )
    )
$$;

comment on function app._get_salary_correction_status_cancelled_id()
    is 'internal_helper: semantic lookup for the single active cancelled salary correction status.';

create or replace function app._get_production_operation_correction_status_pending_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'production_operation_correction_status.pending',
        (
            select pocs.production_operation_correction_status_id
            from app.production_operation_correction_statuses pocs
            where pocs.is_active = true
              and pocs.is_pending = true
        )
    )
$$;

comment on function app._get_production_operation_correction_status_pending_id()
    is 'internal_helper: semantic lookup for the single active pending production operation correction status.';

create or replace function app._get_production_operation_correction_status_approved_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'production_operation_correction_status.approved',
        (
            select pocs.production_operation_correction_status_id
            from app.production_operation_correction_statuses pocs
            where pocs.is_active = true
              and pocs.is_approved = true
        )
    )
$$;

comment on function app._get_production_operation_correction_status_approved_id()
    is 'internal_helper: semantic lookup for the single active approved production operation correction status.';

create or replace function app._get_production_operation_correction_status_rejected_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'production_operation_correction_status.rejected',
        (
            select pocs.production_operation_correction_status_id
            from app.production_operation_correction_statuses pocs
            where pocs.is_active = true
              and pocs.is_rejected = true
        )
    )
$$;

comment on function app._get_production_operation_correction_status_rejected_id()
    is 'internal_helper: semantic lookup for the single active rejected production operation correction status.';

create or replace function app._get_production_operation_correction_status_cancelled_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'production_operation_correction_status.cancelled',
        (
            select pocs.production_operation_correction_status_id
            from app.production_operation_correction_statuses pocs
            where pocs.is_active = true
              and pocs.is_cancelled = true
        )
    )
$$;

comment on function app._get_production_operation_correction_status_cancelled_id()
    is 'internal_helper: semantic lookup for the single active cancelled production operation correction status.';

create or replace function app._salary_week_start_date(
    p_salary_date date
)
returns date
language sql
security definer
set search_path = app, pg_catalog
as $$
    select (p_salary_date - ((extract(isodow from p_salary_date)::integer - 1) * interval '1 day'))::date
$$;

comment on function app._salary_week_start_date(date)
    is 'internal_helper: returns Monday week start for salary period calculations.';

create or replace function app.create_salary_correction(
    p_actor_employee_id bigint,
    p_employee_id bigint,
    p_employee_shift_id bigint,
    p_salary_correction_type_id bigint,
    p_correction_amount_uzs numeric,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_salary_correction_id bigint;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_salary_correction_general', 'can_salary_correction_all']
    );

    if p_employee_id is null or p_employee_id = p_actor_employee_id then
        raise exception 'target employee is required and self salary correction is forbidden'
            using errcode = '42501';
    end if;

    if p_correction_amount_uzs is null or p_correction_amount_uzs = 0 then
        raise exception 'p_correction_amount_uzs must be non-null and non-zero'
            using errcode = '22023';
    end if;

    perform 1
    from app.employees e
    where e.employee_id = p_actor_employee_id
    for update;

    perform 1
    from app.employees e
    join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
    where e.employee_id = p_employee_id
      and es.is_active = true
    for update;

    if not found then
        raise exception 'active target employee not found'
            using errcode = 'P0001';
    end if;

    if p_employee_shift_id is not null and not exists (
        select 1
        from app.employee_shifts esh
        where esh.employee_shift_id = p_employee_shift_id
          and esh.employee_id = p_employee_id
    ) then
        raise exception 'employee shift does not belong to target employee'
            using errcode = '22023';
    end if;

    if p_salary_correction_type_id is null or not exists (
        select 1
        from app.salary_correction_types sct
        where sct.salary_correction_type_id = p_salary_correction_type_id
          and sct.is_active = true
    ) then
        raise exception 'active salary correction type is required'
            using errcode = '22023';
    end if;

    insert into app.salary_corrections (
        employee_id,
        employee_shift_id,
        salary_correction_type_id,
        correction_amount_uzs,
        correction_comment,
        assigned_by_employee_id,
        salary_correction_status_id
    )
    values (
        p_employee_id,
        p_employee_shift_id,
        p_salary_correction_type_id,
        p_correction_amount_uzs,
        v_reason,
        p_actor_employee_id,
        app._get_salary_correction_status_pending_id()
    )
    returning salary_correction_id into v_salary_correction_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'create_salary_correction',
        'salary_corrections',
        v_salary_correction_id,
        null,
        jsonb_build_object(
            'salary_correction_id', v_salary_correction_id,
            'employee_id', p_employee_id,
            'employee_shift_id', p_employee_shift_id,
            'salary_correction_type_id', p_salary_correction_type_id,
            'correction_amount_uzs', p_correction_amount_uzs
        ),
        v_reason
    );

    return v_salary_correction_id;
end;
$$;

comment on function app.create_salary_correction(bigint, bigint, bigint, bigint, numeric, text)
    is 'runtime_api: creates a pending direct salary correction with mandatory non-zero amount and audit reason.';

create or replace function app.accrue_salary_correction(
    p_actor_employee_id bigint,
    p_salary_correction_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_correction record;
    v_accrued_at timestamptz;
    v_salary_date date;
    v_salary_entry_id bigint;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select sc.*
    into v_correction
    from app.salary_corrections sc
    where sc.salary_correction_id = p_salary_correction_id
    for update;

    if not found then
        raise exception 'salary correction not found'
            using errcode = 'P0001';
    end if;

    if v_correction.salary_correction_status_id <> app._get_salary_correction_status_approved_id()
       or v_correction.approved_at is null
       or v_correction.correction_amount_uzs is null
       or v_correction.correction_amount_uzs = 0 then
        raise exception 'salary correction is not approved for accrual'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.employee_salary_entries e
    where e.salary_correction_id = p_salary_correction_id
      and e.reversed_salary_entry_id is null
    for update;

    if found then
        raise exception 'salary correction already has a normal salary entry'
            using errcode = 'P0001';
    end if;

    v_accrued_at := now();
    v_salary_date := timezone('Asia/Tashkent', v_accrued_at)::date;

    insert into app.employee_salary_entries (
        employee_id,
        employee_shift_id,
        salary_entry_type_id,
        salary_correction_id,
        amount_uzs,
        accrued_at,
        accrued_by_employee_id,
        salary_period_date,
        salary_week_start_date,
        salary_month_start_date
    )
    values (
        v_correction.employee_id,
        v_correction.employee_shift_id,
        app._get_salary_entry_type_salary_correction_id(),
        p_salary_correction_id,
        v_correction.correction_amount_uzs,
        v_accrued_at,
        p_actor_employee_id,
        v_salary_date,
        app._salary_week_start_date(v_salary_date),
        date_trunc('month', v_salary_date)::date
    )
    returning employee_salary_entry_id into v_salary_entry_id;

    perform app.recalculate_employee_salary_periods_for_entry(v_salary_entry_id);

    return v_salary_entry_id;
end;
$$;

comment on function app.accrue_salary_correction(bigint, bigint)
    is 'internal_helper: inserts one append-only salary ledger row for an approved salary_correction and rebuilds affected totals.';

create or replace function app.approve_salary_correction(
    p_actor_employee_id bigint,
    p_salary_correction_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_before record;
    v_after record;
    v_salary_entry_id bigint;
begin
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_salary_correction_general', 'can_salary_correction_all']
    );

    select sc.*
    into v_before
    from app.salary_corrections sc
    where sc.salary_correction_id = p_salary_correction_id
    for update;

    if not found then
        raise exception 'salary correction not found'
            using errcode = 'P0001';
    end if;

    if v_before.salary_correction_status_id <> app._get_salary_correction_status_pending_id()
       or v_before.approved_at is not null
       or v_before.rejected_at is not null
       or v_before.cancelled_at is not null then
        raise exception 'salary correction is not pending'
            using errcode = 'P0001';
    end if;

    if v_before.employee_id = p_actor_employee_id then
        raise exception 'self approval is forbidden'
            using errcode = '42501';
    end if;

    if v_before.correction_amount_uzs is null or v_before.correction_amount_uzs = 0 then
        raise exception 'approved salary correction amount must be non-zero'
            using errcode = '22023';
    end if;

    perform 1
    from app.employees e
    where e.employee_id = v_before.employee_id
    for update;

    update app.salary_corrections
    set
        approved_at = now(),
        approved_by_employee_id = p_actor_employee_id,
        salary_correction_status_id = app._get_salary_correction_status_approved_id(),
        updated_at = now()
    where salary_correction_id = p_salary_correction_id;

    v_salary_entry_id := app.accrue_salary_correction(p_actor_employee_id, p_salary_correction_id);

    select sc.*
    into v_after
    from app.salary_corrections sc
    where sc.salary_correction_id = p_salary_correction_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'approve_salary_correction',
        'salary_corrections',
        p_salary_correction_id,
        to_jsonb(v_before),
        to_jsonb(v_after) || jsonb_build_object(
            'employee_salary_entry_id', v_salary_entry_id,
            'final_correction_amount_uzs', v_before.correction_amount_uzs
        ),
        null
    );

    return v_salary_entry_id;
end;
$$;

comment on function app.approve_salary_correction(bigint, bigint)
    is 'runtime_api: approves a pending salary correction, accrues its ledger entry, rebuilds totals and audits the action.';

create or replace function app.reject_salary_correction(
    p_actor_employee_id bigint,
    p_salary_correction_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before record;
    v_after record;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_salary_correction_general', 'can_salary_correction_all']
    );

    select sc.*
    into v_before
    from app.salary_corrections sc
    where sc.salary_correction_id = p_salary_correction_id
    for update;

    if not found then
        raise exception 'salary correction not found'
            using errcode = 'P0001';
    end if;

    if v_before.salary_correction_status_id <> app._get_salary_correction_status_pending_id()
       or v_before.approved_at is not null
       or v_before.rejected_at is not null
       or v_before.cancelled_at is not null then
        raise exception 'salary correction is not rejectable'
            using errcode = 'P0001';
    end if;

    update app.salary_corrections
    set
        rejected_at = now(),
        rejected_by_employee_id = p_actor_employee_id,
        rejection_reason = v_reason,
        salary_correction_status_id = app._get_salary_correction_status_rejected_id(),
        updated_at = now()
    where salary_correction_id = p_salary_correction_id;

    select sc.*
    into v_after
    from app.salary_corrections sc
    where sc.salary_correction_id = p_salary_correction_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'reject_salary_correction',
        'salary_corrections',
        p_salary_correction_id,
        to_jsonb(v_before),
        to_jsonb(v_after),
        v_reason
    );

    return p_salary_correction_id;
end;
$$;

comment on function app.reject_salary_correction(bigint, bigint, text)
    is 'runtime_api: rejects a pending salary correction with required reason and audit event.';

create or replace function app.cancel_salary_correction(
    p_actor_employee_id bigint,
    p_salary_correction_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before record;
    v_after record;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_salary_correction_general', 'can_salary_correction_all']
    );

    select sc.*
    into v_before
    from app.salary_corrections sc
    where sc.salary_correction_id = p_salary_correction_id
    for update;

    if not found then
        raise exception 'salary correction not found'
            using errcode = 'P0001';
    end if;

    if v_before.salary_correction_status_id <> app._get_salary_correction_status_pending_id()
       or v_before.approved_at is not null
       or v_before.rejected_at is not null
       or v_before.cancelled_at is not null then
        raise exception 'salary correction is not cancellable without reversal path'
            using errcode = 'P0001';
    end if;

    update app.salary_corrections
    set
        cancelled_at = now(),
        cancelled_by_employee_id = p_actor_employee_id,
        cancel_reason = v_reason,
        salary_correction_status_id = app._get_salary_correction_status_cancelled_id(),
        updated_at = now()
    where salary_correction_id = p_salary_correction_id;

    select sc.*
    into v_after
    from app.salary_corrections sc
    where sc.salary_correction_id = p_salary_correction_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'cancel_salary_correction',
        'salary_corrections',
        p_salary_correction_id,
        to_jsonb(v_before),
        to_jsonb(v_after),
        v_reason
    );

    return p_salary_correction_id;
end;
$$;

comment on function app.cancel_salary_correction(bigint, bigint, text)
    is 'runtime_api: cancels a pending salary correction with required reason and audit event.';

create or replace function app._assert_production_correction_quantity_safe(
    p_production_operation_id bigint,
    p_candidate_quantity_delta numeric,
    p_excluded_correction_id bigint
)
returns void
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_operation record;
    v_existing_delta_sum numeric(18,3);
begin
    select po.production_operation_id, po.quantity_produced, su.allows_fractional_quantity
    into v_operation
    from app.production_operations po
    join app.skus s
        on s.sku_id = po.sku_id
    join app.sku_units su
        on su.sku_unit_id = s.sku_unit_id
    where po.production_operation_id = p_production_operation_id
    for update;

    if not found then
        raise exception 'production operation not found'
            using errcode = 'P0001';
    end if;

    if p_candidate_quantity_delta is null then
        return;
    end if;

    if v_operation.allows_fractional_quantity = false
       and p_candidate_quantity_delta <> trunc(p_candidate_quantity_delta) then
        raise exception 'quantity correction must be integer for non-fractional SKU unit'
            using errcode = '22023';
    end if;

    perform 1
    from app.production_operation_corrections poc
    where poc.production_operation_id = p_production_operation_id
      and (
          p_excluded_correction_id is null
          or poc.production_operation_correction_id <> p_excluded_correction_id
      )
      and poc.production_operation_correction_status_id in (
          app._get_production_operation_correction_status_pending_id(),
          app._get_production_operation_correction_status_approved_id()
      )
    for update;

    select coalesce(sum(poc.correction_quantity_delta), 0)
    into v_existing_delta_sum
    from app.production_operation_corrections poc
    where poc.production_operation_id = p_production_operation_id
      and (
          p_excluded_correction_id is null
          or poc.production_operation_correction_id <> p_excluded_correction_id
      )
      and poc.production_operation_correction_status_id in (
          app._get_production_operation_correction_status_pending_id(),
          app._get_production_operation_correction_status_approved_id()
      );

    if coalesce(v_operation.quantity_produced, 0) + v_existing_delta_sum + p_candidate_quantity_delta < 0 then
        raise exception 'production correction quantity delta makes corrected gross quantity negative'
            using errcode = '22023';
    end if;
end;
$$;

comment on function app._assert_production_correction_quantity_safe(bigint, numeric, bigint)
    is 'internal_helper: validates production operation correction quantity delta against SKU unit and non-negative gross quantity rules.';

create or replace function app.create_production_operation_correction(
    p_actor_employee_id bigint,
    p_production_operation_id bigint,
    p_correction_quantity_delta numeric,
    p_correction_amount_delta_uzs numeric,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_operation record;
    v_correction_id bigint;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_correct_production_operations');

    if ((p_correction_quantity_delta is not null)::integer + (p_correction_amount_delta_uzs is not null)::integer) <> 1 then
        raise exception 'exactly one production correction delta is required'
            using errcode = '22023';
    end if;

    if coalesce(p_correction_quantity_delta, p_correction_amount_delta_uzs) = 0 then
        raise exception 'production correction delta must be non-zero'
            using errcode = '22023';
    end if;

    select po.production_operation_id, po.employee_id, po.production_operation_status_id
    into v_operation
    from app.production_operations po
    join app.production_operation_statuses pos
        on pos.production_operation_status_id = po.production_operation_status_id
    where po.production_operation_id = p_production_operation_id
      and po.is_open = false
      and po.finished_at is not null
      and pos.is_active = true
      and pos.is_closed = true
      and pos.allows_salary_accrual = true
    for update;

    if not found then
        raise exception 'closed salary-eligible production operation not found'
            using errcode = 'P0001';
    end if;

    perform app._assert_production_correction_quantity_safe(
        p_production_operation_id,
        p_correction_quantity_delta,
        null
    );

    insert into app.production_operation_corrections (
        production_operation_id,
        employee_id,
        correction_quantity_delta,
        correction_amount_delta_uzs,
        correction_reason,
        assigned_by_employee_id,
        production_operation_correction_status_id
    )
    values (
        p_production_operation_id,
        v_operation.employee_id,
        p_correction_quantity_delta,
        p_correction_amount_delta_uzs,
        v_reason,
        p_actor_employee_id,
        app._get_production_operation_correction_status_pending_id()
    )
    returning production_operation_correction_id into v_correction_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'create_production_operation_correction',
        'production_operation_corrections',
        v_correction_id,
        null,
        jsonb_build_object(
            'production_operation_correction_id', v_correction_id,
            'production_operation_id', p_production_operation_id,
            'employee_id', v_operation.employee_id,
            'correction_quantity_delta', p_correction_quantity_delta,
            'correction_amount_delta_uzs', p_correction_amount_delta_uzs
        ),
        v_reason
    );

    return v_correction_id;
end;
$$;

comment on function app.create_production_operation_correction(bigint, bigint, numeric, numeric, text)
    is 'runtime_api: creates a pending production operation correction with exactly one non-zero delta and audit reason.';

create or replace function app.accrue_production_operation_correction(
    p_actor_employee_id bigint,
    p_production_operation_correction_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_correction record;
    v_original_entry record;
    v_accrued_at timestamptz;
    v_salary_date date;
    v_amount_uzs numeric(18,4);
    v_quantity numeric(18,3);
    v_salary_entry_id bigint;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select poc.*
    into v_correction
    from app.production_operation_corrections poc
    where poc.production_operation_correction_id = p_production_operation_correction_id
    for update;

    if not found then
        raise exception 'production operation correction not found'
            using errcode = 'P0001';
    end if;

    if v_correction.production_operation_correction_status_id
       <> app._get_production_operation_correction_status_approved_id()
       or v_correction.approved_at is null then
        raise exception 'production operation correction is not approved for accrual'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.production_operations po
    where po.production_operation_id = v_correction.production_operation_id
    for update;

    select e.*
    into v_original_entry
    from app.employee_salary_entries e
    join app.salary_entry_types sety
        on sety.salary_entry_type_id = e.salary_entry_type_id
    where e.production_operation_id = v_correction.production_operation_id
      and e.reversed_salary_entry_id is null
      and sety.is_active = true
      and sety.is_production_operation = true
    for update;

    if not found then
        raise exception 'original production salary entry is required for production correction accrual'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.employee_salary_entries e
    where e.production_operation_correction_id = p_production_operation_correction_id
      and e.reversed_salary_entry_id is null
    for update;

    if found then
        raise exception 'production operation correction already has a normal salary entry'
            using errcode = 'P0001';
    end if;

    if v_correction.correction_quantity_delta is not null then
        v_quantity := v_correction.correction_quantity_delta;
        v_amount_uzs := v_correction.correction_quantity_delta * v_original_entry.tariff_rate_uzs;
    else
        v_quantity := null;
        v_amount_uzs := v_correction.correction_amount_delta_uzs;
    end if;

    if v_amount_uzs is null or v_amount_uzs = 0 then
        raise exception 'production operation correction salary effect must be non-zero'
            using errcode = 'P0001';
    end if;

    v_accrued_at := now();
    v_salary_date := v_original_entry.salary_period_date;

    insert into app.employee_salary_entries (
        employee_id,
        employee_shift_id,
        salary_entry_type_id,
        production_operation_correction_id,
        quantity,
        tariff_rate_uzs,
        amount_uzs,
        accrued_at,
        accrued_by_employee_id,
        employee_roles_snapshot_json,
        machine_id_snapshot,
        sku_id_snapshot,
        sku_code_snapshot,
        sku_name_snapshot,
        salary_period_date,
        salary_week_start_date,
        salary_month_start_date
    )
    values (
        v_correction.employee_id,
        v_original_entry.employee_shift_id,
        app._get_salary_entry_type_production_operation_correction_id(),
        p_production_operation_correction_id,
        v_quantity,
        v_original_entry.tariff_rate_uzs,
        v_amount_uzs,
        v_accrued_at,
        p_actor_employee_id,
        v_original_entry.employee_roles_snapshot_json,
        v_original_entry.machine_id_snapshot,
        v_original_entry.sku_id_snapshot,
        v_original_entry.sku_code_snapshot,
        v_original_entry.sku_name_snapshot,
        v_salary_date,
        v_original_entry.salary_week_start_date,
        v_original_entry.salary_month_start_date
    )
    returning employee_salary_entry_id into v_salary_entry_id;

    perform app.recalculate_employee_salary_periods_for_entry(v_salary_entry_id);

    return v_salary_entry_id;
end;
$$;

comment on function app.accrue_production_operation_correction(bigint, bigint)
    is 'internal_helper: inserts one append-only salary ledger row for an approved production operation correction and rebuilds affected totals.';

create or replace function app.approve_production_operation_correction(
    p_actor_employee_id bigint,
    p_production_operation_correction_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_before record;
    v_after record;
    v_salary_entry_id bigint;
begin
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array[
            'can_correct_production_operations',
            'can_salary_correction_production',
            'can_salary_correction_all'
        ]
    );

    select poc.*
    into v_before
    from app.production_operation_corrections poc
    where poc.production_operation_correction_id = p_production_operation_correction_id
    for update;

    if not found then
        raise exception 'production operation correction not found'
            using errcode = 'P0001';
    end if;

    if v_before.production_operation_correction_status_id
       <> app._get_production_operation_correction_status_pending_id()
       or v_before.approved_at is not null
       or v_before.rejected_at is not null
       or v_before.cancelled_at is not null then
        raise exception 'production operation correction is not pending'
            using errcode = 'P0001';
    end if;

    if ((v_before.correction_quantity_delta is not null)::integer
        + (v_before.correction_amount_delta_uzs is not null)::integer) <> 1 then
        raise exception 'production operation correction must have exactly one delta'
            using errcode = 'P0001';
    end if;

    if coalesce(v_before.correction_quantity_delta, v_before.correction_amount_delta_uzs) = 0 then
        raise exception 'production operation correction delta must be non-zero'
            using errcode = 'P0001';
    end if;

    perform app._assert_production_correction_quantity_safe(
        v_before.production_operation_id,
        v_before.correction_quantity_delta,
        p_production_operation_correction_id
    );

    update app.production_operation_corrections
    set
        approved_at = now(),
        approved_by_employee_id = p_actor_employee_id,
        production_operation_correction_status_id =
            app._get_production_operation_correction_status_approved_id(),
        updated_at = now()
    where production_operation_correction_id = p_production_operation_correction_id;

    v_salary_entry_id := app.accrue_production_operation_correction(
        p_actor_employee_id,
        p_production_operation_correction_id
    );

    select poc.*
    into v_after
    from app.production_operation_corrections poc
    where poc.production_operation_correction_id = p_production_operation_correction_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'approve_production_operation_correction',
        'production_operation_corrections',
        p_production_operation_correction_id,
        to_jsonb(v_before),
        to_jsonb(v_after) || jsonb_build_object(
            'employee_salary_entry_id', v_salary_entry_id,
            'approved_quantity_delta', v_before.correction_quantity_delta,
            'approved_amount_delta_uzs', v_before.correction_amount_delta_uzs
        ),
        null
    );

    return v_salary_entry_id;
end;
$$;

comment on function app.approve_production_operation_correction(bigint, bigint)
    is 'runtime_api: approves a pending production operation correction, accrues its ledger entry, rebuilds totals and audits the action.';

create or replace function app.reject_production_operation_correction(
    p_actor_employee_id bigint,
    p_production_operation_correction_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before record;
    v_after record;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array[
            'can_correct_production_operations',
            'can_salary_correction_production',
            'can_salary_correction_all'
        ]
    );

    select poc.*
    into v_before
    from app.production_operation_corrections poc
    where poc.production_operation_correction_id = p_production_operation_correction_id
    for update;

    if not found then
        raise exception 'production operation correction not found'
            using errcode = 'P0001';
    end if;

    if v_before.production_operation_correction_status_id
       <> app._get_production_operation_correction_status_pending_id()
       or v_before.approved_at is not null
       or v_before.rejected_at is not null
       or v_before.cancelled_at is not null then
        raise exception 'production operation correction is not rejectable'
            using errcode = 'P0001';
    end if;

    update app.production_operation_corrections
    set
        rejected_at = now(),
        rejected_by_employee_id = p_actor_employee_id,
        rejection_reason = v_reason,
        production_operation_correction_status_id =
            app._get_production_operation_correction_status_rejected_id(),
        updated_at = now()
    where production_operation_correction_id = p_production_operation_correction_id;

    select poc.*
    into v_after
    from app.production_operation_corrections poc
    where poc.production_operation_correction_id = p_production_operation_correction_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'reject_production_operation_correction',
        'production_operation_corrections',
        p_production_operation_correction_id,
        to_jsonb(v_before),
        to_jsonb(v_after),
        v_reason
    );

    return p_production_operation_correction_id;
end;
$$;

comment on function app.reject_production_operation_correction(bigint, bigint, text)
    is 'runtime_api: rejects a pending production operation correction with required reason and audit event.';

create or replace function app.cancel_production_operation_correction(
    p_actor_employee_id bigint,
    p_production_operation_correction_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before record;
    v_after record;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array[
            'can_correct_production_operations',
            'can_salary_correction_production',
            'can_salary_correction_all'
        ]
    );

    select poc.*
    into v_before
    from app.production_operation_corrections poc
    where poc.production_operation_correction_id = p_production_operation_correction_id
    for update;

    if not found then
        raise exception 'production operation correction not found'
            using errcode = 'P0001';
    end if;

    if v_before.production_operation_correction_status_id
       <> app._get_production_operation_correction_status_pending_id()
       or v_before.approved_at is not null
       or v_before.rejected_at is not null
       or v_before.cancelled_at is not null then
        raise exception 'production operation correction is not cancellable'
            using errcode = 'P0001';
    end if;

    update app.production_operation_corrections
    set
        cancelled_at = now(),
        cancelled_by_employee_id = p_actor_employee_id,
        cancel_reason = v_reason,
        production_operation_correction_status_id =
            app._get_production_operation_correction_status_cancelled_id(),
        updated_at = now()
    where production_operation_correction_id = p_production_operation_correction_id;

    select poc.*
    into v_after
    from app.production_operation_corrections poc
    where poc.production_operation_correction_id = p_production_operation_correction_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'cancel_production_operation_correction',
        'production_operation_corrections',
        p_production_operation_correction_id,
        to_jsonb(v_before),
        to_jsonb(v_after),
        v_reason
    );

    return p_production_operation_correction_id;
end;
$$;

comment on function app.cancel_production_operation_correction(bigint, bigint, text)
    is 'runtime_api: cancels a pending production operation correction with required reason and audit event.';

create or replace function app._insert_salary_entry_reversal(
    p_actor_employee_id bigint,
    p_employee_salary_entry_id bigint,
    p_reversal_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_source record;
    v_reversal_entry_id bigint;
begin
    perform app._assert_actor_active(p_actor_employee_id);

    select e.*
    into v_source
    from app.employee_salary_entries e
    where e.employee_salary_entry_id = p_employee_salary_entry_id
    for update;

    if not found then
        raise exception 'source salary entry not found'
            using errcode = 'P0001';
    end if;

    if v_source.reversed_salary_entry_id is not null
       or v_source.salary_entry_type_id = app._get_salary_entry_type_reversal_id() then
        raise exception 'reversal of reversal is forbidden'
            using errcode = 'P0001';
    end if;

    perform 1
    from app.employee_salary_entries e
    where e.reversed_salary_entry_id = p_employee_salary_entry_id
    for update;

    if found then
        raise exception 'source salary entry already has a reversal'
            using errcode = 'P0001';
    end if;

    insert into app.employee_salary_entries (
        employee_id,
        employee_shift_id,
        salary_entry_type_id,
        reversed_salary_entry_id,
        quantity,
        tariff_rate_uzs,
        amount_uzs,
        accrued_at,
        accrued_by_employee_id,
        reversal_reason,
        employee_roles_snapshot_json,
        machine_id_snapshot,
        sku_id_snapshot,
        sku_code_snapshot,
        sku_name_snapshot,
        salary_period_date,
        salary_week_start_date,
        salary_month_start_date
    )
    values (
        v_source.employee_id,
        v_source.employee_shift_id,
        app._get_salary_entry_type_reversal_id(),
        p_employee_salary_entry_id,
        v_source.quantity,
        v_source.tariff_rate_uzs,
        -v_source.amount_uzs,
        now(),
        p_actor_employee_id,
        p_reversal_reason,
        v_source.employee_roles_snapshot_json,
        v_source.machine_id_snapshot,
        v_source.sku_id_snapshot,
        v_source.sku_code_snapshot,
        v_source.sku_name_snapshot,
        v_source.salary_period_date,
        v_source.salary_week_start_date,
        v_source.salary_month_start_date
    )
    returning employee_salary_entry_id into v_reversal_entry_id;

    perform app.recalculate_employee_salary_periods_for_entry(v_reversal_entry_id);

    return v_reversal_entry_id;
end;
$$;

comment on function app._insert_salary_entry_reversal(bigint, bigint, text)
    is 'internal_helper: inserts one full append-only reversal salary entry and rebuilds affected totals.';

create or replace function app.reverse_salary_entry(
    p_actor_employee_id bigint,
    p_employee_salary_entry_id bigint,
    p_reversal_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_source record;
    v_source_type record;
    v_reversal_entry_id bigint;
begin
    v_reason := app._assert_nonempty_text(p_reversal_reason, 'p_reversal_reason');

    select e.*, sety.is_production_operation, sety.is_salary_correction
    into v_source
    from app.employee_salary_entries e
    join app.salary_entry_types sety
        on sety.salary_entry_type_id = e.salary_entry_type_id
    where e.employee_salary_entry_id = p_employee_salary_entry_id
    for update;

    if not found then
        raise exception 'source salary entry not found'
            using errcode = 'P0001';
    end if;

    select
        v_source.is_production_operation as is_production_operation,
        v_source.is_salary_correction as is_salary_correction
    into v_source_type;

    if v_source_type.is_production_operation = true then
        perform app._assert_actor_has_any_permission(
            p_actor_employee_id,
            array['can_reverse_salary_production', 'can_reverse_salary_all']
        );
    elsif v_source_type.is_salary_correction = true then
        perform app._assert_actor_has_any_permission(
            p_actor_employee_id,
            array['can_reverse_salary_corrections_only', 'can_reverse_salary_all']
        );
    else
        perform app._assert_actor_has_permission(p_actor_employee_id, 'can_reverse_salary_all');
    end if;

    v_reversal_entry_id := app._insert_salary_entry_reversal(
        p_actor_employee_id,
        p_employee_salary_entry_id,
        v_reason
    );

    perform app._insert_audit_event(
        p_actor_employee_id,
        'reverse_salary_entry',
        'employee_salary_entries',
        p_employee_salary_entry_id,
        jsonb_build_object(
            'source_employee_salary_entry_id', p_employee_salary_entry_id,
            'source_salary_entry_type_id', v_source.salary_entry_type_id,
            'source_amount_uzs', v_source.amount_uzs
        ),
        jsonb_build_object(
            'source_employee_salary_entry_id', p_employee_salary_entry_id,
            'reversal_employee_salary_entry_id', v_reversal_entry_id,
            'reversal_amount_uzs', -v_source.amount_uzs,
            'full_reversal', true
        ),
        v_reason
    );

    return v_reversal_entry_id;
end;
$$;

comment on function app.reverse_salary_entry(bigint, bigint, text)
    is 'runtime_api: creates a full audited reversal of one non-reversal salary entry according to salary category permissions.';

create or replace function app.emergency_reverse_salary_entry(
    p_actor_employee_id bigint,
    p_employee_salary_entry_id bigint,
    p_reversal_reason text,
    p_audit_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reversal_reason text;
    v_audit_reason text;
    v_source record;
    v_reversal_entry_id bigint;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_system_emergency_actions');

    if p_reversal_reason is null and p_audit_reason is null then
        raise exception 'p_reversal_reason or p_audit_reason is required'
            using errcode = '22023';
    end if;

    v_reversal_reason := app._assert_nonempty_text(
        coalesce(p_reversal_reason, p_audit_reason),
        'p_reversal_reason'
    );
    v_audit_reason := app._assert_nonempty_text(
        coalesce(p_audit_reason, p_reversal_reason),
        'p_audit_reason'
    );

    select e.*
    into v_source
    from app.employee_salary_entries e
    where e.employee_salary_entry_id = p_employee_salary_entry_id
    for update;

    if not found then
        raise exception 'source salary entry not found'
            using errcode = 'P0001';
    end if;

    v_reversal_entry_id := app._insert_salary_entry_reversal(
        p_actor_employee_id,
        p_employee_salary_entry_id,
        v_reversal_reason
    );

    perform app._insert_audit_event(
        p_actor_employee_id,
        'emergency_reverse_salary_entry',
        'employee_salary_entries',
        p_employee_salary_entry_id,
        jsonb_build_object(
            'source_employee_salary_entry_id', p_employee_salary_entry_id,
            'source_salary_entry_type_id', v_source.salary_entry_type_id,
            'source_amount_uzs', v_source.amount_uzs
        ),
        jsonb_build_object(
            'source_employee_salary_entry_id', p_employee_salary_entry_id,
            'reversal_employee_salary_entry_id', v_reversal_entry_id,
            'reversal_amount_uzs', -v_source.amount_uzs,
            'full_reversal', true,
            'emergency_path', true,
            'created_salary_correction', false,
            'created_compensation_salary_entry', false
        ),
        v_audit_reason
    );

    return v_reversal_entry_id;
end;
$$;

comment on function app.emergency_reverse_salary_entry(bigint, bigint, text, text)
    is 'runtime_api: creates an audited emergency full reversal without salary_correction or compensation entry.';

create or replace function app.rebuild_employee_salary_period_totals(
    p_actor_employee_id bigint,
    p_employee_id bigint,
    p_period_start_date date,
    p_period_end_date date,
    p_audit_reason text
)
returns bigint[]
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_audit_reason text;
    v_scope record;
    v_total_id bigint;
    v_total_ids bigint[] := array[]::bigint[];
    v_before jsonb;
    v_after jsonb;
begin
    v_audit_reason := app._assert_nonempty_text(p_audit_reason, 'p_audit_reason');
    perform app._assert_actor_has_any_permission(
        p_actor_employee_id,
        array['can_salary_correction_all', 'can_system_emergency_actions']
    );

    if p_employee_id is null
       or p_period_start_date is null
       or p_period_end_date is null
       or p_period_end_date < p_period_start_date then
        raise exception 'valid employee and rebuild date range are required'
            using errcode = '22023';
    end if;

    perform 1
    from app.employees e
    where e.employee_id = p_employee_id
    for update;

    if not found then
        raise exception 'employee not found'
            using errcode = 'P0001';
    end if;

    select coalesce(jsonb_agg(to_jsonb(espt) order by espt.salary_period_type_id, espt.period_start_date), '[]'::jsonb)
    into v_before
    from app.employee_salary_period_totals espt
    where espt.employee_id = p_employee_id
      and espt.period_end_date >= p_period_start_date
      and espt.period_start_date <= p_period_end_date;

    for v_scope in
        with salary_dates as (
            select distinct e.salary_period_date
            from app.employee_salary_entries e
            where e.employee_id = p_employee_id
              and e.salary_period_date between p_period_start_date and p_period_end_date
        ),
        ledger_scopes as (
            select
                app._get_period_type_day_id() as period_type_id,
                sd.salary_period_date as period_start_date,
                sd.salary_period_date as period_end_date
            from salary_dates sd
            union
            select
                app._get_period_type_week_id(),
                app._salary_week_start_date(sd.salary_period_date),
                (app._salary_week_start_date(sd.salary_period_date) + interval '6 days')::date
            from salary_dates sd
            union
            select
                app._get_period_type_month_id(),
                date_trunc('month', sd.salary_period_date)::date,
                ((date_trunc('month', sd.salary_period_date)::date + interval '1 month')::date - 1)
            from salary_dates sd
        ),
        existing_total_scopes as (
            select
                espt.salary_period_type_id as period_type_id,
                espt.period_start_date,
                espt.period_end_date
            from app.employee_salary_period_totals espt
            where espt.employee_id = p_employee_id
              and espt.period_end_date >= p_period_start_date
              and espt.period_start_date <= p_period_end_date
        ),
        scopes as (
            select *
            from ledger_scopes
            union
            select *
            from existing_total_scopes
        )
        select distinct s.period_type_id, s.period_start_date, s.period_end_date
        from scopes s
        order by
            case s.period_type_id
                when app._get_period_type_day_id() then 1
                when app._get_period_type_week_id() then 2
                when app._get_period_type_month_id() then 3
                else 4
            end,
            s.period_start_date
    loop
        v_total_id := app._upsert_employee_salary_period_total(
            p_employee_id,
            v_scope.period_type_id,
            v_scope.period_start_date,
            v_scope.period_end_date
        );
        v_total_ids := array_append(v_total_ids, v_total_id);
    end loop;

    if cardinality(v_total_ids) = 0 then
        raise exception 'no salary periods found for rebuild scope'
            using errcode = 'P0001';
    end if;

    select coalesce(jsonb_agg(to_jsonb(espt) order by espt.salary_period_type_id, espt.period_start_date), '[]'::jsonb)
    into v_after
    from app.employee_salary_period_totals espt
    where espt.employee_salary_period_total_id = any(v_total_ids);

    perform app._insert_audit_event(
        p_actor_employee_id,
        'rebuild_employee_salary_period_totals',
        'employee_salary_period_totals',
        v_total_ids[1],
        jsonb_build_object(
            'employee_id', p_employee_id,
            'period_start_date', p_period_start_date,
            'period_end_date', p_period_end_date,
            'before_totals', v_before
        ),
        jsonb_build_object(
            'employee_id', p_employee_id,
            'period_start_date', p_period_start_date,
            'period_end_date', p_period_end_date,
            'affected_total_row_ids', v_total_ids,
            'after_totals', v_after,
            'created_or_reversed_salary_entries', false
        ),
        v_audit_reason
    );

    return v_total_ids;
end;
$$;

comment on function app.rebuild_employee_salary_period_totals(bigint, bigint, date, date, text)
    is 'maintenance_api: rebuilds salary period totals cache from employee_salary_entries with audit reason and without ledger mutation.';

-- END db/functions/_work/wp_06_salary_ledger/functions.sql


-- BEGIN db/functions/_work/wp_07_audit_consistency/functions.sql

-- WP-07 intentionally introduces no additional SQL functions.
-- Audit insert ownership is WP-02: app._insert_audit_event(...).
-- This WP is a cross-WP consistency gate for Section 14 audit obligations.


-- END db/functions/_work/wp_07_audit_consistency/functions.sql


-- BEGIN db/functions/_work/wp_08_notifications/functions.sql

create or replace function app._get_notification_channel_telegram_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'notification_channel.telegram',
        (
            select nc.notification_channel_id
            from app.notification_channels nc
            where nc.is_active = true
              and nc.is_telegram = true
        )
    )
$$;

comment on function app._get_notification_channel_telegram_id()
    is 'internal_helper: semantic lookup for the single active Telegram notification channel.';

create or replace function app._get_notification_status_created_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'notification_status.created',
        (
            select ns.notification_status_id
            from app.notification_statuses ns
            where ns.is_active = true
              and ns.is_created = true
        )
    )
$$;

comment on function app._get_notification_status_created_id()
    is 'internal_helper: semantic lookup for the single active created notification status.';

create or replace function app._get_notification_status_sent_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'notification_status.sent',
        (
            select ns.notification_status_id
            from app.notification_statuses ns
            where ns.is_active = true
              and ns.is_sent = true
        )
    )
$$;

comment on function app._get_notification_status_sent_id()
    is 'internal_helper: semantic lookup for the single active sent notification status.';

create or replace function app._get_notification_status_delivered_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'notification_status.delivered',
        (
            select ns.notification_status_id
            from app.notification_statuses ns
            where ns.is_active = true
              and ns.is_delivered = true
        )
    )
$$;

comment on function app._get_notification_status_delivered_id()
    is 'internal_helper: semantic lookup for the single active delivered notification status.';

create or replace function app._get_notification_status_read_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'notification_status.read',
        (
            select ns.notification_status_id
            from app.notification_statuses ns
            where ns.is_active = true
              and ns.is_read = true
        )
    )
$$;

comment on function app._get_notification_status_read_id()
    is 'internal_helper: semantic lookup for the single active read notification status.';

create or replace function app._get_notification_status_failed_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'notification_status.failed',
        (
            select ns.notification_status_id
            from app.notification_statuses ns
            where ns.is_active = true
              and ns.is_failed = true
        )
    )
$$;

comment on function app._get_notification_status_failed_id()
    is 'internal_helper: semantic lookup for the single active failed notification status.';

create or replace function app._get_notification_status_cancelled_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'notification_status.cancelled',
        (
            select ns.notification_status_id
            from app.notification_statuses ns
            where ns.is_active = true
              and ns.is_cancelled = true
        )
    )
$$;

comment on function app._get_notification_status_cancelled_id()
    is 'internal_helper: semantic lookup for the single active cancelled notification status.';

create or replace function app._notification_is_active_for_deduplication(
    p_notification_id bigint
)
returns boolean
language sql
security definer
set search_path = app, pg_catalog
as $$
    select exists (
        select 1
        from app.notifications n
        join app.notification_statuses ns
            on ns.notification_status_id = n.notification_status_id
        where n.notification_id = p_notification_id
          and ns.is_cancelled = false
    )
$$;

comment on function app._notification_is_active_for_deduplication(bigint)
    is 'internal_helper: checks whether a notification row is non-cancelled for Section 15 deduplication.';

create or replace function app._get_notification_recipients_by_permission(
    p_permission_name text
)
returns table (
    recipient_employee_id bigint
)
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if p_permission_name not in (
        'can_receive_production_notifications',
        'can_receive_director_notifications'
    ) then
        raise exception 'unsupported notification recipient permission: %', p_permission_name
            using errcode = '22023';
    end if;

    return query
    select distinct e.employee_id
    from app.employees e
    join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
    join app.employee_roles er
        on er.employee_id = e.employee_id
    join app.roles r
        on r.role_id = er.role_id
    where es.is_active = true
      and es.is_active_for_login = true
      and er.revoked_at is null
      and r.is_active = true
      and (
          (
              p_permission_name = 'can_receive_production_notifications'
              and r.can_receive_production_notifications = true
          )
          or (
              p_permission_name = 'can_receive_director_notifications'
              and r.can_receive_director_notifications = true
          )
      )
    order by e.employee_id;
end;
$$;

comment on function app._get_notification_recipients_by_permission(text)
    is 'internal_helper: returns active employees routed by allowlisted notification permission flags only.';

create or replace function app.create_notification(
    p_recipient_employee_id bigint,
    p_cause_table_name text,
    p_cause_record_id bigint,
    p_title text,
    p_message_text text,
    p_deduplication_key text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_cause_table_name text;
    v_title text;
    v_message_text text;
    v_deduplication_key text;
    v_notification_id bigint;
    v_channel_id bigint;
begin
    if p_recipient_employee_id is null then
        raise exception 'p_recipient_employee_id is required'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from app.employees e
        join app.employee_statuses es
            on es.employee_status_id = e.employee_status_id
        where e.employee_id = p_recipient_employee_id
          and es.is_active = true
          and es.is_active_for_login = true
    ) then
        raise exception 'notification recipient must be an active login-enabled employee'
            using errcode = 'P0001';
    end if;

    if (p_cause_table_name is null) <> (p_cause_record_id is null) then
        raise exception 'cause table and cause record must be supplied together'
            using errcode = '22023';
    end if;

    v_cause_table_name := nullif(btrim(p_cause_table_name), '');
    if p_cause_table_name is not null and v_cause_table_name is null then
        raise exception 'p_cause_table_name must not be blank'
            using errcode = '22023';
    end if;

    v_title := app._assert_nonempty_text(p_title, 'p_title');
    v_message_text := app._assert_nonempty_text(p_message_text, 'p_message_text');
    v_deduplication_key := nullif(btrim(p_deduplication_key), '');
    v_channel_id := app._get_notification_channel_telegram_id();

    if v_deduplication_key is not null then
        lock table app.notifications in share row exclusive mode;

        select n.notification_id
        into v_notification_id
        from app.notifications n
        join app.notification_statuses ns
            on ns.notification_status_id = n.notification_status_id
        where n.recipient_employee_id = p_recipient_employee_id
          and n.notification_channel_id = v_channel_id
          and n.deduplication_key = v_deduplication_key
          and ns.is_cancelled = false
        order by n.notification_id
        limit 1;

        if found then
            return v_notification_id;
        end if;
    end if;

    insert into app.notifications (
        recipient_employee_id,
        notification_channel_id,
        cause_table_name,
        cause_record_id,
        title,
        message_text,
        notification_status_id,
        deduplication_key
    )
    values (
        p_recipient_employee_id,
        v_channel_id,
        v_cause_table_name,
        p_cause_record_id,
        v_title,
        v_message_text,
        app._get_notification_status_created_id(),
        v_deduplication_key
    )
    returning notification_id into v_notification_id;

    return v_notification_id;
end;
$$;

comment on function app.create_notification(bigint, text, bigint, text, text, text)
    is 'internal_helper: creates one Telegram notification row with semantic created status and optional Section 15 deduplication.';

create or replace function app.mark_notification_sent(
    p_notification_id bigint,
    p_provider_message_id text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_provider_message_id text;
begin
    if p_notification_id is null then
        raise exception 'p_notification_id is required'
            using errcode = '22023';
    end if;

    v_provider_message_id := nullif(btrim(p_provider_message_id), '');

    perform 1
    from app.notifications n
    where n.notification_id = p_notification_id
    for update;

    if not found then
        raise exception 'notification not found'
            using errcode = 'P0001';
    end if;

    update app.notifications
    set
        notification_status_id = app._get_notification_status_sent_id(),
        provider_message_id = coalesce(v_provider_message_id, provider_message_id),
        sent_at = coalesce(sent_at, now()),
        failed_at = null,
        delivery_error_text = null
    where notification_id = p_notification_id;

    return p_notification_id;
end;
$$;

comment on function app.mark_notification_sent(bigint, text)
    is 'runtime_api: records provider send success and optional provider_message_id for a notification.';

create or replace function app.mark_notification_delivered(
    p_notification_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if p_notification_id is null then
        raise exception 'p_notification_id is required'
            using errcode = '22023';
    end if;

    perform 1
    from app.notifications n
    where n.notification_id = p_notification_id
    for update;

    if not found then
        raise exception 'notification not found'
            using errcode = 'P0001';
    end if;

    update app.notifications
    set
        notification_status_id = app._get_notification_status_delivered_id(),
        sent_at = coalesce(sent_at, now()),
        delivered_at = coalesce(delivered_at, now()),
        failed_at = null,
        delivery_error_text = null
    where notification_id = p_notification_id;

    return p_notification_id;
end;
$$;

comment on function app.mark_notification_delivered(bigint)
    is 'runtime_api: records provider delivery success for a notification.';

create or replace function app.mark_notification_read(
    p_notification_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if p_notification_id is null then
        raise exception 'p_notification_id is required'
            using errcode = '22023';
    end if;

    perform 1
    from app.notifications n
    where n.notification_id = p_notification_id
    for update;

    if not found then
        raise exception 'notification not found'
            using errcode = 'P0001';
    end if;

    update app.notifications
    set
        notification_status_id = app._get_notification_status_read_id(),
        sent_at = coalesce(sent_at, now()),
        delivered_at = coalesce(delivered_at, now()),
        read_at = coalesce(read_at, now()),
        failed_at = null,
        delivery_error_text = null
    where notification_id = p_notification_id;

    return p_notification_id;
end;
$$;

comment on function app.mark_notification_read(bigint)
    is 'runtime_api: records notification read/open lifecycle without treating read as task completion.';

create or replace function app.mark_notification_failed(
    p_notification_id bigint,
    p_delivery_error_text text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_delivery_error_text text;
begin
    if p_notification_id is null then
        raise exception 'p_notification_id is required'
            using errcode = '22023';
    end if;

    v_delivery_error_text := app._assert_nonempty_text(
        p_delivery_error_text,
        'p_delivery_error_text'
    );

    perform 1
    from app.notifications n
    where n.notification_id = p_notification_id
    for update;

    if not found then
        raise exception 'notification not found'
            using errcode = 'P0001';
    end if;

    update app.notifications
    set
        notification_status_id = app._get_notification_status_failed_id(),
        failed_at = coalesce(failed_at, now()),
        delivery_error_text = v_delivery_error_text
    where notification_id = p_notification_id;

    return p_notification_id;
end;
$$;

comment on function app.mark_notification_failed(bigint, text)
    is 'runtime_api: records provider delivery or hide failure without rolling back domain facts.';

create or replace function app.hide_notification_from_chat(
    p_notification_id bigint,
    p_provider_hide_confirmed boolean,
    p_cancel_task boolean
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    if p_notification_id is null then
        raise exception 'p_notification_id is required'
            using errcode = '22023';
    end if;

    if p_provider_hide_confirmed is null then
        raise exception 'p_provider_hide_confirmed is required'
            using errcode = '22023';
    end if;

    if p_cancel_task is null then
        raise exception 'p_cancel_task is required'
            using errcode = '22023';
    end if;

    perform 1
    from app.notifications n
    where n.notification_id = p_notification_id
    for update;

    if not found then
        raise exception 'notification not found'
            using errcode = 'P0001';
    end if;

    update app.notifications
    set
        notification_status_id = case
            when p_cancel_task then app._get_notification_status_cancelled_id()
            else notification_status_id
        end,
        hidden_from_chat_at = case
            when p_provider_hide_confirmed then coalesce(hidden_from_chat_at, now())
            else hidden_from_chat_at
        end
    where notification_id = p_notification_id;

    return p_notification_id;
end;
$$;

comment on function app.hide_notification_from_chat(bigint, boolean, boolean)
    is 'runtime_api: records Telegram chat hide confirmation and optionally cancels obsolete fulfilled task notifications without deleting rows.';

create or replace function app._create_downtime_notification_for_permission(
    p_machine_downtime_id bigint,
    p_permission_name text,
    p_deduplication_key text,
    p_title text,
    p_message_text text
)
returns integer
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_recipient record;
    v_created_count integer := 0;
    v_before_notification_id bigint;
    v_after_notification_id bigint;
begin
    for v_recipient in
        select recipient_employee_id
        from app._get_notification_recipients_by_permission(p_permission_name)
    loop
        select n.notification_id
        into v_before_notification_id
        from app.notifications n
        join app.notification_statuses ns
            on ns.notification_status_id = n.notification_status_id
        where n.recipient_employee_id = v_recipient.recipient_employee_id
          and n.notification_channel_id = app._get_notification_channel_telegram_id()
          and n.deduplication_key = p_deduplication_key
          and ns.is_cancelled = false
        order by n.notification_id
        limit 1;

        v_after_notification_id := app.create_notification(
            v_recipient.recipient_employee_id,
            'machine_downtimes',
            p_machine_downtime_id,
            p_title,
            p_message_text,
            p_deduplication_key
        );

        if v_before_notification_id is null
           and app._notification_is_active_for_deduplication(v_after_notification_id) then
            v_created_count := v_created_count + 1;
        end if;
    end loop;

    return v_created_count;
end;
$$;

comment on function app._create_downtime_notification_for_permission(bigint, text, text, text, text)
    is 'internal_helper: creates downtime notifications for recipients routed by an allowlisted permission flag.';

create or replace function app.scan_active_downtimes_for_notifications()
returns integer
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_notification record;
    v_created_count integer := 0;
    v_title text;
    v_message_text text;
begin
    for v_notification in
        select
            md.machine_downtime_id,
            md.machine_id,
            mdt.machine_downtime_type_name,
            rule.technical_code as notification_rule_code,
            rule.threshold_minutes,
            rule.recipient_permission_code,
            rule.notification_kind
        from app.machine_downtimes md
        join app.machine_downtime_types mdt
            on mdt.machine_downtime_type_id = md.machine_downtime_type_id
        join app.machine_downtime_behavior_profiles mdbp
            on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
        join app.machine_downtime_profile_notification_rules rule
            on rule.machine_downtime_behavior_profile_id = mdbp.machine_downtime_behavior_profile_id
        where md.is_open = true
          and mdt.is_active = true
          and mdbp.is_active = true
          and rule.is_active = true
          and md.started_at <= now() - (rule.threshold_minutes * interval '1 minute')
        order by
            md.machine_downtime_id,
            rule.priority,
            rule.machine_downtime_profile_notification_rule_id
        for update of md skip locked
    loop
        if v_notification.notification_kind = 'TYPE_IMMEDIATE' then
            v_title := v_notification.machine_downtime_type_name;
            v_message_text :=
                'Станок #' || v_notification.machine_id::text || ': '
                || lower(v_notification.machine_downtime_type_name) || '.';
        elsif v_notification.notification_kind = 'ELAPSED_THRESHOLD' then
            v_title := 'Простой больше ' || v_notification.threshold_minutes::text || ' минут';
            v_message_text :=
                'Станок #' || v_notification.machine_id::text
                || ': простой длится больше '
                || v_notification.threshold_minutes::text || ' минут.';
        else
            raise exception 'unsupported downtime notification kind'
                using errcode = 'P0001';
        end if;

        v_created_count := v_created_count + app._create_downtime_notification_for_permission(
            v_notification.machine_downtime_id,
            v_notification.recipient_permission_code,
            'downtime_' || v_notification.machine_downtime_id::text || '_' || v_notification.notification_rule_code,
            v_title,
            v_message_text
        );
    end loop;

    return v_created_count;
end;
$$;

comment on function app.scan_active_downtimes_for_notifications()
    is 'runtime_api: scans open machine downtimes and creates Section 15 deduplicated threshold/system notifications.';

-- END db/functions/_work/wp_08_notifications/functions.sql


-- BEGIN db/functions/_work/wp_09_google_sheets_export/functions.sql

create or replace function app._get_google_sheets_export_status_success_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'google_sheets_export_status.success',
        (
            select gses.google_sheets_export_status_id
            from app.google_sheets_export_statuses gses
            where gses.is_active = true
              and gses.is_success = true
        )
    )
$$;

comment on function app._get_google_sheets_export_status_success_id()
    is 'internal_helper: semantic lookup for the single active successful Google Sheets export final status.';

create or replace function app._get_google_sheets_export_status_failed_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'google_sheets_export_status.failed',
        (
            select gses.google_sheets_export_status_id
            from app.google_sheets_export_statuses gses
            where gses.is_active = true
              and gses.is_failed = true
        )
    )
$$;

comment on function app._get_google_sheets_export_status_failed_id()
    is 'internal_helper: semantic lookup for the single active failed Google Sheets export final status.';

create or replace function app._get_google_sheets_export_status_cancelled_id()
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._require_lookup_id(
        'google_sheets_export_status.cancelled',
        (
            select gses.google_sheets_export_status_id
            from app.google_sheets_export_statuses gses
            where gses.is_active = true
              and gses.is_cancelled = true
        )
    )
$$;

comment on function app._get_google_sheets_export_status_cancelled_id()
    is 'internal_helper: semantic lookup for the single active cancelled Google Sheets export final status.';

create or replace function app._assert_google_sheets_export_run_actor(
    p_actor_employee_id bigint,
    p_requested_by_employee_id bigint
)
returns void
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_view_admin_reports');

    if p_requested_by_employee_id is null then
        raise exception 'p_requested_by_employee_id is required'
            using errcode = '22023';
    end if;

    if p_actor_employee_id <> p_requested_by_employee_id then
        raise exception 'export run final transition must use requested_by_employee_id as actor'
            using errcode = '42501';
    end if;
end;
$$;

comment on function app._assert_google_sheets_export_run_actor(bigint, bigint)
    is 'internal_helper: authorizes export lifecycle through can_view_admin_reports and the run requested_by_employee_id actor rule.';

create or replace function app.create_google_sheets_export_run(
    p_actor_employee_id bigint,
    p_export_type text,
    p_period_from date,
    p_period_to date
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_export_type text;
    v_google_sheets_export_run_id bigint;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_view_admin_reports');

    v_export_type := app._assert_nonempty_text(p_export_type, 'p_export_type');

    if v_export_type <> 'management_mvp_export' then
        raise exception 'unsupported Google Sheets export type: %', v_export_type
            using errcode = '22023';
    end if;

    if p_period_from is null then
        raise exception 'p_period_from is required'
            using errcode = '22023';
    end if;

    if p_period_to is null then
        raise exception 'p_period_to is required'
            using errcode = '22023';
    end if;

    if p_period_from > p_period_to then
        raise exception 'p_period_from must not be after p_period_to'
            using errcode = '22023';
    end if;

    insert into app.google_sheets_export_runs (
        export_type,
        requested_by_employee_id,
        period_from,
        period_to,
        google_sheets_export_status_id,
        google_spreadsheet_id,
        started_at,
        completed_at,
        error_message
    )
    values (
        v_export_type,
        p_actor_employee_id,
        p_period_from,
        p_period_to,
        null,
        null,
        now(),
        null,
        null
    )
    returning google_sheets_export_run_id into v_google_sheets_export_run_id;

    return v_google_sheets_export_run_id;
end;
$$;

comment on function app.create_google_sheets_export_run(bigint, text, date, date)
    is 'runtime_api: creates a running management_mvp_export Google Sheets export run for an actor with can_view_admin_reports.';

create or replace function app.finish_google_sheets_export_run_success(
    p_actor_employee_id bigint,
    p_google_sheets_export_run_id bigint,
    p_google_spreadsheet_id text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_run record;
    v_google_spreadsheet_id text;
begin
    if p_google_sheets_export_run_id is null then
        raise exception 'p_google_sheets_export_run_id is required'
            using errcode = '22023';
    end if;

    v_google_spreadsheet_id := app._assert_nonempty_text(
        p_google_spreadsheet_id,
        'p_google_spreadsheet_id'
    );

    select
        gser.requested_by_employee_id,
        gser.google_sheets_export_status_id,
        gser.completed_at
    into v_run
    from app.google_sheets_export_runs gser
    where gser.google_sheets_export_run_id = p_google_sheets_export_run_id
    for update;

    if not found then
        raise exception 'Google Sheets export run not found'
            using errcode = 'P0001';
    end if;

    perform app._assert_google_sheets_export_run_actor(
        p_actor_employee_id,
        v_run.requested_by_employee_id
    );

    if v_run.google_sheets_export_status_id is not null
       or v_run.completed_at is not null then
        raise exception 'Google Sheets export run is already final'
            using errcode = 'P0001';
    end if;

    update app.google_sheets_export_runs
    set
        google_sheets_export_status_id = app._get_google_sheets_export_status_success_id(),
        google_spreadsheet_id = v_google_spreadsheet_id,
        completed_at = now(),
        error_message = null
    where google_sheets_export_run_id = p_google_sheets_export_run_id;

    return p_google_sheets_export_run_id;
end;
$$;

comment on function app.finish_google_sheets_export_run_success(bigint, bigint, text)
    is 'runtime_api: marks a running Google Sheets export run successful using requested_by_employee_id as the backend-worker business actor.';

create or replace function app.finish_google_sheets_export_run_failed(
    p_actor_employee_id bigint,
    p_google_sheets_export_run_id bigint,
    p_error_message text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_run record;
    v_error_message text;
begin
    if p_google_sheets_export_run_id is null then
        raise exception 'p_google_sheets_export_run_id is required'
            using errcode = '22023';
    end if;

    v_error_message := app._assert_nonempty_text(p_error_message, 'p_error_message');

    select
        gser.requested_by_employee_id,
        gser.google_sheets_export_status_id,
        gser.completed_at
    into v_run
    from app.google_sheets_export_runs gser
    where gser.google_sheets_export_run_id = p_google_sheets_export_run_id
    for update;

    if not found then
        raise exception 'Google Sheets export run not found'
            using errcode = 'P0001';
    end if;

    perform app._assert_google_sheets_export_run_actor(
        p_actor_employee_id,
        v_run.requested_by_employee_id
    );

    if v_run.google_sheets_export_status_id is not null
       or v_run.completed_at is not null then
        raise exception 'Google Sheets export run is already final'
            using errcode = 'P0001';
    end if;

    update app.google_sheets_export_runs
    set
        google_sheets_export_status_id = app._get_google_sheets_export_status_failed_id(),
        completed_at = now(),
        error_message = v_error_message
    where google_sheets_export_run_id = p_google_sheets_export_run_id;

    return p_google_sheets_export_run_id;
end;
$$;

comment on function app.finish_google_sheets_export_run_failed(bigint, bigint, text)
    is 'runtime_api: marks a running Google Sheets export run failed using requested_by_employee_id as the backend-worker business actor.';

create or replace function app.cancel_google_sheets_export_run(
    p_actor_employee_id bigint,
    p_google_sheets_export_run_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_run record;
begin
    if p_google_sheets_export_run_id is null then
        raise exception 'p_google_sheets_export_run_id is required'
            using errcode = '22023';
    end if;

    select
        gser.requested_by_employee_id,
        gser.google_sheets_export_status_id,
        gser.completed_at
    into v_run
    from app.google_sheets_export_runs gser
    where gser.google_sheets_export_run_id = p_google_sheets_export_run_id
    for update;

    if not found then
        raise exception 'Google Sheets export run not found'
            using errcode = 'P0001';
    end if;

    perform app._assert_google_sheets_export_run_actor(
        p_actor_employee_id,
        v_run.requested_by_employee_id
    );

    if v_run.google_sheets_export_status_id is not null
       or v_run.completed_at is not null then
        raise exception 'Google Sheets export run is already final'
            using errcode = 'P0001';
    end if;

    update app.google_sheets_export_runs
    set
        google_sheets_export_status_id = app._get_google_sheets_export_status_cancelled_id(),
        completed_at = now(),
        error_message = null
    where google_sheets_export_run_id = p_google_sheets_export_run_id;

    return p_google_sheets_export_run_id;
end;
$$;

comment on function app.cancel_google_sheets_export_run(bigint, bigint)
    is 'runtime_api: marks a running Google Sheets export run cancelled using requested_by_employee_id as the business actor.';

-- END db/functions/_work/wp_09_google_sheets_export/functions.sql


-- BEGIN activity type profile management

create or replace function app._assert_dictionary_technical_code(
    p_value text,
    p_parameter_name text
)
returns text
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_value text;
begin
    v_value := app._assert_nonempty_text(p_value, p_parameter_name);

    if v_value !~ '^[a-z][a-z0-9_]*$' then
        raise exception '% must match ^[a-z][a-z0-9_]*$', p_parameter_name
            using errcode = '22023';
    end if;

    return v_value;
end;
$$;

comment on function app._assert_dictionary_technical_code(text, text)
    is 'internal_helper: validates an immutable lowercase technical code for managed activity dictionaries.';

create or replace function app.create_operator_break_behavior_profile(
    p_actor_employee_id bigint,
    p_technical_code text,
    p_profile_name text,
    p_allows_during_open_production boolean,
    p_blocks_production_start boolean,
    p_blocks_self_production_finish boolean,
    p_blocks_additional_work_start boolean,
    p_blocks_shift_finish boolean,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_technical_code text;
    v_profile_name text;
    v_reason text;
    v_profile_id bigint;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_technical_code := app._assert_dictionary_technical_code(p_technical_code, 'p_technical_code');
    v_profile_name := app._assert_nonempty_text(p_profile_name, 'p_profile_name');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    if p_allows_during_open_production is null
       or p_blocks_production_start is null
       or p_blocks_self_production_finish is null
       or p_blocks_additional_work_start is null
       or p_blocks_shift_finish is null then
        raise exception 'operator break behavior flags are required'
            using errcode = '22023';
    end if;

    insert into app.operator_break_behavior_profiles (
        technical_code,
        profile_name,
        requires_open_shift,
        allows_during_open_production,
        blocks_production_start,
        blocks_self_production_finish,
        blocks_additional_work_start,
        blocks_shift_finish,
        is_active
    )
    values (
        v_technical_code,
        v_profile_name,
        true,
        p_allows_during_open_production,
        p_blocks_production_start,
        p_blocks_self_production_finish,
        p_blocks_additional_work_start,
        p_blocks_shift_finish,
        true
    )
    returning operator_break_behavior_profile_id into v_profile_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'create_operator_break_behavior_profile',
        'operator_break_behavior_profiles',
        v_profile_id,
        null,
        jsonb_build_object(
            'technical_code', v_technical_code,
            'profile_name', v_profile_name,
            'requires_open_shift', true,
            'allows_during_open_production', p_allows_during_open_production,
            'blocks_production_start', p_blocks_production_start,
            'blocks_self_production_finish', p_blocks_self_production_finish,
            'blocks_additional_work_start', p_blocks_additional_work_start,
            'blocks_shift_finish', p_blocks_shift_finish,
            'is_active', true
        ),
        v_reason
    );

    return v_profile_id;
end;
$$;

comment on function app.create_operator_break_behavior_profile(bigint, text, text, boolean, boolean, boolean, boolean, boolean, text)
    is 'runtime_api: creates an immutable audited operator-break behavior profile under can_manage_dictionaries.';

create or replace function app.create_operator_break_type(
    p_actor_employee_id bigint,
    p_technical_code text,
    p_display_name text,
    p_display_order integer,
    p_operator_break_behavior_profile_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_technical_code text;
    v_display_name text;
    v_reason text;
    v_type_id bigint;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_technical_code := app._assert_dictionary_technical_code(p_technical_code, 'p_technical_code');
    v_display_name := app._assert_nonempty_text(p_display_name, 'p_display_name');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    if p_display_order is null or p_display_order < 0 then
        raise exception 'p_display_order must be a non-negative integer'
            using errcode = '22023';
    end if;

    perform 1
    from app.operator_break_behavior_profiles obbp
    where obbp.operator_break_behavior_profile_id = p_operator_break_behavior_profile_id
      and obbp.is_active = true
    for update;

    if not found then
        raise exception 'active operator break behavior profile is required'
            using errcode = '22023';
    end if;

    insert into app.operator_break_types (
        technical_code,
        operator_break_type_name,
        display_order,
        operator_break_behavior_profile_id,
        is_active
    )
    values (
        v_technical_code,
        v_display_name,
        p_display_order,
        p_operator_break_behavior_profile_id,
        true
    )
    returning operator_break_type_id into v_type_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'create_operator_break_type',
        'operator_break_types',
        v_type_id,
        null,
        jsonb_build_object(
            'technical_code', v_technical_code,
            'display_name', v_display_name,
            'display_order', p_display_order,
            'operator_break_behavior_profile_id', p_operator_break_behavior_profile_id,
            'is_active', true
        ),
        v_reason
    );

    return v_type_id;
end;
$$;

comment on function app.create_operator_break_type(bigint, text, text, integer, bigint, text)
    is 'runtime_api: creates an audited operator-break type attached to an active break profile.';

create or replace function app.deactivate_operator_break_type(
    p_actor_employee_id bigint,
    p_operator_break_type_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before jsonb;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select to_jsonb(obt)
    into v_before
    from app.operator_break_types obt
    where obt.operator_break_type_id = p_operator_break_type_id
      and obt.is_active = true
    for update;

    if v_before is null then
        raise exception 'active operator break type not found'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.operator_breaks ob
        where ob.operator_break_type_id = p_operator_break_type_id
          and ob.is_open = true
    ) then
        raise exception 'open operator break blocks type deactivation'
            using errcode = 'P0001';
    end if;

    update app.operator_break_types
    set is_active = false,
        updated_at = now()
    where operator_break_type_id = p_operator_break_type_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'deactivate_operator_break_type',
        'operator_break_types',
        p_operator_break_type_id,
        v_before,
        v_before || jsonb_build_object('is_active', false),
        v_reason
    );

    return p_operator_break_type_id;
end;
$$;

comment on function app.deactivate_operator_break_type(bigint, bigint, text)
    is 'runtime_api: deactivates an unused operator-break type with permission, open-record guard and audit.';

create or replace function app.deactivate_operator_break_behavior_profile(
    p_actor_employee_id bigint,
    p_operator_break_behavior_profile_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before jsonb;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select to_jsonb(obbp)
    into v_before
    from app.operator_break_behavior_profiles obbp
    where obbp.operator_break_behavior_profile_id = p_operator_break_behavior_profile_id
      and obbp.is_active = true
    for update;

    if v_before is null then
        raise exception 'active operator break behavior profile not found'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.operator_break_types obt
        where obt.operator_break_behavior_profile_id = p_operator_break_behavior_profile_id
          and obt.is_active = true
    ) then
        raise exception 'active operator break type blocks profile deactivation'
            using errcode = 'P0001';
    end if;

    update app.operator_break_behavior_profiles
    set is_active = false,
        updated_at = now()
    where operator_break_behavior_profile_id = p_operator_break_behavior_profile_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'deactivate_operator_break_behavior_profile',
        'operator_break_behavior_profiles',
        p_operator_break_behavior_profile_id,
        v_before,
        v_before || jsonb_build_object('is_active', false),
        v_reason
    );

    return p_operator_break_behavior_profile_id;
end;
$$;

comment on function app.deactivate_operator_break_behavior_profile(bigint, bigint, text)
    is 'runtime_api: deactivates an unreferenced operator-break profile with permission and audit.';

create or replace function app._create_machine_downtime_behavior_profile(
    p_actor_employee_id bigint,
    p_expected_class text,
    p_technical_code text,
    p_profile_name text,
    p_operator_requires_start_comment boolean,
    p_blocks_production_finish boolean,
    p_blocks_shift_finish boolean,
    p_machine_status_effect text,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_technical_code text;
    v_profile_name text;
    v_reason text;
    v_profile_id bigint;
    v_requires_production_operation boolean;
    v_ui_color_token text;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_technical_code := app._assert_dictionary_technical_code(p_technical_code, 'p_technical_code');
    v_profile_name := app._assert_nonempty_text(p_profile_name, 'p_profile_name');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    if p_expected_class not in ('OPERATIONAL', 'CRITICAL') then
        raise exception 'unsupported downtime class'
            using errcode = '22023';
    end if;

    if p_operator_requires_start_comment is null
       or p_blocks_production_finish is null
       or p_blocks_shift_finish is null then
        raise exception 'machine downtime behavior flags are required'
            using errcode = '22023';
    end if;

    if p_expected_class = 'OPERATIONAL' then
        v_requires_production_operation := true;
        v_ui_color_token := 'yellow';
        if p_machine_status_effect <> 'DOWNTIME' then
            raise exception 'operational downtime profile must use DOWNTIME machine status effect'
                using errcode = '22023';
        end if;
    else
        v_requires_production_operation := false;
        v_ui_color_token := 'scarlet';
        if p_machine_status_effect not in ('DOWNTIME', 'BROKEN') then
            raise exception 'critical downtime profile requires DOWNTIME or BROKEN machine status effect'
                using errcode = '22023';
        end if;
    end if;

    insert into app.machine_downtime_behavior_profiles (
        technical_code,
        profile_name,
        downtime_class,
        requires_production_operation,
        operator_requires_start_comment,
        privileged_actor_requires_start_reason,
        blocks_production_finish,
        blocks_shift_finish,
        machine_status_effect,
        ui_color_token,
        is_active
    )
    values (
        v_technical_code,
        v_profile_name,
        p_expected_class,
        v_requires_production_operation,
        p_operator_requires_start_comment,
        true,
        p_blocks_production_finish,
        p_blocks_shift_finish,
        p_machine_status_effect,
        v_ui_color_token,
        true
    )
    returning machine_downtime_behavior_profile_id into v_profile_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'create_' || lower(p_expected_class) || '_downtime_behavior_profile',
        'machine_downtime_behavior_profiles',
        v_profile_id,
        null,
        jsonb_build_object(
            'technical_code', v_technical_code,
            'profile_name', v_profile_name,
            'downtime_class', p_expected_class,
            'requires_production_operation', v_requires_production_operation,
            'operator_requires_start_comment', p_operator_requires_start_comment,
            'privileged_actor_requires_start_reason', true,
            'blocks_production_finish', p_blocks_production_finish,
            'blocks_shift_finish', p_blocks_shift_finish,
            'machine_status_effect', p_machine_status_effect,
            'ui_color_token', v_ui_color_token,
            'is_active', true
        ),
        v_reason
    );

    return v_profile_id;
end;
$$;

comment on function app._create_machine_downtime_behavior_profile(bigint, text, text, text, boolean, boolean, boolean, text, text)
    is 'internal_helper: creates a validated immutable class-bound downtime behavior profile with audit.';

create or replace function app.create_operational_downtime_behavior_profile(
    p_actor_employee_id bigint,
    p_technical_code text,
    p_profile_name text,
    p_operator_requires_start_comment boolean,
    p_blocks_production_finish boolean,
    p_blocks_shift_finish boolean,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._create_machine_downtime_behavior_profile(
        p_actor_employee_id,
        'OPERATIONAL',
        p_technical_code,
        p_profile_name,
        p_operator_requires_start_comment,
        p_blocks_production_finish,
        p_blocks_shift_finish,
        'DOWNTIME',
        p_reason
    )
$$;

comment on function app.create_operational_downtime_behavior_profile(bigint, text, text, boolean, boolean, boolean, text)
    is 'runtime_api: creates an audited operational-only downtime behavior profile.';

create or replace function app.create_critical_downtime_behavior_profile(
    p_actor_employee_id bigint,
    p_technical_code text,
    p_profile_name text,
    p_operator_requires_start_comment boolean,
    p_blocks_production_finish boolean,
    p_blocks_shift_finish boolean,
    p_machine_status_effect text,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._create_machine_downtime_behavior_profile(
        p_actor_employee_id,
        'CRITICAL',
        p_technical_code,
        p_profile_name,
        p_operator_requires_start_comment,
        p_blocks_production_finish,
        p_blocks_shift_finish,
        p_machine_status_effect,
        p_reason
    )
$$;

comment on function app.create_critical_downtime_behavior_profile(bigint, text, text, boolean, boolean, boolean, text, text)
    is 'runtime_api: creates an audited critical-only downtime behavior profile.';

create or replace function app._create_machine_downtime_type(
    p_actor_employee_id bigint,
    p_expected_class text,
    p_technical_code text,
    p_display_name text,
    p_display_order integer,
    p_machine_downtime_behavior_profile_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_technical_code text;
    v_display_name text;
    v_reason text;
    v_type_id bigint;
    v_has_complete_notification_rules boolean;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_technical_code := app._assert_dictionary_technical_code(p_technical_code, 'p_technical_code');
    v_display_name := app._assert_nonempty_text(p_display_name, 'p_display_name');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    if p_expected_class not in ('OPERATIONAL', 'CRITICAL') then
        raise exception 'unsupported downtime class'
            using errcode = '22023';
    end if;

    if p_display_order is null or p_display_order < 0 then
        raise exception 'p_display_order must be a non-negative integer'
            using errcode = '22023';
    end if;

    perform 1
    from app.machine_downtime_behavior_profiles mdbp
    where mdbp.machine_downtime_behavior_profile_id = p_machine_downtime_behavior_profile_id
      and mdbp.downtime_class = p_expected_class
      and mdbp.is_active = true
    for update;

    if not found then
        raise exception 'active compatible machine downtime behavior profile is required'
            using errcode = '22023';
    end if;

    select
        count(*) = 2
        and count(*) filter (
            where rule.recipient_permission_code = 'can_receive_production_notifications'
              and (
                (p_expected_class = 'OPERATIONAL'
                  and rule.notification_kind = 'ELAPSED_THRESHOLD'
                  and rule.threshold_minutes = 15)
                or (p_expected_class = 'CRITICAL'
                  and rule.notification_kind = 'TYPE_IMMEDIATE'
                  and rule.threshold_minutes = 0)
              )
        ) = 1
        and count(*) filter (
            where rule.recipient_permission_code = 'can_receive_director_notifications'
              and rule.notification_kind = 'ELAPSED_THRESHOLD'
              and rule.threshold_minutes = 30
        ) = 1
    into v_has_complete_notification_rules
    from app.machine_downtime_profile_notification_rules rule
    where rule.machine_downtime_behavior_profile_id = p_machine_downtime_behavior_profile_id
      and rule.is_active = true;

    if not v_has_complete_notification_rules then
        raise exception 'downtime profile requires the complete approved notification rule set before type creation'
            using errcode = '22023';
    end if;

    insert into app.machine_downtime_types (
        technical_code,
        machine_downtime_type_name,
        display_order,
        downtime_class,
        machine_downtime_behavior_profile_id,
        is_active
    )
    values (
        v_technical_code,
        v_display_name,
        p_display_order,
        p_expected_class,
        p_machine_downtime_behavior_profile_id,
        true
    )
    returning machine_downtime_type_id into v_type_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'create_' || lower(p_expected_class) || '_downtime_type',
        'machine_downtime_types',
        v_type_id,
        null,
        jsonb_build_object(
            'technical_code', v_technical_code,
            'display_name', v_display_name,
            'display_order', p_display_order,
            'downtime_class', p_expected_class,
            'machine_downtime_behavior_profile_id', p_machine_downtime_behavior_profile_id,
            'is_active', true
        ),
        v_reason
    );

    return v_type_id;
end;
$$;

comment on function app._create_machine_downtime_type(bigint, text, text, text, integer, bigint, text)
    is 'internal_helper: creates an immutable audited downtime type bound to a compatible profile class.';

create or replace function app.create_operational_downtime_type(
    p_actor_employee_id bigint,
    p_technical_code text,
    p_display_name text,
    p_display_order integer,
    p_machine_downtime_behavior_profile_id bigint,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._create_machine_downtime_type(
        p_actor_employee_id,
        'OPERATIONAL',
        p_technical_code,
        p_display_name,
        p_display_order,
        p_machine_downtime_behavior_profile_id,
        p_reason
    )
$$;

comment on function app.create_operational_downtime_type(bigint, text, text, integer, bigint, text)
    is 'runtime_api: creates an audited operational downtime type using an operational profile only.';

create or replace function app.create_critical_downtime_type(
    p_actor_employee_id bigint,
    p_technical_code text,
    p_display_name text,
    p_display_order integer,
    p_machine_downtime_behavior_profile_id bigint,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._create_machine_downtime_type(
        p_actor_employee_id,
        'CRITICAL',
        p_technical_code,
        p_display_name,
        p_display_order,
        p_machine_downtime_behavior_profile_id,
        p_reason
    )
$$;

comment on function app.create_critical_downtime_type(bigint, text, text, integer, bigint, text)
    is 'runtime_api: creates an audited critical downtime type using a critical profile only.';

create or replace function app._deactivate_machine_downtime_type(
    p_actor_employee_id bigint,
    p_expected_class text,
    p_machine_downtime_type_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before jsonb;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select to_jsonb(mdt)
    into v_before
    from app.machine_downtime_types mdt
    where mdt.machine_downtime_type_id = p_machine_downtime_type_id
      and mdt.downtime_class = p_expected_class
      and mdt.is_active = true
    for update;

    if v_before is null then
        raise exception 'active downtime type of expected class not found'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.machine_downtimes md
        where md.machine_downtime_type_id = p_machine_downtime_type_id
          and md.is_open = true
    ) then
        raise exception 'open machine downtime blocks type deactivation'
            using errcode = 'P0001';
    end if;

    update app.machine_downtime_types
    set is_active = false,
        updated_at = now()
    where machine_downtime_type_id = p_machine_downtime_type_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'deactivate_' || lower(p_expected_class) || '_downtime_type',
        'machine_downtime_types',
        p_machine_downtime_type_id,
        v_before,
        v_before || jsonb_build_object('is_active', false),
        v_reason
    );

    return p_machine_downtime_type_id;
end;
$$;

comment on function app._deactivate_machine_downtime_type(bigint, text, bigint, text)
    is 'internal_helper: deactivates an unused downtime type only through its expected management class.';

create or replace function app.deactivate_operational_downtime_type(
    p_actor_employee_id bigint,
    p_machine_downtime_type_id bigint,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._deactivate_machine_downtime_type(
        p_actor_employee_id,
        'OPERATIONAL',
        p_machine_downtime_type_id,
        p_reason
    )
$$;

comment on function app.deactivate_operational_downtime_type(bigint, bigint, text)
    is 'runtime_api: deactivates an unused operational downtime type through the operational scope.';

create or replace function app.deactivate_critical_downtime_type(
    p_actor_employee_id bigint,
    p_machine_downtime_type_id bigint,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._deactivate_machine_downtime_type(
        p_actor_employee_id,
        'CRITICAL',
        p_machine_downtime_type_id,
        p_reason
    )
$$;

comment on function app.deactivate_critical_downtime_type(bigint, bigint, text)
    is 'runtime_api: deactivates an unused critical downtime type through the critical scope.';

create or replace function app._deactivate_machine_downtime_behavior_profile(
    p_actor_employee_id bigint,
    p_expected_class text,
    p_machine_downtime_behavior_profile_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before jsonb;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select to_jsonb(mdbp)
    into v_before
    from app.machine_downtime_behavior_profiles mdbp
    where mdbp.machine_downtime_behavior_profile_id = p_machine_downtime_behavior_profile_id
      and mdbp.downtime_class = p_expected_class
      and mdbp.is_active = true
    for update;

    if v_before is null then
        raise exception 'active downtime behavior profile of expected class not found'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.machine_downtime_types mdt
        where mdt.machine_downtime_behavior_profile_id = p_machine_downtime_behavior_profile_id
          and mdt.is_active = true
    ) then
        raise exception 'active downtime type blocks profile deactivation'
            using errcode = 'P0001';
    end if;

    update app.machine_downtime_behavior_profiles
    set is_active = false,
        updated_at = now()
    where machine_downtime_behavior_profile_id = p_machine_downtime_behavior_profile_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'deactivate_' || lower(p_expected_class) || '_downtime_behavior_profile',
        'machine_downtime_behavior_profiles',
        p_machine_downtime_behavior_profile_id,
        v_before,
        v_before || jsonb_build_object('is_active', false),
        v_reason
    );

    return p_machine_downtime_behavior_profile_id;
end;
$$;

comment on function app._deactivate_machine_downtime_behavior_profile(bigint, text, bigint, text)
    is 'internal_helper: deactivates an unreferenced downtime behavior profile only through its class scope.';

create or replace function app.deactivate_operational_downtime_behavior_profile(
    p_actor_employee_id bigint,
    p_machine_downtime_behavior_profile_id bigint,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._deactivate_machine_downtime_behavior_profile(
        p_actor_employee_id,
        'OPERATIONAL',
        p_machine_downtime_behavior_profile_id,
        p_reason
    )
$$;

comment on function app.deactivate_operational_downtime_behavior_profile(bigint, bigint, text)
    is 'runtime_api: deactivates an unreferenced operational downtime profile through the operational scope.';

create or replace function app.deactivate_critical_downtime_behavior_profile(
    p_actor_employee_id bigint,
    p_machine_downtime_behavior_profile_id bigint,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._deactivate_machine_downtime_behavior_profile(
        p_actor_employee_id,
        'CRITICAL',
        p_machine_downtime_behavior_profile_id,
        p_reason
    )
$$;

comment on function app.deactivate_critical_downtime_behavior_profile(bigint, bigint, text)
    is 'runtime_api: deactivates an unreferenced critical downtime profile through the critical scope.';

create or replace function app._create_machine_downtime_notification_rule(
    p_actor_employee_id bigint,
    p_expected_class text,
    p_machine_downtime_behavior_profile_id bigint,
    p_technical_code text,
    p_threshold_minutes integer,
    p_recipient_permission_code text,
    p_notification_kind text,
    p_priority integer,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_technical_code text;
    v_reason text;
    v_rule_id bigint;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_technical_code := app._assert_dictionary_technical_code(p_technical_code, 'p_technical_code');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    perform 1
    from app.machine_downtime_behavior_profiles mdbp
    where mdbp.machine_downtime_behavior_profile_id = p_machine_downtime_behavior_profile_id
      and mdbp.downtime_class = p_expected_class
      and mdbp.is_active = true
    for update;

    if not found then
        raise exception 'active compatible downtime behavior profile is required'
            using errcode = '22023';
    end if;

    if exists (
        select 1
        from app.machine_downtime_types mdt
        where mdt.machine_downtime_behavior_profile_id = p_machine_downtime_behavior_profile_id
    ) then
        raise exception 'notification rules become immutable after a downtime type references the profile'
            using errcode = 'P0001';
    end if;

    if p_threshold_minutes is null
       or p_priority is null
       or p_priority < 0
       or p_recipient_permission_code not in (
           'can_receive_production_notifications',
           'can_receive_director_notifications'
       )
       or not (
           (p_notification_kind = 'TYPE_IMMEDIATE' and p_threshold_minutes = 0)
           or (p_notification_kind = 'ELAPSED_THRESHOLD' and p_threshold_minutes > 0)
       ) then
        raise exception 'invalid downtime notification rule parameters'
            using errcode = '22023';
    end if;

    if not (
        (
            p_expected_class = 'OPERATIONAL'
            and (
                (p_recipient_permission_code = 'can_receive_production_notifications'
                  and p_notification_kind = 'ELAPSED_THRESHOLD'
                  and p_threshold_minutes = 15)
                or (p_recipient_permission_code = 'can_receive_director_notifications'
                  and p_notification_kind = 'ELAPSED_THRESHOLD'
                  and p_threshold_minutes = 30)
            )
        )
        or (
            p_expected_class = 'CRITICAL'
            and (
                (p_recipient_permission_code = 'can_receive_production_notifications'
                  and p_notification_kind = 'TYPE_IMMEDIATE'
                  and p_threshold_minutes = 0)
                or (p_recipient_permission_code = 'can_receive_director_notifications'
                  and p_notification_kind = 'ELAPSED_THRESHOLD'
                  and p_threshold_minutes = 30)
            )
        )
    ) then
        raise exception 'notification rule is outside the approved behavior contract for this downtime class'
            using errcode = '22023';
    end if;

    insert into app.machine_downtime_profile_notification_rules (
        machine_downtime_behavior_profile_id,
        technical_code,
        threshold_minutes,
        recipient_permission_code,
        notification_kind,
        priority,
        is_active
    )
    values (
        p_machine_downtime_behavior_profile_id,
        v_technical_code,
        p_threshold_minutes,
        p_recipient_permission_code,
        p_notification_kind,
        p_priority,
        true
    )
    returning machine_downtime_profile_notification_rule_id into v_rule_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'create_' || lower(p_expected_class) || '_downtime_notification_rule',
        'machine_downtime_profile_notification_rules',
        v_rule_id,
        null,
        jsonb_build_object(
            'machine_downtime_behavior_profile_id', p_machine_downtime_behavior_profile_id,
            'technical_code', v_technical_code,
            'threshold_minutes', p_threshold_minutes,
            'recipient_permission_code', p_recipient_permission_code,
            'notification_kind', p_notification_kind,
            'priority', p_priority,
            'is_active', true
        ),
        v_reason
    );

    return v_rule_id;
end;
$$;

comment on function app._create_machine_downtime_notification_rule(bigint, text, bigint, text, integer, text, text, integer, text)
    is 'internal_helper: creates a validated immutable notification rule inside one downtime profile class.';

create or replace function app.create_operational_downtime_notification_rule(
    p_actor_employee_id bigint,
    p_machine_downtime_behavior_profile_id bigint,
    p_technical_code text,
    p_threshold_minutes integer,
    p_recipient_permission_code text,
    p_notification_kind text,
    p_priority integer,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._create_machine_downtime_notification_rule(
        p_actor_employee_id,
        'OPERATIONAL',
        p_machine_downtime_behavior_profile_id,
        p_technical_code,
        p_threshold_minutes,
        p_recipient_permission_code,
        p_notification_kind,
        p_priority,
        p_reason
    )
$$;

comment on function app.create_operational_downtime_notification_rule(bigint, bigint, text, integer, text, text, integer, text)
    is 'runtime_api: creates an audited notification rule for an operational downtime profile only.';

create or replace function app.create_critical_downtime_notification_rule(
    p_actor_employee_id bigint,
    p_machine_downtime_behavior_profile_id bigint,
    p_technical_code text,
    p_threshold_minutes integer,
    p_recipient_permission_code text,
    p_notification_kind text,
    p_priority integer,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._create_machine_downtime_notification_rule(
        p_actor_employee_id,
        'CRITICAL',
        p_machine_downtime_behavior_profile_id,
        p_technical_code,
        p_threshold_minutes,
        p_recipient_permission_code,
        p_notification_kind,
        p_priority,
        p_reason
    )
$$;

comment on function app.create_critical_downtime_notification_rule(bigint, bigint, text, integer, text, text, integer, text)
    is 'runtime_api: creates an audited notification rule for a critical downtime profile only.';

create or replace function app._deactivate_machine_downtime_notification_rule(
    p_actor_employee_id bigint,
    p_expected_class text,
    p_machine_downtime_profile_notification_rule_id bigint,
    p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_before jsonb;
    v_profile_id bigint;
begin
    perform app._assert_actor_has_permission(p_actor_employee_id, 'can_manage_dictionaries');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    select to_jsonb(rule), rule.machine_downtime_behavior_profile_id
    into v_before, v_profile_id
    from app.machine_downtime_profile_notification_rules rule
    join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = rule.machine_downtime_behavior_profile_id
    where rule.machine_downtime_profile_notification_rule_id = p_machine_downtime_profile_notification_rule_id
      and rule.is_active = true
      and mdbp.downtime_class = p_expected_class
    for update of rule;

    if v_before is null then
        raise exception 'active downtime notification rule of expected class not found'
            using errcode = 'P0001';
    end if;

    if exists (
        select 1
        from app.machine_downtime_types mdt
        where mdt.machine_downtime_behavior_profile_id = v_profile_id
    ) then
        raise exception 'notification rules become immutable after a downtime type references the profile'
            using errcode = 'P0001';
    end if;

    update app.machine_downtime_profile_notification_rules
    set is_active = false,
        updated_at = now()
    where machine_downtime_profile_notification_rule_id = p_machine_downtime_profile_notification_rule_id;

    perform app._insert_audit_event(
        p_actor_employee_id,
        'deactivate_' || lower(p_expected_class) || '_downtime_notification_rule',
        'machine_downtime_profile_notification_rules',
        p_machine_downtime_profile_notification_rule_id,
        v_before,
        v_before || jsonb_build_object('is_active', false),
        v_reason
    );

    return p_machine_downtime_profile_notification_rule_id;
end;
$$;

comment on function app._deactivate_machine_downtime_notification_rule(bigint, text, bigint, text)
    is 'internal_helper: deactivates a downtime notification rule with class and open-downtime guards.';

create or replace function app.deactivate_operational_downtime_notification_rule(
    p_actor_employee_id bigint,
    p_machine_downtime_profile_notification_rule_id bigint,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._deactivate_machine_downtime_notification_rule(
        p_actor_employee_id,
        'OPERATIONAL',
        p_machine_downtime_profile_notification_rule_id,
        p_reason
    )
$$;

comment on function app.deactivate_operational_downtime_notification_rule(bigint, bigint, text)
    is 'runtime_api: deactivates an operational downtime notification rule through the operational scope.';

create or replace function app.deactivate_critical_downtime_notification_rule(
    p_actor_employee_id bigint,
    p_machine_downtime_profile_notification_rule_id bigint,
    p_reason text
)
returns bigint
language sql
security definer
set search_path = app, pg_catalog
as $$
    select app._deactivate_machine_downtime_notification_rule(
        p_actor_employee_id,
        'CRITICAL',
        p_machine_downtime_profile_notification_rule_id,
        p_reason
    )
$$;

comment on function app.deactivate_critical_downtime_notification_rule(bigint, bigint, text)
    is 'runtime_api: deactivates a critical downtime notification rule through the critical scope.';

-- END activity type profile management

-- BEGIN administrative web authentication foundation

create or replace function app.read_admin_password_credential(
    p_login_name text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_login_name text;
    v_credential record;
begin
    v_login_name := lower(btrim(coalesce(p_login_name, '')));
    if v_login_name !~ '^[a-z0-9][a-z0-9._-]{2,63}$' then
        return null;
    end if;

    select
        c.admin_password_credential_id,
        c.employee_id,
        c.password_hash,
        c.must_change_password,
        c.failed_attempt_count,
        c.locked_until,
        c.is_active
    into v_credential
    from app.admin_password_credentials c
    where c.login_name = v_login_name;

    if not found then
        return null;
    end if;

    return jsonb_build_object(
        'credential_id', v_credential.admin_password_credential_id::text,
        'employee_id', v_credential.employee_id::text,
        'password_hash', v_credential.password_hash,
        'must_change_password', v_credential.must_change_password,
        'failed_attempt_count', v_credential.failed_attempt_count,
        'locked_until', v_credential.locked_until,
        'is_active', v_credential.is_active
    );
end;
$$;

comment on function app.read_admin_password_credential(text)
    is 'runtime_api: returns one private password credential to the trusted backend for constant-time proof verification.';

create or replace function app.record_admin_password_failure(
    p_admin_password_credential_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_credential app.admin_password_credentials%rowtype;
    v_failed_attempt_count smallint;
    v_locked_until timestamptz;
begin
    select *
    into v_credential
    from app.admin_password_credentials c
    where c.admin_password_credential_id = p_admin_password_credential_id
    for update;

    if not found then
        return null;
    end if;

    if not v_credential.is_active then
        return jsonb_build_object('accepted', false);
    end if;

    if v_credential.locked_until is not null and v_credential.locked_until > now() then
        return jsonb_build_object(
            'accepted', true,
            'failed_attempt_count', v_credential.failed_attempt_count,
            'locked_until', v_credential.locked_until
        );
    end if;

    v_failed_attempt_count := least(
        5,
        case
            when v_credential.locked_until is not null and v_credential.locked_until <= now() then 1
            else v_credential.failed_attempt_count + 1
        end
    );
    v_locked_until := case
        when v_failed_attempt_count >= 5 then now() + interval '15 minutes'
        else null
    end;

    update app.admin_password_credentials
    set
        failed_attempt_count = v_failed_attempt_count,
        locked_until = v_locked_until,
        updated_at = now()
    where admin_password_credential_id = p_admin_password_credential_id;

    return jsonb_build_object(
        'accepted', true,
        'failed_attempt_count', v_failed_attempt_count,
        'locked_until', v_locked_until
    );
end;
$$;

comment on function app.record_admin_password_failure(bigint)
    is 'runtime_api: records one failed password proof with a bounded five-attempt, fifteen-minute lockout.';

create or replace function app.start_admin_password_session(
    p_admin_password_credential_id bigint,
    p_session_token_hash text,
    p_csrf_token_hash text,
    p_created_ip text,
    p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_credential app.admin_password_credentials%rowtype;
    v_employee record;
    v_admin_session_id bigint;
    v_created_at timestamptz := clock_timestamp();
    v_expires_at timestamptz := v_created_at + interval '8 hours';
    v_idle_expires_at timestamptz := v_created_at + interval '30 minutes';
    v_created_ip inet;
    v_user_agent text;
begin
    if p_session_token_hash is null or p_session_token_hash !~ '^[a-f0-9]{64}$' then
        raise exception 'invalid session token hash' using errcode = '22023';
    end if;
    if p_csrf_token_hash is null or p_csrf_token_hash !~ '^[a-f0-9]{64}$' then
        raise exception 'invalid CSRF token hash' using errcode = '22023';
    end if;

    if p_created_ip is not null and btrim(p_created_ip) <> '' then
        v_created_ip := btrim(p_created_ip)::inet;
    end if;
    if p_user_agent is not null and btrim(p_user_agent) <> '' then
        v_user_agent := left(btrim(p_user_agent), 512);
    end if;

    select *
    into v_credential
    from app.admin_password_credentials c
    where c.admin_password_credential_id = p_admin_password_credential_id
    for update;

    if not found
       or not v_credential.is_active
       or (v_credential.locked_until is not null and v_credential.locked_until > now()) then
        raise exception 'administrative credential is unavailable' using errcode = '42501';
    end if;

    select
        e.full_name,
        r.role_name
    into v_employee
    from app.employees e
    join app.employee_statuses es
      on es.employee_status_id = e.employee_status_id
    join app.employee_roles er
      on er.employee_id = e.employee_id
     and er.revoked_at is null
    join app.roles r
      on r.role_id = er.role_id
     and r.is_active = true
    where e.employee_id = v_credential.employee_id
      and es.is_active = true
      and es.is_active_for_login = true
      and r.can_access_admin_panel = true;

    if not found then
        raise exception 'administrative actor is unavailable' using errcode = '42501';
    end if;

    update app.admin_password_credentials
    set failed_attempt_count = 0, locked_until = null, updated_at = now()
    where admin_password_credential_id = v_credential.admin_password_credential_id;

    insert into app.admin_sessions (
        employee_id,
        admin_password_credential_id,
        auth_method,
        session_token_hash,
        csrf_token_hash,
        created_ip,
        user_agent,
        created_at,
        last_seen_at,
        idle_expires_at,
        expires_at
    )
    values (
        v_credential.employee_id,
        v_credential.admin_password_credential_id,
        'PASSWORD',
        p_session_token_hash,
        p_csrf_token_hash,
        v_created_ip,
        v_user_agent,
        v_created_at,
        v_created_at,
        v_idle_expires_at,
        v_expires_at
    )
    returning admin_session_id into v_admin_session_id;

    perform app._insert_audit_event(
        v_credential.employee_id,
        'admin_session_started',
        'admin_sessions',
        v_admin_session_id,
        null,
        jsonb_build_object('auth_method', 'PASSWORD'),
        null
    );

    return jsonb_build_object(
        'session_id', v_admin_session_id::text,
        'employee_id', v_credential.employee_id::text,
        'full_name', v_employee.full_name,
        'role_name', v_employee.role_name,
        'auth_method', 'PASSWORD',
        'must_change_password', v_credential.must_change_password,
        'created_at', v_created_at,
        'idle_expires_at', v_idle_expires_at,
        'expires_at', v_expires_at
    );
end;
$$;

comment on function app.start_admin_password_session(bigint, text, text, text, text)
    is 'runtime_api: creates an attributable password-backed admin session after backend cryptographic proof verification.';

create or replace function app.create_admin_telegram_qr_challenge(
    p_confirmation_token_hash text,
    p_browser_token_hash text,
    p_created_ip text,
    p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_created_at timestamptz := clock_timestamp();
    v_expires_at timestamptz := v_created_at + interval '2 minutes';
    v_created_ip inet;
    v_user_agent text;
    v_recent_challenge_count integer;
    v_challenge_id bigint;
begin
    if p_confirmation_token_hash is null
       or p_confirmation_token_hash !~ '^[a-f0-9]{64}$' then
        raise exception 'invalid Telegram confirmation token hash' using errcode = '22023';
    end if;
    if p_browser_token_hash is null
       or p_browser_token_hash !~ '^[a-f0-9]{64}$' then
        raise exception 'invalid browser token hash' using errcode = '22023';
    end if;

    if p_created_ip is not null and btrim(p_created_ip) <> '' then
        v_created_ip := btrim(p_created_ip)::inet;
    end if;
    if p_user_agent is not null and btrim(p_user_agent) <> '' then
        v_user_agent := left(btrim(p_user_agent), 512);
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'admin-telegram-qr:' || coalesce(v_created_ip::text, 'unknown'),
            0
        )
    );

    select count(*)
    into v_recent_challenge_count
    from app.admin_telegram_qr_challenges c
    where c.created_ip is not distinct from v_created_ip
      and c.created_at >= v_created_at - interval '1 minute';

    if v_recent_challenge_count >= 20 then
        raise exception 'administrative QR challenge rate exceeded' using errcode = '54000';
    end if;

    insert into app.admin_telegram_qr_challenges (
        confirmation_token_hash,
        browser_token_hash,
        created_ip,
        user_agent,
        created_at,
        expires_at
    )
    values (
        p_confirmation_token_hash,
        p_browser_token_hash,
        v_created_ip,
        v_user_agent,
        v_created_at,
        v_expires_at
    )
    returning admin_telegram_qr_challenge_id into v_challenge_id;

    return jsonb_build_object(
        'challenge_id', v_challenge_id::text,
        'expires_at', v_expires_at
    );
end;
$$;

comment on function app.create_admin_telegram_qr_challenge(text, text, text, text)
    is 'runtime_api: creates one browser-bound, two-minute Telegram QR challenge with hashed proofs and source throttling.';

create or replace function app.confirm_admin_telegram_qr_challenge(
    p_confirmation_token_hash text,
    p_telegram_user_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_challenge app.admin_telegram_qr_challenges%rowtype;
    v_employee record;
    v_role record;
    v_confirmed_at timestamptz := clock_timestamp();
begin
    if p_confirmation_token_hash is null
       or p_confirmation_token_hash !~ '^[a-f0-9]{64}$'
       or p_telegram_user_id is null then
        return jsonb_build_object('status', 'UNAVAILABLE');
    end if;

    select *
    into v_challenge
    from app.admin_telegram_qr_challenges c
    where c.confirmation_token_hash = p_confirmation_token_hash
    for update;

    if not found then
        return jsonb_build_object('status', 'UNAVAILABLE');
    end if;
    if v_challenge.claimed_at is not null then
        return jsonb_build_object('status', 'ALREADY_USED');
    end if;
    if v_challenge.expires_at <= v_confirmed_at then
        return jsonb_build_object('status', 'EXPIRED');
    end if;

    select e.employee_id, e.full_name
    into v_employee
    from app.employees e
    join app.employee_statuses es
      on es.employee_status_id = e.employee_status_id
    where e.telegram_user_id = p_telegram_user_id
      and es.is_active = true
      and es.is_active_for_login = true
    for share of e, es;

    if not found then
        return jsonb_build_object('status', 'NOT_BOUND');
    end if;

    select r.role_name
    into v_role
    from app.employee_roles er
    join app.roles r
      on r.role_id = er.role_id
    where er.employee_id = v_employee.employee_id
      and er.revoked_at is null
      and r.is_active = true
      and r.can_access_admin_panel = true
    for share of er, r;

    if not found then
        return jsonb_build_object('status', 'FORBIDDEN');
    end if;

    if v_challenge.confirmed_employee_id is not null then
        if v_challenge.confirmed_employee_id = v_employee.employee_id then
            return jsonb_build_object('status', 'CONFIRMED');
        end if;
        return jsonb_build_object('status', 'ALREADY_USED');
    end if;

    update app.admin_telegram_qr_challenges
    set
        confirmed_employee_id = v_employee.employee_id,
        confirmed_at = v_confirmed_at
    where admin_telegram_qr_challenge_id = v_challenge.admin_telegram_qr_challenge_id;

    perform app._insert_audit_event(
        v_employee.employee_id,
        'admin_telegram_qr_confirmed',
        'admin_telegram_qr_challenges',
        v_challenge.admin_telegram_qr_challenge_id,
        null,
        jsonb_build_object('auth_method', 'TELEGRAM_QR'),
        null
    );

    return jsonb_build_object('status', 'CONFIRMED');
end;
$$;

comment on function app.confirm_admin_telegram_qr_challenge(text, bigint)
    is 'runtime_api: confirms one unexpired QR challenge for an already-bound active administrative Telegram identity.';

create or replace function app.claim_admin_telegram_qr_challenge(
    p_admin_telegram_qr_challenge_id bigint,
    p_browser_token_hash text,
    p_session_token_hash text,
    p_csrf_token_hash text,
    p_created_ip text,
    p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_challenge app.admin_telegram_qr_challenges%rowtype;
    v_actor record;
    v_admin_session_id bigint;
    v_created_at timestamptz := clock_timestamp();
    v_expires_at timestamptz := v_created_at + interval '8 hours';
    v_idle_expires_at timestamptz := v_created_at + interval '30 minutes';
    v_created_ip inet;
    v_user_agent text;
begin
    if p_admin_telegram_qr_challenge_id is null
       or p_browser_token_hash is null
       or p_browser_token_hash !~ '^[a-f0-9]{64}$'
       or p_session_token_hash is null
       or p_session_token_hash !~ '^[a-f0-9]{64}$'
       or p_csrf_token_hash is null
       or p_csrf_token_hash !~ '^[a-f0-9]{64}$' then
        return jsonb_build_object('status', 'UNAVAILABLE');
    end if;

    if p_created_ip is not null and btrim(p_created_ip) <> '' then
        v_created_ip := btrim(p_created_ip)::inet;
    end if;
    if p_user_agent is not null and btrim(p_user_agent) <> '' then
        v_user_agent := left(btrim(p_user_agent), 512);
    end if;

    select *
    into v_challenge
    from app.admin_telegram_qr_challenges c
    where c.admin_telegram_qr_challenge_id = p_admin_telegram_qr_challenge_id
      and c.browser_token_hash = p_browser_token_hash
    for update;

    if not found then
        return jsonb_build_object('status', 'UNAVAILABLE');
    end if;
    if v_challenge.claimed_at is not null then
        return jsonb_build_object('status', 'ALREADY_USED');
    end if;
    if v_challenge.expires_at <= v_created_at then
        return jsonb_build_object('status', 'EXPIRED');
    end if;
    if v_challenge.confirmed_employee_id is null then
        return jsonb_build_object('status', 'PENDING');
    end if;

    select
        e.full_name,
        r.role_name
    into v_actor
    from app.employees e
    join app.employee_statuses es
      on es.employee_status_id = e.employee_status_id
    join app.employee_roles er
      on er.employee_id = e.employee_id
     and er.revoked_at is null
    join app.roles r
      on r.role_id = er.role_id
     and r.is_active = true
    where e.employee_id = v_challenge.confirmed_employee_id
      and es.is_active = true
      and es.is_active_for_login = true
      and r.can_access_admin_panel = true
    for share of e, es, er, r;

    if not found then
        return jsonb_build_object('status', 'FORBIDDEN');
    end if;

    insert into app.admin_sessions (
        employee_id,
        admin_password_credential_id,
        auth_method,
        session_token_hash,
        csrf_token_hash,
        created_ip,
        user_agent,
        created_at,
        last_seen_at,
        idle_expires_at,
        expires_at
    )
    values (
        v_challenge.confirmed_employee_id,
        null,
        'TELEGRAM_QR',
        p_session_token_hash,
        p_csrf_token_hash,
        v_created_ip,
        v_user_agent,
        v_created_at,
        v_created_at,
        v_idle_expires_at,
        v_expires_at
    )
    returning admin_session_id into v_admin_session_id;

    update app.admin_telegram_qr_challenges
    set
        claimed_admin_session_id = v_admin_session_id,
        claimed_at = v_created_at
    where admin_telegram_qr_challenge_id = v_challenge.admin_telegram_qr_challenge_id;

    perform app._insert_audit_event(
        v_challenge.confirmed_employee_id,
        'admin_session_started',
        'admin_sessions',
        v_admin_session_id,
        null,
        jsonb_build_object('auth_method', 'TELEGRAM_QR'),
        null
    );

    return jsonb_build_object(
        'status', 'AUTHENTICATED',
        'session_id', v_admin_session_id::text,
        'employee_id', v_challenge.confirmed_employee_id::text,
        'full_name', v_actor.full_name,
        'role_name', v_actor.role_name,
        'auth_method', 'TELEGRAM_QR',
        'must_change_password', false,
        'created_at', v_created_at,
        'idle_expires_at', v_idle_expires_at,
        'expires_at', v_expires_at
    );
end;
$$;

comment on function app.claim_admin_telegram_qr_challenge(bigint, text, text, text, text, text)
    is 'runtime_api: atomically consumes one browser-bound confirmed Telegram challenge and creates the common admin session.';

create or replace function app.resolve_admin_session(
    p_session_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_session app.admin_sessions%rowtype;
    v_actor record;
    v_now timestamptz := clock_timestamp();
    v_idle_expires_at timestamptz;
begin
    if p_session_token_hash is null or p_session_token_hash !~ '^[a-f0-9]{64}$' then
        return null;
    end if;

    select *
    into v_session
    from app.admin_sessions s
    where s.session_token_hash = p_session_token_hash
    for update;

    if not found or v_session.revoked_at is not null then
        return null;
    end if;

    if v_session.expires_at <= v_now or v_session.idle_expires_at <= v_now then
        update app.admin_sessions
        set revoked_at = v_now, revoked_reason = 'SESSION_EXPIRED'
        where admin_session_id = v_session.admin_session_id;
        return null;
    end if;

    select
        e.full_name,
        r.role_name,
        c.must_change_password
    into v_actor
    from app.employees e
    join app.employee_statuses es
      on es.employee_status_id = e.employee_status_id
    join app.employee_roles er
      on er.employee_id = e.employee_id
     and er.revoked_at is null
    join app.roles r
      on r.role_id = er.role_id
     and r.is_active = true
    left join app.admin_password_credentials c
      on c.admin_password_credential_id = v_session.admin_password_credential_id
     and c.employee_id = e.employee_id
     and c.is_active = true
    where e.employee_id = v_session.employee_id
      and es.is_active = true
      and es.is_active_for_login = true
      and r.can_access_admin_panel = true
      and (
          v_session.auth_method <> 'PASSWORD'
          or c.admin_password_credential_id is not null
      );

    if not found then
        update app.admin_sessions
        set revoked_at = v_now, revoked_reason = 'AUTHORIZATION_REVOKED'
        where admin_session_id = v_session.admin_session_id;
        return null;
    end if;

    v_idle_expires_at := least(v_now + interval '30 minutes', v_session.expires_at);
    update app.admin_sessions
    set last_seen_at = v_now, idle_expires_at = v_idle_expires_at
    where admin_session_id = v_session.admin_session_id;

    return jsonb_build_object(
        'session_id', v_session.admin_session_id::text,
        'employee_id', v_session.employee_id::text,
        'full_name', v_actor.full_name,
        'role_name', v_actor.role_name,
        'auth_method', v_session.auth_method,
        'must_change_password', coalesce(v_actor.must_change_password, false),
        'csrf_token_hash', v_session.csrf_token_hash,
        'created_at', v_session.created_at,
        'last_seen_at', v_now,
        'idle_expires_at', v_idle_expires_at,
        'expires_at', v_session.expires_at
    );
end;
$$;

comment on function app.resolve_admin_session(text)
    is 'runtime_api: resolves and touches one valid admin session while rechecking employee and role authorization.';

create or replace function app.read_admin_password_credential_for_session(
    p_session_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_session jsonb;
    v_credential record;
begin
    v_session := app.resolve_admin_session(p_session_token_hash);
    if v_session is null or v_session ->> 'auth_method' <> 'PASSWORD' then
        return null;
    end if;

    select c.admin_password_credential_id, c.login_name, c.password_hash
    into v_credential
    from app.admin_sessions s
    join app.admin_password_credentials c
      on c.admin_password_credential_id = s.admin_password_credential_id
     and c.employee_id = s.employee_id
     and c.is_active = true
    where s.admin_session_id = (v_session ->> 'session_id')::bigint;

    if not found then
        return null;
    end if;

    return jsonb_build_object(
        'credential_id', v_credential.admin_password_credential_id::text,
        'login_name', v_credential.login_name,
        'password_hash', v_credential.password_hash
    );
end;
$$;

comment on function app.read_admin_password_credential_for_session(text)
    is 'runtime_api: returns the current password hash only for a valid password-backed admin session.';

create or replace function app.change_admin_password(
    p_session_token_hash text,
    p_new_password_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_session jsonb;
    v_admin_session_id bigint;
    v_employee_id bigint;
    v_admin_password_credential_id bigint;
    v_must_change_password boolean;
begin
    if p_new_password_hash is null
       or p_new_password_hash !~ '^scrypt\$v1\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$' then
        raise exception 'invalid password hash format' using errcode = '22023';
    end if;

    v_session := app.resolve_admin_session(p_session_token_hash);
    if v_session is null or v_session ->> 'auth_method' <> 'PASSWORD' then
        raise exception 'administrative session is unavailable' using errcode = '42501';
    end if;

    v_admin_session_id := (v_session ->> 'session_id')::bigint;
    v_employee_id := (v_session ->> 'employee_id')::bigint;

    select c.admin_password_credential_id, c.must_change_password
    into v_admin_password_credential_id, v_must_change_password
    from app.admin_sessions s
    join app.admin_password_credentials c
      on c.admin_password_credential_id = s.admin_password_credential_id
     and c.employee_id = s.employee_id
    where s.admin_session_id = v_admin_session_id
      and c.is_active = true
    for update of c;

    if not found then
        raise exception 'administrative credential is unavailable' using errcode = '42501';
    end if;

    update app.admin_password_credentials
    set
        password_hash = p_new_password_hash,
        must_change_password = false,
        failed_attempt_count = 0,
        locked_until = null,
        password_changed_at = now(),
        updated_at = now()
    where admin_password_credential_id = v_admin_password_credential_id;

    update app.admin_sessions
    set revoked_at = clock_timestamp(), revoked_reason = 'PASSWORD_CHANGED_OTHER_SESSION'
    where admin_password_credential_id = v_admin_password_credential_id
      and admin_session_id <> v_admin_session_id
      and revoked_at is null;

    perform app._insert_audit_event(
        v_employee_id,
        'admin_password_changed',
        'admin_password_credentials',
        v_admin_password_credential_id,
        jsonb_build_object('must_change_password', v_must_change_password),
        jsonb_build_object('must_change_password', false),
        null
    );

    return jsonb_build_object(
        'employee_id', v_employee_id::text,
        'must_change_password', false
    );
end;
$$;

comment on function app.change_admin_password(text, text)
    is 'runtime_api: replaces a password hash for the current session and revokes the credential other sessions.';

create or replace function app.revoke_admin_session(
    p_session_token_hash text,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_reason text;
    v_admin_session_id bigint;
    v_employee_id bigint;
begin
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    update app.admin_sessions
    set revoked_at = clock_timestamp(), revoked_reason = left(v_reason, 200)
    where session_token_hash = p_session_token_hash
      and revoked_at is null
    returning admin_session_id, employee_id
    into v_admin_session_id, v_employee_id;

    if not found then
        return jsonb_build_object('revoked', false);
    end if;

    if exists (
        select 1
        from app.employees e
        join app.employee_statuses es on es.employee_status_id = e.employee_status_id
        where e.employee_id = v_employee_id
          and es.is_active = true
          and es.is_active_for_login = true
    ) then
        perform app._insert_audit_event(
            v_employee_id,
            'admin_session_revoked',
            'admin_sessions',
            v_admin_session_id,
            null,
            jsonb_build_object('reason', left(v_reason, 200)),
            null
        );
    end if;

    return jsonb_build_object(
        'revoked', true,
        'session_id', v_admin_session_id::text
    );
end;
$$;

comment on function app.revoke_admin_session(text, text)
    is 'runtime_api: revokes one admin session by one-way token hash and records an attributable audit event when possible.';

create or replace function app.read_admin_overview(
    p_session_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_session jsonb;
    v_recent_actions jsonb;
begin
    v_session := app.resolve_admin_session(p_session_token_hash);
    if v_session is null then
        raise exception 'administrative session is unavailable' using errcode = '42501';
    end if;
    if coalesce((v_session ->> 'must_change_password')::boolean, false) then
        raise exception 'password change is required' using errcode = '42501';
    end if;

    select coalesce(
        jsonb_agg(to_jsonb(recent_action) order by recent_action.created_at desc),
        '[]'::jsonb
    )
    into v_recent_actions
    from (
        select
            ae.audit_event_id::text as audit_event_id,
            ae.action_name,
            ae.entity_table_name,
            ae.entity_record_id::text as entity_record_id,
            e.full_name as actor_full_name,
            ae.created_at
        from app.audit_events ae
        join app.employees e on e.employee_id = ae.actor_employee_id
        order by ae.created_at desc, ae.audit_event_id desc
        limit 8
    ) recent_action;

    return jsonb_build_object(
        'counts', jsonb_build_object(
            'employees', (
                select count(*)
                from app.employees e
                join app.employee_statuses es on es.employee_status_id = e.employee_status_id
                where es.is_active = true and es.is_active_for_login = true
            ),
            'machines', (select count(*) from app.machines),
            'skus', (select count(*) from app.skus where is_active = true),
            'active_sessions', (
                select count(*)
                from app.admin_sessions s
                where s.revoked_at is null
                  and s.idle_expires_at > now()
                  and s.expires_at > now()
            )
        ),
        'attention', jsonb_build_array(
            jsonb_build_object(
                'code', 'BROKEN_MACHINES',
                'count', (
                    select count(*)
                    from app.machines m
                    join app.machine_statuses ms on ms.machine_status_id = m.machine_status_id
                    where ms.is_active = true and ms.is_broken_status = true
                )
            ),
            jsonb_build_object(
                'code', 'SKU_PRODUCTIVITY_MISSING',
                'count', (
                    select count(*)
                    from app.skus s
                    where s.is_active = true and s.planned_productivity_per_hour is null
                )
            ),
            jsonb_build_object(
                'code', 'ADDITIONAL_WORK_OPEN',
                'count', (
                    select count(*)
                    from app.additional_works aw
                    where aw.finished_at is null and aw.cancelled_at is null
                )
            )
        ),
        'recent_actions', v_recent_actions
    );
end;
$$;

comment on function app.read_admin_overview(text)
    is 'runtime_api: returns the bounded overview and audit projection only through a valid admin session.';

create or replace function app.read_admin_directory(
    p_session_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_session jsonb;
begin
    v_session := app.resolve_admin_session(p_session_token_hash);
    if v_session is null then
        raise exception 'administrative session is unavailable' using errcode = '42501';
    end if;
    if coalesce((v_session ->> 'must_change_password')::boolean, false) then
        raise exception 'password change is required' using errcode = '42501';
    end if;

    return jsonb_build_object(
        'employees', (
            select coalesce(jsonb_agg(to_jsonb(employee_row) order by employee_row.full_name, employee_row.employee_id), '[]'::jsonb)
            from (
                select
                    e.employee_id::text as employee_id,
                    e.full_name,
                    e.phone_e164,
                    e.position_id::text as position_id,
                    p.position_name,
                    e.employee_status_id::text as employee_status_id,
                    es.employee_status_name,
                    es.is_active_for_login,
                    (e.telegram_user_id is not null) as telegram_is_bound,
                    coalesce((
                        select jsonb_agg(r.role_name order by r.role_name)
                        from app.employee_roles er
                        join app.roles r on r.role_id = er.role_id
                        where er.employee_id = e.employee_id
                          and er.revoked_at is null
                          and r.is_active = true
                    ), '[]'::jsonb) as role_names
                from app.employees e
                join app.positions p on p.position_id = e.position_id
                join app.employee_statuses es on es.employee_status_id = e.employee_status_id
            ) employee_row
        ),
        'positions', (
            select coalesce(jsonb_agg(to_jsonb(position_row) order by position_row.position_name, position_row.position_id), '[]'::jsonb)
            from (
                select
                    p.position_id::text as position_id,
                    p.position_name,
                    p.position_description,
                    p.is_production_position,
                    p.is_active,
                    (select count(*) from app.employees e where e.position_id = p.position_id) as employee_count
                from app.positions p
            ) position_row
        ),
        'employee_statuses', (
            select coalesce(jsonb_agg(to_jsonb(status_row) order by status_row.employee_status_id), '[]'::jsonb)
            from (
                select
                    es.employee_status_id::text as employee_status_id,
                    es.employee_status_name,
                    es.is_active_for_login,
                    es.is_final,
                    es.is_active
                from app.employee_statuses es
            ) status_row
        ),
        'machines', (
            select coalesce(jsonb_agg(to_jsonb(machine_row) order by machine_row.machine_name, machine_row.machine_id), '[]'::jsonb)
            from (
                select
                    m.machine_id::text as machine_id,
                    m.machine_name,
                    m.workshop_name,
                    m.machine_status_id::text as machine_status_id,
                    ms.machine_status_name,
                    m.machine_use_status_id::text as machine_use_status_id,
                    mus.machine_use_status_name,
                    mus.is_decommissioned as machine_use_is_decommissioned,
                    true as qr_is_assigned
                from app.machines m
                join app.machine_statuses ms on ms.machine_status_id = m.machine_status_id
                join app.machine_use_statuses mus on mus.machine_use_status_id = m.machine_use_status_id
            ) machine_row
        ),
        'machine_use_statuses', (
            select coalesce(jsonb_agg(to_jsonb(use_status_row) order by use_status_row.machine_use_status_id), '[]'::jsonb)
            from (
                select
                    mus.machine_use_status_id::text as machine_use_status_id,
                    mus.machine_use_status_name,
                    mus.is_decommissioned,
                    mus.is_active
                from app.machine_use_statuses mus
            ) use_status_row
        ),
        'skus', (
            select coalesce(jsonb_agg(to_jsonb(sku_row) order by sku_row.sku_code, sku_row.sku_id), '[]'::jsonb)
            from (
                select
                    s.sku_id::text as sku_id,
                    s.sku_code,
                    s.sku_name,
                    s.sku_unit_id::text as sku_unit_id,
                    su.sku_unit_name,
                    s.planned_productivity_per_hour::text as planned_productivity_per_hour,
                    s.current_sku_tariff_uzs::text as current_sku_tariff_uzs,
                    s.is_active,
                    true as qr_is_assigned
                from app.skus s
                join app.sku_units su on su.sku_unit_id = s.sku_unit_id
            ) sku_row
        ),
        'sku_units', (
            select coalesce(jsonb_agg(to_jsonb(unit_row) order by unit_row.sku_unit_id), '[]'::jsonb)
            from (
                select
                    su.sku_unit_id::text as sku_unit_id,
                    su.sku_unit_name,
                    su.allows_fractional_quantity,
                    su.is_active
                from app.sku_units su
            ) unit_row
        ),
        'additional_work_types', (
            select coalesce(jsonb_agg(to_jsonb(work_type_row) order by work_type_row.additional_work_type_name, work_type_row.additional_work_type_id), '[]'::jsonb)
            from (
                select
                    awt.additional_work_type_id::text as additional_work_type_id,
                    awt.additional_work_type_name,
                    awt.is_active
                from app.additional_work_types awt
            ) work_type_row
        ),
        'activity_profiles', (
            select coalesce(jsonb_agg(to_jsonb(profile_row) order by profile_row.activity_class, profile_row.profile_name, profile_row.profile_id), '[]'::jsonb)
            from (
                select
                    'BREAK'::text as activity_class,
                    obp.operator_break_behavior_profile_id::text as profile_id,
                    obp.technical_code,
                    obp.profile_name,
                    obp.is_active
                from app.operator_break_behavior_profiles obp
                union all
                select
                    mdp.downtime_class as activity_class,
                    mdp.machine_downtime_behavior_profile_id::text as profile_id,
                    mdp.technical_code,
                    mdp.profile_name,
                    mdp.is_active
                from app.machine_downtime_behavior_profiles mdp
            ) profile_row
        ),
        'activity_types', (
            select coalesce(jsonb_agg(to_jsonb(activity_row) order by activity_row.activity_class, activity_row.display_order, activity_row.display_name, activity_row.activity_type_id), '[]'::jsonb)
            from (
                select
                    'BREAK'::text as activity_class,
                    obt.operator_break_type_id::text as activity_type_id,
                    obt.technical_code,
                    obt.operator_break_type_name as display_name,
                    obt.display_order,
                    obt.operator_break_behavior_profile_id::text as profile_id,
                    obp.profile_name,
                    obt.is_active
                from app.operator_break_types obt
                join app.operator_break_behavior_profiles obp
                  on obp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
                union all
                select
                    mdt.downtime_class as activity_class,
                    mdt.machine_downtime_type_id::text as activity_type_id,
                    mdt.technical_code,
                    mdt.machine_downtime_type_name as display_name,
                    mdt.display_order,
                    mdt.machine_downtime_behavior_profile_id::text as profile_id,
                    mdp.profile_name,
                    mdt.is_active
                from app.machine_downtime_types mdt
                join app.machine_downtime_behavior_profiles mdp
                  on mdp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
            ) activity_row
        ),
        'audit_events', (
            select coalesce(jsonb_agg(to_jsonb(audit_row) order by audit_row.created_at desc, audit_row.audit_event_id desc), '[]'::jsonb)
            from (
                select
                    ae.audit_event_id::text as audit_event_id,
                    ae.action_name,
                    ae.entity_table_name,
                    ae.entity_record_id::text as entity_record_id,
                    e.full_name as actor_full_name,
                    ae.reason,
                    ae.created_at
                from app.audit_events ae
                join app.employees e on e.employee_id = ae.actor_employee_id
                order by ae.created_at desc, ae.audit_event_id desc
                limit 100
            ) audit_row
        )
    );
end;
$$;

comment on function app.read_admin_directory(text)
    is 'runtime_api: returns bounded safe administrative directory projections through a valid admin session without raw QR tokens or audit payloads.';

create or replace function app._require_admin_session_actor(
    p_session_token_hash text
)
returns bigint
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_session jsonb;
begin
    v_session := app.resolve_admin_session(p_session_token_hash);
    if v_session is null then
        raise exception 'administrative session is unavailable' using errcode = '42501';
    end if;
    if coalesce((v_session ->> 'must_change_password')::boolean, false) then
        raise exception 'password change is required' using errcode = '42501';
    end if;
    return (v_session ->> 'employee_id')::bigint;
end;
$$;

comment on function app._require_admin_session_actor(text)
    is 'internal_helper: resolves one current admin session and returns its attributable employee actor after password replacement.';

create or replace function app.prepare_admin_qr_label(
    p_session_token_hash text,
    p_resource_kind text,
    p_resource_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_kind text;
    v_title text;
    v_subtitle text;
    v_payload text;
    v_entity_table text;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_kind := upper(btrim(coalesce(p_resource_kind, '')));

    if v_kind = 'MACHINE' then
        select
            m.machine_name,
            null::text,
            'peaks-machine:v1:' || m.machine_qr_token,
            'machines'
        into v_title, v_subtitle, v_payload, v_entity_table
        from app.machines m
        where m.machine_id = p_resource_id;
    elsif v_kind = 'SKU' then
        select
            s.sku_code,
            coalesce(s.sku_name, s.sku_code),
            'peaks-sku:v1:' || s.sku_qr_token,
            'skus'
        into v_title, v_subtitle, v_payload, v_entity_table
        from app.skus s
        where s.sku_id = p_resource_id;
    else
        raise exception 'unsupported QR label resource kind' using errcode = '22023';
    end if;

    if not found then
        raise exception 'QR label resource not found' using errcode = 'P0001';
    end if;

    perform app._insert_audit_event(
        v_actor_employee_id,
        case when v_kind = 'MACHINE' then 'admin_download_machine_qr_label' else 'admin_download_sku_qr_label' end,
        v_entity_table,
        p_resource_id,
        null,
        jsonb_build_object('qr_label_generated', true),
        'Скачивание QR-ярлыка из административной панели'
    );

    return jsonb_build_object(
        'resource_kind', v_kind,
        'resource_id', p_resource_id::text,
        'title', v_title,
        'subtitle', v_subtitle,
        'payload', v_payload
    );
end;
$$;

comment on function app.prepare_admin_qr_label(text, text, bigint)
    is 'runtime_api: returns one protected QR payload only to the authenticated backend renderer and audits the download without storing the secret in audit data.';

create or replace function app.save_admin_employee(
    p_session_token_hash text,
    p_target_employee_id bigint,
    p_full_name text,
    p_phone_e164 text,
    p_position_id bigint,
    p_employee_status_id bigint,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_employee_id bigint;
    v_full_name text;
    v_phone_e164 text;
    v_reason text;
    v_status_allows_login boolean;
    v_before jsonb;
    v_after jsonb;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_full_name := app._assert_nonempty_text(p_full_name, 'p_full_name');
    v_phone_e164 := app._assert_nonempty_text(p_phone_e164, 'p_phone_e164');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');

    if v_phone_e164 !~ '^\+[0-9]{7,15}$' then
        raise exception 'phone must use E.164 format' using errcode = '22023';
    end if;
    if not exists (
        select 1 from app.positions p
        where p.position_id = p_position_id and p.is_active = true
    ) then
        raise exception 'active position is required' using errcode = '22023';
    end if;
    select es.is_active_for_login
    into v_status_allows_login
    from app.employee_statuses es
    where es.employee_status_id = p_employee_status_id
      and es.is_active = true;
    if not found then
        raise exception 'active employee status is required' using errcode = '22023';
    end if;

    if p_target_employee_id is null then
        insert into app.employees (
            full_name,
            phone_e164,
            position_id,
            employee_status_id
        )
        values (
            v_full_name,
            v_phone_e164,
            p_position_id,
            p_employee_status_id
        )
        returning employee_id into v_employee_id;

        v_after := jsonb_build_object(
            'employee_id', v_employee_id,
            'full_name', v_full_name,
            'phone_e164', v_phone_e164,
            'position_id', p_position_id,
            'employee_status_id', p_employee_status_id
        );
        perform app._insert_audit_event(
            v_actor_employee_id,
            'admin_create_employee',
            'employees',
            v_employee_id,
            null,
            v_after,
            v_reason
        );
        return jsonb_build_object('employee_id', v_employee_id::text, 'created', true);
    end if;

    select jsonb_build_object(
        'employee_id', e.employee_id,
        'full_name', e.full_name,
        'phone_e164', e.phone_e164,
        'position_id', e.position_id,
        'employee_status_id', e.employee_status_id
    )
    into v_before
    from app.employees e
    where e.employee_id = p_target_employee_id
    for update;
    if not found then
        raise exception 'target employee not found' using errcode = 'P0001';
    end if;

    if not v_status_allows_login and exists (
        select 1 from app.employee_shifts esh
        where esh.employee_id = p_target_employee_id and esh.is_open = true
        union all
        select 1 from app.production_operations po
        where po.employee_id = p_target_employee_id and po.is_open = true
        union all
        select 1 from app.operator_breaks ob
        where ob.employee_id = p_target_employee_id and ob.is_open = true
        union all
        select 1 from app.additional_works aw
        where aw.employee_id = p_target_employee_id
          and aw.started_at is not null
          and aw.finished_at is null
          and aw.cancelled_at is null
    ) then
        raise exception 'open shift or work actions block inactive employee status transition'
            using errcode = 'P0001';
    end if;

    update app.employees e
    set
        full_name = v_full_name,
        phone_e164 = v_phone_e164,
        position_id = p_position_id,
        employee_status_id = p_employee_status_id,
        updated_at = now()
    where e.employee_id = p_target_employee_id;

    v_after := jsonb_build_object(
        'employee_id', p_target_employee_id,
        'full_name', v_full_name,
        'phone_e164', v_phone_e164,
        'position_id', p_position_id,
        'employee_status_id', p_employee_status_id
    );
    if v_before is distinct from v_after then
        perform app._insert_audit_event(
            v_actor_employee_id,
            'admin_update_employee',
            'employees',
            p_target_employee_id,
            v_before,
            v_after,
            v_reason
        );
    end if;
    return jsonb_build_object('employee_id', p_target_employee_id::text, 'created', false);
end;
$$;

comment on function app.save_admin_employee(text, bigint, text, text, bigint, bigint, text)
    is 'runtime_api: creates or updates the approved employee fields through an attributable admin session and audit.';

create or replace function app.save_admin_position(
    p_session_token_hash text,
    p_position_id bigint,
    p_position_name text,
    p_position_description text,
    p_is_production_position boolean,
    p_is_active boolean,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_position_id bigint;
    v_name text;
    v_description text;
    v_reason text;
    v_before jsonb;
    v_after jsonb;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_name := app._assert_nonempty_text(p_position_name, 'p_position_name');
    v_description := nullif(btrim(p_position_description), '');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    if p_is_production_position is null or p_is_active is null then
        raise exception 'position flags are required' using errcode = '22023';
    end if;

    if p_position_id is null then
        insert into app.positions (
            position_name,
            position_description,
            is_production_position,
            is_active
        )
        values (v_name, v_description, p_is_production_position, p_is_active)
        returning position_id into v_position_id;
        v_after := jsonb_build_object(
            'position_id', v_position_id,
            'position_name', v_name,
            'position_description', v_description,
            'is_production_position', p_is_production_position,
            'is_active', p_is_active
        );
        perform app._insert_audit_event(
            v_actor_employee_id,
            'admin_create_position',
            'positions',
            v_position_id,
            null,
            v_after,
            v_reason
        );
        return jsonb_build_object('position_id', v_position_id::text, 'created', true);
    end if;

    select to_jsonb(p)
    into v_before
    from app.positions p
    where p.position_id = p_position_id
    for update;
    if not found then
        raise exception 'position not found' using errcode = 'P0001';
    end if;
    if not p_is_active and exists (
        select 1
        from app.employees e
        join app.employee_statuses es on es.employee_status_id = e.employee_status_id
        where e.position_id = p_position_id
          and es.is_active = true
          and es.is_active_for_login = true
    ) then
        raise exception 'active employees block position deactivation' using errcode = 'P0001';
    end if;

    update app.positions p
    set
        position_name = v_name,
        position_description = v_description,
        is_production_position = p_is_production_position,
        is_active = p_is_active,
        updated_at = now()
    where p.position_id = p_position_id
    returning to_jsonb(p) into v_after;

    if v_before is distinct from v_after then
        perform app._insert_audit_event(
            v_actor_employee_id,
            'admin_update_position',
            'positions',
            p_position_id,
            v_before - array['created_at', 'updated_at'],
            v_after - array['created_at', 'updated_at'],
            v_reason
        );
    end if;
    return jsonb_build_object('position_id', p_position_id::text, 'created', false);
end;
$$;

comment on function app.save_admin_position(text, bigint, text, text, boolean, boolean, text)
    is 'runtime_api: creates or updates a position through an attributable admin session with active-employee deactivation guard and audit.';

create or replace function app.save_admin_machine(
    p_session_token_hash text,
    p_machine_id bigint,
    p_machine_name text,
    p_workshop_name text,
    p_machine_use_status_id bigint,
    p_new_machine_qr_token text,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_machine_id bigint;
    v_name text;
    v_workshop text;
    v_new_token text;
    v_reason text;
    v_use_is_decommissioned boolean;
    v_before jsonb;
    v_after jsonb;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_name := app._assert_nonempty_text(p_machine_name, 'p_machine_name');
    v_workshop := nullif(btrim(p_workshop_name), '');
    v_new_token := nullif(btrim(p_new_machine_qr_token), '');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    if v_new_token is not null and v_new_token !~ '^[A-Za-z0-9_-]{32}$' then
        raise exception 'machine QR token must contain exactly 32 base64url characters'
            using errcode = '22023';
    end if;

    select mus.is_decommissioned
    into v_use_is_decommissioned
    from app.machine_use_statuses mus
    where mus.machine_use_status_id = p_machine_use_status_id
      and mus.is_active = true;
    if not found then
        raise exception 'active machine use status is required' using errcode = '22023';
    end if;

    if p_machine_id is null then
        if v_new_token is null then
            raise exception 'new machine requires a QR token' using errcode = '22023';
        end if;
        insert into app.machines (
            machine_name,
            workshop_name,
            machine_qr_token,
            machine_status_id,
            machine_use_status_id
        )
        values (
            v_name,
            v_workshop,
            v_new_token,
            app._get_machine_status_available_for_start_id(),
            p_machine_use_status_id
        )
        returning machine_id into v_machine_id;
        perform app._insert_audit_event(
            v_actor_employee_id,
            'admin_create_machine',
            'machines',
            v_machine_id,
            null,
            jsonb_build_object(
                'machine_id', v_machine_id,
                'machine_name', v_name,
                'workshop_name', v_workshop,
                'machine_use_status_id', p_machine_use_status_id,
                'machine_qr_token_assigned', true
            ),
            v_reason
        );
        return jsonb_build_object('machine_id', v_machine_id::text, 'created', true, 'qr_rotated', true);
    end if;

    select jsonb_build_object(
        'machine_id', m.machine_id,
        'machine_name', m.machine_name,
        'workshop_name', m.workshop_name,
        'machine_use_status_id', m.machine_use_status_id,
        'machine_qr_token_present', true,
        'machine_qr_token_length', length(m.machine_qr_token)
    )
    into v_before
    from app.machines m
    where m.machine_id = p_machine_id
    for update;
    if not found then
        raise exception 'machine not found' using errcode = 'P0001';
    end if;
    if v_use_is_decommissioned and exists (
        select 1 from app.production_operations po
        where po.machine_id = p_machine_id and po.is_open = true
        union all
        select 1 from app.machine_downtimes md
        where md.machine_id = p_machine_id and md.is_open = true
    ) then
        raise exception 'open production or downtime blocks machine decommissioning'
            using errcode = 'P0001';
    end if;

    update app.machines m
    set
        machine_name = v_name,
        workshop_name = v_workshop,
        machine_use_status_id = p_machine_use_status_id,
        machine_qr_token = coalesce(v_new_token, m.machine_qr_token),
        updated_at = now()
    where m.machine_id = p_machine_id;

    v_after := jsonb_build_object(
        'machine_id', p_machine_id,
        'machine_name', v_name,
        'workshop_name', v_workshop,
        'machine_use_status_id', p_machine_use_status_id,
        'machine_qr_token_present', true,
        'machine_qr_token_length', coalesce(length(v_new_token), (v_before ->> 'machine_qr_token_length')::integer),
        'machine_qr_token_rotated', v_new_token is not null
    );
    perform app._insert_audit_event(
        v_actor_employee_id,
        'admin_update_machine',
        'machines',
        p_machine_id,
        v_before,
        v_after,
        v_reason
    );
    return jsonb_build_object('machine_id', p_machine_id::text, 'created', false, 'qr_rotated', v_new_token is not null);
end;
$$;

comment on function app.save_admin_machine(text, bigint, text, text, bigint, text, text)
    is 'runtime_api: creates or updates approved machine fields and optionally rotates a redacted QR token through an attributable admin session.';

create or replace function app.save_admin_sku(
    p_session_token_hash text,
    p_sku_id bigint,
    p_sku_code text,
    p_sku_name text,
    p_sku_unit_id bigint,
    p_planned_productivity_per_hour numeric,
    p_current_sku_tariff_uzs numeric,
    p_is_active boolean,
    p_new_sku_qr_token text,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_sku_id bigint;
    v_code text;
    v_name text;
    v_new_token text;
    v_reason text;
    v_before jsonb;
    v_after jsonb;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_code := app._assert_nonempty_text(p_sku_code, 'p_sku_code');
    v_name := nullif(btrim(p_sku_name), '');
    v_new_token := nullif(btrim(p_new_sku_qr_token), '');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    if p_planned_productivity_per_hour is not null and p_planned_productivity_per_hour <= 0 then
        raise exception 'planned productivity must be positive' using errcode = '22023';
    end if;
    if p_current_sku_tariff_uzs is null or p_current_sku_tariff_uzs < 0 then
        raise exception 'SKU tariff must be non-negative' using errcode = '22023';
    end if;
    if p_is_active is null then
        raise exception 'SKU active flag is required' using errcode = '22023';
    end if;
    if v_new_token is not null and v_new_token !~ '^[A-Za-z0-9_-]{32}$' then
        raise exception 'SKU QR token must contain exactly 32 base64url characters'
            using errcode = '22023';
    end if;
    if not exists (
        select 1 from app.sku_units su
        where su.sku_unit_id = p_sku_unit_id and su.is_active = true
    ) then
        raise exception 'active SKU unit is required' using errcode = '22023';
    end if;

    if p_sku_id is null then
        if v_new_token is null then
            raise exception 'new SKU requires a QR token' using errcode = '22023';
        end if;
        insert into app.skus (
            sku_code,
            sku_name,
            sku_qr_token,
            sku_unit_id,
            planned_productivity_per_hour,
            current_sku_tariff_uzs,
            is_active
        )
        values (
            v_code,
            v_name,
            v_new_token,
            p_sku_unit_id,
            p_planned_productivity_per_hour,
            p_current_sku_tariff_uzs,
            p_is_active
        )
        returning sku_id into v_sku_id;
        perform app._insert_audit_event(
            v_actor_employee_id,
            'admin_create_sku',
            'skus',
            v_sku_id,
            null,
            jsonb_build_object(
                'sku_id', v_sku_id,
                'sku_code', v_code,
                'sku_name', v_name,
                'sku_unit_id', p_sku_unit_id,
                'planned_productivity_per_hour', p_planned_productivity_per_hour,
                'current_sku_tariff_uzs', p_current_sku_tariff_uzs,
                'is_active', p_is_active,
                'sku_qr_token_assigned', true
            ),
            v_reason
        );
        return jsonb_build_object('sku_id', v_sku_id::text, 'created', true, 'qr_rotated', true);
    end if;

    select jsonb_build_object(
        'sku_id', s.sku_id,
        'sku_code', s.sku_code,
        'sku_name', s.sku_name,
        'sku_unit_id', s.sku_unit_id,
        'planned_productivity_per_hour', s.planned_productivity_per_hour,
        'current_sku_tariff_uzs', s.current_sku_tariff_uzs,
        'is_active', s.is_active,
        'sku_qr_token_present', true,
        'sku_qr_token_length', length(s.sku_qr_token)
    )
    into v_before
    from app.skus s
    where s.sku_id = p_sku_id
    for update;
    if not found then
        raise exception 'SKU not found' using errcode = 'P0001';
    end if;
    if not p_is_active and exists (
        select 1 from app.production_operations po
        where po.sku_id = p_sku_id and po.is_open = true
    ) then
        raise exception 'open production blocks SKU deactivation' using errcode = 'P0001';
    end if;

    update app.skus s
    set
        sku_code = v_code,
        sku_name = v_name,
        sku_unit_id = p_sku_unit_id,
        planned_productivity_per_hour = p_planned_productivity_per_hour,
        current_sku_tariff_uzs = p_current_sku_tariff_uzs,
        is_active = p_is_active,
        sku_qr_token = coalesce(v_new_token, s.sku_qr_token),
        updated_at = now()
    where s.sku_id = p_sku_id;

    v_after := jsonb_build_object(
        'sku_id', p_sku_id,
        'sku_code', v_code,
        'sku_name', v_name,
        'sku_unit_id', p_sku_unit_id,
        'planned_productivity_per_hour', p_planned_productivity_per_hour,
        'current_sku_tariff_uzs', p_current_sku_tariff_uzs,
        'is_active', p_is_active,
        'sku_qr_token_present', true,
        'sku_qr_token_length', coalesce(length(v_new_token), (v_before ->> 'sku_qr_token_length')::integer),
        'sku_qr_token_rotated', v_new_token is not null
    );
    perform app._insert_audit_event(
        v_actor_employee_id,
        'admin_update_sku',
        'skus',
        p_sku_id,
        v_before,
        v_after,
        v_reason
    );
    return jsonb_build_object('sku_id', p_sku_id::text, 'created', false, 'qr_rotated', v_new_token is not null);
end;
$$;

comment on function app.save_admin_sku(text, bigint, text, text, bigint, numeric, numeric, boolean, text, text)
    is 'runtime_api: creates or updates approved SKU fields and optionally rotates a redacted QR token without rewriting historical salary entries.';

create or replace function app.save_admin_additional_work_type(
    p_session_token_hash text,
    p_additional_work_type_id bigint,
    p_additional_work_type_name text,
    p_is_active boolean,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_type_id bigint;
    v_name text;
    v_reason text;
    v_before jsonb;
    v_after jsonb;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_name := app._assert_nonempty_text(p_additional_work_type_name, 'p_additional_work_type_name');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    if p_is_active is null then
        raise exception 'additional work active flag is required' using errcode = '22023';
    end if;

    if p_additional_work_type_id is null then
        insert into app.additional_work_types (additional_work_type_name, is_active)
        values (v_name, p_is_active)
        returning additional_work_type_id into v_type_id;
        perform app._insert_audit_event(
            v_actor_employee_id,
            'admin_create_additional_work_type',
            'additional_work_types',
            v_type_id,
            null,
            jsonb_build_object(
                'additional_work_type_id', v_type_id,
                'additional_work_type_name', v_name,
                'is_active', p_is_active
            ),
            v_reason
        );
        return jsonb_build_object('additional_work_type_id', v_type_id::text, 'created', true);
    end if;

    select to_jsonb(awt)
    into v_before
    from app.additional_work_types awt
    where awt.additional_work_type_id = p_additional_work_type_id
    for update;
    if not found then
        raise exception 'additional work type not found' using errcode = 'P0001';
    end if;
    if not p_is_active and exists (
        select 1 from app.additional_works aw
        where aw.additional_work_type_id = p_additional_work_type_id
          and aw.finished_at is null
          and aw.cancelled_at is null
    ) then
        raise exception 'unfinished additional work blocks type deactivation' using errcode = 'P0001';
    end if;

    update app.additional_work_types awt
    set additional_work_type_name = v_name,
        is_active = p_is_active,
        updated_at = now()
    where awt.additional_work_type_id = p_additional_work_type_id
    returning to_jsonb(awt) into v_after;
    if v_before is distinct from v_after then
        perform app._insert_audit_event(
            v_actor_employee_id,
            'admin_update_additional_work_type',
            'additional_work_types',
            p_additional_work_type_id,
            v_before - array['created_at', 'updated_at'],
            v_after - array['created_at', 'updated_at'],
            v_reason
        );
    end if;
    return jsonb_build_object('additional_work_type_id', p_additional_work_type_id::text, 'created', false);
end;
$$;

comment on function app.save_admin_additional_work_type(text, bigint, text, boolean, text)
    is 'runtime_api: creates, renames, activates, or safely deactivates an additional-work type through an attributable admin session.';

create or replace function app.create_admin_activity_type(
    p_session_token_hash text,
    p_activity_class text,
    p_technical_code text,
    p_display_name text,
    p_display_order integer,
    p_profile_id bigint,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_class text;
    v_code text;
    v_code_base text;
    v_code_suffix text;
    v_class_suffix text;
    v_name text;
    v_reason text;
    v_type_id bigint;
    v_display_order integer;
    v_sequence integer;
    v_source text;
    v_target text;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_class := upper(btrim(coalesce(p_activity_class, '')));
    v_name := app._assert_nonempty_text(p_display_name, 'p_display_name');
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    if v_class not in ('BREAK', 'OPERATIONAL', 'CRITICAL') then
        raise exception 'unsupported activity class' using errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('admin_activity_order:' || v_class, 0)
    );

    if p_technical_code is null then
        v_code := lower(v_name);
        for v_source, v_target in
            select source_letter, target_letters
            from (values
                ('А', 'a'), ('Б', 'b'), ('В', 'v'), ('Г', 'g'), ('Д', 'd'),
                ('Е', 'e'), ('Ё', 'yo'), ('Ж', 'zh'), ('З', 'z'), ('И', 'i'),
                ('Й', 'y'), ('К', 'k'), ('Л', 'l'), ('М', 'm'), ('Н', 'n'),
                ('О', 'o'), ('П', 'p'), ('Р', 'r'), ('С', 's'), ('Т', 't'),
                ('У', 'u'), ('Ф', 'f'), ('Х', 'kh'), ('Ц', 'ts'), ('Ч', 'ch'),
                ('Ш', 'sh'), ('Щ', 'shch'), ('Ъ', ''), ('Ы', 'y'), ('Ь', ''),
                ('Э', 'e'), ('Ю', 'yu'), ('Я', 'ya'),
                ('а', 'a'), ('б', 'b'), ('в', 'v'), ('г', 'g'), ('д', 'd'),
                ('е', 'e'), ('ё', 'yo'), ('ж', 'zh'), ('з', 'z'), ('и', 'i'),
                ('й', 'y'), ('к', 'k'), ('л', 'l'), ('м', 'm'), ('н', 'n'),
                ('о', 'o'), ('п', 'p'), ('р', 'r'), ('с', 's'), ('т', 't'),
                ('у', 'u'), ('ф', 'f'), ('х', 'kh'), ('ц', 'ts'), ('ч', 'ch'),
                ('ш', 'sh'), ('щ', 'shch'), ('ъ', ''), ('ы', 'y'), ('ь', ''),
                ('э', 'e'), ('ю', 'yu'), ('я', 'ya')
            ) transliteration(source_letter, target_letters)
        loop
            v_code := replace(v_code, v_source, v_target);
        end loop;
        v_code := btrim(regexp_replace(v_code, '[^a-z0-9]+', '_', 'g'), '_');
        if v_code = '' then
            v_code := 'activity';
        elsif v_code ~ '^[0-9]' then
            v_code := 'activity_' || v_code;
        end if;

        if exists (
            select 1
            from app.operator_break_types obt
            where v_class <> 'BREAK'
              and (
                  obt.operator_break_type_name = v_name
                  or lower(obt.operator_break_type_name) = lower(v_name)
              )
            union all
            select 1
            from app.machine_downtime_types mdt
            where mdt.downtime_class <> v_class
              and (
                  mdt.machine_downtime_type_name = v_name
                  or lower(mdt.machine_downtime_type_name) = lower(v_name)
              )
        ) then
            v_class_suffix := case v_class
                when 'BREAK' then '_pereryv'
                when 'OPERATIONAL' then '_operatsionnyy_prostoy'
                else '_kriticheskiy_prostoy'
            end;
            v_code := left(v_code, 100 - length(v_class_suffix)) || v_class_suffix;
        end if;

        v_code_base := left(v_code, 100);
        v_code := v_code_base;
        v_sequence := 1;
        while exists (
            select 1 from app.operator_break_types obt where obt.technical_code = v_code
            union all
            select 1 from app.machine_downtime_types mdt where mdt.technical_code = v_code
        ) loop
            v_sequence := v_sequence + 1;
            v_code_suffix := '_' || v_sequence::text;
            v_code := left(v_code_base, 100 - length(v_code_suffix)) || v_code_suffix;
        end loop;
    else
        v_code := app._assert_dictionary_technical_code(p_technical_code, 'p_technical_code');
    end if;

    if p_display_order is null then
        if v_class = 'BREAK' then
            select coalesce(max(obt.display_order), 0) + 10
            into v_display_order
            from app.operator_break_types obt
            where obt.is_active = true;
        else
            select coalesce(max(mdt.display_order), 0) + 10
            into v_display_order
            from app.machine_downtime_types mdt
            where mdt.downtime_class = v_class
              and mdt.is_active = true;
        end if;
    elsif p_display_order < 0 then
        raise exception 'display order must be a non-negative integer' using errcode = '22023';
    else
        v_display_order := p_display_order;
    end if;

    if v_class = 'BREAK' then
        perform 1
        from app.operator_break_behavior_profiles obp
        where obp.operator_break_behavior_profile_id = p_profile_id
          and obp.is_active = true
        for update;
        if not found then
            raise exception 'active break profile is required' using errcode = '22023';
        end if;
        insert into app.operator_break_types (
            technical_code,
            operator_break_type_name,
            display_order,
            operator_break_behavior_profile_id,
            is_active
        ) values (v_code, v_name, v_display_order, p_profile_id, true)
        returning operator_break_type_id into v_type_id;
    else
        perform 1
        from app.machine_downtime_behavior_profiles mdp
        where mdp.machine_downtime_behavior_profile_id = p_profile_id
          and mdp.downtime_class = v_class
          and mdp.is_active = true
        for update;
        if not found then
            raise exception 'active compatible downtime profile is required' using errcode = '22023';
        end if;

        insert into app.machine_downtime_types (
            technical_code,
            machine_downtime_type_name,
            display_order,
            downtime_class,
            machine_downtime_behavior_profile_id,
            is_active
        ) values (v_code, v_name, v_display_order, v_class, p_profile_id, true)
        returning machine_downtime_type_id into v_type_id;
    end if;

    perform app._insert_audit_event(
        v_actor_employee_id,
        'admin_create_activity_type',
        case when v_class = 'BREAK' then 'operator_break_types' else 'machine_downtime_types' end,
        v_type_id,
        null,
        jsonb_build_object(
            'activity_class', v_class,
            'technical_code', v_code,
            'display_name', v_name,
            'display_order', v_display_order,
            'profile_id', p_profile_id,
            'is_active', true
        ),
        v_reason
    );
    return jsonb_build_object(
        'activity_type_id', v_type_id::text,
        'activity_class', v_class,
        'technical_code', v_code,
        'display_order', v_display_order
    );
end;
$$;

comment on function app.create_admin_activity_type(text, text, text, text, integer, bigint, text)
    is 'runtime_api: creates a break or downtime type from an accepted active profile, generating technical code and final display position when omitted.';

create or replace function app.move_admin_activity_type(
    p_session_token_hash text,
    p_activity_class text,
    p_activity_type_id bigint,
    p_direction text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_class text;
    v_direction text;
    v_ids bigint[];
    v_index integer;
    v_target_index integer;
    v_swap_id bigint;
    v_before_order integer;
    v_after_order integer;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_class := upper(btrim(coalesce(p_activity_class, '')));
    v_direction := upper(btrim(coalesce(p_direction, '')));
    if v_class not in ('BREAK', 'OPERATIONAL', 'CRITICAL') then
        raise exception 'unsupported activity class' using errcode = '22023';
    end if;
    if v_direction not in ('UP', 'DOWN') then
        raise exception 'unsupported move direction' using errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('admin_activity_order:' || v_class, 0)
    );

    if v_class = 'BREAK' then
        select array_agg(obt.operator_break_type_id order by obt.display_order, obt.operator_break_type_id)
        into v_ids
        from app.operator_break_types obt
        where obt.is_active = true;
    else
        select array_agg(mdt.machine_downtime_type_id order by mdt.display_order, mdt.machine_downtime_type_id)
        into v_ids
        from app.machine_downtime_types mdt
        where mdt.downtime_class = v_class
          and mdt.is_active = true;
    end if;

    v_index := array_position(v_ids, p_activity_type_id);
    if v_index is null then
        raise exception 'active activity type not found in class' using errcode = 'P0001';
    end if;
    v_target_index := v_index + case when v_direction = 'UP' then -1 else 1 end;
    if v_target_index < 1 or v_target_index > coalesce(array_length(v_ids, 1), 0) then
        return jsonb_build_object(
            'activity_type_id', p_activity_type_id::text,
            'activity_class', v_class,
            'moved', false
        );
    end if;

    if v_class = 'BREAK' then
        select obt.display_order into strict v_before_order
        from app.operator_break_types obt
        where obt.operator_break_type_id = p_activity_type_id
        for update;
    else
        select mdt.display_order into strict v_before_order
        from app.machine_downtime_types mdt
        where mdt.machine_downtime_type_id = p_activity_type_id
          and mdt.downtime_class = v_class
        for update;
    end if;

    v_swap_id := v_ids[v_target_index];
    v_ids[v_target_index] := p_activity_type_id;
    v_ids[v_index] := v_swap_id;

    if v_class = 'BREAK' then
        update app.operator_break_types obt
        set display_order = ordered.position::integer * 10,
            updated_at = now()
        from unnest(v_ids) with ordinality as ordered(activity_type_id, position)
        where obt.operator_break_type_id = ordered.activity_type_id;
    else
        update app.machine_downtime_types mdt
        set display_order = ordered.position::integer * 10,
            updated_at = now()
        from unnest(v_ids) with ordinality as ordered(activity_type_id, position)
        where mdt.machine_downtime_type_id = ordered.activity_type_id
          and mdt.downtime_class = v_class;
    end if;

    v_after_order := v_target_index * 10;
    perform app._insert_audit_event(
        v_actor_employee_id,
        'admin_move_activity_type',
        case when v_class = 'BREAK' then 'operator_break_types' else 'machine_downtime_types' end,
        p_activity_type_id,
        jsonb_build_object('activity_class', v_class, 'display_order', v_before_order),
        jsonb_build_object('activity_class', v_class, 'display_order', v_after_order, 'direction', v_direction),
        'Изменение порядка показа через административную панель'
    );

    return jsonb_build_object(
        'activity_type_id', p_activity_type_id::text,
        'activity_class', v_class,
        'moved', true,
        'display_order', v_after_order
    );
end;
$$;

comment on function app.move_admin_activity_type(text, text, bigint, text)
    is 'runtime_api: atomically moves an active break or downtime type within its class and audits the resulting Mini App display order.';

create or replace function app.deactivate_admin_activity_type(
    p_session_token_hash text,
    p_activity_class text,
    p_activity_type_id bigint,
    p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = app, pg_catalog
as $$
declare
    v_actor_employee_id bigint;
    v_class text;
    v_reason text;
    v_before jsonb;
begin
    v_actor_employee_id := app._require_admin_session_actor(p_session_token_hash);
    v_class := upper(btrim(coalesce(p_activity_class, '')));
    v_reason := app._assert_nonempty_text(p_reason, 'p_reason');
    if v_class not in ('BREAK', 'OPERATIONAL', 'CRITICAL') then
        raise exception 'unsupported activity class' using errcode = '22023';
    end if;

    if v_class = 'BREAK' then
        select to_jsonb(obt)
        into v_before
        from app.operator_break_types obt
        where obt.operator_break_type_id = p_activity_type_id
          and obt.is_active = true
        for update;
        if not found then
            raise exception 'active break type not found' using errcode = 'P0001';
        end if;
        if exists (
            select 1 from app.operator_breaks ob
            where ob.operator_break_type_id = p_activity_type_id and ob.is_open = true
        ) then
            raise exception 'open break blocks type deactivation' using errcode = 'P0001';
        end if;
        update app.operator_break_types
        set is_active = false, updated_at = now()
        where operator_break_type_id = p_activity_type_id;
    else
        select to_jsonb(mdt)
        into v_before
        from app.machine_downtime_types mdt
        where mdt.machine_downtime_type_id = p_activity_type_id
          and mdt.downtime_class = v_class
          and mdt.is_active = true
        for update;
        if not found then
            raise exception 'active downtime type not found' using errcode = 'P0001';
        end if;
        if exists (
            select 1 from app.machine_downtimes md
            where md.machine_downtime_type_id = p_activity_type_id and md.is_open = true
        ) then
            raise exception 'open downtime blocks type deactivation' using errcode = 'P0001';
        end if;
        update app.machine_downtime_types
        set is_active = false, updated_at = now()
        where machine_downtime_type_id = p_activity_type_id;
    end if;

    perform app._insert_audit_event(
        v_actor_employee_id,
        'admin_deactivate_activity_type',
        case when v_class = 'BREAK' then 'operator_break_types' else 'machine_downtime_types' end,
        p_activity_type_id,
        v_before,
        v_before || jsonb_build_object('is_active', false),
        v_reason
    );
    return jsonb_build_object('activity_type_id', p_activity_type_id::text, 'activity_class', v_class, 'is_active', false);
end;
$$;

comment on function app.deactivate_admin_activity_type(text, text, bigint, text)
    is 'runtime_api: safely deactivates a break or downtime type through an attributable admin session while preserving history.';

-- END administrative web authentication foundation
