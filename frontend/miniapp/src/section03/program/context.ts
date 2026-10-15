import { GraphContextValidationError, defineGraphContext, graphContext } from '../../foundation/graphProtocol/context';
import type { Section03NodeId } from './ids';

export const SECTION03_CONTEXT_KEYS = Object.freeze([
  'correction_scope', 'downtime_follow_up',
  'employee_id', 'machine_id', 'downtime_id', 'production_operation_id',
  'employee_full_name', 'downtime_type_id', 'downtime_type_name', 'additional_work_id', 'additional_work_type_id',
  'additional_work_type_name',
  'work_type', 'operation_id', 'salary_entry_id', 'employee_shift_id',
  'salary_correction_type_id', 'correction_mode', 'production_correction_mode',
  'period', 'from_date', 'to_date', 'comment_finish', 'comment_start',
  'quantity_produced', 'shift_finish_reason', 'amount_uzs',
  'without_accrual_reason', 'financial_correction_reason', 'reversal_reason',
  'correction_quantity', 'production_correction_reason', 'export_run_id', 'refresh_nonce',
] as const);

export type Section03ContextKey = typeof SECTION03_CONTEXT_KEYS[number];
export type Section03Period = 'today' | 'week' | 'month' | 'last_30_days';
export type Section03WorkType = 'production' | 'additional_work';
export type Section03CorrectionMode = 'accrual' | 'withholding';
export type Section03ProductionCorrectionMode = 'increase' | 'decrease' | 'final';
export type Section03CorrectionScope = 'employee' | 'machine';
export type Section03DowntimeFollowUp = 'start_critical_downtime';

export type Section03Context = Readonly<{
  correction_scope?: Section03CorrectionScope;
  downtime_follow_up?: Section03DowntimeFollowUp;
  employee_id?: string;
  employee_full_name?: string;
  machine_id?: string;
  downtime_id?: string;
  production_operation_id?: string;
  downtime_type_id?: string;
  downtime_type_name?: string;
  additional_work_id?: string;
  additional_work_type_id?: string;
  additional_work_type_name?: string;
  work_type?: Section03WorkType;
  operation_id?: string;
  salary_entry_id?: string;
  employee_shift_id?: string;
  salary_correction_type_id?: string;
  correction_mode?: Section03CorrectionMode;
  production_correction_mode?: Section03ProductionCorrectionMode;
  period?: Section03Period;
  from_date?: string;
  to_date?: string;
  comment_finish?: string;
  comment_start?: string;
  quantity_produced?: string;
  shift_finish_reason?: string;
  amount_uzs?: string;
  without_accrual_reason?: string;
  financial_correction_reason?: string;
  reversal_reason?: string;
  correction_quantity?: string;
  production_correction_reason?: string;
  export_run_id?: string;
  refresh_nonce?: number;
}>;

const contextKeys = new Set<string>(SECTION03_CONTEXT_KEYS);
const periods = new Set<string>(['today', 'week', 'month', 'last_30_days']);
const workTypes = new Set<string>(['production', 'additional_work']);
const correctionModes = new Set<string>(['accrual', 'withholding']);
const productionCorrectionModes = new Set<string>(['increase', 'decrease', 'final']);
const correctionScopes = new Set<string>(['employee', 'machine']);
const downtimeFollowUps = new Set<string>(['start_critical_downtime']);

function decodeRefreshNonce(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new GraphContextValidationError('Expected a non-negative safe integer.');
  }
  return value;
}

export function createSection03GraphContextSchema() {
  return defineGraphContext({
    correction_scope: graphContext.optionalMode('employee', 'machine'),
    downtime_follow_up: graphContext.optionalMode('start_critical_downtime'),
    employee_id: graphContext.optionalId(), employee_full_name: graphContext.optionalTextInput(), machine_id: graphContext.optionalId(), downtime_id: graphContext.optionalId(),
    production_operation_id: graphContext.optionalId(), downtime_type_id: graphContext.optionalId(), downtime_type_name: graphContext.optionalTextInput(), additional_work_id: graphContext.optionalId(),
    additional_work_type_id: graphContext.optionalId(), additional_work_type_name: graphContext.optionalTextInput(), operation_id: graphContext.optionalId(), salary_entry_id: graphContext.optionalId(),
    employee_shift_id: graphContext.optionalId(), salary_correction_type_id: graphContext.optionalId(),
    work_type: graphContext.optionalMode('production', 'additional_work'),
    correction_mode: graphContext.optionalMode('accrual', 'withholding'),
    production_correction_mode: graphContext.optionalMode('increase', 'decrease', 'final'),
    period: graphContext.optionalPeriod('today', 'week', 'month', 'last_30_days'),
    from_date: graphContext.optionalTextInput(), to_date: graphContext.optionalTextInput(),
    comment_finish: graphContext.optionalTextInput(), comment_start: graphContext.optionalTextInput(),
    quantity_produced: graphContext.optionalTextInput(), shift_finish_reason: graphContext.optionalTextInput(), amount_uzs: graphContext.optionalTextInput(),
    without_accrual_reason: graphContext.optionalTextInput(), financial_correction_reason: graphContext.optionalTextInput(),
    reversal_reason: graphContext.optionalTextInput(), correction_quantity: graphContext.optionalTextInput(),
    production_correction_reason: graphContext.optionalTextInput(), export_run_id: graphContext.optionalId(),
    refresh_nonce: graphContext.optionalScalarInput(decodeRefreshNonce),
  });
}

export class Section03ContextError extends Error {
  readonly field: string;

  constructor(field: string, reason: string) {
    super(`Invalid Section 03 context field ${field}: ${reason}.`);
    this.name = 'Section03ContextError';
    this.field = field;
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function decodeSection03Context(value: unknown): Section03Context {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Section03ContextError('$', 'expected a plain scalar object');
  }
  const source = value as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(source)) {
    if (!contextKeys.has(key)) throw new Section03ContextError(key, 'unknown field');
  }
  const output: Record<string, string | number> = {};
  for (const [key, item] of Object.entries(source)) {
    if (item === undefined) continue;
    if (key === 'refresh_nonce') {
      if (typeof item !== 'number' || !Number.isSafeInteger(item) || item < 0) {
        throw new Section03ContextError(key, 'expected a non-negative safe integer');
      }
      output[key] = item;
      continue;
    }
    if (!nonEmpty(item)) throw new Section03ContextError(key, 'expected a non-empty scalar string');
    const normalized = item.trim();
    if (key === 'correction_scope' && !correctionScopes.has(normalized)) throw new Section03ContextError(key, 'expected a closed correction scope');
    if (key === 'downtime_follow_up' && !downtimeFollowUps.has(normalized)) throw new Section03ContextError(key, 'expected a closed downtime follow-up');
    if (key === 'period' && !periods.has(normalized)) throw new Section03ContextError(key, 'expected a closed period');
    if (key === 'work_type' && !workTypes.has(normalized)) throw new Section03ContextError(key, 'expected a closed work type');
    if (key === 'correction_mode' && !correctionModes.has(normalized)) throw new Section03ContextError(key, 'expected a closed correction mode');
    if (key === 'production_correction_mode' && !productionCorrectionModes.has(normalized)) {
      throw new Section03ContextError(key, 'expected a closed production correction mode');
    }
    output[key] = normalized;
  }
  return Object.freeze(output) as Section03Context;
}

export function requireSection03Context(
  nodeId: Section03NodeId,
  context: Section03Context,
  fields: readonly Section03ContextKey[],
): void {
  for (const field of fields) {
    if (context[field] === undefined) {
      throw new Section03ContextError(field, `required by ${nodeId}`);
    }
  }
  if (nodeId === 'S03-CP11' || nodeId === 'S03-CP12' || nodeId === 'S03-CP13' || nodeId === 'S03-CP14' || nodeId === 'S03-CP15' || nodeId === 'S03-CP16') {
    const employeeScope = context.correction_scope === 'employee' && context.employee_id !== undefined && context.machine_id === undefined;
    const machineScope = context.correction_scope === 'machine' && context.machine_id !== undefined && context.employee_id === undefined;
    if (!employeeScope && !machineScope) {
      throw new Section03ContextError('correction_scope|employee_id|machine_id', 'expected one explicit matching correction scope');
    }
  }
}

export function isSection03ContextScalarOnly(context: Section03Context): boolean {
  return Object.values(context).every((value) => value === undefined || typeof value === 'string' || typeof value === 'number');
}
