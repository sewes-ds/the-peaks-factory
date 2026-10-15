import {
  Section03GeneratedContractError,
  decodeSection03BackendPresentationTuple,
  type Section03BackendPresentationTuple,
} from './generated/managerPresentationContract';

export type Section03ContractErrorCode =
  | 'INVALID_OBJECT'
  | 'INVALID_STRING'
  | 'INVALID_ID'
  | 'INVALID_NUMBER'
  | 'INVALID_BOOLEAN'
  | 'INVALID_ARRAY'
  | 'INVALID_LITERAL'
  | 'INVALID_SECTION'
  | 'INVALID_SCREEN'
  | 'INVALID_UI_VARIANT'
  | 'INVALID_SEVERITY'
  | 'INVALID_AVAILABLE_ACTIONS'
  | 'PLACEHOLDER_REPORTS_FORBIDDEN'
  | 'OPERATION_ID_MISMATCH';

export class Section03ContractError extends Error {
  readonly code: Section03ContractErrorCode;
  readonly path: string;
  readonly expected: string;
  readonly actual: unknown;
  readonly originalError: unknown;

  constructor(input: Readonly<{ code: Section03ContractErrorCode; path: string; expected: string; actual: unknown; originalError?: unknown }>) {
    super(`Invalid Section03 contract at ${input.path}: expected ${input.expected}.`);
    this.name = 'Section03ContractError';
    this.code = input.code;
    this.path = input.path;
    this.expected = input.expected;
    this.actual = input.actual;
    this.originalError = input.originalError;
    Object.freeze(this);
  }
}

export type ManagerMachineUiVariant = 'light_blue' | 'green' | 'yellow' | 'red';
export type ManagerMachineDowntimeType = 'operational' | 'critical';
export type ManagerWorkplaceSeverity = 'none' | 'operational' | 'critical';
export type ManagerEmployeeUiState =
  | 'shift_not_started'
  | 'shift_idle'
  | 'production'
  | 'break'
  | 'operational_down'
  | 'critical_down'
  | 'additional_work';
export type ManagerEmployeeUiVariant =
  | 'white'
  | 'light_blue'
  | 'green'
  | 'yellow'
  | 'red'
  | 'grey';

export type ManagerMachine = Readonly<{
  machine_id: string;
  machine_name: string;
  ui_state: 'idle' | 'running' | 'warning' | 'critical';
  ui_variant: ManagerMachineUiVariant;
  active_production_operation_id: string | null;
  active_employee_id: string | null;
  active_employee_full_name: string | null;
  active_sku_id: string | null;
  active_sku_code: string | null;
  active_sku_name: string | null;
  active_break_id: string | null;
  active_break_name: string | null;
  active_downtime_id: string | null;
  downtime_type: ManagerMachineDowntimeType | null;
  downtime_name: string | null;
  downtime_comment: string | null;
  downtime_start_comment: string | null;
  downtime_finish_comment: string | null;
  downtime_started_at: string | null;
  downtime_duration: string | null;
  has_active_critical_downtime: boolean;
  has_active_operational_downtime: boolean;
  active_operational_downtime_id: string | null;
  is_selectable_for_manager_critical_downtime: boolean;
  available_actions: readonly string[];
}>;

export type ManagerWorkplaceState = Readonly<{
  section: 'S03';
  screen: 'S03-N01';
  manager: Readonly<{ employee_id: string; full_name: string }>;
  sections: Readonly<{
    machines: Readonly<{ title: string; running_count: number; downtime_count: number; idle_count: number; downtime_severity: ManagerWorkplaceSeverity; ui_variant: 'light_blue'; available_actions: readonly string[] }>;
    employees: Readonly<{ title: string; open_shift_count: number; production_count: number; downtime_count: number; additional_work_count: number; break_count: number; without_work_count: number; production_downtime_severity: ManagerWorkplaceSeverity; ui_variant: 'light_blue'; available_actions: readonly string[] }>;
    downtimes: Readonly<{ title: string; critical_count: number; operational_count: number; ui_variant: 'light_blue'; available_actions: readonly string[] }>;
    additional_works: Readonly<{ title: string; requested_count: number; approved_count: number; active_count: number; requires_accrual_count: number; ui_variant: 'grey'; available_actions: readonly string[] }>;
    corrections: Readonly<{ title: string; ui_variant: 'light_blue'; available_actions: readonly string[] }>;
    notifications: Readonly<{ title: string; open_tasks_count: number; ui_variant: 'light_blue'; available_actions: readonly string[] }>;
    reports: Readonly<{ title: string; ui_variant: 'light_blue'; is_placeholder: true; available_actions: readonly [] }>;
  }>;
}>;

export type ManagerOpenTaskKind =
  | 'ADDITIONAL_WORK_REQUESTED'
  | 'ADDITIONAL_WORK_WAITING_ACCRUAL'
  | 'CRITICAL_DOWNTIME_OPEN'
  | 'OPERATIONAL_DOWNTIME_OVER_15_MIN';
export type ManagerOpenTaskTargetScreenId = 'S03-AW10' | 'S03-AW50' | 'S03-M02';
export type ManagerOpenTaskColorToken = 'red' | 'yellow' | 'green' | 'gray';
export type ManagerOpenTaskUiVariant = 'red' | 'yellow' | 'green' | 'grey';
export type ManagerOpenTaskSourceTable =
  | 'additional_works'
  | 'machine_downtimes'
  | 'production_operations'
  | 'machines'
  | 'general'
  | 'unknown';
export type ManagerOpenTaskType =
  | 'additional_work_request'
  | 'additional_work_waiting_accrual'
  | 'open_machine_downtime'
  | 'open_production_operation'
  | 'machine_attention'
  | 'general_notification'
  | 'unknown';
export type ManagerOpenTaskTargetContext =
  | Readonly<{ additional_work_id: string }>
  | Readonly<{ machine_id: string }>;
export type ManagerOpenTaskItem = Readonly<{
  task_id: string;
  notification_id: string;
  created_at: string;
  task_kind: ManagerOpenTaskKind;
  entity_table: ManagerOpenTaskSourceTable;
  entity_id: string | null;
  sort_group: number;
  sort_started_at: string;
  ui_color_token: ManagerOpenTaskColorToken;
  target_screen_id: ManagerOpenTaskTargetScreenId;
  target_context: ManagerOpenTaskTargetContext;
  display_lines: readonly string[];
  source_table: ManagerOpenTaskSourceTable;
  source_id: string | null;
  task_type: ManagerOpenTaskType;
  title: string;
  description: string | null;
  ui_state: 'open';
  ui_variant: ManagerOpenTaskUiVariant;
  available_actions: readonly ['OPEN_TASK_SOURCE'];
}>;
export type ManagerOpenTasksResponse = Readonly<{
  section: 'S03';
  screen: 'S03-NOT01';
  title: 'Уведомления';
  tasks: readonly ManagerOpenTaskItem[];
  open_tasks: readonly ManagerOpenTaskItem[];
  open_tasks_count: number;
  available_actions: readonly ['BACK'];
}>;

export type ManagerMachines = Readonly<{ section: 'S03'; screen: 'S03-M01'; title: string; machines: readonly ManagerMachine[]; available_actions: readonly string[] }>;
export type ManagerMachineCard = Readonly<{ section: 'S03'; screen: 'S03-M02'; machine: ManagerMachine; available_actions: readonly string[] }>;
export type ManagerEmployee = Readonly<{
  employee_id: string;
  full_name: string;
  ui_state: ManagerEmployeeUiState;
  ui_variant: ManagerEmployeeUiVariant;
  open_shift_id: string | null;
  shift_started_at: string | null;
  active_production_operation_id: string | null;
  production_started_at: string | null;
  active_machine_id: string | null;
  active_machine_name: string | null;
  active_sku_id: string | null;
  active_sku_code: string | null;
  active_sku_name: string | null;
  active_break_id: string | null;
  active_break_name: string | null;
  break_started_at: string | null;
  break_duration: string | null;
  active_downtime_id: string | null;
  downtime_type: ManagerMachineDowntimeType | null;
  downtime_name: string | null;
  downtime_comment: string | null;
  downtime_started_at: string | null;
  downtime_duration: string | null;
  downtime_start_comment: string | null;
  downtime_finish_comment: string | null;
  active_additional_work_id: string | null;
  active_additional_work_name: string | null;
  additional_work_started_at: string | null;
  additional_work_duration: string | null;
  available_actions: readonly 'OPEN_EMPLOYEE_CARD'[];
}>;
export type ManagerShiftBlockers = Readonly<{
  production: Readonly<{
    production_operation_id: string;
    machine_id: string | null;
    machine_name: string | null;
    sku_name: string | null;
  }> | null;
  break: Readonly<{
    target_employee_id: string;
    operator_break_id: string;
  }> | null;
  additional_work: Readonly<{
    additional_work_id: string;
  }> | null;
}>;
export type ManagerEmployees = Readonly<{
  section: 'S03';
  screen: 'S03-E01';
  title: 'Сотрудники';
  employees: readonly ManagerEmployee[];
  available_actions: readonly 'BACK'[];
}>;
export type ManagerEmployeeCard = Readonly<{
  section: 'S03';
  screen: 'S03-E02';
  employee: Omit<ManagerEmployee, 'available_actions'> & Readonly<{
    blockers: ManagerShiftBlockers;
    available_actions: readonly (
      | 'VIEW_SALARY'
      | 'VIEW_COMPLETED_WORKS'
      | 'FINISH_EMPLOYEE_SHIFT_BY_MANAGER'
    )[];
  }>;
  available_actions: readonly 'BACK'[];
}>;
export type ManagerCompletedWorkType = 'production' | 'additional_work';
export type ManagerCompletedWorkItem = Readonly<{
  work_item_id: string;
  work_type: ManagerCompletedWorkType;
  operation_id: string;
  employee_id: string;
  employee_full_name: string;
  completed_date: string;
  production_operation_id: string | null;
  additional_work_id: string | null;
  machine_id: string | null;
  machine_name: string | null;
  sku_name: string | null;
  sku_code: string | null;
  quantity: string | null;
  additional_work_name: string | null;
  salary_entry_id: string | null;
  salary_amount_uzs: string;
  amount_uzs: string;
  old_quantity: string | null;
  correction_base_quantity: string | null;
  current_quantity: string | null;
  can_correct: boolean;
  can_storno: boolean;
  is_reversed: boolean;
  reversal_id: string | null;
}>;
export type ManagerCompletedWorksResponse = Readonly<{
  section: 'S03';
  screen: 'S03-E21' | 'S03-CF22' | 'S03-CP12';
  employee: Readonly<{ employee_id: string; full_name: string }>;
  works: readonly ManagerCompletedWorkItem[];
  available_actions: readonly ['BACK'];
}>;
export type ManagerEmployeeCompletedProductionOperationsResponse = Readonly<{
  section: 'S03';
  screen: 'S03-CP12';
  employee: Readonly<{ employee_id: string; full_name: string }>;
  works: readonly ManagerCompletedWorkItem[];
  available_actions: readonly ['BACK'];
}>;
export type ManagerMachineCompletedProductionOperation = Readonly<
  Omit<
    ManagerCompletedWorkItem,
    | 'work_type'
    | 'production_operation_id'
    | 'machine_id'
    | 'machine_name'
    | 'quantity'
    | 'current_quantity'
    | 'correction_base_quantity'
  > & {
    work_type: 'production';
    production_operation_id: string;
    machine_id: string;
    machine_name: string;
    quantity: string;
    current_quantity: string;
    correction_base_quantity: string;
  }
>;
export type ManagerMachineCompletedProductionOperationsResponse = Readonly<{
  section: 'S03';
  screen: 'S03-CP12';
  machine: Readonly<{ machine_id: string; machine_name: string }>;
  operations: readonly ManagerMachineCompletedProductionOperation[];
  available_actions: readonly ['BACK'];
}>;
export type ManagerProductionCompletedOperationsResponse =
  | ManagerEmployeeCompletedProductionOperationsResponse
  | ManagerMachineCompletedProductionOperationsResponse;
export type ManagerCompletedWorkCardResponse = Readonly<{
  section: 'S03';
  screen: 'S03-E22' | 'S03-CF23';
  employee: Readonly<{ employee_id: string; full_name: string }>;
  work: ManagerCompletedWorkItem;
  available_actions: readonly ['BACK'];
}>;
export type ManagerEmployeeSalaryResponse = Readonly<{
  section: 'S03';
  screen: 'S03-SAL01';
  employee: Readonly<{ employee_id: string; full_name: string }>;
  employee_id: string;
  totals: Readonly<{
    today_uzs: string;
    week_uzs: string;
    month_uzs: string;
  }>;
  breakdown?: Readonly<{
    production_uzs: string;
    additional_work_uzs: string;
    corrections_uzs: string | null;
    reversals_uzs: string | null;
  }>;
}>;
export type ManagerEmployeeSalaryHistoryMonth = Readonly<{
  month: string;
  total_uzs: string;
  production_uzs: string;
  additional_work_uzs: string;
  corrections_uzs: string | null;
  reversals_uzs: string | null;
}>;
export type ManagerEmployeeSalaryHistoryResponse = Readonly<{
  section: 'S03';
  screen: 'S03-SAL02';
  employee: Readonly<{ employee_id: string; full_name: string }>;
  employee_id: string;
  months: readonly ManagerEmployeeSalaryHistoryMonth[];
}>;
export type ManagerAdditionalWorkStatus =
  | 'requested'
  | 'approved'
  | 'active'
  | 'waiting_accrual';
export type ManagerAdditionalWorkAction =
  | 'OPEN_ADDITIONAL_WORK_CARD'
  | 'APPROVE_ADDITIONAL_WORK_REQUEST'
  | 'REJECT_ADDITIONAL_WORK_REQUEST'
  | 'CANCEL_ADDITIONAL_WORK'
  | 'FINISH_ADDITIONAL_WORK'
  | 'ACCRUE_ADDITIONAL_WORK_SALARY'
  | 'MARK_WITHOUT_ACCRUAL';
export type ManagerAdditionalWorkItem = Readonly<{
  additional_work_id: string;
  additional_work_type_id: string;
  additional_work_name: string;
  employee_id: string;
  employee_full_name: string;
  requested_at: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: ManagerAdditionalWorkStatus;
  ui_state: ManagerAdditionalWorkStatus;
  ui_variant: 'grey' | 'green' | 'yellow';
  available_actions: readonly ManagerAdditionalWorkAction[];
}>;
export type ManagerAdditionalWorksResponse = Readonly<{
  section: 'S03';
  screen: 'S03-AW01';
  title: 'Доп. работы';
  groups: Readonly<Record<ManagerAdditionalWorkStatus, readonly ManagerAdditionalWorkItem[]>>;
  available_actions: readonly ['ASSIGN_ADDITIONAL_WORK', 'BACK'];
}>;
export const ADDITIONAL_WORK_ASSIGNMENT_BLOCKED_CODES_ = Object.freeze([
  'additional_work_assignment_already_exists',
  'additional_work_target_not_available',
  'additional_work_type_not_available',
  'additional_work_assignment_forbidden',
  'additional_work_assignment_conflict',
] as const);
export type AdditionalWorkAssignmentBlockedCode =
  typeof ADDITIONAL_WORK_ASSIGNMENT_BLOCKED_CODES_[number];

export type ManagerAdditionalWorkTypeAvailable = Readonly<{
  additional_work_type_id: string;
  additional_work_name: string;
  is_active: boolean;
  display_order: number;
  can_assign: boolean;
  blocked_code: AdditionalWorkAssignmentBlockedCode | null;
  blocked_message: string | null;
}>;
export type ManagerAdditionalWorkTypesAvailableResponse = Readonly<{
  section: 'S03';
  screen: 'S03-AW41';
  assignability_employee_id: string;
  assignability_additional_work_type_id: string | null;
  additional_work_types: readonly ManagerAdditionalWorkTypeAvailable[];
  available_actions:
    | readonly ['ASSIGN_ADDITIONAL_WORK', 'BACK']
    | readonly ['BACK'];
}>;
export type ManagerSalaryCorrectionContextEmployee = Readonly<{
  employee_id: string;
  employee_full_name: string;
  employee_shift_id: string;
  shift_started_at: string;
  shift_finished_at: string | null;
}>;
export type ManagerSalaryCorrectionContextResponse = Readonly<{
  section: 'S03';
  screen: 'S03-CF10';
  employees_with_today_shift: readonly ManagerSalaryCorrectionContextEmployee[];
  default_accrual_salary_correction_type_id: string;
  default_withholding_salary_correction_type_id: string;
  available_actions: readonly ['BACK'];
}>;
export type OperationIdResponse = Readonly<{ id: string }>;
export type Section03ExportRunResponse = Readonly<{ export_run_id: string }>;

type PlainObject = Readonly<Record<string, unknown>>;

const severities = Object.freeze(['none', 'operational', 'critical'] as const);
const machineStates = Object.freeze(['idle', 'running', 'warning', 'critical'] as const);
const machineVariants = Object.freeze(['light_blue', 'green', 'yellow', 'red'] as const);
const downtimeTypes = Object.freeze(['operational', 'critical'] as const);
const employeeStates = Object.freeze([
  'shift_not_started',
  'shift_idle',
  'production',
  'break',
  'operational_down',
  'critical_down',
  'additional_work',
] as const);
const employeeVariants = Object.freeze([
  'white',
  'light_blue',
  'green',
  'yellow',
  'red',
  'grey',
] as const);
const completedWorkTypes = Object.freeze([
  'production',
  'additional_work',
] as const);
const additionalWorkStatuses = Object.freeze([
  'requested', 'approved', 'active', 'waiting_accrual',
] as const);
const additionalWorkVariants = Object.freeze(['grey', 'green', 'yellow'] as const);
const additionalWorkActions = Object.freeze([
  'OPEN_ADDITIONAL_WORK_CARD',
  'APPROVE_ADDITIONAL_WORK_REQUEST',
  'REJECT_ADDITIONAL_WORK_REQUEST',
  'CANCEL_ADDITIONAL_WORK',
  'FINISH_ADDITIONAL_WORK',
  'ACCRUE_ADDITIONAL_WORK_SALARY',
  'MARK_WITHOUT_ACCRUAL',
] as const);
const additionalWorkActionsByStatus = Object.freeze({
  requested: Object.freeze(['OPEN_ADDITIONAL_WORK_CARD', 'APPROVE_ADDITIONAL_WORK_REQUEST', 'REJECT_ADDITIONAL_WORK_REQUEST'] as const),
  approved: Object.freeze(['OPEN_ADDITIONAL_WORK_CARD', 'CANCEL_ADDITIONAL_WORK'] as const),
  active: Object.freeze(['OPEN_ADDITIONAL_WORK_CARD', 'FINISH_ADDITIONAL_WORK'] as const),
  waiting_accrual: Object.freeze(['OPEN_ADDITIONAL_WORK_CARD', 'ACCRUE_ADDITIONAL_WORK_SALARY', 'MARK_WITHOUT_ACCRUAL'] as const),
});
const openTaskKinds = Object.freeze([
  'ADDITIONAL_WORK_REQUESTED',
  'ADDITIONAL_WORK_WAITING_ACCRUAL',
  'CRITICAL_DOWNTIME_OPEN',
  'OPERATIONAL_DOWNTIME_OVER_15_MIN',
] as const);
const openTaskTargets = Object.freeze(['S03-AW10', 'S03-AW50', 'S03-M02'] as const);
const openTaskColors = Object.freeze(['red', 'yellow', 'green', 'gray'] as const);
const openTaskVariants = Object.freeze(['red', 'yellow', 'green', 'grey'] as const);
const openTaskSourceTables = Object.freeze([
  'additional_works', 'machine_downtimes', 'production_operations',
  'machines', 'general', 'unknown',
] as const);
const openTaskTypes = Object.freeze([
  'additional_work_request', 'additional_work_waiting_accrual',
  'open_machine_downtime', 'open_production_operation', 'machine_attention',
  'general_notification', 'unknown',
] as const);

function fail(code: Section03ContractErrorCode, path: string, expected: string, actual: unknown): never {
  throw new Section03ContractError({ code, path, expected, actual });
}

function generatedTuple(
  tuple: Section03BackendPresentationTuple,
  path: string,
): void {
  try {
    decodeSection03BackendPresentationTuple(tuple);
  } catch (error: unknown) {
    if (error instanceof Section03GeneratedContractError) {
      throw new Section03ContractError({
        code: 'INVALID_UI_VARIANT',
        path,
        expected: 'backend-generated canonical presentation tuple',
        actual: tuple,
        originalError: error,
      });
    }
    throw error;
  }
}

function object(value: unknown, path: string): PlainObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('INVALID_OBJECT', path, 'plain object', value);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail('INVALID_OBJECT', path, 'plain object', value);
  }
  return value as PlainObject;
}

function field(source: PlainObject, key: string, path: string): unknown {
  const value = source[key];
  if (value === undefined) {
    return fail('INVALID_OBJECT', `${path}.${key}`, 'required field', value);
  }
  return value;
}

function exactObjectFields(source: PlainObject, path: string, expected: readonly string[]): void {
  const expectedSet = new Set(expected);
  const actual = Object.keys(source);
  if (actual.length !== expected.length || actual.some((key) => !expectedSet.has(key))) {
    fail('INVALID_OBJECT', path, `exact fields [${expected.join(', ')}]`, actual);
  }
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail('INVALID_STRING', path, 'non-empty string', value);
  }
  return value.trim();
}

function id(value: unknown, path: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fail('INVALID_ID', path, 'non-empty string or finite number ID', value);
}

function nullableId(value: unknown, path: string): string | null {
  return value === null ? null : id(value, path);
}

function nullableText(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path);
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    return fail('INVALID_STRING', path, 'string', value);
  }
  return value;
}

function nullableStringValue(value: unknown, path: string): string | null {
  return value === null ? null : stringValue(value, path);
}

function canonicalNonNegativeDecimal(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) {
    return fail('INVALID_STRING', path, 'canonical non-negative decimal string', value);
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    return fail('INVALID_BOOLEAN', path, 'boolean', value);
  }
  return value;
}

function count(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return fail('INVALID_NUMBER', path, 'finite non-negative integer', value);
  }
  return value;
}

function nonNegativeSafeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return fail('INVALID_NUMBER', path, 'non-negative safe integer', value);
  }
  return value;
}

function salaryValue(value: unknown, path: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail('INVALID_NUMBER', path, 'finite number', value);
  }
  return String(value);
}

function nullableSalaryValue(value: unknown, path: string): string | null {
  return value === null ? null : salaryValue(value, path);
}

function exact<const TValue extends string>(value: unknown, path: string, expected: TValue, code: Section03ContractErrorCode = 'INVALID_LITERAL'): TValue {
  if (value !== expected) {
    return fail(code, path, expected, value);
  }
  return expected;
}

function oneOf<const TValue extends string>(value: unknown, path: string, values: readonly TValue[], code: Section03ContractErrorCode): TValue {
  if (typeof value !== 'string') {
    return fail(code, path, values.join(' | '), value);
  }
  for (const item of values) {
    if (value === item) {
      return item;
    }
  }
  return fail(code, path, values.join(' | '), value);
}

function nullableOneOf<const TValue extends string>(value: unknown, path: string, values: readonly TValue[], code: Section03ContractErrorCode): TValue | null {
  return value === null ? null : oneOf(value, path, values, code);
}

function actions(value: unknown, path: string, allowEmpty = false): readonly string[] {
  if (!Array.isArray(value)) {
    return fail('INVALID_ARRAY', path, 'array of non-empty strings', value);
  }
  if (!allowEmpty && value.length === 0) {
    return fail('INVALID_AVAILABLE_ACTIONS', path, 'non-empty available_actions array', value);
  }
  return Object.freeze(value.map((item, index) => text(item, `${path}[${index}]`)));
}

function closedActions<const TValue extends string>(
  value: unknown,
  path: string,
  allowed: readonly TValue[],
  allowEmpty = false,
): readonly TValue[] {
  const decoded = actions(value, path, allowEmpty);
  const unique = new Set<string>();
  return Object.freeze(decoded.map((item, index) => {
    const resolved = oneOf(
      item,
      `${path}[${index}]`,
      allowed,
      'INVALID_AVAILABLE_ACTIONS',
    );
    if (unique.has(resolved)) {
      return fail(
        'INVALID_AVAILABLE_ACTIONS',
        `${path}[${index}]`,
        'unique available action',
        resolved,
      );
    }
    unique.add(resolved);
    return resolved;
  }));
}

function array<TValue>(value: unknown, path: string, decode: (item: unknown, path: string) => TValue): readonly TValue[] {
  if (!Array.isArray(value)) {
    return fail('INVALID_ARRAY', path, 'array', value);
  }
  return Object.freeze(value.map((item, index) => decode(item, `${path}[${index}]`)));
}

function backOnly(value: unknown, path: string): readonly ['BACK'] {
  const decoded = closedActions(value, path, ['BACK']);
  if (decoded.length !== 1 || decoded[0] !== 'BACK') {
    return fail('INVALID_AVAILABLE_ACTIONS', path, 'exactly [BACK]', value);
  }
  return decoded as readonly ['BACK'];
}

function completedWorkEmployee(
  value: unknown,
  path: string,
): Readonly<{ employee_id: string; full_name: string }> {
  const source = object(value, path);
  return Object.freeze({
    employee_id: id(field(source, 'employee_id', path), `${path}.employee_id`),
    full_name: text(field(source, 'full_name', path), `${path}.full_name`),
  });
}

function decodeCompletedWorkItem(
  value: unknown,
  path: string,
): ManagerCompletedWorkItem {
  const source = object(value, path);
  return Object.freeze({
    work_item_id: id(field(source, 'work_item_id', path), `${path}.work_item_id`),
    work_type: oneOf(field(source, 'work_type', path), `${path}.work_type`, completedWorkTypes, 'INVALID_LITERAL'),
    operation_id: id(field(source, 'operation_id', path), `${path}.operation_id`),
    employee_id: id(field(source, 'employee_id', path), `${path}.employee_id`),
    employee_full_name: text(field(source, 'employee_full_name', path), `${path}.employee_full_name`),
    completed_date: text(field(source, 'completed_date', path), `${path}.completed_date`),
    production_operation_id: nullableId(field(source, 'production_operation_id', path), `${path}.production_operation_id`),
    additional_work_id: nullableId(field(source, 'additional_work_id', path), `${path}.additional_work_id`),
    machine_id: nullableId(field(source, 'machine_id', path), `${path}.machine_id`),
    machine_name: nullableStringValue(field(source, 'machine_name', path), `${path}.machine_name`),
    sku_name: nullableStringValue(field(source, 'sku_name', path), `${path}.sku_name`),
    sku_code: nullableStringValue(field(source, 'sku_code', path), `${path}.sku_code`),
    quantity: nullableStringValue(field(source, 'quantity', path), `${path}.quantity`),
    additional_work_name: nullableStringValue(field(source, 'additional_work_name', path), `${path}.additional_work_name`),
    salary_entry_id: nullableId(field(source, 'salary_entry_id', path), `${path}.salary_entry_id`),
    salary_amount_uzs: stringValue(field(source, 'salary_amount_uzs', path), `${path}.salary_amount_uzs`),
    amount_uzs: stringValue(field(source, 'amount_uzs', path), `${path}.amount_uzs`),
    old_quantity: nullableStringValue(field(source, 'old_quantity', path), `${path}.old_quantity`),
    correction_base_quantity: nullableStringValue(field(source, 'correction_base_quantity', path), `${path}.correction_base_quantity`),
    current_quantity: nullableStringValue(field(source, 'current_quantity', path), `${path}.current_quantity`),
    can_correct: boolean(field(source, 'can_correct', path), `${path}.can_correct`),
    can_storno: boolean(field(source, 'can_storno', path), `${path}.can_storno`),
    is_reversed: boolean(field(source, 'is_reversed', path), `${path}.is_reversed`),
    reversal_id: nullableId(field(source, 'reversal_id', path), `${path}.reversal_id`),
  });
}

function decodeSalaryHistoryMonth(
  value: unknown,
  path: string,
): ManagerEmployeeSalaryHistoryMonth {
  const source = object(value, path);
  return Object.freeze({
    month: text(field(source, 'month', path), `${path}.month`),
    total_uzs: salaryValue(field(source, 'total_uzs', path), `${path}.total_uzs`),
    production_uzs: salaryValue(field(source, 'production_uzs', path), `${path}.production_uzs`),
    additional_work_uzs: salaryValue(field(source, 'additional_work_uzs', path), `${path}.additional_work_uzs`),
    corrections_uzs: nullableSalaryValue(field(source, 'corrections_uzs', path), `${path}.corrections_uzs`),
    reversals_uzs: nullableSalaryValue(field(source, 'reversals_uzs', path), `${path}.reversals_uzs`),
  });
}

function decodeAdditionalWorkItem(
  value: unknown,
  path: string,
  group: ManagerAdditionalWorkStatus,
  identities: Set<string>,
): ManagerAdditionalWorkItem {
  const source = object(value, path);
  const workId = id(field(source, 'additional_work_id', path), `${path}.additional_work_id`);
  if (identities.has(workId)) {
    return fail('INVALID_ID', `${path}.additional_work_id`, 'globally unique additional_work_id', workId);
  }
  identities.add(workId);
  const status = oneOf(field(source, 'status', path), `${path}.status`, additionalWorkStatuses, 'INVALID_LITERAL');
  if (status !== group) return fail('INVALID_LITERAL', `${path}.status`, group, status);
  const uiState = oneOf(field(source, 'ui_state', path), `${path}.ui_state`, additionalWorkStatuses, 'INVALID_LITERAL');
  if (uiState !== status) return fail('INVALID_LITERAL', `${path}.ui_state`, status, uiState);
  const uiVariant = oneOf(
    field(source, 'ui_variant', path),
    `${path}.ui_variant`,
    additionalWorkVariants,
    'INVALID_UI_VARIANT',
  );
  generatedTuple({
    family: 'additional_work',
    tuple: { status, ui_variant: uiVariant },
  }, `${path}.presentation_tuple`);
  const decodedActions = closedActions(
    field(source, 'available_actions', path),
    `${path}.available_actions`,
    additionalWorkActions,
  );
  const expectedActions = additionalWorkActionsByStatus[status];
  if (decodedActions.length !== expectedActions.length || decodedActions.some((action, index) => action !== expectedActions[index])) {
    return fail('INVALID_AVAILABLE_ACTIONS', `${path}.available_actions`, `exactly [${expectedActions.join(', ')}]`, decodedActions);
  }
  return Object.freeze({
    additional_work_id: workId,
    additional_work_type_id: id(field(source, 'additional_work_type_id', path), `${path}.additional_work_type_id`),
    additional_work_name: text(field(source, 'additional_work_name', path), `${path}.additional_work_name`),
    employee_id: id(field(source, 'employee_id', path), `${path}.employee_id`),
    employee_full_name: text(field(source, 'employee_full_name', path), `${path}.employee_full_name`),
    requested_at: nullableText(field(source, 'requested_at', path), `${path}.requested_at`),
    created_at: nullableText(field(source, 'created_at', path), `${path}.created_at`),
    started_at: nullableText(field(source, 'started_at', path), `${path}.started_at`),
    finished_at: nullableText(field(source, 'finished_at', path), `${path}.finished_at`),
    status,
    ui_state: uiState,
    ui_variant: uiVariant,
    available_actions: decodedActions,
  });
}

function decodeMachine(value: unknown, path: string): ManagerMachine {
  const source = object(value, path);
  const uiState = oneOf(field(source, 'ui_state', path), `${path}.ui_state`, machineStates, 'INVALID_LITERAL');
  const uiVariant = oneOf(field(source, 'ui_variant', path), `${path}.ui_variant`, machineVariants, 'INVALID_UI_VARIANT');
  generatedTuple({
    family: 'machine',
    tuple: { ui_state: uiState, ui_variant: uiVariant },
  }, `${path}.presentation_tuple`);
  return Object.freeze({
    machine_id: id(field(source, 'machine_id', path), `${path}.machine_id`),
    machine_name: text(field(source, 'machine_name', path), `${path}.machine_name`),
    ui_state: uiState,
    ui_variant: uiVariant,
    active_production_operation_id: nullableId(field(source, 'active_production_operation_id', path), `${path}.active_production_operation_id`),
    active_employee_id: nullableId(field(source, 'active_employee_id', path), `${path}.active_employee_id`),
    active_employee_full_name: nullableText(field(source, 'active_employee_full_name', path), `${path}.active_employee_full_name`),
    active_sku_id: nullableId(field(source, 'active_sku_id', path), `${path}.active_sku_id`),
    active_sku_code: nullableText(field(source, 'active_sku_code', path), `${path}.active_sku_code`),
    active_sku_name: nullableText(field(source, 'active_sku_name', path), `${path}.active_sku_name`),
    active_break_id: nullableId(field(source, 'active_break_id', path), `${path}.active_break_id`),
    active_break_name: nullableText(field(source, 'active_break_name', path), `${path}.active_break_name`),
    active_downtime_id: nullableId(field(source, 'active_downtime_id', path), `${path}.active_downtime_id`),
    downtime_type: nullableOneOf(field(source, 'downtime_type', path), `${path}.downtime_type`, downtimeTypes, 'INVALID_LITERAL'),
    downtime_name: nullableText(field(source, 'downtime_name', path), `${path}.downtime_name`),
    downtime_comment: nullableText(field(source, 'downtime_comment', path), `${path}.downtime_comment`),
    downtime_start_comment: nullableText(field(source, 'downtime_start_comment', path), `${path}.downtime_start_comment`),
    downtime_finish_comment: nullableText(field(source, 'downtime_finish_comment', path), `${path}.downtime_finish_comment`),
    downtime_started_at: nullableText(field(source, 'downtime_started_at', path), `${path}.downtime_started_at`),
    downtime_duration: nullableText(field(source, 'downtime_duration', path), `${path}.downtime_duration`),
    has_active_critical_downtime: boolean(field(source, 'has_active_critical_downtime', path), `${path}.has_active_critical_downtime`),
    has_active_operational_downtime: boolean(field(source, 'has_active_operational_downtime', path), `${path}.has_active_operational_downtime`),
    active_operational_downtime_id: nullableId(field(source, 'active_operational_downtime_id', path), `${path}.active_operational_downtime_id`),
    is_selectable_for_manager_critical_downtime: boolean(field(source, 'is_selectable_for_manager_critical_downtime', path), `${path}.is_selectable_for_manager_critical_downtime`),
    available_actions: actions(field(source, 'available_actions', path), `${path}.available_actions`, true),
  });
}

function decodeEmployee(
  value: unknown,
  path: string,
  card: boolean,
): ManagerEmployee | ManagerEmployeeCard['employee'] {
  const source = object(value, path);
  const uiState = oneOf(
    field(source, 'ui_state', path),
    `${path}.ui_state`,
    employeeStates,
    'INVALID_LITERAL',
  );
  const uiVariant = oneOf(
    field(source, 'ui_variant', path),
    `${path}.ui_variant`,
    employeeVariants,
    'INVALID_UI_VARIANT',
  );
  generatedTuple({
    family: 'employee',
    tuple: { ui_state: uiState, ui_variant: uiVariant },
  }, `${path}.presentation_tuple`);
  const decoded = {
    employee_id: id(field(source, 'employee_id', path), `${path}.employee_id`),
    full_name: text(field(source, 'full_name', path), `${path}.full_name`),
    ui_state: uiState,
    ui_variant: uiVariant,
    open_shift_id: nullableId(field(source, 'open_shift_id', path), `${path}.open_shift_id`),
    shift_started_at: nullableText(field(source, 'shift_started_at', path), `${path}.shift_started_at`),
    active_production_operation_id: nullableId(field(source, 'active_production_operation_id', path), `${path}.active_production_operation_id`),
    production_started_at: nullableText(field(source, 'production_started_at', path), `${path}.production_started_at`),
    active_machine_id: nullableId(field(source, 'active_machine_id', path), `${path}.active_machine_id`),
    active_machine_name: nullableText(field(source, 'active_machine_name', path), `${path}.active_machine_name`),
    active_sku_id: nullableId(field(source, 'active_sku_id', path), `${path}.active_sku_id`),
    active_sku_code: nullableText(field(source, 'active_sku_code', path), `${path}.active_sku_code`),
    active_sku_name: nullableText(field(source, 'active_sku_name', path), `${path}.active_sku_name`),
    active_break_id: nullableId(field(source, 'active_break_id', path), `${path}.active_break_id`),
    active_break_name: nullableText(field(source, 'active_break_name', path), `${path}.active_break_name`),
    break_started_at: nullableText(field(source, 'break_started_at', path), `${path}.break_started_at`),
    break_duration: nullableText(field(source, 'break_duration', path), `${path}.break_duration`),
    active_downtime_id: nullableId(field(source, 'active_downtime_id', path), `${path}.active_downtime_id`),
    downtime_type: nullableOneOf(field(source, 'downtime_type', path), `${path}.downtime_type`, downtimeTypes, 'INVALID_LITERAL'),
    downtime_name: nullableText(field(source, 'downtime_name', path), `${path}.downtime_name`),
    downtime_comment: nullableText(field(source, 'downtime_comment', path), `${path}.downtime_comment`),
    downtime_started_at: nullableText(field(source, 'downtime_started_at', path), `${path}.downtime_started_at`),
    downtime_duration: nullableText(field(source, 'downtime_duration', path), `${path}.downtime_duration`),
    downtime_start_comment: nullableText(field(source, 'downtime_start_comment', path), `${path}.downtime_start_comment`),
    downtime_finish_comment: nullableText(field(source, 'downtime_finish_comment', path), `${path}.downtime_finish_comment`),
    active_additional_work_id: nullableId(field(source, 'active_additional_work_id', path), `${path}.active_additional_work_id`),
    active_additional_work_name: nullableText(field(source, 'active_additional_work_name', path), `${path}.active_additional_work_name`),
    additional_work_started_at: nullableText(field(source, 'additional_work_started_at', path), `${path}.additional_work_started_at`),
    additional_work_duration: nullableText(field(source, 'additional_work_duration', path), `${path}.additional_work_duration`),
  };
  if (!card) {
    return Object.freeze({
      ...decoded,
      available_actions: closedActions(
        field(source, 'available_actions', path),
        `${path}.available_actions`,
        ['OPEN_EMPLOYEE_CARD'],
        true,
      ),
    });
  }
  return Object.freeze({
    ...decoded,
    blockers: decodeShiftBlockers(
      field(source, 'blockers', path),
      `${path}.blockers`,
    ),
    available_actions: closedActions(
      field(source, 'available_actions', path),
      `${path}.available_actions`,
      [
        'VIEW_SALARY',
        'VIEW_COMPLETED_WORKS',
        'FINISH_EMPLOYEE_SHIFT_BY_MANAGER',
      ],
      true,
    ),
  });
}

function decodeShiftBlockers(
  value: unknown,
  path: string,
): ManagerShiftBlockers {
  const source = object(value, path);
  const productionValue = field(source, 'production', path);
  const breakValue = field(source, 'break', path);
  const additionalWorkValue = field(source, 'additional_work', path);
  const production = productionValue === null
    ? null
    : (() => {
        const item = object(productionValue, `${path}.production`);
        return Object.freeze({
          production_operation_id: id(field(item, 'production_operation_id', `${path}.production`), `${path}.production.production_operation_id`),
          machine_id: nullableId(field(item, 'machine_id', `${path}.production`), `${path}.production.machine_id`),
          machine_name: nullableText(field(item, 'machine_name', `${path}.production`), `${path}.production.machine_name`),
          sku_name: nullableText(field(item, 'sku_name', `${path}.production`), `${path}.production.sku_name`),
        });
      })();
  const employeeBreak = breakValue === null
    ? null
    : (() => {
        const item = object(breakValue, `${path}.break`);
        return Object.freeze({
          target_employee_id: id(field(item, 'target_employee_id', `${path}.break`), `${path}.break.target_employee_id`),
          operator_break_id: id(field(item, 'operator_break_id', `${path}.break`), `${path}.break.operator_break_id`),
        });
      })();
  const additionalWork = additionalWorkValue === null
    ? null
    : (() => {
        const item = object(additionalWorkValue, `${path}.additional_work`);
        return Object.freeze({
          additional_work_id: id(field(item, 'additional_work_id', `${path}.additional_work`), `${path}.additional_work.additional_work_id`),
        });
      })();
  return Object.freeze({
    production,
    break: employeeBreak,
    additional_work: additionalWork,
  });
}

function baseSection(value: unknown, path: string): PlainObject {
  const source = object(value, path);
  text(field(source, 'title', path), `${path}.title`);
  actions(field(source, 'available_actions', path), `${path}.available_actions`);
  return source;
}

function title(source: PlainObject, path: string): string {
  return text(field(source, 'title', path), `${path}.title`);
}

const openTaskSemantics = Object.freeze({
  ADDITIONAL_WORK_REQUESTED: Object.freeze({
    target: 'S03-AW10', contextKey: 'additional_work_id',
    taskType: 'additional_work_request',
  }),
  ADDITIONAL_WORK_WAITING_ACCRUAL: Object.freeze({
    target: 'S03-AW50', contextKey: 'additional_work_id',
    taskType: 'additional_work_waiting_accrual',
  }),
  CRITICAL_DOWNTIME_OPEN: Object.freeze({
    target: 'S03-M02', contextKey: 'machine_id',
    taskType: 'open_machine_downtime',
  }),
  OPERATIONAL_DOWNTIME_OVER_15_MIN: Object.freeze({
    target: 'S03-M02', contextKey: 'machine_id',
    taskType: 'open_machine_downtime',
  }),
} as const satisfies Readonly<Record<ManagerOpenTaskKind, Readonly<{
  target: ManagerOpenTaskTargetScreenId;
  contextKey: 'additional_work_id' | 'machine_id';
  taskType: ManagerOpenTaskType;
}>>>);

function decodeManagerOpenTask(value: unknown, path: string): ManagerOpenTaskItem {
  const source = object(value, path);
  exactObjectFields(source, path, [
    'task_id', 'notification_id', 'created_at', 'task_kind', 'entity_table',
    'entity_id', 'sort_group', 'sort_started_at', 'ui_color_token',
    'target_screen_id', 'target_context', 'display_lines', 'source_table',
    'source_id', 'task_type', 'title', 'description', 'ui_state', 'ui_variant',
    'available_actions',
  ]);
  const taskKind = oneOf(
    field(source, 'task_kind', path), `${path}.task_kind`, openTaskKinds, 'INVALID_LITERAL',
  );
  const semantics = openTaskSemantics[taskKind];
  const target = exact(
    oneOf(field(source, 'target_screen_id', path), `${path}.target_screen_id`, openTaskTargets, 'INVALID_SCREEN'),
    `${path}.target_screen_id`, semantics.target, 'INVALID_SCREEN',
  );
  const targetContextSource = object(field(source, 'target_context', path), `${path}.target_context`);
  exactObjectFields(targetContextSource, `${path}.target_context`, [semantics.contextKey]);
  const targetContext = Object.freeze({
    [semantics.contextKey]: text(
      field(targetContextSource, semantics.contextKey, `${path}.target_context`),
      `${path}.target_context.${semantics.contextKey}`,
    ),
  }) as ManagerOpenTaskTargetContext;
  const color = oneOf(
    field(source, 'ui_color_token', path),
    `${path}.ui_color_token`,
    openTaskColors,
    'INVALID_UI_VARIANT',
  );
  const variant = oneOf(
    field(source, 'ui_variant', path),
    `${path}.ui_variant`,
    openTaskVariants,
    'INVALID_UI_VARIANT',
  );
  generatedTuple({
    family: 'notification',
    tuple: {
      task_kind: taskKind,
      ui_color_token: color,
      ui_variant: variant,
    },
  }, `${path}.presentation_tuple`);
  const taskType = exact(
    oneOf(field(source, 'task_type', path), `${path}.task_type`, openTaskTypes, 'INVALID_LITERAL'),
    `${path}.task_type`, semantics.taskType, 'INVALID_LITERAL',
  );
  const displayLines = array(
    field(source, 'display_lines', path), `${path}.display_lines`,
    (item, itemPath) => text(item, itemPath),
  );
  if (displayLines.length === 0) {
    return fail('INVALID_ARRAY', `${path}.display_lines`, 'non-empty array', displayLines);
  }
  return Object.freeze({
    task_id: text(field(source, 'task_id', path), `${path}.task_id`),
    notification_id: text(field(source, 'notification_id', path), `${path}.notification_id`),
    created_at: text(field(source, 'created_at', path), `${path}.created_at`),
    task_kind: taskKind,
    entity_table: oneOf(field(source, 'entity_table', path), `${path}.entity_table`, openTaskSourceTables, 'INVALID_LITERAL'),
    entity_id: nullableStringValue(field(source, 'entity_id', path), `${path}.entity_id`),
    sort_group: nonNegativeSafeInteger(field(source, 'sort_group', path), `${path}.sort_group`),
    sort_started_at: text(field(source, 'sort_started_at', path), `${path}.sort_started_at`),
    ui_color_token: color,
    target_screen_id: target,
    target_context: targetContext,
    display_lines: displayLines,
    source_table: oneOf(field(source, 'source_table', path), `${path}.source_table`, openTaskSourceTables, 'INVALID_LITERAL'),
    source_id: nullableStringValue(field(source, 'source_id', path), `${path}.source_id`),
    task_type: taskType,
    title: text(field(source, 'title', path), `${path}.title`),
    description: nullableStringValue(field(source, 'description', path), `${path}.description`),
    ui_state: exact(field(source, 'ui_state', path), `${path}.ui_state`, 'open'),
    ui_variant: variant,
    available_actions: closedActions(
      field(source, 'available_actions', path), `${path}.available_actions`, ['OPEN_TASK_SOURCE'],
    ) as readonly ['OPEN_TASK_SOURCE'],
  });
}

export function decodeManagerOpenTasksResponse(value: unknown): ManagerOpenTasksResponse {
  const source = object(value, '$');
  exactObjectFields(source, '$', [
    'section', 'screen', 'title', 'tasks', 'open_tasks', 'open_tasks_count',
    'available_actions',
  ]);
  const tasks = array(field(source, 'tasks', '$'), '$.tasks', decodeManagerOpenTask);
  const openTasks = array(field(source, 'open_tasks', '$'), '$.open_tasks', decodeManagerOpenTask);
  const countValue = nonNegativeSafeInteger(
    field(source, 'open_tasks_count', '$'), '$.open_tasks_count',
  );
  if (countValue !== tasks.length || openTasks.length !== tasks.length) {
    return fail('INVALID_NUMBER', '$.open_tasks_count', 'tasks/open_tasks length', countValue);
  }
  const taskIds = new Set<string>();
  const notificationIds = new Set<string>();
  const orderedTasks = new Set<string>();
  tasks.forEach((task, index) => {
    if (taskIds.has(task.task_id)) {
      fail('INVALID_ID', `$.tasks[${index}].task_id`, 'unique task_id', task.task_id);
    }
    if (notificationIds.has(task.notification_id)) {
      fail('INVALID_ID', `$.tasks[${index}].notification_id`, 'unique notification_id', task.notification_id);
    }
    const serialized = JSON.stringify(task);
    if (orderedTasks.has(serialized)) {
      fail('INVALID_ARRAY', `$.tasks[${index}]`, 'unique ordered task', task);
    }
    taskIds.add(task.task_id);
    notificationIds.add(task.notification_id);
    orderedTasks.add(serialized);
    if (serialized !== JSON.stringify(openTasks[index])) {
      fail('INVALID_ARRAY', `$.open_tasks[${index}]`, 'ordered deep-equivalent task', openTasks[index]);
    }
  });
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-NOT01', 'INVALID_SCREEN'),
    title: exact(field(source, 'title', '$'), '$.title', 'Уведомления'),
    tasks,
    open_tasks: openTasks,
    open_tasks_count: countValue,
    available_actions: closedActions(
      field(source, 'available_actions', '$'), '$.available_actions', ['BACK'],
    ) as readonly ['BACK'],
  });
}

export function decodeManagerWorkplaceStateResponse(value: unknown): ManagerWorkplaceState {
  const source = object(value, '$');
  const manager = object(field(source, 'manager', '$'), '$.manager');
  const sections = object(field(source, 'sections', '$'), '$.sections');
  const machines = baseSection(field(sections, 'machines', '$.sections'), '$.sections.machines');
  const employees = baseSection(field(sections, 'employees', '$.sections'), '$.sections.employees');
  const downtimes = baseSection(field(sections, 'downtimes', '$.sections'), '$.sections.downtimes');
  const additionalWorks = baseSection(field(sections, 'additional_works', '$.sections'), '$.sections.additional_works');
  const corrections = baseSection(field(sections, 'corrections', '$.sections'), '$.sections.corrections');
  const notifications = baseSection(field(sections, 'notifications', '$.sections'), '$.sections.notifications');
  const reports = object(field(sections, 'reports', '$.sections'), '$.sections.reports');
  title(reports, '$.sections.reports');
  if (field(reports, 'is_placeholder', '$.sections.reports') !== true) {
    return fail('INVALID_LITERAL', '$.sections.reports.is_placeholder', 'true', field(reports, 'is_placeholder', '$.sections.reports'));
  }
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-N01', 'INVALID_SCREEN'),
    manager: Object.freeze({ employee_id: id(field(manager, 'employee_id', '$.manager'), '$.manager.employee_id'), full_name: text(field(manager, 'full_name', '$.manager'), '$.manager.full_name') }),
    sections: Object.freeze({
      machines: Object.freeze({ title: title(machines, '$.sections.machines'), running_count: count(field(machines, 'running_count', '$.sections.machines'), '$.sections.machines.running_count'), downtime_count: count(field(machines, 'downtime_count', '$.sections.machines'), '$.sections.machines.downtime_count'), idle_count: count(field(machines, 'idle_count', '$.sections.machines'), '$.sections.machines.idle_count'), downtime_severity: oneOf(field(machines, 'downtime_severity', '$.sections.machines'), '$.sections.machines.downtime_severity', severities, 'INVALID_SEVERITY'), ui_variant: exact(field(machines, 'ui_variant', '$.sections.machines'), '$.sections.machines.ui_variant', 'light_blue', 'INVALID_UI_VARIANT'), available_actions: actions(field(machines, 'available_actions', '$.sections.machines'), '$.sections.machines.available_actions') }),
      employees: Object.freeze({ title: title(employees, '$.sections.employees'), open_shift_count: count(field(employees, 'open_shift_count', '$.sections.employees'), '$.sections.employees.open_shift_count'), production_count: count(field(employees, 'production_count', '$.sections.employees'), '$.sections.employees.production_count'), downtime_count: count(field(employees, 'downtime_count', '$.sections.employees'), '$.sections.employees.downtime_count'), additional_work_count: count(field(employees, 'additional_work_count', '$.sections.employees'), '$.sections.employees.additional_work_count'), break_count: count(field(employees, 'break_count', '$.sections.employees'), '$.sections.employees.break_count'), without_work_count: count(field(employees, 'without_work_count', '$.sections.employees'), '$.sections.employees.without_work_count'), production_downtime_severity: oneOf(field(employees, 'production_downtime_severity', '$.sections.employees'), '$.sections.employees.production_downtime_severity', severities, 'INVALID_SEVERITY'), ui_variant: exact(field(employees, 'ui_variant', '$.sections.employees'), '$.sections.employees.ui_variant', 'light_blue', 'INVALID_UI_VARIANT'), available_actions: actions(field(employees, 'available_actions', '$.sections.employees'), '$.sections.employees.available_actions') }),
      downtimes: Object.freeze({ title: title(downtimes, '$.sections.downtimes'), critical_count: count(field(downtimes, 'critical_count', '$.sections.downtimes'), '$.sections.downtimes.critical_count'), operational_count: count(field(downtimes, 'operational_count', '$.sections.downtimes'), '$.sections.downtimes.operational_count'), ui_variant: exact(field(downtimes, 'ui_variant', '$.sections.downtimes'), '$.sections.downtimes.ui_variant', 'light_blue', 'INVALID_UI_VARIANT'), available_actions: actions(field(downtimes, 'available_actions', '$.sections.downtimes'), '$.sections.downtimes.available_actions') }),
      additional_works: Object.freeze({ title: title(additionalWorks, '$.sections.additional_works'), requested_count: count(field(additionalWorks, 'requested_count', '$.sections.additional_works'), '$.sections.additional_works.requested_count'), approved_count: count(field(additionalWorks, 'approved_count', '$.sections.additional_works'), '$.sections.additional_works.approved_count'), active_count: count(field(additionalWorks, 'active_count', '$.sections.additional_works'), '$.sections.additional_works.active_count'), requires_accrual_count: count(field(additionalWorks, 'requires_accrual_count', '$.sections.additional_works'), '$.sections.additional_works.requires_accrual_count'), ui_variant: exact(field(additionalWorks, 'ui_variant', '$.sections.additional_works'), '$.sections.additional_works.ui_variant', 'grey', 'INVALID_UI_VARIANT'), available_actions: actions(field(additionalWorks, 'available_actions', '$.sections.additional_works'), '$.sections.additional_works.available_actions') }),
      corrections: Object.freeze({ title: title(corrections, '$.sections.corrections'), ui_variant: exact(field(corrections, 'ui_variant', '$.sections.corrections'), '$.sections.corrections.ui_variant', 'light_blue', 'INVALID_UI_VARIANT'), available_actions: actions(field(corrections, 'available_actions', '$.sections.corrections'), '$.sections.corrections.available_actions') }),
      notifications: Object.freeze({ title: title(notifications, '$.sections.notifications'), open_tasks_count: count(field(notifications, 'open_tasks_count', '$.sections.notifications'), '$.sections.notifications.open_tasks_count'), ui_variant: exact(field(notifications, 'ui_variant', '$.sections.notifications'), '$.sections.notifications.ui_variant', 'light_blue', 'INVALID_UI_VARIANT'), available_actions: actions(field(notifications, 'available_actions', '$.sections.notifications'), '$.sections.notifications.available_actions') }),
      reports: Object.freeze({ title: title(reports, '$.sections.reports'), ui_variant: exact(field(reports, 'ui_variant', '$.sections.reports'), '$.sections.reports.ui_variant', 'light_blue', 'INVALID_UI_VARIANT'), is_placeholder: true, available_actions: closedActions(field(reports, 'available_actions', '$.sections.reports'), '$.sections.reports.available_actions', [], true) as readonly [] }),
    }),
  });
}

export function decodeManagerMachinesResponse(value: unknown): ManagerMachines {
  const source = object(value, '$');
  return Object.freeze({ section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'), screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-M01', 'INVALID_SCREEN'), title: text(field(source, 'title', '$'), '$.title'), machines: array(field(source, 'machines', '$'), '$.machines', decodeMachine), available_actions: actions(field(source, 'available_actions', '$'), '$.available_actions') });
}

export function decodeManagerMachineCardResponse(value: unknown): ManagerMachineCard {
  const source = object(value, '$');
  return Object.freeze({ section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'), screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-M02', 'INVALID_SCREEN'), machine: decodeMachine(field(source, 'machine', '$'), '$.machine'), available_actions: actions(field(source, 'available_actions', '$'), '$.available_actions') });
}

export function decodeManagerEmployeesResponse(value: unknown): ManagerEmployees {
  const source = object(value, '$');
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-E01', 'INVALID_SCREEN'),
    title: exact(field(source, 'title', '$'), '$.title', 'Сотрудники'),
    employees: array(
      field(source, 'employees', '$'),
      '$.employees',
      (item, path) => decodeEmployee(item, path, false) as ManagerEmployee,
    ),
    available_actions: closedActions(
      field(source, 'available_actions', '$'),
      '$.available_actions',
      ['BACK'],
    ),
  });
}

export function decodeManagerAdditionalWorkTypesAvailableResponse(
  value: unknown,
): ManagerAdditionalWorkTypesAvailableResponse {
  const source = object(value, '$');
  exactObjectFields(source, '$', [
    'section', 'screen', 'assignability_employee_id',
    'assignability_additional_work_type_id', 'additional_work_types',
    'available_actions',
  ]);
  const identities = new Set<string>();
  const displayOrders = new Set<number>();
  const additionalWorkTypes = array(
    field(source, 'additional_work_types', '$'),
    '$.additional_work_types',
    (item, path) => {
      const candidate = object(item, path);
      exactObjectFields(candidate, path, [
        'additional_work_type_id', 'additional_work_name', 'is_active',
        'display_order', 'can_assign', 'blocked_code', 'blocked_message',
      ]);
      const typeId = id(
        field(candidate, 'additional_work_type_id', path),
        `${path}.additional_work_type_id`,
      );
      if (identities.has(typeId)) {
        return fail('INVALID_ID', `${path}.additional_work_type_id`, 'unique additional_work_type_id', typeId);
      }
      identities.add(typeId);
      const displayOrder = nonNegativeSafeInteger(
        field(candidate, 'display_order', path),
        `${path}.display_order`,
      );
      if (displayOrders.has(displayOrder)) {
        return fail('INVALID_NUMBER', `${path}.display_order`, 'unique display_order', displayOrder);
      }
      displayOrders.add(displayOrder);
      const isActive = boolean(field(candidate, 'is_active', path), `${path}.is_active`);
      const canAssign = boolean(field(candidate, 'can_assign', path), `${path}.can_assign`);
      const blockedCode = nullableOneOf(
        field(candidate, 'blocked_code', path),
        `${path}.blocked_code`,
        ADDITIONAL_WORK_ASSIGNMENT_BLOCKED_CODES_,
        'INVALID_LITERAL',
      );
      const blockedMessage = nullableText(
        field(candidate, 'blocked_message', path),
        `${path}.blocked_message`,
      );
      if (canAssign && (!isActive || blockedCode !== null || blockedMessage !== null)) {
        return fail('INVALID_BOOLEAN', `${path}.can_assign`, 'true only for active unblocked type', candidate);
      }
      if (!canAssign && (blockedCode === null || blockedMessage === null)) {
        return fail('INVALID_BOOLEAN', `${path}.can_assign`, 'false with blocked_code and blocked_message', candidate);
      }
      return Object.freeze({
        additional_work_type_id: typeId,
        additional_work_name: text(
          field(candidate, 'additional_work_name', path),
          `${path}.additional_work_name`,
        ),
        is_active: isActive,
        display_order: displayOrder,
        can_assign: canAssign,
        blocked_code: blockedCode,
        blocked_message: blockedMessage,
      });
    },
  );
  const availableActions = closedActions(
    field(source, 'available_actions', '$'),
    '$.available_actions',
    ['ASSIGN_ADDITIONAL_WORK', 'BACK'],
  );
  if (
    availableActions[availableActions.length - 1] !== 'BACK' ||
    availableActions.includes('ASSIGN_ADDITIONAL_WORK') !== additionalWorkTypes.some((item) => item.can_assign)
  ) {
    return fail(
      'INVALID_AVAILABLE_ACTIONS',
      '$.available_actions',
      'ASSIGN_ADDITIONAL_WORK iff at least one pair is assignable, followed by BACK',
      availableActions,
    );
  }
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-AW41', 'INVALID_SCREEN'),
    assignability_employee_id: id(
      field(source, 'assignability_employee_id', '$'),
      '$.assignability_employee_id',
    ),
    assignability_additional_work_type_id: nullableId(
      field(source, 'assignability_additional_work_type_id', '$'),
      '$.assignability_additional_work_type_id',
    ),
    additional_work_types: additionalWorkTypes,
    available_actions: availableActions as ManagerAdditionalWorkTypesAvailableResponse['available_actions'],
  });
}

export function decodeManagerSalaryCorrectionContextResponse(
  value: unknown,
): ManagerSalaryCorrectionContextResponse {
  const source = object(value, '$');
  exactObjectFields(source, '$', [
    'section',
    'screen',
    'employees_with_today_shift',
    'default_accrual_salary_correction_type_id',
    'default_withholding_salary_correction_type_id',
    'available_actions',
  ]);
  const employeeIds = new Set<string>();
  const shiftIds = new Set<string>();
  const employees = array(
    field(source, 'employees_with_today_shift', '$'),
    '$.employees_with_today_shift',
    (item, path) => {
      const employee = object(item, path);
      exactObjectFields(employee, path, [
        'employee_id',
        'employee_full_name',
        'employee_shift_id',
        'shift_started_at',
        'shift_finished_at',
      ]);
      const employeeId = id(field(employee, 'employee_id', path), `${path}.employee_id`);
      if (employeeIds.has(employeeId)) {
        return fail('INVALID_ID', `${path}.employee_id`, 'unique employee_id', employeeId);
      }
      employeeIds.add(employeeId);
      const shiftId = id(field(employee, 'employee_shift_id', path), `${path}.employee_shift_id`);
      if (shiftIds.has(shiftId)) {
        return fail('INVALID_ID', `${path}.employee_shift_id`, 'unique employee_shift_id', shiftId);
      }
      shiftIds.add(shiftId);
      return Object.freeze({
        employee_id: employeeId,
        employee_full_name: text(field(employee, 'employee_full_name', path), `${path}.employee_full_name`),
        employee_shift_id: shiftId,
        shift_started_at: text(field(employee, 'shift_started_at', path), `${path}.shift_started_at`),
        shift_finished_at: nullableText(field(employee, 'shift_finished_at', path), `${path}.shift_finished_at`),
      });
    },
  );
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-CF10', 'INVALID_SCREEN'),
    employees_with_today_shift: employees,
    default_accrual_salary_correction_type_id: id(
      field(source, 'default_accrual_salary_correction_type_id', '$'),
      '$.default_accrual_salary_correction_type_id',
    ),
    default_withholding_salary_correction_type_id: id(
      field(source, 'default_withholding_salary_correction_type_id', '$'),
      '$.default_withholding_salary_correction_type_id',
    ),
    available_actions: backOnly(field(source, 'available_actions', '$'), '$.available_actions'),
  });
}

export function decodeManagerEmployeeCardResponse(
  value: unknown,
): ManagerEmployeeCard {
  const source = object(value, '$');
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-E02', 'INVALID_SCREEN'),
    employee: decodeEmployee(
      field(source, 'employee', '$'),
      '$.employee',
      true,
    ) as ManagerEmployeeCard['employee'],
    available_actions: closedActions(
      field(source, 'available_actions', '$'),
      '$.available_actions',
      ['BACK'],
    ),
  });
}

export function decodeManagerCompletedWorksResponse(
  value: unknown,
): ManagerCompletedWorksResponse {
  const source = object(value, '$');
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: oneOf(field(source, 'screen', '$'), '$.screen', ['S03-E21', 'S03-CF22', 'S03-CP12'], 'INVALID_SCREEN'),
    employee: completedWorkEmployee(field(source, 'employee', '$'), '$.employee'),
    works: array(field(source, 'works', '$'), '$.works', decodeCompletedWorkItem),
    available_actions: backOnly(field(source, 'available_actions', '$'), '$.available_actions'),
  });
}

const completedWorkItemFields = Object.freeze([
  'work_item_id', 'work_type', 'operation_id', 'employee_id', 'employee_full_name',
  'completed_date', 'production_operation_id', 'additional_work_id', 'machine_id',
  'machine_name', 'sku_name', 'sku_code', 'quantity', 'additional_work_name',
  'salary_entry_id', 'salary_amount_uzs', 'amount_uzs', 'old_quantity',
  'correction_base_quantity', 'current_quantity', 'can_correct', 'can_storno',
  'is_reversed', 'reversal_id',
] as const);

function decodeEmployeeCompletedProductionOperations(
  value: unknown,
): ManagerEmployeeCompletedProductionOperationsResponse {
  const source = object(value, '$');
  exactObjectFields(source, '$', ['section', 'screen', 'employee', 'works', 'available_actions']);
  const employee = object(field(source, 'employee', '$'), '$.employee');
  exactObjectFields(employee, '$.employee', ['employee_id', 'full_name']);
  const decoded = decodeManagerCompletedWorksResponse(value);
  if (decoded.screen !== 'S03-CP12') {
    return fail('INVALID_SCREEN', '$.screen', 'S03-CP12', decoded.screen);
  }
  const operationIds = new Set<string>();
  const productionOperationIds = new Set<string>();
  decoded.works.forEach((work, index) => {
    const path = `$.works[${index}]`;
    exactObjectFields(object((field(source, 'works', '$') as readonly unknown[])[index], path), path, completedWorkItemFields);
    if (work.work_type !== 'production') return fail('INVALID_LITERAL', `${path}.work_type`, 'production', work.work_type);
    if (work.production_operation_id === null) return fail('INVALID_ID', `${path}.production_operation_id`, 'non-null ID', null);
    canonicalNonNegativeDecimal(work.quantity, `${path}.quantity`);
    canonicalNonNegativeDecimal(work.current_quantity, `${path}.current_quantity`);
    canonicalNonNegativeDecimal(work.correction_base_quantity, `${path}.correction_base_quantity`);
    if (operationIds.has(work.operation_id)) return fail('INVALID_ID', `${path}.operation_id`, 'unique operation_id', work.operation_id);
    if (productionOperationIds.has(work.production_operation_id)) {
      return fail('INVALID_ID', `${path}.production_operation_id`, 'unique production_operation_id', work.production_operation_id);
    }
    operationIds.add(work.operation_id);
    productionOperationIds.add(work.production_operation_id);
  });
  return Object.freeze({
    section: decoded.section,
    screen: 'S03-CP12',
    employee: decoded.employee,
    works: decoded.works,
    available_actions: decoded.available_actions,
  });
}

export function decodeManagerMachineCompletedProductionOperationsResponse(
  value: unknown,
): ManagerMachineCompletedProductionOperationsResponse {
  const source = object(value, '$');
  exactObjectFields(source, '$', ['section', 'screen', 'machine', 'operations', 'available_actions']);
  const machine = object(field(source, 'machine', '$'), '$.machine');
  exactObjectFields(machine, '$.machine', ['machine_id', 'machine_name']);
  const responseMachine = Object.freeze({
    machine_id: id(field(machine, 'machine_id', '$.machine'), '$.machine.machine_id'),
    machine_name: text(field(machine, 'machine_name', '$.machine'), '$.machine.machine_name'),
  });
  const operationIds = new Set<string>();
  const productionOperationIds = new Set<string>();
  const operations = array(field(source, 'operations', '$'), '$.operations', (item, path) => {
    const operation = object(item, path);
    exactObjectFields(operation, path, completedWorkItemFields);
    const work = decodeCompletedWorkItem(item, path);
    if (work.work_type !== 'production') {
      return fail('INVALID_LITERAL', `${path}.work_type`, 'production', work.work_type);
    }
    if (work.production_operation_id === null) {
      return fail('INVALID_ID', `${path}.production_operation_id`, 'non-null ID', null);
    }
    if (work.machine_id === null) {
      return fail('INVALID_ID', `${path}.machine_id`, 'non-null ID', null);
    }
    if (work.machine_name === null || work.machine_name.trim().length === 0) {
      return fail('INVALID_STRING', `${path}.machine_name`, 'non-empty string', work.machine_name);
    }
    const quantity = canonicalNonNegativeDecimal(work.quantity, `${path}.quantity`);
    const currentQuantity = canonicalNonNegativeDecimal(work.current_quantity, `${path}.current_quantity`);
    const correctionBaseQuantity = canonicalNonNegativeDecimal(
      work.correction_base_quantity,
      `${path}.correction_base_quantity`,
    );
    if (operationIds.has(work.operation_id)) {
      return fail('INVALID_ID', `${path}.operation_id`, 'unique operation_id', work.operation_id);
    }
    if (productionOperationIds.has(work.production_operation_id)) {
      return fail(
        'INVALID_ID',
        `${path}.production_operation_id`,
        'unique production_operation_id',
        work.production_operation_id,
      );
    }
    operationIds.add(work.operation_id);
    productionOperationIds.add(work.production_operation_id);
    return Object.freeze({
      ...work,
      work_type: 'production' as const,
      production_operation_id: work.production_operation_id,
      machine_id: work.machine_id,
      machine_name: work.machine_name,
      quantity,
      current_quantity: currentQuantity,
      correction_base_quantity: correctionBaseQuantity,
    }) satisfies ManagerMachineCompletedProductionOperation;
  });
  if (operations.some((operation) => operation.machine_id !== responseMachine.machine_id)) {
    return fail('OPERATION_ID_MISMATCH', '$.operations[].machine_id', responseMachine.machine_id, operations);
  }
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-CP12', 'INVALID_SCREEN'),
    machine: responseMachine,
    operations,
    available_actions: backOnly(field(source, 'available_actions', '$'), '$.available_actions'),
  });
}

export function decodeManagerProductionCompletedOperationsResponse(
  value: unknown,
): ManagerProductionCompletedOperationsResponse {
  const source = object(value, '$');
  const employeeShape = Object.hasOwn(source, 'employee') || Object.hasOwn(source, 'works');
  const machineShape = Object.hasOwn(source, 'machine') || Object.hasOwn(source, 'operations');
  if (employeeShape === machineShape) {
    return fail('INVALID_OBJECT', '$', 'exactly one employee or machine completed-production shape', value);
  }
  return employeeShape
    ? decodeEmployeeCompletedProductionOperations(value)
    : decodeManagerMachineCompletedProductionOperationsResponse(value);
}

export function decodeManagerCompletedWorkCardResponse(
  value: unknown,
): ManagerCompletedWorkCardResponse {
  const source = object(value, '$');
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: oneOf(field(source, 'screen', '$'), '$.screen', ['S03-E22', 'S03-CF23'], 'INVALID_SCREEN'),
    employee: completedWorkEmployee(field(source, 'employee', '$'), '$.employee'),
    work: decodeCompletedWorkItem(field(source, 'work', '$'), '$.work'),
    available_actions: backOnly(field(source, 'available_actions', '$'), '$.available_actions'),
  });
}

export function decodeManagerEmployeeSalaryResponse(
  value: unknown,
): ManagerEmployeeSalaryResponse {
  const source = object(value, '$');
  const totals = object(field(source, 'totals', '$'), '$.totals');
  const breakdownValue = source.breakdown;
  const breakdown = breakdownValue === undefined
    ? undefined
    : (() => {
        const item = object(breakdownValue, '$.breakdown');
        return Object.freeze({
          production_uzs: salaryValue(field(item, 'production_uzs', '$.breakdown'), '$.breakdown.production_uzs'),
          additional_work_uzs: salaryValue(field(item, 'additional_work_uzs', '$.breakdown'), '$.breakdown.additional_work_uzs'),
          corrections_uzs: nullableSalaryValue(field(item, 'corrections_uzs', '$.breakdown'), '$.breakdown.corrections_uzs'),
          reversals_uzs: nullableSalaryValue(field(item, 'reversals_uzs', '$.breakdown'), '$.breakdown.reversals_uzs'),
        });
      })();
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-SAL01', 'INVALID_SCREEN'),
    employee: completedWorkEmployee(field(source, 'employee', '$'), '$.employee'),
    employee_id: id(field(source, 'employee_id', '$'), '$.employee_id'),
    totals: Object.freeze({
      today_uzs: salaryValue(field(totals, 'today_uzs', '$.totals'), '$.totals.today_uzs'),
      week_uzs: salaryValue(field(totals, 'week_uzs', '$.totals'), '$.totals.week_uzs'),
      month_uzs: salaryValue(field(totals, 'month_uzs', '$.totals'), '$.totals.month_uzs'),
    }),
    ...(breakdown === undefined ? {} : { breakdown }),
  });
}

export function decodeManagerEmployeeSalaryHistoryResponse(
  value: unknown,
): ManagerEmployeeSalaryHistoryResponse {
  const source = object(value, '$');
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-SAL02', 'INVALID_SCREEN'),
    employee: completedWorkEmployee(field(source, 'employee', '$'), '$.employee'),
    employee_id: id(field(source, 'employee_id', '$'), '$.employee_id'),
    months: array(field(source, 'months', '$'), '$.months', decodeSalaryHistoryMonth),
  });
}

export function decodeManagerAdditionalWorksResponse(
  value: unknown,
): ManagerAdditionalWorksResponse {
  const source = object(value, '$');
  const groups = object(field(source, 'groups', '$'), '$.groups');
  const identities = new Set<string>();
  const decodeGroup = (status: ManagerAdditionalWorkStatus) => array(
    field(groups, status, '$.groups'),
    `$.groups.${status}`,
    (item, path) => decodeAdditionalWorkItem(item, path, status, identities),
  );
  const topActions = closedActions(
    field(source, 'available_actions', '$'),
    '$.available_actions',
    ['ASSIGN_ADDITIONAL_WORK', 'BACK'],
  );
  if (topActions.length !== 2 || topActions[0] !== 'ASSIGN_ADDITIONAL_WORK' || topActions[1] !== 'BACK') {
    return fail('INVALID_AVAILABLE_ACTIONS', '$.available_actions', 'exactly [ASSIGN_ADDITIONAL_WORK, BACK]', topActions);
  }
  return Object.freeze({
    section: exact(field(source, 'section', '$'), '$.section', 'S03', 'INVALID_SECTION'),
    screen: exact(field(source, 'screen', '$'), '$.screen', 'S03-AW01', 'INVALID_SCREEN'),
    title: exact(field(source, 'title', '$'), '$.title', 'Доп. работы'),
    groups: Object.freeze({
      requested: decodeGroup('requested'),
      approved: decodeGroup('approved'),
      active: decodeGroup('active'),
      waiting_accrual: decodeGroup('waiting_accrual'),
    }),
    available_actions: topActions as readonly ['ASSIGN_ADDITIONAL_WORK', 'BACK'],
  });
}

export function decodeOperationIdResponse(value: unknown, expectedDowntimeId: string): OperationIdResponse {
  const source = object(value, '$');
  const operationId = id(field(source, 'id', '$'), '$.id');
  if (operationId !== expectedDowntimeId) {
    return fail('OPERATION_ID_MISMATCH', '$.id', expectedDowntimeId, operationId);
  }
  return Object.freeze({ id: operationId });
}

export function decodeSection03ExportRunResponse(value: unknown): Section03ExportRunResponse {
  const source = object(value, '$');
  exactObjectFields(source, '$', ['export_run_id']);
  const exportRunId = field(source, 'export_run_id', '$');
  if (typeof exportRunId !== 'string' || !/^[1-9][0-9]*$/.test(exportRunId)) {
    return fail('INVALID_ID', '$.export_run_id', 'positive integer string', exportRunId);
  }
  return Object.freeze({ export_run_id: exportRunId });
}
