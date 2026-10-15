-- verify_schema.sql
-- Read-only verification artifact for the accepted SQL package.
-- Expected execution order before this file:
-- schema.sql -> seed.sql -> functions.sql -> grants.sql -> verify_schema.sql

with
expected_tables(table_name) as (
    values
        ('positions'),
        ('employee_statuses'),
        ('machine_statuses'),
        ('machine_use_statuses'),
        ('sku_units'),
        ('production_operation_statuses'),
        ('machine_downtime_behavior_profiles'),
        ('machine_downtime_types'),
        ('machine_downtime_profile_notification_rules'),
        ('operator_break_behavior_profiles'),
        ('operator_break_types'),
        ('additional_work_types'),
        ('additional_work_approval_statuses'),
        ('additional_work_accrual_statuses'),
        ('salary_entry_types'),
        ('period_types'),
        ('notification_channels'),
        ('notification_statuses'),
        ('google_sheets_export_statuses'),
        ('roles'),
        ('employees'),
        ('employee_roles'),
        ('admin_password_credentials'),
        ('admin_sessions'),
        ('admin_telegram_qr_challenges'),
        ('employee_shifts'),
        ('machines'),
        ('skus'),
        ('production_operations'),
        ('machine_status_events'),
        ('machine_downtimes'),
        ('operator_breaks'),
        ('additional_works'),
        ('salary_correction_types'),
        ('salary_correction_statuses'),
        ('production_operation_correction_statuses'),
        ('salary_corrections'),
        ('production_operation_corrections'),
        ('employee_salary_entries'),
        ('employee_salary_period_totals'),
        ('salary_total_discrepancy_logs'),
        ('audit_events'),
        ('telegram_contact_proofs'),
        ('notifications'),
        ('google_sheets_export_runs')
),
expected_roles(role_name) as (
    values
        ('app_owner_role'),
        ('migration_role'),
        ('app_runtime_role'),
        ('readonly_role')
),
expected_export_surfaces(surface_name) as (
    values
        ('salary_summary'),
        ('salary_details'),
        ('additional_work_details'),
        ('machine_output_summary'),
        ('machine_output_details')
),
expected_runtime_functions(function_name) as (
    values
        ('start_employee_shift'),
        ('finish_employee_shift'),
        ('emergency_close_employee_shift'),
        ('create_employee'),
        ('update_employee'),
        ('change_employee_status'),
        ('assign_employee_role'),
        ('revoke_employee_role'),
        ('bind_employee_telegram_user'),
        ('reset_employee_telegram_user'),
        ('identify_employee_for_telegram_self_binding'),
        ('confirm_employee_telegram_self_binding'),
        ('record_telegram_contact_proof'),
        ('consume_telegram_contact_proof'),
        ('finalize_telegram_contact_proof'),
        ('rotate_machine_qr_token'),
        ('rotate_sku_qr_token'),
        ('update_sku_tariff'),
        ('create_operator_break_behavior_profile'),
        ('create_operator_break_type'),
        ('deactivate_operator_break_type'),
        ('deactivate_operator_break_behavior_profile'),
        ('create_operational_downtime_behavior_profile'),
        ('create_critical_downtime_behavior_profile'),
        ('create_operational_downtime_type'),
        ('create_critical_downtime_type'),
        ('deactivate_operational_downtime_type'),
        ('deactivate_critical_downtime_type'),
        ('deactivate_operational_downtime_behavior_profile'),
        ('deactivate_critical_downtime_behavior_profile'),
        ('create_operational_downtime_notification_rule'),
        ('create_critical_downtime_notification_rule'),
        ('deactivate_operational_downtime_notification_rule'),
        ('deactivate_critical_downtime_notification_rule'),
        ('start_production_operation'),
        ('finish_production_operation'),
        ('cancel_production_operation'),
        ('start_machine_downtime'),
        ('finish_machine_downtime'),
        ('cancel_machine_downtime'),
        ('start_operator_break'),
        ('finish_operator_break'),
        ('emergency_finish_operator_break'),
        ('request_additional_work'),
        ('approve_additional_work_request'),
        ('reject_additional_work_request'),
        ('assign_additional_work'),
        ('start_additional_work'),
        ('finish_additional_work'),
        ('approve_additional_work'),
        ('reject_additional_work'),
        ('cancel_additional_work'),
        ('mark_additional_work_without_accrual'),
        ('accrue_additional_work_salary'),
        ('create_salary_correction'),
        ('approve_salary_correction'),
        ('reject_salary_correction'),
        ('cancel_salary_correction'),
        ('create_production_operation_correction'),
        ('approve_production_operation_correction'),
        ('reject_production_operation_correction'),
        ('cancel_production_operation_correction'),
        ('reverse_salary_entry'),
        ('emergency_reverse_salary_entry'),
        ('mark_notification_sent'),
        ('mark_notification_delivered'),
        ('mark_notification_read'),
        ('mark_notification_failed'),
        ('hide_notification_from_chat'),
        ('scan_active_downtimes_for_notifications'),
        ('create_google_sheets_export_run'),
        ('finish_google_sheets_export_run_success'),
        ('finish_google_sheets_export_run_failed'),
        ('cancel_google_sheets_export_run'),
        ('read_admin_password_credential'),
        ('record_admin_password_failure'),
        ('start_admin_password_session'),
        ('create_admin_telegram_qr_challenge'),
        ('confirm_admin_telegram_qr_challenge'),
        ('claim_admin_telegram_qr_challenge'),
        ('resolve_admin_session'),
        ('read_admin_password_credential_for_session'),
        ('change_admin_password'),
        ('revoke_admin_session'),
        ('read_admin_overview'),
        ('read_admin_directory'),
        ('prepare_admin_qr_label'),
        ('save_admin_employee'),
        ('save_admin_position'),
        ('save_admin_machine'),
        ('save_admin_sku'),
        ('save_admin_additional_work_type'),
        ('create_admin_activity_type'),
        ('move_admin_activity_type'),
        ('deactivate_admin_activity_type')
),
expected_role_matrix as (
    select *
    from (
        values
            ('Рабочий', true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false),
            ('Руководитель производства', false, true, false, false, true, true, true, false, true, true, true, true, false, false, false, false, false, true, false, true, false, false, true),
            ('Руководитель администрации', false, false, true, true, true, false, false, true, false, false, false, false, true, true, true, false, false, true, true, false, false, false, true),
            ('Директор', false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, false, true),
            ('Администратор системы', false, false, false, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, true)
    ) as t(
        role_name,
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
),
app_functions as (
    select
        p.oid,
        p.proname,
        p.prosecdef,
        p.proowner,
        p.proconfig,
        coalesce(d.description, '') as description,
        pg_get_functiondef(p.oid) as function_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'app'
    left join pg_description d on d.objoid = p.oid and d.classoid = 'pg_proc'::regclass
),
function_summary as (
    select
        count(*) as total_functions,
        count(*) filter (where description like 'runtime_api:%') as runtime_api_count,
        count(*) filter (where description like 'internal_helper:%') as internal_helper_count,
        count(*) filter (where description like 'maintenance_api:%') as maintenance_api_count,
        count(*) filter (where prosecdef) as security_definer_count,
        count(*) filter (where proconfig @> array['search_path=app, pg_catalog']) as fixed_search_path_count,
        count(*) filter (where pg_get_userbyid(proowner) = 'app_runtime_role') as runtime_owned_count,
        count(*) filter (where description like 'runtime_api:%' and has_function_privilege('app_runtime_role', oid, 'EXECUTE')) as runtime_exec_count,
        count(*) filter (where description like 'internal_helper:%' and has_function_privilege('app_runtime_role', oid, 'EXECUTE')) as runtime_internal_exec_count,
        count(*) filter (where description like 'maintenance_api:%' and has_function_privilege('app_runtime_role', oid, 'EXECUTE')) as runtime_maintenance_exec_count,
        count(*) filter (where has_function_privilege('readonly_role', oid, 'EXECUTE')) as readonly_exec_count
    from app_functions
),
table_privileges as (
    select
        count(*) filter (where grantee = 'app_runtime_role' and privilege_type = 'SELECT') as runtime_select_count,
        count(*) filter (where grantee = 'readonly_role' and privilege_type = 'SELECT') as readonly_select_count,
        count(*) filter (where grantee = 'app_runtime_role' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')) as runtime_dml_count,
        count(*) filter (where grantee = 'readonly_role' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')) as readonly_dml_count,
        count(*) filter (where grantee = 'PUBLIC') as public_table_privilege_count
    from information_schema.table_privileges
    where table_schema = 'app'
),
sequence_privileges as (
    select count(*) as runtime_or_readonly_sequence_privileges
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app'
      and c.relkind = 'S'
      and (
          has_sequence_privilege('app_runtime_role', c.oid, 'USAGE')
          or has_sequence_privilege('app_runtime_role', c.oid, 'SELECT')
          or has_sequence_privilege('app_runtime_role', c.oid, 'UPDATE')
          or has_sequence_privilege('readonly_role', c.oid, 'USAGE')
          or has_sequence_privilege('readonly_role', c.oid, 'SELECT')
          or has_sequence_privilege('readonly_role', c.oid, 'UPDATE')
      )
),
public_function_privileges as (
    select count(*) as public_execute_count
    from app_functions
    where has_function_privilege('public', oid, 'EXECUTE')
),
surface_objects as (
    select e.surface_name, c.relkind
    from expected_export_surfaces e
    left join pg_class c
      on c.relname = e.surface_name
     and c.relnamespace = 'app'::regnamespace
     and c.relkind in ('v', 'm')
),
checks as (
    select
        'V01_SCHEMA_ROLES_GRANTS' as check_group,
        'V01_001_APP_SCHEMA_EXISTS' as check_id,
        case when to_regnamespace('app') is not null then 'PASS' else 'FAIL' end as result,
        'Application schema app exists.' as message,
        null::text as details

    union all
    select
        'V01_SCHEMA_ROLES_GRANTS',
        'V01_002_REQUIRED_TABLES_EXIST',
        case when count(t.table_name) = count(et.table_name) then 'PASS' else 'FAIL' end,
        'All required application tables exist.',
        'expected=' || count(et.table_name) || '; found=' || count(t.table_name)
    from expected_tables et
    left join information_schema.tables t
      on t.table_schema = 'app'
     and t.table_name = et.table_name
     and t.table_type = 'BASE TABLE'

    union all
    select
        'V01_SCHEMA_ROLES_GRANTS',
        'V01_003_REQUIRED_DB_ROLES_EXIST',
        case when count(r.rolname) = count(er.role_name) then 'PASS' else 'FAIL' end,
        'Required PostgreSQL capability roles exist.',
        'expected=' || count(er.role_name) || '; found=' || count(r.rolname)
    from expected_roles er
    left join pg_roles r on r.rolname = er.role_name

    union all
    select
        'V01_SCHEMA_ROLES_GRANTS',
        'V01_004_SCHEMA_PRIVILEGE_BOUNDARY',
        case when
            has_schema_privilege('app_runtime_role', 'app', 'USAGE')
            and not has_schema_privilege('app_runtime_role', 'app', 'CREATE')
            and has_schema_privilege('readonly_role', 'app', 'USAGE')
            and not has_schema_privilege('readonly_role', 'app', 'CREATE')
            and has_schema_privilege('migration_role', 'app', 'CREATE')
            and not has_schema_privilege('public', 'app', 'USAGE')
            and not has_schema_privilege('public', 'app', 'CREATE')
        then 'PASS' else 'FAIL' end,
        'Schema privilege boundary matches accepted role model.',
        'runtime_usage=' || has_schema_privilege('app_runtime_role', 'app', 'USAGE')
        || '; runtime_create=' || has_schema_privilege('app_runtime_role', 'app', 'CREATE')
        || '; readonly_usage=' || has_schema_privilege('readonly_role', 'app', 'USAGE')
        || '; readonly_create=' || has_schema_privilege('readonly_role', 'app', 'CREATE')
        || '; migration_create=' || has_schema_privilege('migration_role', 'app', 'CREATE')
        || '; public_usage=' || has_schema_privilege('public', 'app', 'USAGE')
        || '; public_create=' || has_schema_privilege('public', 'app', 'CREATE')

    union all
    select
        'V01_SCHEMA_ROLES_GRANTS',
        'V01_005_RUNTIME_READONLY_DIRECT_DML_DENY',
        case when runtime_dml_count = 0 and readonly_dml_count = 0 then 'PASS' else 'FAIL' end,
        'Runtime and readonly roles have no direct table DML privileges.',
        'runtime_dml=' || runtime_dml_count || '; readonly_dml=' || readonly_dml_count
    from table_privileges

    union all
    select
        'V01_SCHEMA_ROLES_GRANTS',
        'V01_009_SKU_QR_SCHEMA_CONTRACT',
        case when
            exists (
                select 1
                from information_schema.columns c
                where c.table_schema = 'app'
                  and c.table_name = 'skus'
                  and c.column_name = 'sku_qr_token'
                  and c.data_type = 'text'
                  and c.is_nullable = 'NO'
            )
            and exists (
                select 1
                from pg_constraint con
                where con.conrelid = 'app.skus'::regclass
                  and con.conname = 'skus_sku_qr_token_uniq'
                  and con.contype = 'u'
            )
            and exists (
                select 1
                from pg_constraint con
                where con.conrelid = 'app.skus'::regclass
                  and con.conname = 'skus_sku_qr_token_format_chk'
                  and con.contype = 'c'
            )
            and not exists (
                select 1
                from app.skus s
                where s.sku_qr_token !~ '^[A-Za-z0-9_-]{32}$'
            )
        then 'PASS' else 'FAIL' end,
        'SKU QR tokens are required, unique, and exactly 32 base64url characters.',
        'bad_rows=' || (select count(*) from app.skus s where s.sku_qr_token !~ '^[A-Za-z0-9_-]{32}$')

    union all
    select
        'V01_SCHEMA_ROLES_GRANTS',
        'V01_006_RUNTIME_READONLY_SEQUENCE_DENY',
        case when runtime_or_readonly_sequence_privileges = 0 then 'PASS' else 'FAIL' end,
        'Runtime and readonly roles have no direct sequence privileges.',
        'runtime_or_readonly_sequence_privileges=' || runtime_or_readonly_sequence_privileges
    from sequence_privileges

    union all
    select
        'V01_SCHEMA_ROLES_GRANTS',
        'V01_007_PUBLIC_OBJECT_PRIVILEGE_DENY',
        case when public_table_privilege_count = 0 and public_execute_count = 0 then 'PASS' else 'FAIL' end,
        'PUBLIC has no application table or function privileges.',
        'public_table_privileges=' || public_table_privilege_count || '; public_function_exec=' || public_execute_count
    from table_privileges, public_function_privileges

    union all
    select
        'V01_SCHEMA_ROLES_GRANTS',
        'V01_008_RUNTIME_READ_SURFACE_COUNT',
        case when runtime_select_count = 45 and readonly_select_count = 45 then 'PASS' else 'FAIL' end,
        'Runtime and readonly SELECT surfaces match accepted grants.',
        'runtime_select=' || runtime_select_count || '; readonly_select=' || readonly_select_count
    from table_privileges

    union all
    select
        'V02_SEED_DICTIONARIES',
        'V02_001_CORE_DICTIONARY_COUNTS',
        case when
            (select count(*) from app.positions) = 5
            and (select count(*) from app.employee_statuses) = 3
            and (select count(*) from app.machine_statuses) = 4
            and (select count(*) from app.machine_use_statuses) = 2
            and (select count(*) from app.sku_units) = 2
            and (select count(*) from app.production_operation_statuses) = 3
            and (select count(*) from app.machine_downtime_behavior_profiles) = 3
            and (select count(*) from app.machine_downtime_types) = 4
            and (select count(*) from app.machine_downtime_profile_notification_rules) = 6
            and (select count(*) from app.operator_break_behavior_profiles) = 1
            and (select count(*) from app.operator_break_types) = 2
            and (select count(*) from app.additional_work_types) = 6
            and (select count(*) from app.roles) = 5
        then 'PASS' else 'FAIL' end,
        'Core dictionary seed row counts match accepted seed.',
        null::text

    union all
    select
        'V02_SEED_DICTIONARIES',
        'V02_001A_ACTIVITY_PROFILE_SEED_CONTRACT',
        case when
            (
                select count(*)
                from app.operator_break_behavior_profiles obbp
                where obbp.technical_code = 'standard_operator_break_v1'
                  and obbp.is_active = true
                  and obbp.requires_open_shift = true
                  and obbp.allows_during_open_production = true
                  and obbp.blocks_production_start = true
                  and obbp.blocks_self_production_finish = true
                  and obbp.blocks_additional_work_start = true
                  and obbp.blocks_shift_finish = true
            ) = 1
            and (
                select count(*)
                from app.operator_break_types obt
                join app.operator_break_behavior_profiles obbp
                  on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
                where obt.technical_code in ('lunch', 'personal_needs')
                  and obt.is_active = true
                  and obbp.technical_code = 'standard_operator_break_v1'
            ) = 2
            and (
                select count(*)
                from app.machine_downtime_types mdt
                join app.machine_downtime_behavior_profiles mdbp
                  on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
                where mdt.is_active = true
                  and mdbp.is_active = true
                  and (
                    (mdt.technical_code in ('material_waiting', 'other_operational')
                      and mdbp.technical_code = 'operational_downtime_v1'
                      and mdbp.downtime_class = 'OPERATIONAL'
                      and mdbp.requires_production_operation = true
                      and mdbp.operator_requires_start_comment = false
                      and mdbp.blocks_production_finish = true
                      and mdbp.blocks_shift_finish = true
                      and mdbp.machine_status_effect = 'DOWNTIME'
                      and mdbp.ui_color_token = 'yellow')
                    or (mdt.technical_code = 'repair_required'
                      and mdbp.technical_code = 'critical_repair_downtime_v1'
                      and mdbp.downtime_class = 'CRITICAL'
                      and mdbp.operator_requires_start_comment = true
                      and mdbp.blocks_production_finish = false
                      and mdbp.blocks_shift_finish = false
                      and mdbp.machine_status_effect = 'BROKEN'
                      and mdbp.ui_color_token = 'scarlet')
                    or (mdt.technical_code = 'setup_required'
                      and mdbp.technical_code = 'critical_setup_downtime_v1'
                      and mdbp.downtime_class = 'CRITICAL'
                      and mdbp.operator_requires_start_comment = true
                      and mdbp.blocks_production_finish = false
                      and mdbp.blocks_shift_finish = false
                      and mdbp.machine_status_effect = 'DOWNTIME'
                      and mdbp.ui_color_token = 'scarlet')
                  )
            ) = 4
            and (
                select count(*)
                from app.machine_downtime_profile_notification_rules rule
                join app.machine_downtime_behavior_profiles mdbp
                  on mdbp.machine_downtime_behavior_profile_id = rule.machine_downtime_behavior_profile_id
                where rule.is_active = true
                  and (
                    (mdbp.technical_code = 'operational_downtime_v1'
                      and row(rule.technical_code, rule.threshold_minutes, rule.recipient_permission_code, rule.notification_kind)
                        in (
                          row('production_head_15min', 15, 'can_receive_production_notifications', 'ELAPSED_THRESHOLD'),
                          row('director_30min', 30, 'can_receive_director_notifications', 'ELAPSED_THRESHOLD')
                        ))
                    or (mdbp.technical_code = 'critical_repair_downtime_v1'
                      and row(rule.technical_code, rule.threshold_minutes, rule.recipient_permission_code, rule.notification_kind)
                        in (
                          row('production_head_repair', 0, 'can_receive_production_notifications', 'TYPE_IMMEDIATE'),
                          row('director_30min', 30, 'can_receive_director_notifications', 'ELAPSED_THRESHOLD')
                        ))
                    or (mdbp.technical_code = 'critical_setup_downtime_v1'
                      and row(rule.technical_code, rule.threshold_minutes, rule.recipient_permission_code, rule.notification_kind)
                        in (
                          row('production_head_setup', 0, 'can_receive_production_notifications', 'TYPE_IMMEDIATE'),
                          row('director_30min', 30, 'can_receive_director_notifications', 'ELAPSED_THRESHOLD')
                        ))
                  )
            ) = 6
        then 'PASS' else 'FAIL' end,
        'Break, operational downtime and critical downtime seeds map to the accepted immutable profiles and notification rules.',
        null::text

    union all
    select
        'V02_SEED_DICTIONARIES',
        'V02_002_SALARY_NOTIFICATION_EXPORT_DICTIONARY_COUNTS',
        case when
            (select count(*) from app.salary_correction_types) = 3
            and (select count(*) from app.additional_work_approval_statuses) = 4
            and (select count(*) from app.additional_work_accrual_statuses) = 3
            and (select count(*) from app.salary_entry_types) = 5
            and (select count(*) from app.period_types) = 3
            and (select count(*) from app.notification_channels) = 1
            and (select count(*) from app.notification_statuses) = 6
            and (select count(*) from app.google_sheets_export_statuses) = 3
            and (select count(*) from app.salary_correction_statuses) = 4
            and (select count(*) from app.production_operation_correction_statuses) = 4
        then 'PASS' else 'FAIL' end,
        'Salary, notification and export dictionary seed row counts match accepted seed.',
        null::text

    union all
    select
        'V02_SEED_DICTIONARIES',
        'V02_003_SEMANTIC_SINGLETON_FLAGS',
        case when
            (select count(*) from app.machine_statuses where is_active and is_available_for_start) = 1
            and (select count(*) from app.machine_statuses where is_active and is_running_status) = 1
            and (select count(*) from app.machine_statuses where is_active and is_broken_status) = 1
            and (select count(*) from app.machine_statuses where is_active and is_downtime_status and not is_broken_status) = 1
            and (select count(*) from app.machine_use_statuses where is_active and is_available_for_operations) = 1
            and (select count(*) from app.machine_use_statuses where is_active and is_decommissioned) = 1
            and (select count(*) from app.period_types where is_active and is_day) = 1
            and (select count(*) from app.period_types where is_active and is_week) = 1
            and (select count(*) from app.period_types where is_active and is_month) = 1
        then 'PASS' else 'FAIL' end,
        'Required active semantic singleton flags are unambiguous.',
        null::text

    union all
    select
        'V02_SEED_DICTIONARIES',
        'V02_004_EXPORT_STATUS_NO_RUNNING_SEMANTIC',
        case when not exists (
            select 1
            from app.google_sheets_export_statuses
            where google_sheets_export_status_name ilike '%running%'
               or google_sheets_export_status_name ilike '%выполня%'
               or google_sheets_export_status_name ilike '%запущ%'
        ) then 'PASS' else 'FAIL' end,
        'Google Sheets export statuses contain no running semantic status row.',
        null::text

    union all
    select
        'V03_EMPLOYEES_ROLES',
        'V03_001_ROLE_MATRIX_EXACT',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Seeded role permission matrix exactly matches accepted Section 11 flags.',
        'mismatched_roles=' || count(*)
    from expected_role_matrix e
    full join app.roles r on r.role_name = e.role_name
    where r.role_name is null
       or e.role_name is null
       or row(
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
            r.can_system_emergency_actions,
            r.can_access_admin_panel
       ) is distinct from row(
            e.can_work_as_operator,
            e.can_manage_production,
            e.can_manage_admin,
            e.can_manage_telegram_binding,
            e.can_view_audit,
            e.can_change_sku_tariff,
            e.can_salary_correction_production,
            e.can_salary_correction_general,
            e.can_salary_correction_all,
            e.can_reverse_salary_production,
            e.can_reverse_salary_all,
            e.can_correct_production_operations,
            e.can_manage_employees,
            e.can_manage_positions,
            e.can_manage_roles_limited,
            e.can_manage_roles_all,
            e.can_manage_dictionaries,
            e.can_view_admin_reports,
            e.can_reverse_salary_corrections_only,
            e.can_receive_production_notifications,
            e.can_receive_director_notifications,
            e.can_system_emergency_actions,
            e.can_access_admin_panel
       )

    union all
    select
        'V03_EMPLOYEES_ROLES',
        'V03_002_ACTIVE_ROLE_DATA_INVARIANTS',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Employee role assignment data satisfies active/revoked state invariants.',
        'bad_rows=' || count(*)
    from app.employee_roles er
    where (
        er.revoked_at is null
        and (er.revoked_by_employee_id is not null or er.revoke_reason is not null)
    )
    or (
        er.revoked_at is not null
        and (
            er.revoked_by_employee_id is null
            or er.revoke_reason is null
            or btrim(er.revoke_reason) = ''
            or er.revoked_at < er.assigned_at
        )
    )

    union all
    select
        'V04_LIFECYCLE',
        'V04_001_OPEN_ENTITY_UNIQUENESS_INDEXES',
        case when count(*) = 5 then 'PASS' else 'FAIL' end,
        'Required open-state uniqueness indexes exist.',
        'found=' || count(*)
    from pg_indexes
    where schemaname = 'app'
      and indexname in (
          'employee_shifts_one_open_shift_per_employee_idx',
          'production_operations_one_open_per_employee_idx',
          'production_operations_one_open_per_machine_idx',
          'machine_downtimes_one_open_per_machine_idx',
          'operator_breaks_one_open_per_employee_idx'
      )

    union all
    select
        'V04_LIFECYCLE',
        'V04_002_SHIFT_OPEN_FINISH_DESYNC',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Employee shifts have no is_open / finished_at desync.',
        'bad_rows=' || count(*)
    from app.employee_shifts
    where (is_open and finished_at is not null)
       or (not is_open and finished_at is null)

    union all
    select
        'V04_LIFECYCLE',
        'V04_003_PRODUCTION_OPERATION_STATUS_DESYNC',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Production operations have no open/closed/cancelled status desync.',
        'bad_rows=' || count(*)
    from app.production_operations po
    join app.production_operation_statuses s
      on s.production_operation_status_id = po.production_operation_status_id
    where (po.is_open and not s.is_open)
       or (po.finished_at is not null and not s.is_closed)
       or (po.cancelled_at is not null and not s.is_cancelled)

    union all
    select
        'V04_LIFECYCLE',
        'V04_004_ACTIVITY_TYPE_PROFILE_REFERENCES',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Active and open activity records reference active compatible types and profiles.',
        'bad_rows=' || count(*)
    from (
        select obt.operator_break_type_id::text as bad_id
        from app.operator_break_types obt
        join app.operator_break_behavior_profiles obbp
          on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
        where obt.is_active = true and obbp.is_active = false

        union all

        select mdt.machine_downtime_type_id::text
        from app.machine_downtime_types mdt
        join app.machine_downtime_behavior_profiles mdbp
          on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
        where mdt.downtime_class <> mdbp.downtime_class
           or (mdt.is_active = true and mdbp.is_active = false)

        union all

        select ob.operator_break_id::text
        from app.operator_breaks ob
        join app.operator_break_types obt
          on obt.operator_break_type_id = ob.operator_break_type_id
        join app.operator_break_behavior_profiles obbp
          on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
        where ob.is_open = true
          and (obt.is_active = false or obbp.is_active = false)

        union all

        select md.machine_downtime_id::text
        from app.machine_downtimes md
        join app.machine_downtime_types mdt
          on mdt.machine_downtime_type_id = md.machine_downtime_type_id
        join app.machine_downtime_behavior_profiles mdbp
          on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
        where md.is_open = true
          and (mdt.is_active = false or mdbp.is_active = false)
    ) bad_activity_references

    union all
    select
        'V05_ADDITIONAL_WORK',
        'V05_001_ADDITIONAL_WORK_STATUS_DATA_INVARIANTS',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Допработа rows satisfy corrected agreement-execution-payment lifecycle invariants.',
        'bad_rows=' || count(*)
    from app.additional_works aw
    left join app.additional_work_approval_statuses aps
      on aps.additional_work_approval_status_id = aw.additional_work_approval_status_id
    left join app.additional_work_accrual_statuses acs
      on acs.additional_work_accrual_status_id = aw.additional_work_accrual_status_id
    where (aw.finished_at is not null and aw.cancelled_at is not null)
       or (aw.started_at is not null and not aps.is_approved)
       or (aps.is_rejected and aw.started_at is not null)
       or (aps.is_rejected and aw.is_assignment_finished is not true)
       or (aw.finished_at is not null and aw.cancelled_at is null and aw.additional_work_accrual_status_id is null)
       or (aw.cancelled_at is not null and aw.finished_at is not null)
       or (aw.cancelled_at is not null and not aps.is_cancelled)
       or (aw.accrued_at is not null and not (acs.is_accrued or acs.is_without_accrual))
       or (acs.is_accrued and coalesce(aw.amount_uzs, 0) <= 0)
       or (acs.is_without_accrual and coalesce(aw.amount_uzs, 0) <> 0)

    union all
    select
        'V05_ADDITIONAL_WORK',
        'V05_002_ADDITIONAL_WORK_OLD_APPROVAL_FUNCTIONS_DEPRECATED',
        case when count(*) = 2 then 'PASS' else 'FAIL' end,
        'Old post-finish approval/rejection functions are present and marked DEPRECATED / NOT USED.',
        'found=' || count(*)
    from app_functions af
    where af.proname in ('approve_additional_work', 'reject_additional_work')
      and af.description like 'runtime_api: DEPRECATED / NOT USED:%'

    union all
    select
        'V05_ADDITIONAL_WORK',
        'V05_003_ADDITIONAL_WORK_NOTIFICATION_HELPERS_PRESENT',
        case when count(*) = 4 then 'PASS' else 'FAIL' end,
        'Допработа notification helper functions are present.',
        'found=' || count(*)
    from app_functions af
    where af.proname in (
        '_create_additional_work_notification_for_permission',
        '_create_additional_work_notification_for_employee',
        '_cancel_additional_work_task_notifications',
        '_get_additional_work_notification_context'
    )
      and af.description like 'internal_helper:%'

    union all
    select
        'V05_ADDITIONAL_WORK',
        'V05_004_ADDITIONAL_WORK_NOTIFICATION_SIDE_EFFECTS_IN_RUNTIME',
        case when count(*) = 9 then 'PASS' else 'FAIL' end,
        'Допработа runtime functions contain required notification create/close helper calls.',
        'found=' || count(*)
    from app_functions af
    where (
        af.proname = 'request_additional_work'
        and af.function_definition like '%_create_additional_work_notification_for_permission%'
        and af.function_definition like '%_request%'
    )
       or (
        af.proname = 'approve_additional_work_request'
        and af.function_definition like '%_cancel_additional_work_task_notifications%'
        and af.function_definition like '%_create_additional_work_notification_for_employee%'
        and af.function_definition like '%_request_approved%'
    )
       or (
        af.proname = 'reject_additional_work_request'
        and af.function_definition like '%_cancel_additional_work_task_notifications%'
        and af.function_definition like '%_create_additional_work_notification_for_employee%'
        and af.function_definition like '%_request_rejected%'
    )
       or (
        af.proname = 'assign_additional_work'
        and af.function_definition like '%_create_additional_work_notification_for_employee%'
        and af.function_definition like '%_assigned%'
    )
       or (
        af.proname = 'start_additional_work'
        and af.function_definition like '%_cancel_additional_work_task_notifications%'
        and af.function_definition like '%_assigned%'
        and af.function_definition like '%_request_approved%'
    )
       or (
        af.proname = 'finish_additional_work'
        and af.function_definition like '%_create_additional_work_notification_for_permission%'
        and af.function_definition like '%_payment%'
        and af.function_definition like '%требуется решение по оплате%'
    )
       or (
        af.proname = 'cancel_additional_work'
        and af.function_definition like '%_cancel_additional_work_task_notifications%'
        and af.function_definition like '%_request%'
        and af.function_definition like '%_assigned%'
        and af.function_definition like '%_request_approved%'
    )
       or (
        af.proname = 'accrue_additional_work_salary'
        and af.function_definition like '%_cancel_additional_work_task_notifications%'
        and af.function_definition like '%_payment%'
    )
       or (
        af.proname = 'mark_additional_work_without_accrual'
        and af.function_definition like '%_cancel_additional_work_task_notifications%'
        and af.function_definition like '%_payment%'
    )

    union all
    select
        'V06_SALARY_LEDGER',
        'V06_001_SALARY_SOURCE_EXCLUSIVITY_DATA',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Salary ledger rows satisfy observable source exclusivity.',
        'bad_rows=' || count(*)
    from app.employee_salary_entries ese
    where (
        ese.reversed_salary_entry_id is null
        and (
            (ese.production_operation_id is not null)::integer
            + (ese.additional_work_id is not null)::integer
            + (ese.salary_correction_id is not null)::integer
            + (ese.production_operation_correction_id is not null)::integer
        ) <> 1
    )
    or (
        ese.reversed_salary_entry_id is not null
        and (
            ese.production_operation_id is not null
            or ese.additional_work_id is not null
            or ese.salary_correction_id is not null
            or ese.production_operation_correction_id is not null
        )
    )

    union all
    select
        'V06_SALARY_LEDGER',
        'V06_002_SALARY_TOTALS_CACHE_SUM',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Salary period totals cache rows internally sum to total_salary_uzs.',
        'bad_rows=' || count(*)
    from app.employee_salary_period_totals t
    where t.total_salary_uzs is distinct from (
        t.production_salary_uzs
        + t.production_correction_salary_uzs
        + t.additional_work_salary_uzs
        + t.salary_correction_uzs
    )

    union all
    select
        'V06_SALARY_LEDGER',
        'V06_003_UNRESOLVED_SALARY_DISCREPANCIES',
        case when count(*) = 0 then 'PASS' else 'WARNING' end,
        'Unresolved salary discrepancy logs are non-blocking diagnostics only.',
        'unresolved_rows=' || count(*)
    from app.salary_total_discrepancy_logs
    where repaired_at is null

    union all
    select
        'V07_FUNCTIONS',
        'V07_001_FUNCTION_CLASSIFICATION_COUNTS',
        case when runtime_api_count = 95 and internal_helper_count = 82 and maintenance_api_count = 1 then 'PASS' else 'FAIL' end,
        'Function classification counts match accepted functions.sql.',
        'runtime_api=' || runtime_api_count || '; internal_helper=' || internal_helper_count || '; maintenance_api=' || maintenance_api_count
    from function_summary

    union all
    select
        'V07_FUNCTIONS',
        'V07_002_ALL_FUNCTIONS_SECURITY_DEFINER_AND_SEARCH_PATH',
        case when total_functions = security_definer_count and total_functions = fixed_search_path_count then 'PASS' else 'FAIL' end,
        'All app functions are SECURITY DEFINER with fixed search_path app, pg_catalog.',
        'total=' || total_functions || '; security_definer=' || security_definer_count || '; fixed_search_path=' || fixed_search_path_count
    from function_summary

    union all
    select
        'V07_FUNCTIONS',
        'V07_003_FUNCTION_OWNERSHIP_BOUNDARY',
        case when runtime_owned_count = 0 then 'PASS' else 'FAIL' end,
        'No app function is owned by app_runtime_role.',
        'runtime_owned=' || runtime_owned_count
    from function_summary

    union all
    select
        'V07_FUNCTIONS',
        'V07_004_RUNTIME_EXECUTE_ALLOWLIST',
        case when runtime_exec_count = 95 and runtime_internal_exec_count = 0 and runtime_maintenance_exec_count = 0 and readonly_exec_count = 0 then 'PASS' else 'FAIL' end,
        'Runtime and readonly function EXECUTE privileges match accepted allowlist.',
        'runtime_exec=' || runtime_exec_count || '; runtime_internal_exec=' || runtime_internal_exec_count || '; runtime_maintenance_exec=' || runtime_maintenance_exec_count || '; readonly_exec=' || readonly_exec_count
    from function_summary

    union all
    select
        'V07_FUNCTIONS',
        'V07_005_EXPECTED_RUNTIME_FUNCTION_NAMES',
        case when count(af.proname) = count(erf.function_name) then 'PASS' else 'FAIL' end,
        'Expected runtime_api function names exist.',
        'expected=' || count(erf.function_name) || '; found=' || count(af.proname)
    from expected_runtime_functions erf
    left join app_functions af
      on af.proname = erf.function_name
     and af.description like 'runtime_api:%'

    union all
    select
        'V08_AUDIT',
        'V08_001_RAW_AUDIT_TABLE_CLOSED',
        case when
            not has_table_privilege('app_runtime_role', 'app.audit_events', 'SELECT')
            and not has_table_privilege('readonly_role', 'app.audit_events', 'SELECT')
        then 'PASS' else 'FAIL' end,
        'Raw app.audit_events is closed for runtime and readonly roles.',
        'runtime_audit_select=' || has_table_privilege('app_runtime_role', 'app.audit_events', 'SELECT')
        || '; readonly_audit_select=' || has_table_privilege('readonly_role', 'app.audit_events', 'SELECT')

    union all
    select
        'V08_AUDIT',
        'V08_002_AUDIT_ACTION_NAME_DATA',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Existing audit action names are trimmed snake_case.',
        'bad_rows=' || count(*)
    from app.audit_events
    where action_name <> btrim(action_name)
       or action_name !~ '^[a-z][a-z0-9_]*$'

    union all
    select
        'V08_AUDIT',
        'V08_003_TELEGRAM_CONTACT_PROOFS_TABLE_CLOSED',
        case when
            not has_table_privilege('app_runtime_role', 'app.telegram_contact_proofs', 'SELECT')
            and not has_table_privilege('app_runtime_role', 'app.telegram_contact_proofs', 'INSERT')
            and not has_table_privilege('app_runtime_role', 'app.telegram_contact_proofs', 'UPDATE')
            and not has_table_privilege('app_runtime_role', 'app.telegram_contact_proofs', 'DELETE')
            and not has_table_privilege('readonly_role', 'app.telegram_contact_proofs', 'SELECT')
        then 'PASS' else 'FAIL' end,
        'Raw app.telegram_contact_proofs is closed for runtime and readonly roles.',
        'runtime_select=' || has_table_privilege('app_runtime_role', 'app.telegram_contact_proofs', 'SELECT')
        || '; runtime_insert=' || has_table_privilege('app_runtime_role', 'app.telegram_contact_proofs', 'INSERT')
        || '; runtime_update=' || has_table_privilege('app_runtime_role', 'app.telegram_contact_proofs', 'UPDATE')
        || '; runtime_delete=' || has_table_privilege('app_runtime_role', 'app.telegram_contact_proofs', 'DELETE')
        || '; readonly_select=' || has_table_privilege('readonly_role', 'app.telegram_contact_proofs', 'SELECT')

    union all
    select
        'V08_AUDIT',
        'V08_004_TELEGRAM_CONTACT_PROOF_DATA_INVARIANTS',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Telegram contact proof rows satisfy lifecycle and expiry invariants.',
        'bad_rows=' || count(*)
    from app.telegram_contact_proofs tcp
    where tcp.phone_e164 !~ '^\+[0-9]{7,15}$'
       or tcp.source <> 'telegram_bot_contact_update'
       or tcp.proof_status not in ('active', 'used_for_confirmation', 'consumed', 'expired', 'superseded')
       or tcp.expires_at <= tcp.created_at
       or (tcp.proof_status = 'used_for_confirmation' and tcp.used_for_confirmation_at is null)
       or (tcp.proof_status = 'consumed' and tcp.consumed_at is null)
       or (tcp.proof_status <> 'consumed' and tcp.consumed_at is not null)

    union all
    select
        'V08_AUDIT',
        'V08_005_ADMIN_AUTH_PRIVATE_TABLES_CLOSED',
        case when
            not has_table_privilege('app_runtime_role', 'app.admin_password_credentials', 'SELECT')
            and not has_table_privilege('app_runtime_role', 'app.admin_password_credentials', 'INSERT')
            and not has_table_privilege('app_runtime_role', 'app.admin_password_credentials', 'UPDATE')
            and not has_table_privilege('app_runtime_role', 'app.admin_password_credentials', 'DELETE')
            and not has_table_privilege('readonly_role', 'app.admin_password_credentials', 'SELECT')
            and not has_table_privilege('app_runtime_role', 'app.admin_sessions', 'SELECT')
            and not has_table_privilege('app_runtime_role', 'app.admin_sessions', 'INSERT')
            and not has_table_privilege('app_runtime_role', 'app.admin_sessions', 'UPDATE')
            and not has_table_privilege('app_runtime_role', 'app.admin_sessions', 'DELETE')
            and not has_table_privilege('readonly_role', 'app.admin_sessions', 'SELECT')
            and not has_table_privilege('app_runtime_role', 'app.admin_telegram_qr_challenges', 'SELECT')
            and not has_table_privilege('app_runtime_role', 'app.admin_telegram_qr_challenges', 'INSERT')
            and not has_table_privilege('app_runtime_role', 'app.admin_telegram_qr_challenges', 'UPDATE')
            and not has_table_privilege('app_runtime_role', 'app.admin_telegram_qr_challenges', 'DELETE')
            and not has_table_privilege('readonly_role', 'app.admin_telegram_qr_challenges', 'SELECT')
            and not exists (
                select 1
                from app.admin_sessions s
                where s.session_token_hash !~ '^[a-f0-9]{64}$'
                   or s.csrf_token_hash !~ '^[a-f0-9]{64}$'
            )
            and not exists (
                select 1
                from app.admin_telegram_qr_challenges c
                where c.confirmation_token_hash !~ '^[a-f0-9]{64}$'
                   or c.browser_token_hash !~ '^[a-f0-9]{64}$'
                   or c.expires_at <= c.created_at
                   or (c.confirmed_employee_id is null) is distinct from (c.confirmed_at is null)
                   or (c.claimed_admin_session_id is null) is distinct from (c.claimed_at is null)
                   or (c.claimed_at is not null and c.confirmed_at is null)
            )
        then 'PASS' else 'FAIL' end,
        'Raw credentials, sessions, and Telegram QR challenges are closed; stored proof material is one-way hashed.',
        null::text

    union all
    select
        'V09_NOTIFICATIONS',
        'V09_001_NOTIFICATION_CATALOG_AND_STATUS',
        case when
            (select count(*) from app.notification_channels where is_active and is_telegram) = 1
            and (select count(*) from app.notification_statuses where is_active and is_created) = 1
            and (select count(*) from app.notification_statuses where is_active and is_sent) = 1
            and (select count(*) from app.notification_statuses where is_active and is_delivered) = 1
            and (select count(*) from app.notification_statuses where is_active and is_read) = 1
            and (select count(*) from app.notification_statuses where is_active and is_failed) = 1
            and (select count(*) from app.notification_statuses where is_active and is_cancelled) = 1
        then 'PASS' else 'FAIL' end,
        'Notification channel and status semantics are present.',
        null::text

    union all
    select
        'V09_NOTIFICATIONS',
        'V09_002_NOTIFICATION_DATA_INVARIANTS',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Notification rows satisfy observable cause/timestamp invariants.',
        'bad_rows=' || count(*)
    from app.notifications n
    where (n.cause_table_name is null) is distinct from (n.cause_record_id is null)
       or n.sent_at < n.created_at
       or n.delivered_at < n.created_at
       or n.read_at < n.created_at
       or n.failed_at < n.created_at
       or n.hidden_from_chat_at < n.created_at

    union all
    select
        'V10_EXPORT',
        'V10_001_EXPORT_RUN_CATALOG_AND_STATUS',
        case when
            to_regclass('app.google_sheets_export_runs') is not null
            and (select count(*) from app.google_sheets_export_statuses where is_active and is_success) = 1
            and (select count(*) from app.google_sheets_export_statuses where is_active and is_failed) = 1
            and (select count(*) from app.google_sheets_export_statuses where is_active and is_cancelled) = 1
        then 'PASS' else 'FAIL' end,
        'Google Sheets export run table and final status semantics exist.',
        null::text

    union all
    select
        'V10_EXPORT',
        'V10_002_EXPORT_RUN_DATA_INVARIANTS',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Google Sheets export run rows satisfy observable lifecycle invariants.',
        'bad_rows=' || count(*)
    from app.google_sheets_export_runs r
    left join app.google_sheets_export_statuses s
      on s.google_sheets_export_status_id = r.google_sheets_export_status_id
    where r.period_from > r.period_to
       or r.completed_at < r.started_at
       or (r.google_sheets_export_status_id is null and r.completed_at is not null)
       or (r.google_sheets_export_status_id is not null and r.completed_at is null)
       or (s.is_failed and (r.error_message is null or btrim(r.error_message) = ''))

    union all
    select
        'V10_EXPORT',
        'V10_003_REQUIRED_EXPORT_SURFACES_EXIST',
        case when count(relkind) = count(surface_name) then 'PASS' else 'FAIL' end,
        'Required Section 16 MVP export read surfaces exist as catalog-visible app views.',
        'expected=' || count(surface_name) || '; found=' || count(relkind)
    from surface_objects

    union all
    select
        'V11_READ_REPORT_EXPORT_SURFACES',
        'V11_001_EXPORT_SURFACE_FORBIDDEN_COLUMNS_ABSENT',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Implemented export surfaces do not expose forbidden stale columns.',
        'bad_columns=' || count(*)
    from information_schema.columns c
    where c.table_schema = 'app'
      and c.table_name in (select surface_name from expected_export_surfaces)
      and c.column_name in (
          'quantity_accepted',
          'quantity_defective',
          'defective_quantity',
          'quality_split',
          'period_from',
          'period_to'
      )

    union all
    select
        'V12_FORBIDDEN_STALE_CONCEPTS',
        'V12_001_FORBIDDEN_DOMAIN_COLUMNS_ABSENT',
        case when count(*) = 0 then 'PASS' else 'FAIL' end,
        'Forbidden stale domain columns are absent.',
        'bad_columns=' || count(*)
    from information_schema.columns c
    where c.table_schema = 'app'
      and (
          (c.table_name = 'production_operations' and c.column_name in (
              'quantity_accepted',
              'quantity_defective',
              'old_quantity_produced',
              'new_quantity_produced',
              'salary_amount_uzs',
              'manual_duration_minutes',
              'corrected_total_quantity_produced'
          ))
          or (c.table_name = 'employee_salary_period_totals' and c.column_name ilike '%reversal%')
          or (c.table_name = 'skus' and c.column_name ilike '%stock%')
          or (c.table_name = 'machines' and c.column_name ilike '%salary%')
          or (c.table_name = 'machine_downtime_types' and c.column_name in (
              'is_repair_required',
              'is_setup_required',
              'is_material_waiting',
              'is_other'
          ))
      )

    union all
    select
        'V12_FORBIDDEN_STALE_CONCEPTS',
        'V12_002_FORBIDDEN_TABLES_AND_PROCEDURES_ABSENT',
        case when
            not exists (
                select 1
                from information_schema.tables
                where table_schema = 'app'
                  and table_name in ('salary_entry_source_types')
            )
            and not exists (
                select 1
                from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'app'
                  and p.prokind = 'p'
            )
        then 'PASS' else 'FAIL' end,
        'Forbidden stale tables and PostgreSQL procedures are absent.',
        null::text

    union all
    select
        'STATIC_REVIEW',
        'SR_001_FUNCTION_AUTHORIZATION_BODY_REVIEW',
        'STATIC_REVIEW_REQUIRED',
        'Static review must verify function authorization uses active employee_roles joined to roles permission flags, not role names, role ids, display names or numeric semantic ids.',
        null::text

    union all
    select
        'STATIC_REVIEW',
        'SR_002_LOCK_ORDER_AND_ATOMICITY_REVIEW',
        'STATIC_REVIEW_REQUIRED',
        'Static review must verify accepted lock order, concurrency safety and transactional atomicity in mutation functions.',
        null::text

    union all
    select
        'STATIC_REVIEW',
        'SR_003_AUDIT_NOTIFICATION_EXPORT_BEHAVIOR_REVIEW',
        'STATIC_REVIEW_REQUIRED',
        'Static review must verify audit writes, notification cleanup/deduplication and Google Sheets export behavior/source-of-truth boundaries.',
        null::text

    union all
    select
        'STATIC_REVIEW',
        'SR_004_EXPORT_SURFACE_DEFINITION_REVIEW',
        'STATIC_REVIEW_REQUIRED',
        'Static review must verify final export surface formulas, event_date derivation, sku_tariff_snapshot_uzs mapping and production correction attribution where surfaces exist.',
        null::text
)
select
    check_group,
    check_id,
    result,
    message,
    details
from checks
order by
    check_group,
    check_id;
