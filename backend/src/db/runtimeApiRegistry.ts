export type RuntimeApiFunctionMetadata = {
  readonly signature: string;
  readonly argTypes: readonly string[];
  readonly requiresActorEmployeeId: boolean;
};

export const runtimeApiRegistry = {
  start_employee_shift: { signature: 'start_employee_shift(bigint)', argTypes: ['bigint'], requiresActorEmployeeId: true },
  finish_employee_shift: { signature: 'finish_employee_shift(bigint)', argTypes: ['bigint'], requiresActorEmployeeId: true },
  emergency_close_employee_shift: {
    signature: 'emergency_close_employee_shift(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  create_employee: {
    signature: 'create_employee(bigint, text, text, bigint, text, bigint)',
    argTypes: ['bigint', 'text', 'text', 'bigint', 'text', 'bigint'],
    requiresActorEmployeeId: true
  },
  update_employee: {
    signature: 'update_employee(bigint, bigint, text, text, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text', 'text', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  change_employee_status: {
    signature: 'change_employee_status(bigint, bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  assign_employee_role: {
    signature: 'assign_employee_role(bigint, bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  revoke_employee_role: {
    signature: 'revoke_employee_role(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  bind_employee_telegram_user: {
    signature: 'bind_employee_telegram_user(bigint, bigint, bigint, text, text)',
    argTypes: ['bigint', 'bigint', 'bigint', 'text', 'text'],
    requiresActorEmployeeId: true
  },
  reset_employee_telegram_user: {
    signature: 'reset_employee_telegram_user(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  identify_employee_for_telegram_self_binding: {
    signature: 'identify_employee_for_telegram_self_binding(text, bigint)',
    argTypes: ['text', 'bigint'],
    requiresActorEmployeeId: false
  },
  confirm_employee_telegram_self_binding: {
    signature: 'confirm_employee_telegram_self_binding(bigint, text, bigint, text)',
    argTypes: ['bigint', 'text', 'bigint', 'text'],
    requiresActorEmployeeId: false
  },
  record_telegram_contact_proof: {
    signature: 'record_telegram_contact_proof(bigint, text, text, bigint, bigint)',
    argTypes: ['bigint', 'text', 'text', 'bigint', 'bigint'],
    requiresActorEmployeeId: false
  },
  consume_telegram_contact_proof: {
    signature: 'consume_telegram_contact_proof(bigint)',
    argTypes: ['bigint'],
    requiresActorEmployeeId: false
  },
  finalize_telegram_contact_proof: {
    signature: 'finalize_telegram_contact_proof(bigint, bigint)',
    argTypes: ['bigint', 'bigint'],
    requiresActorEmployeeId: false
  },
  rotate_machine_qr_token: {
    signature: 'rotate_machine_qr_token(bigint, bigint, text, text)',
    argTypes: ['bigint', 'bigint', 'text', 'text'],
    requiresActorEmployeeId: true
  },
  rotate_sku_qr_token: {
    signature: 'rotate_sku_qr_token(bigint, bigint, text, text)',
    argTypes: ['bigint', 'bigint', 'text', 'text'],
    requiresActorEmployeeId: true
  },
  update_sku_tariff: {
    signature: 'update_sku_tariff(bigint, bigint, numeric, text)',
    argTypes: ['bigint', 'bigint', 'numeric', 'text'],
    requiresActorEmployeeId: true
  },
  create_operator_break_behavior_profile: {
    signature: 'create_operator_break_behavior_profile(bigint, text, text, boolean, boolean, boolean, boolean, boolean, text)',
    argTypes: ['bigint', 'text', 'text', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'text'],
    requiresActorEmployeeId: true
  },
  create_operator_break_type: {
    signature: 'create_operator_break_type(bigint, text, text, integer, bigint, text)',
    argTypes: ['bigint', 'text', 'text', 'integer', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  deactivate_operator_break_type: {
    signature: 'deactivate_operator_break_type(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  deactivate_operator_break_behavior_profile: {
    signature: 'deactivate_operator_break_behavior_profile(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  create_operational_downtime_behavior_profile: {
    signature: 'create_operational_downtime_behavior_profile(bigint, text, text, boolean, boolean, boolean, text)',
    argTypes: ['bigint', 'text', 'text', 'boolean', 'boolean', 'boolean', 'text'],
    requiresActorEmployeeId: true
  },
  create_critical_downtime_behavior_profile: {
    signature: 'create_critical_downtime_behavior_profile(bigint, text, text, boolean, boolean, boolean, text, text)',
    argTypes: ['bigint', 'text', 'text', 'boolean', 'boolean', 'boolean', 'text', 'text'],
    requiresActorEmployeeId: true
  },
  create_operational_downtime_type: {
    signature: 'create_operational_downtime_type(bigint, text, text, integer, bigint, text)',
    argTypes: ['bigint', 'text', 'text', 'integer', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  create_critical_downtime_type: {
    signature: 'create_critical_downtime_type(bigint, text, text, integer, bigint, text)',
    argTypes: ['bigint', 'text', 'text', 'integer', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  deactivate_operational_downtime_type: {
    signature: 'deactivate_operational_downtime_type(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  deactivate_critical_downtime_type: {
    signature: 'deactivate_critical_downtime_type(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  deactivate_operational_downtime_behavior_profile: {
    signature: 'deactivate_operational_downtime_behavior_profile(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  deactivate_critical_downtime_behavior_profile: {
    signature: 'deactivate_critical_downtime_behavior_profile(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  create_operational_downtime_notification_rule: {
    signature: 'create_operational_downtime_notification_rule(bigint, bigint, text, integer, text, text, integer, text)',
    argTypes: ['bigint', 'bigint', 'text', 'integer', 'text', 'text', 'integer', 'text'],
    requiresActorEmployeeId: true
  },
  create_critical_downtime_notification_rule: {
    signature: 'create_critical_downtime_notification_rule(bigint, bigint, text, integer, text, text, integer, text)',
    argTypes: ['bigint', 'bigint', 'text', 'integer', 'text', 'text', 'integer', 'text'],
    requiresActorEmployeeId: true
  },
  deactivate_operational_downtime_notification_rule: {
    signature: 'deactivate_operational_downtime_notification_rule(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  deactivate_critical_downtime_notification_rule: {
    signature: 'deactivate_critical_downtime_notification_rule(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  start_production_operation: {
    signature: 'start_production_operation(bigint, bigint, bigint)',
    argTypes: ['bigint', 'bigint', 'bigint'],
    requiresActorEmployeeId: true
  },
  finish_production_operation: {
    signature: 'finish_production_operation(bigint, bigint, numeric, text)',
    argTypes: ['bigint', 'bigint', 'numeric', 'text'],
    requiresActorEmployeeId: true
  },
  cancel_production_operation: {
    signature: 'cancel_production_operation(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  start_machine_downtime: {
    signature: 'start_machine_downtime(bigint, bigint, bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  finish_machine_downtime: {
    signature: 'finish_machine_downtime(bigint, bigint, text, text)',
    argTypes: ['bigint', 'bigint', 'text', 'text'],
    requiresActorEmployeeId: true
  },
  cancel_machine_downtime: {
    signature: 'cancel_machine_downtime(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  start_operator_break: {
    signature: 'start_operator_break(bigint, bigint)',
    argTypes: ['bigint', 'bigint'],
    requiresActorEmployeeId: true
  },
  finish_operator_break: { signature: 'finish_operator_break(bigint)', argTypes: ['bigint'], requiresActorEmployeeId: true },
  emergency_finish_operator_break: {
    signature: 'emergency_finish_operator_break(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  assign_additional_work: {
    signature: 'assign_additional_work(bigint, bigint, bigint)',
    argTypes: ['bigint', 'bigint', 'bigint'],
    requiresActorEmployeeId: true
  },
  request_additional_work: {
    signature: 'request_additional_work(bigint, bigint)',
    argTypes: ['bigint', 'bigint'],
    requiresActorEmployeeId: true
  },
  approve_additional_work_request: {
    signature: 'approve_additional_work_request(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  reject_additional_work_request: {
    signature: 'reject_additional_work_request(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  start_additional_work: {
    signature: 'start_additional_work(bigint, bigint)',
    argTypes: ['bigint', 'bigint'],
    requiresActorEmployeeId: true
  },
  finish_additional_work: {
    signature: 'finish_additional_work(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  approve_additional_work: {
    signature: 'approve_additional_work(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  reject_additional_work: {
    signature: 'reject_additional_work(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  cancel_additional_work: {
    signature: 'cancel_additional_work(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  mark_additional_work_without_accrual: {
    signature: 'mark_additional_work_without_accrual(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  accrue_additional_work_salary: {
    signature: 'accrue_additional_work_salary(bigint, bigint, numeric, numeric)',
    argTypes: ['bigint', 'bigint', 'numeric', 'numeric'],
    requiresActorEmployeeId: true
  },
  create_salary_correction: {
    signature: 'create_salary_correction(bigint, bigint, bigint, bigint, numeric, text)',
    argTypes: ['bigint', 'bigint', 'bigint', 'bigint', 'numeric', 'text'],
    requiresActorEmployeeId: true
  },
  approve_salary_correction: {
    signature: 'approve_salary_correction(bigint, bigint)',
    argTypes: ['bigint', 'bigint'],
    requiresActorEmployeeId: true
  },
  reject_salary_correction: {
    signature: 'reject_salary_correction(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  cancel_salary_correction: {
    signature: 'cancel_salary_correction(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  create_production_operation_correction: {
    signature: 'create_production_operation_correction(bigint, bigint, numeric, numeric, text)',
    argTypes: ['bigint', 'bigint', 'numeric', 'numeric', 'text'],
    requiresActorEmployeeId: true
  },
  approve_production_operation_correction: {
    signature: 'approve_production_operation_correction(bigint, bigint)',
    argTypes: ['bigint', 'bigint'],
    requiresActorEmployeeId: true
  },
  reject_production_operation_correction: {
    signature: 'reject_production_operation_correction(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  cancel_production_operation_correction: {
    signature: 'cancel_production_operation_correction(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  reverse_salary_entry: {
    signature: 'reverse_salary_entry(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  emergency_reverse_salary_entry: {
    signature: 'emergency_reverse_salary_entry(bigint, bigint, text, text)',
    argTypes: ['bigint', 'bigint', 'text', 'text'],
    requiresActorEmployeeId: true
  },
  mark_notification_sent: {
    signature: 'mark_notification_sent(bigint, text)',
    argTypes: ['bigint', 'text'],
    requiresActorEmployeeId: false
  },
  mark_notification_delivered: {
    signature: 'mark_notification_delivered(bigint)',
    argTypes: ['bigint'],
    requiresActorEmployeeId: false
  },
  mark_notification_read: { signature: 'mark_notification_read(bigint)', argTypes: ['bigint'], requiresActorEmployeeId: false },
  mark_notification_failed: {
    signature: 'mark_notification_failed(bigint, text)',
    argTypes: ['bigint', 'text'],
    requiresActorEmployeeId: false
  },
  hide_notification_from_chat: {
    signature: 'hide_notification_from_chat(bigint, boolean, boolean)',
    argTypes: ['bigint', 'boolean', 'boolean'],
    requiresActorEmployeeId: false
  },
  scan_active_downtimes_for_notifications: {
    signature: 'scan_active_downtimes_for_notifications()',
    argTypes: [],
    requiresActorEmployeeId: false
  },
  create_google_sheets_export_run: {
    signature: 'create_google_sheets_export_run(bigint, text, date, date)',
    argTypes: ['bigint', 'text', 'date', 'date'],
    requiresActorEmployeeId: true
  },
  finish_google_sheets_export_run_success: {
    signature: 'finish_google_sheets_export_run_success(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  finish_google_sheets_export_run_failed: {
    signature: 'finish_google_sheets_export_run_failed(bigint, bigint, text)',
    argTypes: ['bigint', 'bigint', 'text'],
    requiresActorEmployeeId: true
  },
  cancel_google_sheets_export_run: {
    signature: 'cancel_google_sheets_export_run(bigint, bigint)',
    argTypes: ['bigint', 'bigint'],
    requiresActorEmployeeId: true
  },
  read_admin_password_credential: {
    signature: 'read_admin_password_credential(text)',
    argTypes: ['text'],
    requiresActorEmployeeId: false
  },
  record_admin_password_failure: {
    signature: 'record_admin_password_failure(bigint)',
    argTypes: ['bigint'],
    requiresActorEmployeeId: false
  },
  start_admin_password_session: {
    signature: 'start_admin_password_session(bigint, text, text, text, text)',
    argTypes: ['bigint', 'text', 'text', 'text', 'text'],
    requiresActorEmployeeId: false
  },
  create_admin_telegram_qr_challenge: {
    signature: 'create_admin_telegram_qr_challenge(text, text, text, text)',
    argTypes: ['text', 'text', 'text', 'text'],
    requiresActorEmployeeId: false
  },
  confirm_admin_telegram_qr_challenge: {
    signature: 'confirm_admin_telegram_qr_challenge(text, bigint)',
    argTypes: ['text', 'bigint'],
    requiresActorEmployeeId: false
  },
  claim_admin_telegram_qr_challenge: {
    signature: 'claim_admin_telegram_qr_challenge(bigint, text, text, text, text, text)',
    argTypes: ['bigint', 'text', 'text', 'text', 'text', 'text'],
    requiresActorEmployeeId: false
  },
  resolve_admin_session: {
    signature: 'resolve_admin_session(text)',
    argTypes: ['text'],
    requiresActorEmployeeId: false
  },
  read_admin_password_credential_for_session: {
    signature: 'read_admin_password_credential_for_session(text)',
    argTypes: ['text'],
    requiresActorEmployeeId: false
  },
  change_admin_password: {
    signature: 'change_admin_password(text, text)',
    argTypes: ['text', 'text'],
    requiresActorEmployeeId: false
  },
  revoke_admin_session: {
    signature: 'revoke_admin_session(text, text)',
    argTypes: ['text', 'text'],
    requiresActorEmployeeId: false
  },
  read_admin_overview: {
    signature: 'read_admin_overview(text)',
    argTypes: ['text'],
    requiresActorEmployeeId: false
  },
  read_admin_directory: {
    signature: 'read_admin_directory(text)',
    argTypes: ['text'],
    requiresActorEmployeeId: false
  },
  prepare_admin_qr_label: {
    signature: 'prepare_admin_qr_label(text, text, bigint)',
    argTypes: ['text', 'text', 'bigint'],
    requiresActorEmployeeId: false
  },
  save_admin_employee: {
    signature: 'save_admin_employee(text, bigint, text, text, bigint, bigint, text)',
    argTypes: ['text', 'bigint', 'text', 'text', 'bigint', 'bigint', 'text'],
    requiresActorEmployeeId: false
  },
  save_admin_position: {
    signature: 'save_admin_position(text, bigint, text, text, boolean, boolean, text)',
    argTypes: ['text', 'bigint', 'text', 'text', 'boolean', 'boolean', 'text'],
    requiresActorEmployeeId: false
  },
  save_admin_machine: {
    signature: 'save_admin_machine(text, bigint, text, text, bigint, text, text)',
    argTypes: ['text', 'bigint', 'text', 'text', 'bigint', 'text', 'text'],
    requiresActorEmployeeId: false
  },
  save_admin_sku: {
    signature: 'save_admin_sku(text, bigint, text, text, bigint, numeric, numeric, boolean, text, text)',
    argTypes: ['text', 'bigint', 'text', 'text', 'bigint', 'numeric', 'numeric', 'boolean', 'text', 'text'],
    requiresActorEmployeeId: false
  },
  save_admin_additional_work_type: {
    signature: 'save_admin_additional_work_type(text, bigint, text, boolean, text)',
    argTypes: ['text', 'bigint', 'text', 'boolean', 'text'],
    requiresActorEmployeeId: false
  },
  create_admin_activity_type: {
    signature: 'create_admin_activity_type(text, text, text, text, integer, bigint, text)',
    argTypes: ['text', 'text', 'text', 'text', 'integer', 'bigint', 'text'],
    requiresActorEmployeeId: false
  },
  move_admin_activity_type: {
    signature: 'move_admin_activity_type(text, text, bigint, text)',
    argTypes: ['text', 'text', 'bigint', 'text'],
    requiresActorEmployeeId: false
  },
  deactivate_admin_activity_type: {
    signature: 'deactivate_admin_activity_type(text, text, bigint, text)',
    argTypes: ['text', 'text', 'bigint', 'text'],
    requiresActorEmployeeId: false
  }
} as const satisfies Record<string, RuntimeApiFunctionMetadata>;

export type RuntimeApiFunctionName = keyof typeof runtimeApiRegistry;

export const runtimeApiFunctionNames = Object.keys(runtimeApiRegistry) as RuntimeApiFunctionName[];

export function isRuntimeApiFunctionName(functionName: string): functionName is RuntimeApiFunctionName {
  return Object.prototype.hasOwnProperty.call(runtimeApiRegistry, functionName);
}

export function getRuntimeApiMetadata(functionName: RuntimeApiFunctionName): RuntimeApiFunctionMetadata {
  return runtimeApiRegistry[functionName];
}
