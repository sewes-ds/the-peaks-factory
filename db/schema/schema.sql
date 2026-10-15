-- schema.sql assembled from accepted WP fragments.

-- Canonical public database baseline.


-- BEGIN db/schema/_work/wp_01_foundation_identity_access/ddl.sql

create schema if not exists app;

create table app.positions (
    position_id bigint generated always as identity primary key,
    position_name text not null,
    position_description text null,
    is_production_position boolean not null default true,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint positions_position_name_uniq unique (position_name)
);

create table app.employee_statuses (
    employee_status_id bigint generated always as identity primary key,
    employee_status_name text not null,
    is_active_for_login boolean not null default false,
    is_final boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint employee_statuses_employee_status_name_uniq unique (employee_status_name)
);

create table app.machine_statuses (
    machine_status_id bigint generated always as identity primary key,
    machine_status_name text not null,
    is_available_for_start boolean not null default false,
    is_running_status boolean not null default false,
    is_downtime_status boolean not null default false,
    is_broken_status boolean not null default false,
    requires_attention boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint machine_statuses_machine_status_name_uniq unique (machine_status_name)
);

create unique index machine_statuses_one_active_available_for_start_idx
    on app.machine_statuses (is_available_for_start)
    where is_active = true and is_available_for_start = true;

create unique index machine_statuses_one_active_running_status_idx
    on app.machine_statuses (is_running_status)
    where is_active = true and is_running_status = true;

create unique index machine_statuses_one_active_broken_status_idx
    on app.machine_statuses (is_broken_status)
    where is_active = true and is_broken_status = true;

create unique index machine_statuses_one_active_non_broken_downtime_idx
    on app.machine_statuses (is_downtime_status, is_broken_status)
    where is_active = true and is_downtime_status = true and is_broken_status = false;

create table app.machine_use_statuses (
    machine_use_status_id bigint generated always as identity primary key,
    machine_use_status_name text not null,
    is_available_for_operations boolean not null default false,
    is_decommissioned boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint machine_use_statuses_machine_use_status_name_uniq unique (machine_use_status_name),
    constraint machine_use_statuses_active_exactly_one_semantic_flag_chk check (
        is_active = false
        or (
            is_available_for_operations::integer
            + is_decommissioned::integer
        ) = 1
    )
);

create unique index machine_use_statuses_one_active_available_for_operations_idx
    on app.machine_use_statuses (is_available_for_operations)
    where is_active = true and is_available_for_operations = true;

create unique index machine_use_statuses_one_active_decommissioned_idx
    on app.machine_use_statuses (is_decommissioned)
    where is_active = true and is_decommissioned = true;

create table app.sku_units (
    sku_unit_id bigint generated always as identity primary key,
    sku_unit_name text not null,
    allows_fractional_quantity boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sku_units_sku_unit_name_uniq unique (sku_unit_name)
);

create table app.production_operation_statuses (
    production_operation_status_id bigint generated always as identity primary key,
    production_operation_status_name text not null,
    is_open boolean not null default false,
    is_closed boolean not null default false,
    is_cancelled boolean not null default false,
    allows_salary_accrual boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint production_operation_statuses_production_operation_status_name_uniq unique (
        production_operation_status_name
    ),
    constraint production_operation_statuses_exactly_one_lifecycle_flag_chk check (
        (
            is_open::integer
            + is_closed::integer
            + is_cancelled::integer
        ) = 1
    )
);

create unique index production_operation_statuses_one_active_open_idx
    on app.production_operation_statuses (is_open)
    where is_active = true and is_open = true;

create unique index production_operation_statuses_one_active_closed_idx
    on app.production_operation_statuses (is_closed)
    where is_active = true and is_closed = true;

create unique index production_operation_statuses_one_active_cancelled_idx
    on app.production_operation_statuses (is_cancelled)
    where is_active = true and is_cancelled = true;

create table app.machine_downtime_behavior_profiles (
    machine_downtime_behavior_profile_id bigint generated always as identity primary key,
    technical_code text not null,
    profile_name text not null,
    downtime_class text not null,
    requires_production_operation boolean not null,
    operator_requires_start_comment boolean not null,
    privileged_actor_requires_start_reason boolean not null,
    blocks_production_finish boolean not null,
    blocks_shift_finish boolean not null,
    machine_status_effect text not null,
    ui_color_token text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint machine_downtime_behavior_profiles_technical_code_uniq unique (technical_code),
    constraint machine_downtime_behavior_profiles_id_class_uniq unique (
        machine_downtime_behavior_profile_id,
        downtime_class
    ),
    constraint machine_downtime_behavior_profiles_technical_code_chk check (
        technical_code ~ '^[a-z][a-z0-9_]*$'
    ),
    constraint machine_downtime_behavior_profiles_profile_name_chk check (
        trim(profile_name) <> ''
        and profile_name = trim(profile_name)
    ),
    constraint machine_downtime_behavior_profiles_class_chk check (
        downtime_class in ('OPERATIONAL', 'CRITICAL')
    ),
    constraint machine_downtime_behavior_profiles_status_effect_chk check (
        machine_status_effect in ('DOWNTIME', 'BROKEN')
    ),
    constraint machine_downtime_behavior_profiles_ui_color_chk check (
        ui_color_token in ('yellow', 'scarlet')
    ),
    constraint machine_downtime_behavior_profiles_class_compatibility_chk check (
        (
            downtime_class = 'OPERATIONAL'
            and requires_production_operation = true
            and operator_requires_start_comment = false
            and blocks_production_finish = true
            and blocks_shift_finish = true
            and machine_status_effect = 'DOWNTIME'
            and ui_color_token = 'yellow'
        )
        or (
            downtime_class = 'CRITICAL'
            and requires_production_operation = false
            and operator_requires_start_comment = true
            and blocks_production_finish = false
            and blocks_shift_finish = false
            and machine_status_effect in ('DOWNTIME', 'BROKEN')
            and ui_color_token = 'scarlet'
        )
    ),
    constraint machine_downtime_behavior_profiles_privileged_reason_chk check (
        privileged_actor_requires_start_reason = true
    )
);

create table app.machine_downtime_types (
    machine_downtime_type_id bigint generated always as identity primary key,
    technical_code text not null,
    machine_downtime_type_name text not null,
    display_order integer not null,
    downtime_class text not null,
    machine_downtime_behavior_profile_id bigint not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint machine_downtime_types_technical_code_uniq unique (technical_code),
    constraint machine_downtime_types_class_name_uniq unique (downtime_class, machine_downtime_type_name),
    constraint machine_downtime_types_technical_code_chk check (
        technical_code ~ '^[a-z][a-z0-9_]*$'
    ),
    constraint machine_downtime_types_name_chk check (
        trim(machine_downtime_type_name) <> ''
        and machine_downtime_type_name = trim(machine_downtime_type_name)
    ),
    constraint machine_downtime_types_display_order_chk check (display_order >= 0),
    constraint machine_downtime_types_class_chk check (
        downtime_class in ('OPERATIONAL', 'CRITICAL')
    ),
    constraint machine_downtime_types_profile_class_fk foreign key (
        machine_downtime_behavior_profile_id,
        downtime_class
    ) references app.machine_downtime_behavior_profiles (
        machine_downtime_behavior_profile_id,
        downtime_class
    )
);

create index machine_downtime_types_profile_id_idx
    on app.machine_downtime_types (machine_downtime_behavior_profile_id);

create index machine_downtime_types_active_class_order_idx
    on app.machine_downtime_types (downtime_class, display_order, machine_downtime_type_id)
    where is_active = true;

create table app.machine_downtime_profile_notification_rules (
    machine_downtime_profile_notification_rule_id bigint generated always as identity primary key,
    machine_downtime_behavior_profile_id bigint not null,
    technical_code text not null,
    threshold_minutes integer not null,
    recipient_permission_code text not null,
    notification_kind text not null,
    priority integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint machine_downtime_profile_notification_rules_profile_fk foreign key (
        machine_downtime_behavior_profile_id
    ) references app.machine_downtime_behavior_profiles (machine_downtime_behavior_profile_id),
    constraint machine_downtime_profile_notification_rules_profile_code_uniq unique (
        machine_downtime_behavior_profile_id,
        technical_code
    ),
    constraint machine_downtime_profile_notification_rules_code_chk check (
        technical_code ~ '^[a-z][a-z0-9_]*$'
    ),
    constraint machine_downtime_profile_notification_rules_threshold_chk check (
        threshold_minutes >= 0
        and (
            (notification_kind = 'TYPE_IMMEDIATE' and threshold_minutes = 0)
            or (notification_kind = 'ELAPSED_THRESHOLD' and threshold_minutes > 0)
        )
    ),
    constraint machine_downtime_profile_notification_rules_permission_chk check (
        recipient_permission_code in (
            'can_receive_production_notifications',
            'can_receive_director_notifications'
        )
    ),
    constraint machine_downtime_profile_notification_rules_kind_chk check (
        notification_kind in ('TYPE_IMMEDIATE', 'ELAPSED_THRESHOLD')
    ),
    constraint machine_downtime_profile_notification_rules_priority_chk check (priority >= 0)
);

create index machine_downtime_profile_notification_rules_profile_id_idx
    on app.machine_downtime_profile_notification_rules (machine_downtime_behavior_profile_id);

create index machine_downtime_profile_notification_rules_active_scan_idx
    on app.machine_downtime_profile_notification_rules (
        machine_downtime_behavior_profile_id,
        threshold_minutes,
        priority,
        machine_downtime_profile_notification_rule_id
    )
    where is_active = true;

create table app.operator_break_behavior_profiles (
    operator_break_behavior_profile_id bigint generated always as identity primary key,
    technical_code text not null,
    profile_name text not null,
    requires_open_shift boolean not null,
    allows_during_open_production boolean not null,
    blocks_production_start boolean not null,
    blocks_self_production_finish boolean not null,
    blocks_additional_work_start boolean not null,
    blocks_shift_finish boolean not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint operator_break_behavior_profiles_technical_code_uniq unique (technical_code),
    constraint operator_break_behavior_profiles_technical_code_chk check (
        technical_code ~ '^[a-z][a-z0-9_]*$'
    ),
    constraint operator_break_behavior_profiles_profile_name_chk check (
        trim(profile_name) <> ''
        and profile_name = trim(profile_name)
    ),
    constraint operator_break_behavior_profiles_requires_shift_chk check (
        requires_open_shift = true
        and allows_during_open_production = true
        and blocks_production_start = true
        and blocks_self_production_finish = true
        and blocks_additional_work_start = true
        and blocks_shift_finish = true
    )
);

create table app.operator_break_types (
    operator_break_type_id bigint generated always as identity primary key,
    technical_code text not null,
    operator_break_type_name text not null,
    display_order integer not null,
    operator_break_behavior_profile_id bigint not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint operator_break_types_technical_code_uniq unique (technical_code),
    constraint operator_break_types_operator_break_type_name_uniq unique (operator_break_type_name),
    constraint operator_break_types_technical_code_chk check (
        technical_code ~ '^[a-z][a-z0-9_]*$'
    ),
    constraint operator_break_types_name_chk check (
        trim(operator_break_type_name) <> ''
        and operator_break_type_name = trim(operator_break_type_name)
    ),
    constraint operator_break_types_display_order_chk check (display_order >= 0),
    constraint operator_break_types_profile_fk foreign key (operator_break_behavior_profile_id)
        references app.operator_break_behavior_profiles (operator_break_behavior_profile_id)
);

create index operator_break_types_profile_id_idx
    on app.operator_break_types (operator_break_behavior_profile_id);

create index operator_break_types_active_order_idx
    on app.operator_break_types (display_order, operator_break_type_id)
    where is_active = true;

create table app.additional_work_types (
    additional_work_type_id bigint generated always as identity primary key,
    additional_work_type_name text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint additional_work_types_additional_work_type_name_uniq unique (additional_work_type_name)
);

create table app.additional_work_approval_statuses (
    additional_work_approval_status_id bigint generated always as identity primary key,
    additional_work_approval_status_name text not null,
    is_pending boolean not null default false,
    is_approved boolean not null default false,
    is_rejected boolean not null default false,
    is_cancelled boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint additional_work_approval_statuses_name_uniq unique (additional_work_approval_status_name),
    constraint additional_work_approval_statuses_exactly_one_status_flag_chk check (
        (
            is_pending::integer
            + is_approved::integer
            + is_rejected::integer
            + is_cancelled::integer
        ) = 1
    )
);

create unique index additional_work_approval_statuses_one_active_pending_idx
    on app.additional_work_approval_statuses (is_pending)
    where is_active = true and is_pending = true;

create unique index additional_work_approval_statuses_one_active_approved_idx
    on app.additional_work_approval_statuses (is_approved)
    where is_active = true and is_approved = true;

create unique index additional_work_approval_statuses_one_active_rejected_idx
    on app.additional_work_approval_statuses (is_rejected)
    where is_active = true and is_rejected = true;

create unique index additional_work_approval_statuses_one_active_cancelled_idx
    on app.additional_work_approval_statuses (is_cancelled)
    where is_active = true and is_cancelled = true;

create table app.additional_work_accrual_statuses (
    additional_work_accrual_status_id bigint generated always as identity primary key,
    additional_work_accrual_status_name text not null,
    is_waiting_accrual boolean not null default false,
    is_accrued boolean not null default false,
    is_without_accrual boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint additional_work_accrual_statuses_name_uniq unique (additional_work_accrual_status_name),
    constraint additional_work_accrual_statuses_exactly_one_status_flag_chk check (
        (
            is_waiting_accrual::integer
            + is_accrued::integer
            + is_without_accrual::integer
        ) = 1
    )
);

create unique index additional_work_accrual_statuses_one_active_waiting_accrual_idx
    on app.additional_work_accrual_statuses (is_waiting_accrual)
    where is_active = true and is_waiting_accrual = true;

create unique index additional_work_accrual_statuses_one_active_accrued_idx
    on app.additional_work_accrual_statuses (is_accrued)
    where is_active = true and is_accrued = true;

create unique index additional_work_accrual_statuses_one_active_without_accrual_idx
    on app.additional_work_accrual_statuses (is_without_accrual)
    where is_active = true and is_without_accrual = true;

create table app.salary_entry_types (
    salary_entry_type_id bigint generated always as identity primary key,
    salary_entry_type_name text not null,
    is_production_operation boolean not null default false,
    is_additional_work boolean not null default false,
    is_salary_correction boolean not null default false,
    is_production_operation_correction boolean not null default false,
    is_reversal boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint salary_entry_types_salary_entry_type_name_uniq unique (salary_entry_type_name),
    constraint salary_entry_types_exactly_one_type_flag_chk check (
        (
            is_production_operation::integer
            + is_additional_work::integer
            + is_salary_correction::integer
            + is_production_operation_correction::integer
            + is_reversal::integer
        ) = 1
    )
);

create unique index salary_entry_types_one_active_production_operation_idx
    on app.salary_entry_types (is_production_operation)
    where is_active = true and is_production_operation = true;

create unique index salary_entry_types_one_active_additional_work_idx
    on app.salary_entry_types (is_additional_work)
    where is_active = true and is_additional_work = true;

create unique index salary_entry_types_one_active_salary_correction_idx
    on app.salary_entry_types (is_salary_correction)
    where is_active = true and is_salary_correction = true;

create unique index salary_entry_types_one_active_production_operation_correction_idx
    on app.salary_entry_types (is_production_operation_correction)
    where is_active = true and is_production_operation_correction = true;

create unique index salary_entry_types_one_active_reversal_idx
    on app.salary_entry_types (is_reversal)
    where is_active = true and is_reversal = true;

create table app.period_types (
    period_type_id bigint generated always as identity primary key,
    period_type_name text not null,
    is_day boolean not null default false,
    is_week boolean not null default false,
    is_month boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint period_types_period_type_name_uniq unique (period_type_name),
    constraint period_types_exactly_one_period_flag_chk check (
        (
            is_day::integer
            + is_week::integer
            + is_month::integer
        ) = 1
    )
);

create unique index period_types_one_active_day_idx
    on app.period_types (is_day)
    where is_active = true and is_day = true;

create unique index period_types_one_active_week_idx
    on app.period_types (is_week)
    where is_active = true and is_week = true;

create unique index period_types_one_active_month_idx
    on app.period_types (is_month)
    where is_active = true and is_month = true;

create table app.notification_channels (
    notification_channel_id bigint generated always as identity primary key,
    notification_channel_name text not null,
    is_telegram boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint notification_channels_notification_channel_name_uniq unique (notification_channel_name)
);

create unique index notification_channels_one_active_telegram_idx
    on app.notification_channels (is_telegram)
    where is_active = true and is_telegram = true;

create table app.notification_statuses (
    notification_status_id bigint generated always as identity primary key,
    notification_status_name text not null,
    is_created boolean not null default false,
    is_sent boolean not null default false,
    is_delivered boolean not null default false,
    is_read boolean not null default false,
    is_failed boolean not null default false,
    is_cancelled boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint notification_statuses_notification_status_name_uniq unique (notification_status_name),
    constraint notification_statuses_exactly_one_status_flag_chk check (
        (
            is_created::integer
            + is_sent::integer
            + is_delivered::integer
            + is_read::integer
            + is_failed::integer
            + is_cancelled::integer
        ) = 1
    )
);

create unique index notification_statuses_one_active_created_idx
    on app.notification_statuses (is_created)
    where is_active = true and is_created = true;

create unique index notification_statuses_one_active_sent_idx
    on app.notification_statuses (is_sent)
    where is_active = true and is_sent = true;

create unique index notification_statuses_one_active_delivered_idx
    on app.notification_statuses (is_delivered)
    where is_active = true and is_delivered = true;

create unique index notification_statuses_one_active_read_idx
    on app.notification_statuses (is_read)
    where is_active = true and is_read = true;

create unique index notification_statuses_one_active_failed_idx
    on app.notification_statuses (is_failed)
    where is_active = true and is_failed = true;

create unique index notification_statuses_one_active_cancelled_idx
    on app.notification_statuses (is_cancelled)
    where is_active = true and is_cancelled = true;

create table app.google_sheets_export_statuses (
    google_sheets_export_status_id bigint generated always as identity primary key,
    google_sheets_export_status_name text not null,
    is_success boolean not null default false,
    is_failed boolean not null default false,
    is_cancelled boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint google_sheets_export_statuses_name_uniq unique (google_sheets_export_status_name),
    constraint google_sheets_export_statuses_exactly_one_status_flag_chk check (
        (
            is_success::integer
            + is_failed::integer
            + is_cancelled::integer
        ) = 1
    )
);

create unique index google_sheets_export_statuses_one_active_success_idx
    on app.google_sheets_export_statuses (is_success)
    where is_active = true and is_success = true;

create unique index google_sheets_export_statuses_one_active_failed_idx
    on app.google_sheets_export_statuses (is_failed)
    where is_active = true and is_failed = true;

create unique index google_sheets_export_statuses_one_active_cancelled_idx
    on app.google_sheets_export_statuses (is_cancelled)
    where is_active = true and is_cancelled = true;

create table app.roles (
    role_id bigint generated always as identity primary key,
    role_name text not null,
    role_description text null,
    is_active boolean not null default true,
    can_work_as_operator boolean not null default false,
    can_manage_production boolean not null default false,
    can_manage_admin boolean not null default false,
    can_manage_telegram_binding boolean not null default false,
    can_view_audit boolean not null default false,
    can_change_sku_tariff boolean not null default false,
    can_salary_correction_production boolean not null default false,
    can_salary_correction_general boolean not null default false,
    can_salary_correction_all boolean not null default false,
    can_reverse_salary_production boolean not null default false,
    can_reverse_salary_all boolean not null default false,
    can_correct_production_operations boolean not null default false,
    can_manage_employees boolean not null default false,
    can_manage_positions boolean not null default false,
    can_manage_roles_limited boolean not null default false,
    can_manage_roles_all boolean not null default false,
    can_manage_dictionaries boolean not null default false,
    can_view_admin_reports boolean not null default false,
    can_reverse_salary_corrections_only boolean not null default false,
    can_receive_production_notifications boolean not null default false,
    can_receive_director_notifications boolean not null default false,
    can_system_emergency_actions boolean not null default false,
    can_access_admin_panel boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint roles_role_name_uniq unique (role_name)
);

create table app.employees (
    employee_id bigint generated always as identity primary key,
    full_name text not null,
    phone_e164 text not null,
    telegram_user_id bigint null,
    telegram_username text null,
    position_id bigint not null,
    tariff_category text null,
    employee_status_id bigint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint employees_position_id_fk foreign key (position_id)
        references app.positions (position_id),
    constraint employees_employee_status_id_fk foreign key (employee_status_id)
        references app.employee_statuses (employee_status_id),
    constraint employees_phone_e164_uniq unique (phone_e164),
    constraint employees_full_name_normalized_chk check (
        btrim(full_name) = full_name
        and btrim(full_name) <> ''
    ),
    constraint employees_phone_e164_normalized_chk check (
        btrim(phone_e164) = phone_e164
        and phone_e164 ~ '^\+[0-9]{7,15}$'
    )
);

create unique index employees_telegram_user_id_uniq_idx
    on app.employees (telegram_user_id)
    where telegram_user_id is not null;

create table app.employee_roles (
    employee_role_id bigint generated always as identity primary key,
    employee_id bigint not null,
    role_id bigint not null,
    assigned_at timestamptz not null default now(),
    assigned_by_employee_id bigint null,
    revoked_at timestamptz null,
    revoked_by_employee_id bigint null,
    revoke_reason text null,
    constraint employee_roles_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint employee_roles_role_id_fk foreign key (role_id)
        references app.roles (role_id),
    constraint employee_roles_assigned_by_employee_id_fk foreign key (assigned_by_employee_id)
        references app.employees (employee_id),
    constraint employee_roles_revoked_by_employee_id_fk foreign key (revoked_by_employee_id)
        references app.employees (employee_id),
    constraint employee_roles_revocation_state_chk check (
        (
            revoked_at is null
            and revoked_by_employee_id is null
            and revoke_reason is null
        )
        or (
            revoked_at is not null
            and revoked_by_employee_id is not null
            and revoke_reason is not null
            and btrim(revoke_reason) <> ''
            and revoked_at >= assigned_at
        )
    )
);

create unique index employee_roles_one_active_role_per_employee_idx
    on app.employee_roles (employee_id)
    where revoked_at is null;

create table app.admin_password_credentials (
    admin_password_credential_id bigint generated always as identity primary key,
    employee_id bigint not null,
    login_name text not null,
    password_hash text not null,
    must_change_password boolean not null default true,
    failed_attempt_count smallint not null default 0,
    locked_until timestamptz null,
    is_active boolean not null default true,
    password_changed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint admin_password_credentials_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint admin_password_credentials_employee_id_uniq unique (employee_id),
    constraint admin_password_credentials_login_name_uniq unique (login_name),
    constraint admin_password_credentials_login_name_format_chk check (
        login_name ~ '^[a-z0-9][a-z0-9._-]{2,63}$'
    ),
    constraint admin_password_credentials_password_hash_format_chk check (
        password_hash ~ '^scrypt\$v1\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$'
    ),
    constraint admin_password_credentials_failed_attempt_count_chk check (
        failed_attempt_count between 0 and 5
    )
);

create index admin_password_credentials_locked_until_idx
    on app.admin_password_credentials (locked_until)
    where is_active = true and locked_until is not null;

create table app.admin_sessions (
    admin_session_id bigint generated always as identity primary key,
    employee_id bigint not null,
    admin_password_credential_id bigint null,
    auth_method text not null,
    session_token_hash text not null,
    csrf_token_hash text not null,
    created_ip inet null,
    user_agent text null,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    idle_expires_at timestamptz not null,
    expires_at timestamptz not null,
    revoked_at timestamptz null,
    revoked_reason text null,
    constraint admin_sessions_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint admin_sessions_password_credential_id_fk foreign key (admin_password_credential_id)
        references app.admin_password_credentials (admin_password_credential_id),
    constraint admin_sessions_session_token_hash_uniq unique (session_token_hash),
    constraint admin_sessions_auth_method_chk check (
        auth_method in ('PASSWORD', 'TELEGRAM_QR')
    ),
    constraint admin_sessions_provider_reference_chk check (
        (auth_method = 'PASSWORD' and admin_password_credential_id is not null)
        or (auth_method = 'TELEGRAM_QR' and admin_password_credential_id is null)
    ),
    constraint admin_sessions_session_token_hash_format_chk check (
        session_token_hash ~ '^[a-f0-9]{64}$'
    ),
    constraint admin_sessions_csrf_token_hash_format_chk check (
        csrf_token_hash ~ '^[a-f0-9]{64}$'
    ),
    constraint admin_sessions_user_agent_length_chk check (
        user_agent is null or char_length(user_agent) between 1 and 512
    ),
    constraint admin_sessions_lifetime_chk check (
        last_seen_at >= created_at
        and idle_expires_at > last_seen_at
        and expires_at > created_at
        and idle_expires_at <= expires_at
    ),
    constraint admin_sessions_revocation_state_chk check (
        (revoked_at is null and revoked_reason is null)
        or (
            revoked_at is not null
            and revoked_reason is not null
            and btrim(revoked_reason) <> ''
            and revoked_at >= created_at
        )
    )
);

create index admin_sessions_employee_active_idx
    on app.admin_sessions (employee_id, expires_at)
    where revoked_at is null;

create index admin_sessions_expiry_idx
    on app.admin_sessions (least(idle_expires_at, expires_at))
    where revoked_at is null;

create table app.admin_telegram_qr_challenges (
    admin_telegram_qr_challenge_id bigint generated always as identity primary key,
    confirmation_token_hash text not null,
    browser_token_hash text not null,
    created_ip inet null,
    user_agent text null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    confirmed_employee_id bigint null,
    confirmed_at timestamptz null,
    claimed_admin_session_id bigint null,
    claimed_at timestamptz null,
    constraint admin_telegram_qr_challenges_confirmation_token_hash_uniq
        unique (confirmation_token_hash),
    constraint admin_telegram_qr_challenges_browser_token_hash_uniq
        unique (browser_token_hash),
    constraint admin_telegram_qr_challenges_claimed_session_uniq
        unique (claimed_admin_session_id),
    constraint admin_telegram_qr_challenges_confirmed_employee_id_fk
        foreign key (confirmed_employee_id) references app.employees (employee_id),
    constraint admin_telegram_qr_challenges_claimed_session_id_fk
        foreign key (claimed_admin_session_id) references app.admin_sessions (admin_session_id),
    constraint admin_telegram_qr_challenges_confirmation_token_hash_format_chk check (
        confirmation_token_hash ~ '^[a-f0-9]{64}$'
    ),
    constraint admin_telegram_qr_challenges_browser_token_hash_format_chk check (
        browser_token_hash ~ '^[a-f0-9]{64}$'
    ),
    constraint admin_telegram_qr_challenges_user_agent_length_chk check (
        user_agent is null or char_length(user_agent) between 1 and 512
    ),
    constraint admin_telegram_qr_challenges_expiry_chk check (
        expires_at > created_at
    ),
    constraint admin_telegram_qr_challenges_lifecycle_chk check (
        (
            confirmed_employee_id is null
            and confirmed_at is null
            and claimed_admin_session_id is null
            and claimed_at is null
        )
        or (
            confirmed_employee_id is not null
            and confirmed_at is not null
            and confirmed_at >= created_at
            and confirmed_at <= expires_at
            and claimed_admin_session_id is null
            and claimed_at is null
        )
        or (
            confirmed_employee_id is not null
            and confirmed_at is not null
            and confirmed_at >= created_at
            and confirmed_at <= expires_at
            and claimed_admin_session_id is not null
            and claimed_at is not null
            and claimed_at >= confirmed_at
            and claimed_at <= expires_at
        )
    )
);

create index admin_telegram_qr_challenges_pending_expiry_idx
    on app.admin_telegram_qr_challenges (expires_at)
    where claimed_at is null;

create index admin_telegram_qr_challenges_created_ip_idx
    on app.admin_telegram_qr_challenges (created_ip, created_at)
    where created_ip is not null;

create index admin_telegram_qr_challenges_confirmed_employee_idx
    on app.admin_telegram_qr_challenges (confirmed_employee_id, confirmed_at)
    where confirmed_employee_id is not null;

create table app.employee_shifts (
    employee_shift_id bigint generated always as identity primary key,
    employee_id bigint not null,
    started_at timestamptz not null,
    finished_at timestamptz null,
    started_by_employee_id bigint not null,
    finished_by_employee_id bigint null,
    is_open boolean not null default true,
    created_at timestamptz not null default now(),
    emergency_close_reason text null,
    constraint employee_shifts_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint employee_shifts_started_by_employee_id_fk foreign key (started_by_employee_id)
        references app.employees (employee_id),
    constraint employee_shifts_finished_by_employee_id_fk foreign key (finished_by_employee_id)
        references app.employees (employee_id),
    constraint employee_shifts_lifecycle_state_chk check (
        (
            is_open = true
            and finished_at is null
            and finished_by_employee_id is null
            and emergency_close_reason is null
        )
        or (
            is_open = false
            and finished_at is not null
            and finished_by_employee_id is not null
            and finished_at >= started_at
            and (
                (
                    finished_by_employee_id = employee_id
                    and emergency_close_reason is null
                )
                or (
                    emergency_close_reason is not null
                    and btrim(emergency_close_reason) <> ''
                )
            )
        )
    )
);

create unique index employee_shifts_one_open_shift_per_employee_idx
    on app.employee_shifts (employee_id)
    where is_open = true;

-- END db/schema/_work/wp_01_foundation_identity_access/ddl.sql

-- BEGIN db/schema/_work/wp_02_machines_sku/ddl.sql

create table app.machines (
    machine_id bigint generated always as identity primary key,
    machine_name text not null,
    workshop_name text null,
    machine_qr_token text not null,
    machine_status_id bigint not null,
    machine_use_status_id bigint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint machines_machine_name_uniq unique (machine_name),
    constraint machines_machine_qr_token_uniq unique (machine_qr_token),
    constraint machines_machine_status_id_fk foreign key (machine_status_id)
        references app.machine_statuses (machine_status_id),
    constraint machines_machine_use_status_id_fk foreign key (machine_use_status_id)
        references app.machine_use_statuses (machine_use_status_id),
    constraint machines_machine_name_trimmed_chk check (
        trim(machine_name) <> ''
        and machine_name = trim(machine_name)
    ),
    constraint machines_workshop_name_trimmed_chk check (
        workshop_name is null
        or (
            trim(workshop_name) <> ''
            and workshop_name = trim(workshop_name)
        )
    ),
    constraint machines_machine_qr_token_trimmed_chk check (
        trim(machine_qr_token) <> ''
        and machine_qr_token = trim(machine_qr_token)
    )
);

create index machines_machine_status_id_idx
    on app.machines (machine_status_id);

create index machines_machine_use_status_id_idx
    on app.machines (machine_use_status_id);

create table app.skus (
    sku_id bigint generated always as identity primary key,
    sku_code text not null,
    sku_name text null,
    sku_qr_token text not null,
    sku_unit_id bigint not null,
    planned_productivity_per_hour numeric(18,3) null,
    current_sku_tariff_uzs numeric(18,4) not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint skus_sku_code_uniq unique (sku_code),
    constraint skus_sku_qr_token_uniq unique (sku_qr_token),
    constraint skus_sku_unit_id_fk foreign key (sku_unit_id)
        references app.sku_units (sku_unit_id),
    constraint skus_sku_code_trimmed_chk check (
        trim(sku_code) <> ''
        and sku_code = trim(sku_code)
    ),
    constraint skus_sku_name_trimmed_chk check (
        sku_name is null
        or (
            trim(sku_name) <> ''
            and sku_name = trim(sku_name)
        )
    ),
    constraint skus_sku_qr_token_format_chk check (
        sku_qr_token ~ '^[A-Za-z0-9_-]{32}$'
    ),
    constraint skus_planned_productivity_per_hour_positive_chk check (
        planned_productivity_per_hour is null
        or planned_productivity_per_hour > 0
    ),
    constraint skus_current_sku_tariff_uzs_non_negative_chk check (
        current_sku_tariff_uzs >= 0
    )
);

create index skus_sku_unit_id_idx
    on app.skus (sku_unit_id);

-- END db/schema/_work/wp_02_machines_sku/ddl.sql

-- BEGIN db/schema/_work/wp_03_production_operations_machine_status_events/ddl.sql

create table app.production_operations (
    production_operation_id bigint generated always as identity primary key,
    employee_id bigint not null,
    employee_shift_id bigint not null,
    machine_id bigint not null,
    sku_id bigint not null,
    production_operation_status_id bigint not null,
    is_open boolean not null default true,
    started_at timestamptz not null,
    finished_at timestamptz null,
    cancelled_at timestamptz null,
    quantity_produced numeric(18,3) null,
    finish_comment text null,
    cancel_reason text null,
    started_by_employee_id bigint not null,
    finished_by_employee_id bigint null,
    cancelled_by_employee_id bigint null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint production_operations_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint production_operations_employee_shift_id_fk foreign key (employee_shift_id)
        references app.employee_shifts (employee_shift_id),
    constraint production_operations_machine_id_fk foreign key (machine_id)
        references app.machines (machine_id),
    constraint production_operations_sku_id_fk foreign key (sku_id)
        references app.skus (sku_id),
    constraint production_operations_status_id_fk foreign key (production_operation_status_id)
        references app.production_operation_statuses (production_operation_status_id),
    constraint production_operations_started_by_employee_id_fk foreign key (started_by_employee_id)
        references app.employees (employee_id),
    constraint production_operations_finished_by_employee_id_fk foreign key (finished_by_employee_id)
        references app.employees (employee_id),
    constraint production_operations_cancelled_by_employee_id_fk foreign key (cancelled_by_employee_id)
        references app.employees (employee_id),
    constraint production_operations_open_state_chk check (
        is_open = false
        or (
            finished_at is null
            and cancelled_at is null
            and quantity_produced is null
            and finished_by_employee_id is null
            and cancelled_by_employee_id is null
        )
    ),
    constraint production_operations_terminal_state_present_chk check (
        is_open = true
        or finished_at is not null
        or cancelled_at is not null
    ),
    constraint production_operations_not_finished_and_cancelled_chk check (
        not (finished_at is not null and cancelled_at is not null)
    ),
    constraint production_operations_finished_state_chk check (
        finished_at is null
        or (
            is_open = false
            and finished_by_employee_id is not null
            and cancelled_at is null
            and cancelled_by_employee_id is null
            and quantity_produced is not null
        )
    ),
    constraint production_operations_cancelled_state_chk check (
        cancelled_at is null
        or (
            is_open = false
            and finished_at is null
            and finished_by_employee_id is null
            and cancelled_by_employee_id is not null
            and cancel_reason is not null
            and trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
        )
    ),
    constraint production_operations_quantity_non_negative_chk check (
        quantity_produced is null
        or quantity_produced >= 0
    ),
    constraint production_operations_finish_comment_trimmed_chk check (
        finish_comment is null
        or (
            trim(finish_comment) <> ''
            and finish_comment = trim(finish_comment)
        )
    ),
    constraint production_operations_cancel_reason_trimmed_chk check (
        cancel_reason is null
        or (
            trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
        )
    )
);

create unique index production_operations_one_open_per_employee_idx
    on app.production_operations (employee_id)
    where is_open = true;

create unique index production_operations_one_open_per_machine_idx
    on app.production_operations (machine_id)
    where is_open = true;

create index production_operations_employee_shift_id_idx
    on app.production_operations (employee_shift_id);

create index production_operations_machine_id_idx
    on app.production_operations (machine_id);

create index production_operations_sku_id_idx
    on app.production_operations (sku_id);

create index production_operations_status_id_idx
    on app.production_operations (production_operation_status_id);

create index production_operations_started_at_idx
    on app.production_operations (started_at);

create table app.machine_status_events (
    machine_status_event_id bigint generated always as identity primary key,
    machine_id bigint not null,
    old_machine_status_id bigint null,
    new_machine_status_id bigint not null,
    changed_at timestamptz not null default now(),
    changed_by_employee_id bigint null,
    cause_table_name text null,
    cause_record_id bigint null,
    reason text null,
    created_at timestamptz not null default now(),
    constraint machine_status_events_machine_id_fk foreign key (machine_id)
        references app.machines (machine_id),
    constraint machine_status_events_old_machine_status_id_fk foreign key (old_machine_status_id)
        references app.machine_statuses (machine_status_id),
    constraint machine_status_events_new_machine_status_id_fk foreign key (new_machine_status_id)
        references app.machine_statuses (machine_status_id),
    constraint machine_status_events_changed_by_employee_id_fk foreign key (changed_by_employee_id)
        references app.employees (employee_id),
    constraint machine_status_events_cause_nullability_chk check (
        (
            cause_table_name is null
            and cause_record_id is null
        )
        or (
            cause_table_name is not null
            and cause_record_id is not null
        )
    ),
    constraint machine_status_events_cause_table_name_allowed_chk check (
        cause_table_name is null
        or cause_table_name in (
            'production_operations',
            'machine_downtimes',
            'machines'
        )
    ),
    constraint machine_status_events_business_cause_actor_chk check (
        cause_table_name not in ('production_operations', 'machine_downtimes')
        or changed_by_employee_id is not null
    ),
    constraint machine_status_events_reason_trimmed_chk check (
        reason is null
        or (
            trim(reason) <> ''
            and reason = trim(reason)
        )
    )
);

create index machine_status_events_machine_id_changed_at_idx
    on app.machine_status_events (machine_id, changed_at);

create index machine_status_events_new_machine_status_id_idx
    on app.machine_status_events (new_machine_status_id);

create index machine_status_events_changed_by_employee_id_idx
    on app.machine_status_events (changed_by_employee_id);

create index machine_status_events_cause_idx
    on app.machine_status_events (cause_table_name, cause_record_id);

-- END db/schema/_work/wp_03_production_operations_machine_status_events/ddl.sql

-- BEGIN db/schema/_work/wp_04_downtime_breaks_additional_work/ddl.sql

create table app.machine_downtimes (
    machine_downtime_id bigint generated always as identity primary key,
    machine_id bigint not null,
    production_operation_id bigint null,
    machine_downtime_type_id bigint not null,
    started_at timestamptz not null,
    finished_at timestamptz null,
    cancelled_at timestamptz null,
    started_by_employee_id bigint not null,
    finished_by_employee_id bigint null,
    cancelled_by_employee_id bigint null,
    finish_comment text null,
    cancel_reason text null,
    is_open boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint machine_downtimes_machine_id_fk foreign key (machine_id)
        references app.machines (machine_id),
    constraint machine_downtimes_production_operation_id_fk foreign key (production_operation_id)
        references app.production_operations (production_operation_id),
    constraint machine_downtimes_type_id_fk foreign key (machine_downtime_type_id)
        references app.machine_downtime_types (machine_downtime_type_id),
    constraint machine_downtimes_started_by_employee_id_fk foreign key (started_by_employee_id)
        references app.employees (employee_id),
    constraint machine_downtimes_finished_by_employee_id_fk foreign key (finished_by_employee_id)
        references app.employees (employee_id),
    constraint machine_downtimes_cancelled_by_employee_id_fk foreign key (cancelled_by_employee_id)
        references app.employees (employee_id),
    constraint machine_downtimes_open_state_chk check (
        is_open = false
        or (
            finished_at is null
            and cancelled_at is null
            and finished_by_employee_id is null
            and cancelled_by_employee_id is null
        )
    ),
    constraint machine_downtimes_terminal_state_present_chk check (
        is_open = true
        or finished_at is not null
        or cancelled_at is not null
    ),
    constraint machine_downtimes_not_finished_and_cancelled_chk check (
        not (finished_at is not null and cancelled_at is not null)
    ),
    constraint machine_downtimes_finished_state_chk check (
        finished_at is null
        or (
            is_open = false
            and finished_by_employee_id is not null
            and cancelled_at is null
            and cancelled_by_employee_id is null
            and finished_at >= started_at
        )
    ),
    constraint machine_downtimes_cancelled_state_chk check (
        cancelled_at is null
        or (
            is_open = false
            and cancelled_by_employee_id is not null
            and cancel_reason is not null
            and trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
            and finished_at is null
            and finished_by_employee_id is null
            and cancelled_at >= started_at
        )
    ),
    constraint machine_downtimes_finish_comment_trimmed_chk check (
        finish_comment is null
        or (
            trim(finish_comment) <> ''
            and finish_comment = trim(finish_comment)
        )
    ),
    constraint machine_downtimes_cancel_reason_trimmed_chk check (
        cancel_reason is null
        or (
            trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
        )
    )
);

create unique index machine_downtimes_one_open_per_machine_idx
    on app.machine_downtimes (machine_id)
    where is_open = true;

create index machine_downtimes_production_operation_id_idx
    on app.machine_downtimes (production_operation_id)
    where production_operation_id is not null;

create index machine_downtimes_machine_downtime_type_id_idx
    on app.machine_downtimes (machine_downtime_type_id);

create table app.operator_breaks (
    operator_break_id bigint generated always as identity primary key,
    employee_id bigint not null,
    employee_shift_id bigint not null,
    operator_break_type_id bigint not null,
    started_at timestamptz not null,
    finished_at timestamptz null,
    started_by_employee_id bigint not null,
    finished_by_employee_id bigint null,
    emergency_finish_reason text null,
    is_open boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint operator_breaks_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint operator_breaks_employee_shift_id_fk foreign key (employee_shift_id)
        references app.employee_shifts (employee_shift_id),
    constraint operator_breaks_type_id_fk foreign key (operator_break_type_id)
        references app.operator_break_types (operator_break_type_id),
    constraint operator_breaks_started_by_employee_id_fk foreign key (started_by_employee_id)
        references app.employees (employee_id),
    constraint operator_breaks_finished_by_employee_id_fk foreign key (finished_by_employee_id)
        references app.employees (employee_id),
    constraint operator_breaks_open_state_chk check (
        is_open = false
        or (
            finished_at is null
            and finished_by_employee_id is null
            and emergency_finish_reason is null
        )
    ),
    constraint operator_breaks_closed_state_chk check (
        is_open = true
        or (
            finished_at is not null
            and finished_by_employee_id is not null
            and finished_at >= started_at
        )
    ),
    constraint operator_breaks_finish_path_chk check (
        is_open = true
        or (
            (
                finished_by_employee_id = employee_id
                and emergency_finish_reason is null
            )
            or (
                finished_by_employee_id <> employee_id
                and emergency_finish_reason is not null
                and trim(emergency_finish_reason) <> ''
                and emergency_finish_reason = trim(emergency_finish_reason)
            )
        )
    )
);

create unique index operator_breaks_one_open_per_employee_idx
    on app.operator_breaks (employee_id)
    where is_open = true;

create index operator_breaks_employee_shift_id_idx
    on app.operator_breaks (employee_shift_id);

create index operator_breaks_operator_break_type_id_idx
    on app.operator_breaks (operator_break_type_id);

create table app.additional_works (
    additional_work_id bigint generated always as identity primary key,
    employee_id bigint not null,
    employee_shift_id bigint null,
    additional_work_type_id bigint not null,
    assigned_at timestamptz not null default now(),
    assigned_by_employee_id bigint not null,
    started_at timestamptz null,
    started_by_employee_id bigint null,
    finished_at timestamptz null,
    finished_by_employee_id bigint null,
    cancelled_at timestamptz null,
    cancelled_by_employee_id bigint null,
    cancel_reason text null,
    quantity numeric(18,3) null,
    amount_uzs numeric(18,4) null,
    is_assignment_finished boolean not null default false,
    additional_work_approval_status_id bigint not null,
    decision_by_employee_id bigint null,
    decision_at timestamptz null,
    manager_decision_comment text null,
    additional_work_accrual_status_id bigint null,
    accrued_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint additional_works_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint additional_works_employee_shift_id_fk foreign key (employee_shift_id)
        references app.employee_shifts (employee_shift_id),
    constraint additional_works_type_id_fk foreign key (additional_work_type_id)
        references app.additional_work_types (additional_work_type_id),
    constraint additional_works_assigned_by_employee_id_fk foreign key (assigned_by_employee_id)
        references app.employees (employee_id),
    constraint additional_works_started_by_employee_id_fk foreign key (started_by_employee_id)
        references app.employees (employee_id),
    constraint additional_works_finished_by_employee_id_fk foreign key (finished_by_employee_id)
        references app.employees (employee_id),
    constraint additional_works_cancelled_by_employee_id_fk foreign key (cancelled_by_employee_id)
        references app.employees (employee_id),
    constraint additional_works_approval_status_id_fk foreign key (additional_work_approval_status_id)
        references app.additional_work_approval_statuses (additional_work_approval_status_id),
    constraint additional_works_decision_by_employee_id_fk foreign key (decision_by_employee_id)
        references app.employees (employee_id),
    constraint additional_works_accrual_status_id_fk foreign key (additional_work_accrual_status_id)
        references app.additional_work_accrual_statuses (additional_work_accrual_status_id),
    constraint additional_works_started_state_chk check (
        started_at is null
        or (
            started_by_employee_id is not null
            and started_at >= assigned_at
        )
    ),
    constraint additional_works_not_finished_and_cancelled_chk check (
        not (finished_at is not null and cancelled_at is not null)
    ),
    constraint additional_works_finished_state_chk check (
        finished_at is null
        or (
            started_at is not null
            and finished_by_employee_id is not null
            and finished_at >= started_at
            and cancelled_at is null
            and cancelled_by_employee_id is null
        )
    ),
    constraint additional_works_cancelled_state_chk check (
        cancelled_at is null
        or (
            cancelled_by_employee_id is not null
            and cancel_reason is not null
            and trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
            and cancelled_at >= assigned_at
            and finished_at is null
            and finished_by_employee_id is null
        )
    ),
    constraint additional_works_decision_state_chk check (
        (
            decision_at is null
            and decision_by_employee_id is null
        )
        or (
            decision_at is not null
            and decision_by_employee_id is not null
            and decision_at >= assigned_at
        )
    ),
    constraint additional_works_accrual_state_chk check (
        accrued_at is null
        or (
            additional_work_accrual_status_id is not null
            and (
                decision_at is null
                or accrued_at >= decision_at
            )
        )
    ),
    constraint additional_works_quantity_positive_chk check (
        quantity is null
        or quantity > 0
    ),
    constraint additional_works_amount_non_negative_chk check (
        amount_uzs is null
        or amount_uzs >= 0
    ),
    constraint additional_works_cancel_reason_trimmed_chk check (
        cancel_reason is null
        or (
            trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
        )
    ),
    constraint additional_works_manager_decision_comment_trimmed_chk check (
        manager_decision_comment is null
        or (
            trim(manager_decision_comment) <> ''
            and manager_decision_comment = trim(manager_decision_comment)
        )
    )
);

create index additional_works_employee_id_idx
    on app.additional_works (employee_id);

create index additional_works_employee_shift_id_idx
    on app.additional_works (employee_shift_id)
    where employee_shift_id is not null;

create index additional_works_approval_status_id_idx
    on app.additional_works (additional_work_approval_status_id);

create index additional_works_accrual_status_id_idx
    on app.additional_works (additional_work_accrual_status_id)
    where additional_work_accrual_status_id is not null;

create unique index additional_works_one_unfinished_assignment_per_type_idx
    on app.additional_works (employee_id, additional_work_type_id)
    where is_assignment_finished = false;

create unique index additional_works_one_running_per_employee_idx
    on app.additional_works (employee_id)
    where started_at is not null
        and finished_at is null
        and cancelled_at is null;

-- END db/schema/_work/wp_04_downtime_breaks_additional_work/ddl.sql

-- BEGIN db/schema/_work/wp_05_salary_ledger/ddl.sql

create table app.salary_correction_types (
    salary_correction_type_id bigint generated always as identity primary key,
    salary_correction_type_name text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint salary_correction_types_name_uniq unique (salary_correction_type_name),
    constraint salary_correction_types_name_trimmed_chk check (
        trim(salary_correction_type_name) <> ''
        and salary_correction_type_name = trim(salary_correction_type_name)
    )
);

create table app.salary_correction_statuses (
    salary_correction_status_id bigint generated always as identity primary key,
    salary_correction_status_name text not null,
    is_pending boolean not null default false,
    is_approved boolean not null default false,
    is_rejected boolean not null default false,
    is_cancelled boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint salary_correction_statuses_name_uniq unique (salary_correction_status_name),
    constraint salary_correction_statuses_name_trimmed_chk check (
        trim(salary_correction_status_name) <> ''
        and salary_correction_status_name = trim(salary_correction_status_name)
    ),
    constraint salary_correction_statuses_exactly_one_status_flag_chk check (
        (
            is_pending::integer
            + is_approved::integer
            + is_rejected::integer
            + is_cancelled::integer
        ) = 1
    )
);

create unique index salary_correction_statuses_one_active_pending_idx
    on app.salary_correction_statuses (is_pending)
    where is_active = true and is_pending = true;

create unique index salary_correction_statuses_one_active_approved_idx
    on app.salary_correction_statuses (is_approved)
    where is_active = true and is_approved = true;

create unique index salary_correction_statuses_one_active_rejected_idx
    on app.salary_correction_statuses (is_rejected)
    where is_active = true and is_rejected = true;

create unique index salary_correction_statuses_one_active_cancelled_idx
    on app.salary_correction_statuses (is_cancelled)
    where is_active = true and is_cancelled = true;

create table app.production_operation_correction_statuses (
    production_operation_correction_status_id bigint generated always as identity primary key,
    production_operation_correction_status_name text not null,
    is_pending boolean not null default false,
    is_approved boolean not null default false,
    is_rejected boolean not null default false,
    is_cancelled boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint production_operation_correction_statuses_name_uniq unique (
        production_operation_correction_status_name
    ),
    constraint production_operation_correction_statuses_name_trimmed_chk check (
        trim(production_operation_correction_status_name) <> ''
        and production_operation_correction_status_name = trim(production_operation_correction_status_name)
    ),
    constraint production_operation_correction_statuses_exactly_one_status_flag_chk check (
        (
            is_pending::integer
            + is_approved::integer
            + is_rejected::integer
            + is_cancelled::integer
        ) = 1
    )
);

create unique index production_operation_correction_statuses_one_active_pending_idx
    on app.production_operation_correction_statuses (is_pending)
    where is_active = true and is_pending = true;

create unique index production_operation_correction_statuses_one_active_approved_idx
    on app.production_operation_correction_statuses (is_approved)
    where is_active = true and is_approved = true;

create unique index production_operation_correction_statuses_one_active_rejected_idx
    on app.production_operation_correction_statuses (is_rejected)
    where is_active = true and is_rejected = true;

create unique index production_operation_correction_statuses_one_active_cancelled_idx
    on app.production_operation_correction_statuses (is_cancelled)
    where is_active = true and is_cancelled = true;

create table app.salary_corrections (
    salary_correction_id bigint generated always as identity primary key,
    employee_id bigint not null,
    employee_shift_id bigint null,
    salary_correction_type_id bigint not null,
    correction_amount_uzs numeric(18,4) null,
    correction_quantity numeric(18,3) null,
    correction_comment text not null,
    assigned_at timestamptz not null default now(),
    assigned_by_employee_id bigint not null,
    approved_at timestamptz null,
    approved_by_employee_id bigint null,
    rejected_at timestamptz null,
    rejected_by_employee_id bigint null,
    rejection_reason text null,
    cancelled_at timestamptz null,
    cancelled_by_employee_id bigint null,
    cancel_reason text null,
    salary_correction_status_id bigint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint salary_corrections_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint salary_corrections_employee_shift_id_fk foreign key (employee_shift_id)
        references app.employee_shifts (employee_shift_id),
    constraint salary_corrections_type_id_fk foreign key (salary_correction_type_id)
        references app.salary_correction_types (salary_correction_type_id),
    constraint salary_corrections_assigned_by_employee_id_fk foreign key (assigned_by_employee_id)
        references app.employees (employee_id),
    constraint salary_corrections_approved_by_employee_id_fk foreign key (approved_by_employee_id)
        references app.employees (employee_id),
    constraint salary_corrections_rejected_by_employee_id_fk foreign key (rejected_by_employee_id)
        references app.employees (employee_id),
    constraint salary_corrections_cancelled_by_employee_id_fk foreign key (cancelled_by_employee_id)
        references app.employees (employee_id),
    constraint salary_corrections_status_id_fk foreign key (salary_correction_status_id)
        references app.salary_correction_statuses (salary_correction_status_id),
    constraint salary_corrections_comment_trimmed_chk check (
        trim(correction_comment) <> ''
        and correction_comment = trim(correction_comment)
    ),
    constraint salary_corrections_one_terminal_timestamp_chk check (
        (
            (approved_at is not null)::integer
            + (rejected_at is not null)::integer
            + (cancelled_at is not null)::integer
        ) <= 1
    ),
    constraint salary_corrections_approved_state_chk check (
        approved_at is null
        or (
            approved_by_employee_id is not null
            and correction_amount_uzs is not null
            and correction_amount_uzs <> 0
        )
    ),
    constraint salary_corrections_rejected_state_chk check (
        rejected_at is null
        or (
            rejected_by_employee_id is not null
            and rejection_reason is not null
            and trim(rejection_reason) <> ''
            and rejection_reason = trim(rejection_reason)
        )
    ),
    constraint salary_corrections_cancelled_state_chk check (
        cancelled_at is null
        or (
            cancelled_by_employee_id is not null
            and cancel_reason is not null
            and trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
        )
    ),
    constraint salary_corrections_rejection_reason_trimmed_chk check (
        rejection_reason is null
        or (
            trim(rejection_reason) <> ''
            and rejection_reason = trim(rejection_reason)
        )
    ),
    constraint salary_corrections_cancel_reason_trimmed_chk check (
        cancel_reason is null
        or (
            trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
        )
    )
);

create index salary_corrections_employee_id_idx
    on app.salary_corrections (employee_id);

create index salary_corrections_employee_shift_id_idx
    on app.salary_corrections (employee_shift_id)
    where employee_shift_id is not null;

create index salary_corrections_status_id_idx
    on app.salary_corrections (salary_correction_status_id);

create table app.production_operation_corrections (
    production_operation_correction_id bigint generated always as identity primary key,
    production_operation_id bigint not null,
    employee_id bigint not null,
    correction_quantity_delta numeric(18,3) null,
    correction_amount_delta_uzs numeric(18,4) null,
    correction_reason text not null,
    assigned_at timestamptz not null default now(),
    assigned_by_employee_id bigint not null,
    approved_at timestamptz null,
    approved_by_employee_id bigint null,
    rejected_at timestamptz null,
    rejected_by_employee_id bigint null,
    rejection_reason text null,
    cancelled_at timestamptz null,
    cancelled_by_employee_id bigint null,
    cancel_reason text null,
    production_operation_correction_status_id bigint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint production_operation_corrections_operation_id_fk foreign key (production_operation_id)
        references app.production_operations (production_operation_id),
    constraint production_operation_corrections_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint production_operation_corrections_assigned_by_employee_id_fk foreign key (assigned_by_employee_id)
        references app.employees (employee_id),
    constraint production_operation_corrections_approved_by_employee_id_fk foreign key (approved_by_employee_id)
        references app.employees (employee_id),
    constraint production_operation_corrections_rejected_by_employee_id_fk foreign key (rejected_by_employee_id)
        references app.employees (employee_id),
    constraint production_operation_corrections_cancelled_by_employee_id_fk foreign key (cancelled_by_employee_id)
        references app.employees (employee_id),
    constraint production_operation_corrections_status_id_fk foreign key (
        production_operation_correction_status_id
    )
        references app.production_operation_correction_statuses (production_operation_correction_status_id),
    constraint production_operation_corrections_reason_trimmed_chk check (
        trim(correction_reason) <> ''
        and correction_reason = trim(correction_reason)
    ),
    constraint production_operation_corrections_delta_xor_chk check (
        (
            (correction_quantity_delta is not null)::integer
            + (correction_amount_delta_uzs is not null)::integer
        ) = 1
    ),
    constraint production_operation_corrections_delta_non_zero_chk check (
        (
            correction_quantity_delta is null
            or correction_quantity_delta <> 0
        )
        and (
            correction_amount_delta_uzs is null
            or correction_amount_delta_uzs <> 0
        )
    ),
    constraint production_operation_corrections_one_terminal_timestamp_chk check (
        (
            (approved_at is not null)::integer
            + (rejected_at is not null)::integer
            + (cancelled_at is not null)::integer
        ) <= 1
    ),
    constraint production_operation_corrections_approved_state_chk check (
        approved_at is null
        or approved_by_employee_id is not null
    ),
    constraint production_operation_corrections_rejected_state_chk check (
        rejected_at is null
        or (
            rejected_by_employee_id is not null
            and rejection_reason is not null
            and trim(rejection_reason) <> ''
            and rejection_reason = trim(rejection_reason)
        )
    ),
    constraint production_operation_corrections_cancelled_state_chk check (
        cancelled_at is null
        or (
            cancelled_by_employee_id is not null
            and cancel_reason is not null
            and trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
        )
    ),
    constraint production_operation_corrections_rejection_reason_trimmed_chk check (
        rejection_reason is null
        or (
            trim(rejection_reason) <> ''
            and rejection_reason = trim(rejection_reason)
        )
    ),
    constraint production_operation_corrections_cancel_reason_trimmed_chk check (
        cancel_reason is null
        or (
            trim(cancel_reason) <> ''
            and cancel_reason = trim(cancel_reason)
        )
    )
);

create index production_operation_corrections_operation_id_idx
    on app.production_operation_corrections (production_operation_id);

create index production_operation_corrections_employee_id_idx
    on app.production_operation_corrections (employee_id);

create index production_operation_corrections_status_id_idx
    on app.production_operation_corrections (production_operation_correction_status_id);

create table app.employee_salary_entries (
    employee_salary_entry_id bigint generated always as identity primary key,
    employee_id bigint not null,
    employee_shift_id bigint null,
    salary_entry_type_id bigint not null,
    production_operation_id bigint null,
    additional_work_id bigint null,
    salary_correction_id bigint null,
    production_operation_correction_id bigint null,
    reversed_salary_entry_id bigint null,
    quantity numeric(18,3) null,
    tariff_rate_uzs numeric(18,4) null,
    amount_uzs numeric(18,4) not null,
    accrued_at timestamptz not null,
    accrued_by_employee_id bigint not null,
    reversal_reason text null,
    employee_roles_snapshot_json jsonb null,
    machine_id_snapshot bigint null,
    sku_id_snapshot bigint null,
    sku_code_snapshot text null,
    sku_name_snapshot text null,
    salary_period_date date not null,
    salary_week_start_date date not null,
    salary_month_start_date date not null,
    created_at timestamptz not null default now(),
    constraint employee_salary_entries_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint employee_salary_entries_employee_shift_id_fk foreign key (employee_shift_id)
        references app.employee_shifts (employee_shift_id),
    constraint employee_salary_entries_type_id_fk foreign key (salary_entry_type_id)
        references app.salary_entry_types (salary_entry_type_id),
    constraint employee_salary_entries_production_operation_id_fk foreign key (production_operation_id)
        references app.production_operations (production_operation_id),
    constraint employee_salary_entries_additional_work_id_fk foreign key (additional_work_id)
        references app.additional_works (additional_work_id),
    constraint employee_salary_entries_salary_correction_id_fk foreign key (salary_correction_id)
        references app.salary_corrections (salary_correction_id),
    constraint employee_salary_entries_production_operation_correction_id_fk foreign key (
        production_operation_correction_id
    )
        references app.production_operation_corrections (production_operation_correction_id),
    constraint employee_salary_entries_reversed_salary_entry_id_fk foreign key (reversed_salary_entry_id)
        references app.employee_salary_entries (employee_salary_entry_id),
    constraint employee_salary_entries_accrued_by_employee_id_fk foreign key (accrued_by_employee_id)
        references app.employees (employee_id),
    constraint employee_salary_entries_source_exclusivity_chk check (
        (
            reversed_salary_entry_id is null
            and (
                (production_operation_id is not null)::integer
                + (additional_work_id is not null)::integer
                + (salary_correction_id is not null)::integer
                + (production_operation_correction_id is not null)::integer
            ) = 1
        )
        or (
            reversed_salary_entry_id is not null
            and production_operation_id is null
            and additional_work_id is null
            and salary_correction_id is null
            and production_operation_correction_id is null
        )
    ),
    constraint employee_salary_entries_reversal_reason_required_chk check (
        reversed_salary_entry_id is null
        or (
            reversal_reason is not null
            and trim(reversal_reason) <> ''
            and reversal_reason = trim(reversal_reason)
        )
    ),
    constraint employee_salary_entries_reversal_reason_trimmed_chk check (
        reversal_reason is null
        or (
            trim(reversal_reason) <> ''
            and reversal_reason = trim(reversal_reason)
        )
    ),
    constraint employee_salary_entries_sku_code_snapshot_trimmed_chk check (
        sku_code_snapshot is null
        or (
            trim(sku_code_snapshot) <> ''
            and sku_code_snapshot = trim(sku_code_snapshot)
        )
    ),
    constraint employee_salary_entries_sku_name_snapshot_trimmed_chk check (
        sku_name_snapshot is null
        or (
            trim(sku_name_snapshot) <> ''
            and sku_name_snapshot = trim(sku_name_snapshot)
        )
    )
);

create index employee_salary_entries_employee_period_date_idx
    on app.employee_salary_entries (employee_id, salary_period_date);

create index employee_salary_entries_employee_shift_id_idx
    on app.employee_salary_entries (employee_shift_id)
    where employee_shift_id is not null;

create index employee_salary_entries_production_operation_id_idx
    on app.employee_salary_entries (production_operation_id)
    where production_operation_id is not null;

create index employee_salary_entries_additional_work_id_idx
    on app.employee_salary_entries (additional_work_id)
    where additional_work_id is not null;

create index employee_salary_entries_salary_correction_id_idx
    on app.employee_salary_entries (salary_correction_id)
    where salary_correction_id is not null;

create index employee_salary_entries_production_operation_correction_id_idx
    on app.employee_salary_entries (production_operation_correction_id)
    where production_operation_correction_id is not null;

create unique index employee_salary_entries_one_normal_production_operation_idx
    on app.employee_salary_entries (production_operation_id)
    where production_operation_id is not null
        and reversed_salary_entry_id is null;

create unique index employee_salary_entries_one_normal_additional_work_idx
    on app.employee_salary_entries (additional_work_id)
    where additional_work_id is not null
        and reversed_salary_entry_id is null;

create unique index employee_salary_entries_one_normal_salary_correction_idx
    on app.employee_salary_entries (salary_correction_id)
    where salary_correction_id is not null
        and reversed_salary_entry_id is null;

create unique index employee_salary_entries_one_normal_production_operation_correction_idx
    on app.employee_salary_entries (production_operation_correction_id)
    where production_operation_correction_id is not null
        and reversed_salary_entry_id is null;

create unique index employee_salary_entries_one_reversal_per_original_idx
    on app.employee_salary_entries (reversed_salary_entry_id)
    where reversed_salary_entry_id is not null;

create table app.employee_salary_period_totals (
    employee_salary_period_total_id bigint generated always as identity primary key,
    employee_id bigint not null,
    salary_period_type_id bigint not null,
    period_start_date date not null,
    period_end_date date not null,
    production_salary_uzs numeric(18,4) not null default 0,
    production_correction_salary_uzs numeric(18,4) not null default 0,
    additional_work_salary_uzs numeric(18,4) not null default 0,
    salary_correction_uzs numeric(18,4) not null default 0,
    total_salary_uzs numeric(18,4) not null default 0,
    recalculated_at timestamptz not null,
    source_ledger_max_id bigint null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint employee_salary_period_totals_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint employee_salary_period_totals_period_type_id_fk foreign key (salary_period_type_id)
        references app.period_types (period_type_id),
    constraint employee_salary_period_totals_period_uniq unique (
        employee_id,
        salary_period_type_id,
        period_start_date
    ),
    constraint employee_salary_period_totals_period_range_chk check (
        period_end_date >= period_start_date
    ),
    constraint employee_salary_period_totals_total_sum_chk check (
        total_salary_uzs = (
            production_salary_uzs
            + production_correction_salary_uzs
            + additional_work_salary_uzs
            + salary_correction_uzs
        )
    )
);

create index employee_salary_period_totals_employee_id_idx
    on app.employee_salary_period_totals (employee_id);

create table app.salary_total_discrepancy_logs (
    salary_total_discrepancy_log_id bigint generated always as identity primary key,
    employee_id bigint not null,
    salary_period_type_id bigint not null,
    period_start_date date not null,
    period_end_date date not null,
    stored_total_salary_uzs numeric(18,4) not null,
    rebuilt_total_salary_uzs numeric(18,4) not null,
    difference_uzs numeric(18,4) not null,
    detected_at timestamptz not null default now(),
    detected_by_function text not null,
    repair_action text null,
    repaired_at timestamptz null,
    audit_reason text null,
    created_at timestamptz not null default now(),
    constraint salary_total_discrepancy_logs_employee_id_fk foreign key (employee_id)
        references app.employees (employee_id),
    constraint salary_total_discrepancy_logs_period_type_id_fk foreign key (salary_period_type_id)
        references app.period_types (period_type_id),
    constraint salary_total_discrepancy_logs_period_range_chk check (
        period_end_date >= period_start_date
    ),
    constraint salary_total_discrepancy_logs_difference_chk check (
        difference_uzs = rebuilt_total_salary_uzs - stored_total_salary_uzs
    ),
    constraint salary_total_discrepancy_logs_detected_by_function_trimmed_chk check (
        trim(detected_by_function) <> ''
        and detected_by_function = trim(detected_by_function)
    ),
    constraint salary_total_discrepancy_logs_repair_state_chk check (
        repaired_at is null
        or (
            repair_action is not null
            and trim(repair_action) <> ''
            and repair_action = trim(repair_action)
        )
    ),
    constraint salary_total_discrepancy_logs_repair_audit_reason_chk check (
        repair_action is null
        or (
            audit_reason is not null
            and trim(audit_reason) <> ''
            and audit_reason = trim(audit_reason)
        )
    ),
    constraint salary_total_discrepancy_logs_audit_reason_trimmed_chk check (
        audit_reason is null
        or (
            trim(audit_reason) <> ''
            and audit_reason = trim(audit_reason)
        )
    )
);

create index salary_total_discrepancy_logs_employee_period_idx
    on app.salary_total_discrepancy_logs (
        employee_id,
        salary_period_type_id,
        period_start_date
    );

-- END db/schema/_work/wp_05_salary_ledger/ddl.sql

-- BEGIN db/schema/_work/wp_06_audit_events/ddl.sql

create table app.audit_events (
    audit_event_id bigint generated always as identity primary key,
    actor_employee_id bigint not null,
    action_name text not null,
    entity_table_name text not null,
    entity_record_id bigint not null,
    before_data_json jsonb null,
    after_data_json jsonb null,
    reason text null,
    created_at timestamptz not null default now(),
    constraint audit_events_actor_employee_id_fk foreign key (actor_employee_id)
        references app.employees (employee_id),
    constraint audit_events_action_name_trimmed_chk check (
        trim(action_name) <> ''
        and action_name = trim(action_name)
    ),
    constraint audit_events_action_name_snake_case_chk check (
        action_name ~ '^[a-z][a-z0-9_]*$'
    ),
    constraint audit_events_entity_table_name_trimmed_chk check (
        trim(entity_table_name) <> ''
        and entity_table_name = trim(entity_table_name)
    ),
    constraint audit_events_reason_trimmed_chk check (
        reason is null
        or (
            trim(reason) <> ''
            and reason = trim(reason)
        )
    )
);

create index audit_events_created_at_idx
    on app.audit_events (created_at);

create index audit_events_action_name_idx
    on app.audit_events (action_name);

create index audit_events_actor_employee_id_idx
    on app.audit_events (actor_employee_id);

create index audit_events_entity_target_idx
    on app.audit_events (entity_table_name, entity_record_id);

-- END db/schema/_work/wp_06_audit_events/ddl.sql

-- BEGIN db/schema/_work/wp_auth_telegram_contact_proofs/ddl.sql

create table app.telegram_contact_proofs (
    telegram_contact_proof_id bigint generated always as identity primary key,
    telegram_user_id bigint not null,
    phone_e164 text not null,
    telegram_username text null,
    source text not null default 'telegram_bot_contact_update',
    bot_update_id bigint not null,
    bot_message_id bigint null,
    proof_status text not null default 'active',
    used_for_confirmation_at timestamptz null,
    consumed_at timestamptz null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint telegram_contact_proofs_phone_e164_normalized_chk check (
        btrim(phone_e164) = phone_e164
        and phone_e164 ~ '^\+[0-9]{7,15}$'
    ),
    constraint telegram_contact_proofs_username_trimmed_chk check (
        telegram_username is null
        or telegram_username = btrim(telegram_username)
    ),
    constraint telegram_contact_proofs_source_chk check (
        source = 'telegram_bot_contact_update'
    ),
    constraint telegram_contact_proofs_status_chk check (
        proof_status in ('active', 'used_for_confirmation', 'consumed', 'expired', 'superseded')
    ),
    constraint telegram_contact_proofs_expires_after_created_chk check (
        expires_at > created_at
    ),
    constraint telegram_contact_proofs_used_after_created_chk check (
        used_for_confirmation_at is null
        or used_for_confirmation_at >= created_at
    ),
    constraint telegram_contact_proofs_consumed_after_created_chk check (
        consumed_at is null
        or consumed_at >= created_at
    ),
    constraint telegram_contact_proofs_consumed_status_chk check (
        (proof_status = 'consumed') = (consumed_at is not null)
    ),
    constraint telegram_contact_proofs_used_status_chk check (
        proof_status <> 'used_for_confirmation'
        or used_for_confirmation_at is not null
    )
);

create unique index telegram_contact_proofs_bot_update_id_uniq_idx
    on app.telegram_contact_proofs (bot_update_id);

create unique index telegram_contact_proofs_one_live_per_user_idx
    on app.telegram_contact_proofs (telegram_user_id)
    where proof_status in ('active', 'used_for_confirmation');

create index telegram_contact_proofs_telegram_user_id_idx
    on app.telegram_contact_proofs (telegram_user_id);

create index telegram_contact_proofs_expires_at_idx
    on app.telegram_contact_proofs (expires_at);

create index telegram_contact_proofs_status_idx
    on app.telegram_contact_proofs (proof_status);

-- END db/schema/_work/wp_auth_telegram_contact_proofs/ddl.sql

-- BEGIN db/schema/_work/wp_07_notifications/ddl.sql

create table app.notifications (
    notification_id bigint generated always as identity primary key,
    recipient_employee_id bigint not null,
    notification_channel_id bigint not null,
    cause_table_name text null,
    cause_record_id bigint null,
    title text not null,
    message_text text not null,
    notification_status_id bigint not null,
    provider_message_id text null,
    deduplication_key text null,
    created_at timestamptz not null default now(),
    sent_at timestamptz null,
    delivered_at timestamptz null,
    read_at timestamptz null,
    failed_at timestamptz null,
    delivery_error_text text null,
    hidden_from_chat_at timestamptz null,
    constraint notifications_recipient_employee_id_fk foreign key (recipient_employee_id)
        references app.employees (employee_id),
    constraint notifications_channel_id_fk foreign key (notification_channel_id)
        references app.notification_channels (notification_channel_id),
    constraint notifications_status_id_fk foreign key (notification_status_id)
        references app.notification_statuses (notification_status_id),
    constraint notifications_cause_nullability_chk check (
        (
            cause_table_name is null
            and cause_record_id is null
        )
        or (
            cause_table_name is not null
            and cause_record_id is not null
        )
    ),
    constraint notifications_cause_table_name_trimmed_chk check (
        cause_table_name is null
        or (
            trim(cause_table_name) <> ''
            and cause_table_name = trim(cause_table_name)
        )
    ),
    constraint notifications_title_trimmed_chk check (
        trim(title) <> ''
        and title = trim(title)
    ),
    constraint notifications_message_text_trimmed_chk check (
        trim(message_text) <> ''
        and message_text = trim(message_text)
    ),
    constraint notifications_provider_message_id_trimmed_chk check (
        provider_message_id is null
        or (
            trim(provider_message_id) <> ''
            and provider_message_id = trim(provider_message_id)
        )
    ),
    constraint notifications_deduplication_key_trimmed_chk check (
        deduplication_key is null
        or (
            trim(deduplication_key) <> ''
            and deduplication_key = trim(deduplication_key)
        )
    ),
    constraint notifications_delivery_error_text_trimmed_chk check (
        delivery_error_text is null
        or (
            trim(delivery_error_text) <> ''
            and delivery_error_text = trim(delivery_error_text)
        )
    ),
    constraint notifications_sent_at_order_chk check (
        sent_at is null
        or sent_at >= created_at
    ),
    constraint notifications_delivered_at_order_chk check (
        delivered_at is null
        or delivered_at >= created_at
    ),
    constraint notifications_read_at_order_chk check (
        read_at is null
        or read_at >= created_at
    ),
    constraint notifications_failed_at_order_chk check (
        failed_at is null
        or failed_at >= created_at
    ),
    constraint notifications_hidden_from_chat_at_order_chk check (
        hidden_from_chat_at is null
        or hidden_from_chat_at >= created_at
    )
);

create index notifications_recipient_status_idx
    on app.notifications (recipient_employee_id, notification_status_id);

create index notifications_created_at_idx
    on app.notifications (created_at);

create index notifications_cause_idx
    on app.notifications (cause_table_name, cause_record_id);

create index notifications_deduplication_key_idx
    on app.notifications (recipient_employee_id, notification_channel_id, deduplication_key)
    where deduplication_key is not null;

create index notifications_provider_message_id_idx
    on app.notifications (provider_message_id)
    where provider_message_id is not null;

-- END db/schema/_work/wp_07_notifications/ddl.sql

-- BEGIN db/schema/_work/wp_08_google_sheets_export_runs/ddl.sql

create table app.google_sheets_export_runs (
    google_sheets_export_run_id bigint generated always as identity primary key,
    export_type text not null,
    requested_by_employee_id bigint not null,
    period_from date not null,
    period_to date not null,
    google_sheets_export_status_id bigint null,
    google_spreadsheet_id text null,
    started_at timestamptz not null,
    completed_at timestamptz null,
    error_message text null,
    created_at timestamptz not null default now(),
    constraint google_sheets_export_runs_requested_by_employee_id_fk foreign key (requested_by_employee_id)
        references app.employees (employee_id),
    constraint google_sheets_export_runs_status_id_fk foreign key (google_sheets_export_status_id)
        references app.google_sheets_export_statuses (google_sheets_export_status_id),
    constraint google_sheets_export_runs_export_type_chk check (
        export_type = 'management_mvp_export'
    ),
    constraint google_sheets_export_runs_period_range_chk check (
        period_to >= period_from
    ),
    constraint google_sheets_export_runs_lifecycle_finality_chk check (
        (
            google_sheets_export_status_id is null
            and completed_at is null
        )
        or (
            google_sheets_export_status_id is not null
            and completed_at is not null
        )
    ),
    constraint google_sheets_export_runs_completed_after_started_chk check (
        completed_at is null
        or completed_at >= started_at
    ),
    constraint google_sheets_export_runs_google_spreadsheet_id_trimmed_chk check (
        google_spreadsheet_id is null
        or (
            trim(google_spreadsheet_id) <> ''
            and google_spreadsheet_id = trim(google_spreadsheet_id)
        )
    ),
    constraint google_sheets_export_runs_error_message_trimmed_chk check (
        error_message is null
        or (
            trim(error_message) <> ''
            and error_message = trim(error_message)
        )
    )
);

create index google_sheets_export_runs_created_at_idx
    on app.google_sheets_export_runs (created_at);

create index google_sheets_export_runs_requested_by_employee_id_idx
    on app.google_sheets_export_runs (requested_by_employee_id);

create index google_sheets_export_runs_export_type_idx
    on app.google_sheets_export_runs (export_type);

create index google_sheets_export_runs_status_id_idx
    on app.google_sheets_export_runs (google_sheets_export_status_id)
    where google_sheets_export_status_id is not null;

create index google_sheets_export_runs_running_idx
    on app.google_sheets_export_runs (started_at)
    where google_sheets_export_status_id is null
        and completed_at is null;

-- END db/schema/_work/wp_08_google_sheets_export_runs/ddl.sql

-- BEGIN db/schema/_work/wp_09_final_schema_consistency/ddl.sql

-- WP-09 final consistency pass adds no additional DDL.
-- All schema objects are defined by accepted WP-01 through WP-08 fragments.

-- END db/schema/_work/wp_09_final_schema_consistency/ddl.sql

-- BEGIN EXPORT-SURFACES-001 required MVP export read surfaces

create or replace view app.salary_summary as
with ledger_rows as (
    select
        ese.employee_salary_entry_id,
        ese.employee_id,
        ese.salary_period_date as event_date,
        ese.amount_uzs,
        set_current.is_reversal,
        coalesce(set_original.is_production_operation, set_current.is_production_operation) as is_production_operation,
        coalesce(set_original.is_additional_work, set_current.is_additional_work) as is_additional_work,
        coalesce(set_original.is_salary_correction, set_current.is_salary_correction) as is_salary_correction,
        coalesce(
            set_original.is_production_operation_correction,
            set_current.is_production_operation_correction
        ) as is_production_operation_correction
    from app.employee_salary_entries ese
    join app.salary_entry_types set_current
        on set_current.salary_entry_type_id = ese.salary_entry_type_id
    left join app.employee_salary_entries original
        on original.employee_salary_entry_id = ese.reversed_salary_entry_id
    left join app.salary_entry_types set_original
        on set_original.salary_entry_type_id = original.salary_entry_type_id
)
select
    lr.event_date,
    e.employee_id,
    e.full_name as employee_full_name,
    p.position_id,
    p.position_name,
    coalesce(sum(lr.amount_uzs) filter (where lr.is_production_operation), 0)::numeric(18,4)
        as production_salary_uzs,
    coalesce(sum(lr.amount_uzs) filter (where lr.is_additional_work), 0)::numeric(18,4)
        as additional_work_salary_uzs,
    coalesce(sum(lr.amount_uzs) filter (where lr.is_salary_correction), 0)::numeric(18,4)
        as salary_correction_uzs,
    coalesce(sum(lr.amount_uzs) filter (where lr.is_production_operation_correction), 0)::numeric(18,4)
        as production_correction_uzs,
    coalesce(sum(lr.amount_uzs) filter (where lr.is_reversal), 0)::numeric(18,4)
        as reversal_uzs,
    coalesce(sum(lr.amount_uzs), 0)::numeric(18,4) as total_salary_uzs
from ledger_rows lr
join app.employees e
    on e.employee_id = lr.employee_id
join app.positions p
    on p.position_id = e.position_id
group by
    lr.event_date,
    e.employee_id,
    e.full_name,
    p.position_id,
    p.position_name;

create or replace view app.salary_details as
select
    ese.salary_period_date as event_date,
    e.employee_id,
    e.full_name as employee_full_name,
    ese.employee_salary_entry_id as salary_entry_id,
    set.salary_entry_type_name as salary_entry_type,
    case
        when ese.production_operation_id is not null then 'production_operation'
        when ese.additional_work_id is not null then 'additional_work'
        when ese.salary_correction_id is not null then 'salary_correction'
        when ese.production_operation_correction_id is not null then 'production_operation_correction'
        when ese.reversed_salary_entry_id is not null then 'reversal'
        else 'unknown'
    end as source_type,
    ese.amount_uzs,
    ese.accrued_at,
    ese.production_operation_id,
    ese.additional_work_id,
    coalesce(ese.machine_id_snapshot, po.machine_id) as machine_id,
    m.machine_name,
    coalesce(ese.sku_id_snapshot, po.sku_id) as sku_id,
    coalesce(ese.sku_code_snapshot, s.sku_code) as sku_code,
    coalesce(ese.sku_name_snapshot, s.sku_name) as sku_name,
    su.sku_unit_name,
    ese.quantity as quantity_produced,
    ese.tariff_rate_uzs as sku_tariff_snapshot_uzs,
    ese.salary_correction_id,
    ese.production_operation_correction_id,
    ese.reversed_salary_entry_id,
    ese.reversal_reason
from app.employee_salary_entries ese
join app.salary_entry_types set
    on set.salary_entry_type_id = ese.salary_entry_type_id
join app.employees e
    on e.employee_id = ese.employee_id
left join app.production_operations po
    on po.production_operation_id = ese.production_operation_id
left join app.machines m
    on m.machine_id = coalesce(ese.machine_id_snapshot, po.machine_id)
left join app.skus s
    on s.sku_id = coalesce(ese.sku_id_snapshot, po.sku_id)
left join app.sku_units su
    on su.sku_unit_id = s.sku_unit_id;

create or replace view app.additional_work_details as
select
    (
        coalesce(
            aw.accrued_at,
            aw.cancelled_at,
            aw.decision_at,
            aw.finished_at,
            aw.started_at,
            aw.assigned_at
        ) at time zone 'Asia/Tashkent'
    )::date as event_date,
    e.employee_id,
    e.full_name as employee_full_name,
    aw.additional_work_id,
    aw.additional_work_type_id,
    awt.additional_work_type_name,
    aw.assigned_at,
    aw.started_at,
    aw.finished_at,
    aw.decision_at,
    aw.cancelled_at,
    aws.additional_work_approval_status_name as approval_status,
    acs.additional_work_accrual_status_name as accrual_status,
    aw.accrued_at,
    aw.amount_uzs,
    ese.employee_salary_entry_id as salary_entry_id,
    aw.manager_decision_comment,
    aw.cancel_reason
from app.additional_works aw
join app.employees e
    on e.employee_id = aw.employee_id
join app.additional_work_types awt
    on awt.additional_work_type_id = aw.additional_work_type_id
join app.additional_work_approval_statuses aws
    on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
left join app.additional_work_accrual_statuses acs
    on acs.additional_work_accrual_status_id = aw.additional_work_accrual_status_id
left join app.employee_salary_entries ese
    on ese.additional_work_id = aw.additional_work_id
   and ese.reversed_salary_entry_id is null;

create or replace view app.machine_output_details as
with approved_corrections as (
    select
        poc.production_operation_id,
        coalesce(sum(poc.correction_quantity_delta), 0)::numeric(18,3) as correction_quantity_delta
    from app.production_operation_corrections poc
    join app.production_operation_correction_statuses pcs
        on pcs.production_operation_correction_status_id = poc.production_operation_correction_status_id
    where pcs.is_active = true
      and pcs.is_approved = true
      and poc.correction_quantity_delta is not null
    group by poc.production_operation_id
),
production_correction_salary as (
    select
        poc.production_operation_id,
        coalesce(sum(ese.amount_uzs), 0)::numeric(18,4) as production_correction_salary_uzs
    from app.production_operation_corrections poc
    join app.employee_salary_entries ese
        on ese.production_operation_correction_id = poc.production_operation_correction_id
       and ese.reversed_salary_entry_id is null
    join app.salary_entry_types set
        on set.salary_entry_type_id = ese.salary_entry_type_id
       and set.is_production_operation_correction = true
    group by poc.production_operation_id
),
production_salary as (
    select
        ese.production_operation_id,
        ese.employee_salary_entry_id,
        ese.amount_uzs,
        ese.tariff_rate_uzs
    from app.employee_salary_entries ese
    join app.salary_entry_types set
        on set.salary_entry_type_id = ese.salary_entry_type_id
       and set.is_production_operation = true
    where ese.production_operation_id is not null
      and ese.reversed_salary_entry_id is null
)
select
    (po.finished_at at time zone 'Asia/Tashkent')::date as event_date,
    po.production_operation_id,
    m.machine_id,
    m.machine_name,
    s.sku_id,
    s.sku_code,
    s.sku_name,
    su.sku_unit_name,
    e.employee_id,
    e.full_name as employee_full_name,
    po.started_at,
    po.finished_at,
    po.quantity_produced,
    ps.tariff_rate_uzs as sku_tariff_snapshot_uzs,
    ps.employee_salary_entry_id as salary_entry_id,
    ps.amount_uzs as salary_amount_uzs,
    coalesce(ac.correction_quantity_delta, 0)::numeric(18,3) as correction_quantity_delta,
    (po.quantity_produced + coalesce(ac.correction_quantity_delta, 0))::numeric(18,3)
        as corrected_total_quantity_produced,
    coalesce(pcs.production_correction_salary_uzs, 0)::numeric(18,4) as production_correction_salary_uzs
from app.production_operations po
join app.production_operation_statuses pos
    on pos.production_operation_status_id = po.production_operation_status_id
   and pos.is_active = true
   and pos.is_closed = true
join app.machines m
    on m.machine_id = po.machine_id
join app.skus s
    on s.sku_id = po.sku_id
join app.sku_units su
    on su.sku_unit_id = s.sku_unit_id
join app.employees e
    on e.employee_id = po.employee_id
left join production_salary ps
    on ps.production_operation_id = po.production_operation_id
left join approved_corrections ac
    on ac.production_operation_id = po.production_operation_id
left join production_correction_salary pcs
    on pcs.production_operation_id = po.production_operation_id
where po.finished_at is not null;

create or replace view app.machine_output_summary as
select
    mod.event_date,
    mod.machine_id,
    mod.machine_name,
    mod.sku_id,
    mod.sku_code,
    mod.sku_name,
    mod.sku_unit_name,
    coalesce(sum(mod.quantity_produced + mod.correction_quantity_delta), 0)::numeric(18,3)
        as total_quantity_produced,
    count(*)::bigint as operations_count,
    count(distinct mod.employee_id)::bigint as operators_count,
    coalesce(sum(mod.salary_amount_uzs), 0)::numeric(18,4)
        + coalesce(sum(mod.production_correction_salary_uzs), 0)::numeric(18,4)
        as total_production_salary_uzs
from app.machine_output_details mod
group by
    mod.event_date,
    mod.machine_id,
    mod.machine_name,
    mod.sku_id,
    mod.sku_code,
    mod.sku_name,
    mod.sku_unit_name;

-- END EXPORT-SURFACES-001 required MVP export read surfaces
