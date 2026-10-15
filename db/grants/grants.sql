-- grants.sql assembled from accepted WP fragments.
-- Canonical public privilege baseline.


-- BEGIN db/grants/_work/wp_01_role_schema_public_baseline/grants.sql

-- WP-01 role/schema/public baseline for grants.sql.
-- Runtime, read-only, and maintenance role boundary.

do $$
begin
    if to_regnamespace('app') is null then
        raise exception 'required schema app does not exist';
    end if;

    if not exists (select 1 from pg_roles where rolname = 'app_owner_role') then
        raise exception 'required role app_owner_role does not exist';
    end if;

    if not exists (select 1 from pg_roles where rolname = 'migration_role') then
        raise exception 'required role migration_role does not exist';
    end if;

    if not exists (select 1 from pg_roles where rolname = 'app_runtime_role') then
        raise exception 'required role app_runtime_role does not exist';
    end if;

    if not exists (select 1 from pg_roles where rolname = 'readonly_role') then
        raise exception 'required role readonly_role does not exist';
    end if;
end;
$$;

do $$
begin
    execute format('revoke all privileges on database %I from public', current_database());
    execute format('grant connect on database %I to migration_role', current_database());
    execute format('grant connect on database %I to app_runtime_role', current_database());
    execute format('grant connect on database %I to readonly_role', current_database());
end;
$$;

revoke create on schema public from public;
revoke all on schema app from public;
revoke all on schema app from app_runtime_role;
revoke all on schema app from readonly_role;

grant usage on schema app to app_runtime_role;
grant usage on schema app to readonly_role;
grant usage, create on schema app to migration_role;

revoke all privileges on all tables in schema app from public;
revoke all privileges on all sequences in schema app from public;
revoke all privileges on all functions in schema app from public;

revoke all privileges on all tables in schema app from app_runtime_role;
revoke all privileges on all sequences in schema app from app_runtime_role;
revoke all privileges on all functions in schema app from app_runtime_role;

revoke all privileges on all tables in schema app from readonly_role;
revoke all privileges on all sequences in schema app from readonly_role;
revoke all privileges on all functions in schema app from readonly_role;

alter default privileges in schema app
    revoke all privileges on tables from public;

alter default privileges in schema app
    revoke all privileges on sequences from public;

alter default privileges in schema app
    revoke all privileges on functions from public;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on tables from public;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on sequences from public;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on functions from public;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on tables from app_runtime_role;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on sequences from app_runtime_role;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on functions from app_runtime_role;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on tables from readonly_role;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on sequences from readonly_role;

alter default privileges for role app_owner_role in schema app
    revoke all privileges on functions from readonly_role;

alter default privileges for role migration_role in schema app
    revoke all privileges on tables from public;

alter default privileges for role migration_role in schema app
    revoke all privileges on sequences from public;

alter default privileges for role migration_role in schema app
    revoke all privileges on functions from public;

alter default privileges for role migration_role in schema app
    revoke all privileges on tables from app_runtime_role;

alter default privileges for role migration_role in schema app
    revoke all privileges on sequences from app_runtime_role;

alter default privileges for role migration_role in schema app
    revoke all privileges on functions from app_runtime_role;

alter default privileges for role migration_role in schema app
    revoke all privileges on tables from readonly_role;

alter default privileges for role migration_role in schema app
    revoke all privileges on sequences from readonly_role;

alter default privileges for role migration_role in schema app
    revoke all privileges on functions from readonly_role;

-- END db/grants/_work/wp_01_role_schema_public_baseline/grants.sql


-- BEGIN db/grants/_work/wp_02_runtime_api_execute_allowlist/grants.sql

-- WP-02 app_runtime_role runtime_api EXECUTE allowlist.
-- Source: final accepted db/functions/functions.sql runtime_api comments and exact signatures.

grant execute on function app.start_employee_shift(bigint) to app_runtime_role;
grant execute on function app.finish_employee_shift(bigint) to app_runtime_role;
grant execute on function app.emergency_close_employee_shift(bigint, bigint, text) to app_runtime_role;

grant execute on function app.create_employee(bigint, text, text, bigint, text, bigint) to app_runtime_role;
grant execute on function app.update_employee(bigint, bigint, text, text, bigint, text) to app_runtime_role;
grant execute on function app.change_employee_status(bigint, bigint, bigint, text) to app_runtime_role;
grant execute on function app.assign_employee_role(bigint, bigint, bigint, text) to app_runtime_role;
grant execute on function app.revoke_employee_role(bigint, bigint, text) to app_runtime_role;
grant execute on function app.bind_employee_telegram_user(bigint, bigint, bigint, text, text) to app_runtime_role;
grant execute on function app.reset_employee_telegram_user(bigint, bigint, text) to app_runtime_role;
grant execute on function app.identify_employee_for_telegram_self_binding(text, bigint) to app_runtime_role;
grant execute on function app.confirm_employee_telegram_self_binding(bigint, text, bigint, text) to app_runtime_role;
grant execute on function app.record_telegram_contact_proof(bigint, text, text, bigint, bigint) to app_runtime_role;
grant execute on function app.consume_telegram_contact_proof(bigint) to app_runtime_role;
grant execute on function app.finalize_telegram_contact_proof(bigint, bigint) to app_runtime_role;

grant execute on function app.rotate_machine_qr_token(bigint, bigint, text, text) to app_runtime_role;
grant execute on function app.rotate_sku_qr_token(bigint, bigint, text, text) to app_runtime_role;
grant execute on function app.update_sku_tariff(bigint, bigint, numeric, text) to app_runtime_role;

grant execute on function app.create_operator_break_behavior_profile(bigint, text, text, boolean, boolean, boolean, boolean, boolean, text) to app_runtime_role;
grant execute on function app.create_operator_break_type(bigint, text, text, integer, bigint, text) to app_runtime_role;
grant execute on function app.deactivate_operator_break_type(bigint, bigint, text) to app_runtime_role;
grant execute on function app.deactivate_operator_break_behavior_profile(bigint, bigint, text) to app_runtime_role;

grant execute on function app.create_operational_downtime_behavior_profile(bigint, text, text, boolean, boolean, boolean, text) to app_runtime_role;
grant execute on function app.create_critical_downtime_behavior_profile(bigint, text, text, boolean, boolean, boolean, text, text) to app_runtime_role;
grant execute on function app.create_operational_downtime_type(bigint, text, text, integer, bigint, text) to app_runtime_role;
grant execute on function app.create_critical_downtime_type(bigint, text, text, integer, bigint, text) to app_runtime_role;
grant execute on function app.deactivate_operational_downtime_type(bigint, bigint, text) to app_runtime_role;
grant execute on function app.deactivate_critical_downtime_type(bigint, bigint, text) to app_runtime_role;
grant execute on function app.deactivate_operational_downtime_behavior_profile(bigint, bigint, text) to app_runtime_role;
grant execute on function app.deactivate_critical_downtime_behavior_profile(bigint, bigint, text) to app_runtime_role;
grant execute on function app.create_operational_downtime_notification_rule(bigint, bigint, text, integer, text, text, integer, text) to app_runtime_role;
grant execute on function app.create_critical_downtime_notification_rule(bigint, bigint, text, integer, text, text, integer, text) to app_runtime_role;
grant execute on function app.deactivate_operational_downtime_notification_rule(bigint, bigint, text) to app_runtime_role;
grant execute on function app.deactivate_critical_downtime_notification_rule(bigint, bigint, text) to app_runtime_role;

grant execute on function app.start_production_operation(bigint, bigint, bigint) to app_runtime_role;
grant execute on function app.finish_production_operation(bigint, bigint, numeric, text) to app_runtime_role;
grant execute on function app.cancel_production_operation(bigint, bigint, text) to app_runtime_role;

grant execute on function app.start_machine_downtime(bigint, bigint, bigint, bigint, text) to app_runtime_role;
grant execute on function app.finish_machine_downtime(bigint, bigint, text, text) to app_runtime_role;
grant execute on function app.cancel_machine_downtime(bigint, bigint, text) to app_runtime_role;

grant execute on function app.start_operator_break(bigint, bigint) to app_runtime_role;
grant execute on function app.finish_operator_break(bigint) to app_runtime_role;
grant execute on function app.emergency_finish_operator_break(bigint, bigint, text) to app_runtime_role;

grant execute on function app.request_additional_work(bigint, bigint) to app_runtime_role;
grant execute on function app.approve_additional_work_request(bigint, bigint, text) to app_runtime_role;
grant execute on function app.reject_additional_work_request(bigint, bigint, text) to app_runtime_role;
grant execute on function app.assign_additional_work(bigint, bigint, bigint) to app_runtime_role;
grant execute on function app.start_additional_work(bigint, bigint) to app_runtime_role;
grant execute on function app.finish_additional_work(bigint, bigint, text) to app_runtime_role;
grant execute on function app.approve_additional_work(bigint, bigint, text) to app_runtime_role;
grant execute on function app.reject_additional_work(bigint, bigint, text) to app_runtime_role;
grant execute on function app.cancel_additional_work(bigint, bigint, text) to app_runtime_role;
grant execute on function app.mark_additional_work_without_accrual(bigint, bigint, text) to app_runtime_role;
grant execute on function app.accrue_additional_work_salary(bigint, bigint, numeric, numeric) to app_runtime_role;

grant execute on function app.create_salary_correction(bigint, bigint, bigint, bigint, numeric, text) to app_runtime_role;
grant execute on function app.approve_salary_correction(bigint, bigint) to app_runtime_role;
grant execute on function app.reject_salary_correction(bigint, bigint, text) to app_runtime_role;
grant execute on function app.cancel_salary_correction(bigint, bigint, text) to app_runtime_role;

grant execute on function app.create_production_operation_correction(bigint, bigint, numeric, numeric, text) to app_runtime_role;
grant execute on function app.approve_production_operation_correction(bigint, bigint) to app_runtime_role;
grant execute on function app.reject_production_operation_correction(bigint, bigint, text) to app_runtime_role;
grant execute on function app.cancel_production_operation_correction(bigint, bigint, text) to app_runtime_role;

grant execute on function app.reverse_salary_entry(bigint, bigint, text) to app_runtime_role;
grant execute on function app.emergency_reverse_salary_entry(bigint, bigint, text, text) to app_runtime_role;

grant execute on function app.mark_notification_sent(bigint, text) to app_runtime_role;
grant execute on function app.mark_notification_delivered(bigint) to app_runtime_role;
grant execute on function app.mark_notification_read(bigint) to app_runtime_role;
grant execute on function app.mark_notification_failed(bigint, text) to app_runtime_role;
grant execute on function app.hide_notification_from_chat(bigint, boolean, boolean) to app_runtime_role;
grant execute on function app.scan_active_downtimes_for_notifications() to app_runtime_role;

grant execute on function app.create_google_sheets_export_run(bigint, text, date, date) to app_runtime_role;
grant execute on function app.finish_google_sheets_export_run_success(bigint, bigint, text) to app_runtime_role;
grant execute on function app.finish_google_sheets_export_run_failed(bigint, bigint, text) to app_runtime_role;
grant execute on function app.cancel_google_sheets_export_run(bigint, bigint) to app_runtime_role;

grant execute on function app.read_admin_password_credential(text) to app_runtime_role;
grant execute on function app.record_admin_password_failure(bigint) to app_runtime_role;
grant execute on function app.start_admin_password_session(bigint, text, text, text, text) to app_runtime_role;
grant execute on function app.create_admin_telegram_qr_challenge(text, text, text, text) to app_runtime_role;
grant execute on function app.confirm_admin_telegram_qr_challenge(text, bigint) to app_runtime_role;
grant execute on function app.claim_admin_telegram_qr_challenge(bigint, text, text, text, text, text) to app_runtime_role;
grant execute on function app.resolve_admin_session(text) to app_runtime_role;
grant execute on function app.read_admin_password_credential_for_session(text) to app_runtime_role;
grant execute on function app.change_admin_password(text, text) to app_runtime_role;
grant execute on function app.revoke_admin_session(text, text) to app_runtime_role;
grant execute on function app.read_admin_overview(text) to app_runtime_role;
grant execute on function app.read_admin_directory(text) to app_runtime_role;
grant execute on function app.prepare_admin_qr_label(text, text, bigint) to app_runtime_role;
grant execute on function app.save_admin_employee(text, bigint, text, text, bigint, bigint, text) to app_runtime_role;
grant execute on function app.save_admin_position(text, bigint, text, text, boolean, boolean, text) to app_runtime_role;
grant execute on function app.save_admin_machine(text, bigint, text, text, bigint, text, text) to app_runtime_role;
grant execute on function app.save_admin_sku(text, bigint, text, text, bigint, numeric, numeric, boolean, text, text) to app_runtime_role;
grant execute on function app.save_admin_additional_work_type(text, bigint, text, boolean, text) to app_runtime_role;
grant execute on function app.create_admin_activity_type(text, text, text, text, integer, bigint, text) to app_runtime_role;
grant execute on function app.move_admin_activity_type(text, text, bigint, text) to app_runtime_role;
grant execute on function app.deactivate_admin_activity_type(text, text, bigint, text) to app_runtime_role;


-- END db/grants/_work/wp_02_runtime_api_execute_allowlist/grants.sql


-- BEGIN db/grants/_work/wp_03_runtime_read_surface/grants.sql

-- WP-03 app_runtime_role SELECT read surface.
-- Raw audit_events remains closed by Section 14.10.

grant select on table
    app.positions,
    app.employee_statuses,
    app.machine_statuses,
    app.machine_use_statuses,
    app.sku_units,
    app.production_operation_statuses,
    app.machine_downtime_behavior_profiles,
    app.machine_downtime_types,
    app.machine_downtime_profile_notification_rules,
    app.operator_break_behavior_profiles,
    app.operator_break_types,
    app.additional_work_types,
    app.additional_work_approval_statuses,
    app.additional_work_accrual_statuses,
    app.salary_entry_types,
    app.period_types,
    app.notification_channels,
    app.notification_statuses,
    app.google_sheets_export_statuses,
    app.roles,
    app.employees,
    app.employee_roles,
    app.employee_shifts,
    app.machines,
    app.skus,
    app.production_operations,
    app.machine_status_events,
    app.machine_downtimes,
    app.operator_breaks,
    app.additional_works,
    app.salary_correction_types,
    app.salary_correction_statuses,
    app.production_operation_correction_statuses,
    app.salary_corrections,
    app.production_operation_corrections,
    app.employee_salary_entries,
    app.employee_salary_period_totals,
    app.salary_total_discrepancy_logs,
    app.notifications,
    app.google_sheets_export_runs,
    app.salary_summary,
    app.salary_details,
    app.additional_work_details,
    app.machine_output_summary,
    app.machine_output_details
to app_runtime_role;


-- END db/grants/_work/wp_03_runtime_read_surface/grants.sql


-- BEGIN db/grants/_work/wp_04_readonly_select_surface/grants.sql

-- WP-04 readonly_role SELECT-only surface.
-- Raw audit_events remains closed by default unless a protected audit read surface is approved.

grant select on table
    app.positions,
    app.employee_statuses,
    app.machine_statuses,
    app.machine_use_statuses,
    app.sku_units,
    app.production_operation_statuses,
    app.machine_downtime_behavior_profiles,
    app.machine_downtime_types,
    app.machine_downtime_profile_notification_rules,
    app.operator_break_behavior_profiles,
    app.operator_break_types,
    app.additional_work_types,
    app.additional_work_approval_statuses,
    app.additional_work_accrual_statuses,
    app.salary_entry_types,
    app.period_types,
    app.notification_channels,
    app.notification_statuses,
    app.google_sheets_export_statuses,
    app.roles,
    app.employees,
    app.employee_roles,
    app.employee_shifts,
    app.machines,
    app.skus,
    app.production_operations,
    app.machine_status_events,
    app.machine_downtimes,
    app.operator_breaks,
    app.additional_works,
    app.salary_correction_types,
    app.salary_correction_statuses,
    app.production_operation_correction_statuses,
    app.salary_corrections,
    app.production_operation_corrections,
    app.employee_salary_entries,
    app.employee_salary_period_totals,
    app.salary_total_discrepancy_logs,
    app.notifications,
    app.google_sheets_export_runs,
    app.salary_summary,
    app.salary_details,
    app.additional_work_details,
    app.machine_output_summary,
    app.machine_output_details
to readonly_role;


-- END db/grants/_work/wp_04_readonly_select_surface/grants.sql


-- BEGIN db/grants/_work/wp_05_helper_maintenance_deny_hardening/grants.sql

-- WP-05 helper/maintenance deny and public/readonly hardening.

revoke execute on all functions in schema app from public;
revoke execute on all functions in schema app from readonly_role;

revoke execute on function app.rebuild_employee_salary_period_totals(bigint, bigint, date, date, text)
    from app_runtime_role;

revoke all privileges on table app.audit_events from app_runtime_role;
revoke all privileges on table app.audit_events from readonly_role;
revoke all privileges on table app.audit_events from public;
revoke all privileges on table app.telegram_contact_proofs from app_runtime_role;
revoke all privileges on table app.telegram_contact_proofs from readonly_role;
revoke all privileges on table app.telegram_contact_proofs from public;
revoke all privileges on table app.admin_password_credentials from app_runtime_role;
revoke all privileges on table app.admin_password_credentials from readonly_role;
revoke all privileges on table app.admin_password_credentials from public;
revoke all privileges on table app.admin_sessions from app_runtime_role;
revoke all privileges on table app.admin_sessions from readonly_role;
revoke all privileges on table app.admin_sessions from public;
revoke all privileges on table app.admin_telegram_qr_challenges from app_runtime_role;
revoke all privileges on table app.admin_telegram_qr_challenges from readonly_role;
revoke all privileges on table app.admin_telegram_qr_challenges from public;

revoke all privileges on all sequences in schema app from app_runtime_role;
revoke all privileges on all sequences in schema app from readonly_role;
revoke all privileges on all sequences in schema app from public;


-- END db/grants/_work/wp_05_helper_maintenance_deny_hardening/grants.sql
