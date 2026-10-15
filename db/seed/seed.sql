-- seed.sql assembled from accepted seed WP fragments.

-- Canonical public seed baseline.


-- BEGIN db/seed/_work/wp_01_core_dictionaries/seed.sql

insert into app.positions (
    position_name,
    position_description,
    is_production_position,
    is_active
)
values
    ('Оператор', null, true, true),
    ('Начальник производства', null, true, true),
    ('Руководитель администрации', null, false, true),
    ('Директор', null, false, true),
    ('Администратор системы', null, false, true)
on conflict (position_name) do update
set
    position_description = excluded.position_description,
    is_production_position = excluded.is_production_position,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.employee_statuses (
    employee_status_name,
    is_active_for_login,
    is_final,
    is_active
)
values
    ('Работает', true, false, true),
    ('Уволен', false, true, true),
    ('Заблокирован', false, false, true)
on conflict (employee_status_name) do update
set
    is_active_for_login = excluded.is_active_for_login,
    is_final = excluded.is_final,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.machine_statuses (
    machine_status_name,
    is_available_for_start,
    is_running_status,
    is_downtime_status,
    is_broken_status,
    requires_attention,
    is_active
)
values
    ('Свободен', true, false, false, false, false, true),
    ('Работает', false, true, false, false, false, true),
    ('Простаивает', false, false, true, false, true, true),
    ('Сломан', false, false, true, true, true, true)
on conflict (machine_status_name) do update
set
    is_available_for_start = excluded.is_available_for_start,
    is_running_status = excluded.is_running_status,
    is_downtime_status = excluded.is_downtime_status,
    is_broken_status = excluded.is_broken_status,
    requires_attention = excluded.requires_attention,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.machine_use_statuses (
    machine_use_status_name,
    is_available_for_operations,
    is_decommissioned,
    is_active
)
values
    ('Используется', true, false, true),
    ('Списан', false, true, true)
on conflict (machine_use_status_name) do update
set
    is_available_for_operations = excluded.is_available_for_operations,
    is_decommissioned = excluded.is_decommissioned,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.sku_units (
    sku_unit_name,
    allows_fractional_quantity,
    is_active
)
values
    ('шт', false, true),
    ('кг', true, true)
on conflict (sku_unit_name) do update
set
    allows_fractional_quantity = excluded.allows_fractional_quantity,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.production_operation_statuses (
    production_operation_status_name,
    is_open,
    is_closed,
    is_cancelled,
    allows_salary_accrual,
    is_active
)
values
    ('Активна', true, false, false, false, true),
    ('Закрыта', false, true, false, true, true),
    ('Отменена', false, false, true, false, true)
on conflict (production_operation_status_name) do update
set
    is_open = excluded.is_open,
    is_closed = excluded.is_closed,
    is_cancelled = excluded.is_cancelled,
    allows_salary_accrual = excluded.allows_salary_accrual,
    is_active = excluded.is_active,
    updated_at = now();

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
values
    (
        'operational_downtime_v1',
        'Стандартный операционный простой v1',
        'OPERATIONAL',
        true,
        false,
        true,
        true,
        true,
        'DOWNTIME',
        'yellow',
        true
    ),
    (
        'critical_repair_downtime_v1',
        'Критический ремонтный простой v1',
        'CRITICAL',
        false,
        true,
        true,
        false,
        false,
        'BROKEN',
        'scarlet',
        true
    ),
    (
        'critical_setup_downtime_v1',
        'Критический настроечный простой v1',
        'CRITICAL',
        false,
        true,
        true,
        false,
        false,
        'DOWNTIME',
        'scarlet',
        true
    )
on conflict (technical_code) do nothing;

insert into app.machine_downtime_types (
    technical_code,
    machine_downtime_type_name,
    display_order,
    downtime_class,
    machine_downtime_behavior_profile_id,
    is_active
)
select seed.technical_code,
       seed.machine_downtime_type_name,
       seed.display_order,
       seed.downtime_class,
       profile.machine_downtime_behavior_profile_id,
       true
from (
    values
        ('repair_required', 'Требуется ремонт', 10, 'CRITICAL', 'critical_repair_downtime_v1'),
        ('setup_required', 'Требуется настройка', 20, 'CRITICAL', 'critical_setup_downtime_v1'),
        ('material_waiting', 'Ожидание материала', 10, 'OPERATIONAL', 'operational_downtime_v1'),
        ('other_operational', 'Другое', 20, 'OPERATIONAL', 'operational_downtime_v1')
) as seed(
    technical_code,
    machine_downtime_type_name,
    display_order,
    downtime_class,
    profile_technical_code
)
join app.machine_downtime_behavior_profiles profile
    on profile.technical_code = seed.profile_technical_code
on conflict (technical_code) do nothing;

insert into app.machine_downtime_profile_notification_rules (
    machine_downtime_behavior_profile_id,
    technical_code,
    threshold_minutes,
    recipient_permission_code,
    notification_kind,
    priority,
    is_active
)
select profile.machine_downtime_behavior_profile_id,
       seed.technical_code,
       seed.threshold_minutes,
       seed.recipient_permission_code,
       seed.notification_kind,
       seed.priority,
       true
from (
    values
        (
            'operational_downtime_v1',
            'production_head_15min',
            15,
            'can_receive_production_notifications',
            'ELAPSED_THRESHOLD',
            10
        ),
        (
            'operational_downtime_v1',
            'director_30min',
            30,
            'can_receive_director_notifications',
            'ELAPSED_THRESHOLD',
            20
        ),
        (
            'critical_repair_downtime_v1',
            'production_head_repair',
            0,
            'can_receive_production_notifications',
            'TYPE_IMMEDIATE',
            10
        ),
        (
            'critical_repair_downtime_v1',
            'director_30min',
            30,
            'can_receive_director_notifications',
            'ELAPSED_THRESHOLD',
            20
        ),
        (
            'critical_setup_downtime_v1',
            'production_head_setup',
            0,
            'can_receive_production_notifications',
            'TYPE_IMMEDIATE',
            10
        ),
        (
            'critical_setup_downtime_v1',
            'director_30min',
            30,
            'can_receive_director_notifications',
            'ELAPSED_THRESHOLD',
            20
        )
) as seed(
    profile_technical_code,
    technical_code,
    threshold_minutes,
    recipient_permission_code,
    notification_kind,
    priority
)
join app.machine_downtime_behavior_profiles profile
    on profile.technical_code = seed.profile_technical_code
on conflict (machine_downtime_behavior_profile_id, technical_code) do nothing;

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
    'standard_operator_break_v1',
    'Стандартный перерыв Оператора v1',
    true,
    true,
    true,
    true,
    true,
    true,
    true
)
on conflict (technical_code) do nothing;

insert into app.operator_break_types (
    technical_code,
    operator_break_type_name,
    display_order,
    operator_break_behavior_profile_id,
    is_active
)
select seed.technical_code,
       seed.operator_break_type_name,
       seed.display_order,
       profile.operator_break_behavior_profile_id,
       true
from (
    values
        ('lunch', 'Обед', 10),
        ('personal_needs', 'Личные нужды', 20)
) as seed(technical_code, operator_break_type_name, display_order)
cross join lateral (
    select obbp.operator_break_behavior_profile_id
    from app.operator_break_behavior_profiles obbp
    where obbp.technical_code = 'standard_operator_break_v1'
) profile
on conflict (technical_code) do nothing;

insert into app.additional_work_types (
    additional_work_type_name,
    is_active
)
values
    ('Уборка', true),
    ('Упаковка', true),
    ('Помощь складу', true),
    ('Настройка оборудования', true),
    ('Погрузка', true),
    ('Другое', true)
on conflict (additional_work_type_name) do update
set
    is_active = excluded.is_active,
    updated_at = now();

insert into app.additional_work_approval_statuses (
    additional_work_approval_status_name,
    is_pending,
    is_approved,
    is_rejected,
    is_cancelled,
    is_active
)
values
    ('На подтверждении', true, false, false, false, true),
    ('Подтверждена', false, true, false, false, true),
    ('Отклонена', false, false, true, false, true),
    ('Отменена', false, false, false, true, true)
on conflict (additional_work_approval_status_name) do update
set
    is_pending = excluded.is_pending,
    is_approved = excluded.is_approved,
    is_rejected = excluded.is_rejected,
    is_cancelled = excluded.is_cancelled,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.additional_work_accrual_statuses (
    additional_work_accrual_status_name,
    is_waiting_accrual,
    is_accrued,
    is_without_accrual,
    is_active
)
values
    ('Не начислена', true, false, false, true),
    ('Начислена', false, true, false, true),
    ('Без начисления', false, false, true, true)
on conflict (additional_work_accrual_status_name) do update
set
    is_waiting_accrual = excluded.is_waiting_accrual,
    is_accrued = excluded.is_accrued,
    is_without_accrual = excluded.is_without_accrual,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.salary_entry_types (
    salary_entry_type_name,
    is_production_operation,
    is_additional_work,
    is_salary_correction,
    is_production_operation_correction,
    is_reversal,
    is_active
)
values
    ('Производственная операция', true, false, false, false, false, true),
    ('Дополнительная работа', false, true, false, false, false, true),
    ('Корректировка зарплаты', false, false, true, false, false, true),
    ('Корректировка производственной операции', false, false, false, true, false, true),
    ('Сторно', false, false, false, false, true, true)
on conflict (salary_entry_type_name) do update
set
    is_production_operation = excluded.is_production_operation,
    is_additional_work = excluded.is_additional_work,
    is_salary_correction = excluded.is_salary_correction,
    is_production_operation_correction = excluded.is_production_operation_correction,
    is_reversal = excluded.is_reversal,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.period_types (
    period_type_name,
    is_day,
    is_week,
    is_month,
    is_active
)
values
    ('День', true, false, false, true),
    ('Неделя', false, true, false, true),
    ('Месяц', false, false, true, true)
on conflict (period_type_name) do update
set
    is_day = excluded.is_day,
    is_week = excluded.is_week,
    is_month = excluded.is_month,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.notification_channels (
    notification_channel_name,
    is_telegram,
    is_active
)
values
    ('Telegram', true, true)
on conflict (notification_channel_name) do update
set
    is_telegram = excluded.is_telegram,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.notification_statuses (
    notification_status_name,
    is_created,
    is_sent,
    is_delivered,
    is_read,
    is_failed,
    is_cancelled,
    is_active
)
values
    ('Создано', true, false, false, false, false, false, true),
    ('Отправлено', false, true, false, false, false, false, true),
    ('Доставлено', false, false, true, false, false, false, true),
    ('Прочитано', false, false, false, true, false, false, true),
    ('Ошибка', false, false, false, false, true, false, true),
    ('Отменено', false, false, false, false, false, true, true)
on conflict (notification_status_name) do update
set
    is_created = excluded.is_created,
    is_sent = excluded.is_sent,
    is_delivered = excluded.is_delivered,
    is_read = excluded.is_read,
    is_failed = excluded.is_failed,
    is_cancelled = excluded.is_cancelled,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.google_sheets_export_statuses (
    google_sheets_export_status_name,
    is_success,
    is_failed,
    is_cancelled,
    is_active
)
values
    ('Успешно', true, false, false, true),
    ('Ошибка', false, true, false, true),
    ('Отменено', false, false, true, true)
on conflict (google_sheets_export_status_name) do update
set
    is_success = excluded.is_success,
    is_failed = excluded.is_failed,
    is_cancelled = excluded.is_cancelled,
    is_active = excluded.is_active,
    updated_at = now();

-- END db/seed/_work/wp_01_core_dictionaries/seed.sql

-- BEGIN db/seed/_work/wp_02_roles_permission_matrix/seed.sql

insert into app.roles (
    role_name,
    role_description,
    is_active,
    can_work_as_operator,
    can_manage_production,
    can_manage_admin,
    can_manage_telegram_binding,
    can_view_audit,
    can_change_sku_tariff,
    can_salary_correction_production,
    can_salary_correction_general,
    can_salary_correction_all,
    can_reverse_salary_production,
    can_reverse_salary_all,
    can_correct_production_operations,
    can_manage_employees,
    can_manage_positions,
    can_manage_roles_limited,
    can_manage_roles_all,
    can_manage_dictionaries,
    can_view_admin_reports,
    can_reverse_salary_corrections_only,
    can_receive_production_notifications,
    can_receive_director_notifications,
    can_system_emergency_actions,
    can_access_admin_panel
)
values
    (
        'Рабочий',
        null,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false
    ),
    (
        'Руководитель производства',
        null,
        true,
        false,
        true,
        false,
        false,
        true,
        true,
        true,
        false,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        true,
        false,
        true,
        false,
        false,
        true
    ),
    (
        'Руководитель администрации',
        null,
        true,
        false,
        false,
        true,
        true,
        true,
        false,
        false,
        true,
        false,
        false,
        false,
        false,
        true,
        true,
        true,
        false,
        false,
        true,
        true,
        false,
        false,
        false,
        true
    ),
    (
        'Директор',
        null,
        true,
        false,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        true
    ),
    (
        'Администратор системы',
        null,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        true
    )
on conflict (role_name) do update
set
    role_description = excluded.role_description,
    is_active = excluded.is_active,
    can_work_as_operator = excluded.can_work_as_operator,
    can_manage_production = excluded.can_manage_production,
    can_manage_admin = excluded.can_manage_admin,
    can_manage_telegram_binding = excluded.can_manage_telegram_binding,
    can_view_audit = excluded.can_view_audit,
    can_change_sku_tariff = excluded.can_change_sku_tariff,
    can_salary_correction_production = excluded.can_salary_correction_production,
    can_salary_correction_general = excluded.can_salary_correction_general,
    can_salary_correction_all = excluded.can_salary_correction_all,
    can_reverse_salary_production = excluded.can_reverse_salary_production,
    can_reverse_salary_all = excluded.can_reverse_salary_all,
    can_correct_production_operations = excluded.can_correct_production_operations,
    can_manage_employees = excluded.can_manage_employees,
    can_manage_positions = excluded.can_manage_positions,
    can_manage_roles_limited = excluded.can_manage_roles_limited,
    can_manage_roles_all = excluded.can_manage_roles_all,
    can_manage_dictionaries = excluded.can_manage_dictionaries,
    can_view_admin_reports = excluded.can_view_admin_reports,
    can_reverse_salary_corrections_only = excluded.can_reverse_salary_corrections_only,
    can_receive_production_notifications = excluded.can_receive_production_notifications,
    can_receive_director_notifications = excluded.can_receive_director_notifications,
    can_system_emergency_actions = excluded.can_system_emergency_actions,
    can_access_admin_panel = excluded.can_access_admin_panel,
    updated_at = now();

-- END db/seed/_work/wp_02_roles_permission_matrix/seed.sql

-- BEGIN db/seed/_work/wp_03_salary_correction_dictionaries/seed.sql

insert into app.salary_correction_types (
    salary_correction_type_name,
    is_active
)
values
    ('Начисление', true),
    ('Удержание', true),
    ('Другое', true)
on conflict (salary_correction_type_name) do update
set
    is_active = excluded.is_active,
    updated_at = now();

insert into app.salary_correction_statuses (
    salary_correction_status_name,
    is_pending,
    is_approved,
    is_rejected,
    is_cancelled,
    is_active
)
values
    ('На подтверждении', true, false, false, false, true),
    ('Подтверждена', false, true, false, false, true),
    ('Отклонена', false, false, true, false, true),
    ('Отменена', false, false, false, true, true)
on conflict (salary_correction_status_name) do update
set
    is_pending = excluded.is_pending,
    is_approved = excluded.is_approved,
    is_rejected = excluded.is_rejected,
    is_cancelled = excluded.is_cancelled,
    is_active = excluded.is_active,
    updated_at = now();

insert into app.production_operation_correction_statuses (
    production_operation_correction_status_name,
    is_pending,
    is_approved,
    is_rejected,
    is_cancelled,
    is_active
)
values
    ('На подтверждении', true, false, false, false, true),
    ('Подтверждена', false, true, false, false, true),
    ('Отклонена', false, false, true, false, true),
    ('Отменена', false, false, false, true, true)
on conflict (production_operation_correction_status_name) do update
set
    is_pending = excluded.is_pending,
    is_approved = excluded.is_approved,
    is_rejected = excluded.is_rejected,
    is_cancelled = excluded.is_cancelled,
    is_active = excluded.is_active,
    updated_at = now();

-- END db/seed/_work/wp_03_salary_correction_dictionaries/seed.sql
