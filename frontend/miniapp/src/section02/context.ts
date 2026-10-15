import { defineGraphContext, graphContext, type InferGraphContext } from '../foundation/graphProtocol/context';
export const SECTION02_CONTEXT_KEYS = Object.freeze([
  'machine_selection_mode',
  'machine_id',
  'machine_name',
  'sku_id',
  'sku_code',
  'sku_name',
  'production_operation_id',
  'break_type_id',
  'break_type_name',
  'downtime_id',
  'downtime_type_id',
  'downtime_type_name',
  'downtime_class',
  'production_requirement',
  'comment',
  'additional_work_id',
  'additional_work_type_id',
  'additional_work_name',
  'quantity_produced',
] as const);

export function createSection02ContextSchema() {
  return defineGraphContext({
    machine_selection_mode: graphContext.optionalMode('production', 'critical_downtime'),
    machine_id: graphContext.optionalId(),
    machine_name: graphContext.optionalTextInput(),
    sku_id: graphContext.optionalId(),
    sku_code: graphContext.optionalTextInput(),
    sku_name: graphContext.optionalTextInput(),
    production_operation_id: graphContext.optionalId(),
    break_type_id: graphContext.optionalId(),
    break_type_name: graphContext.optionalTextInput(),
    downtime_id: graphContext.optionalId(),
    downtime_type_id: graphContext.optionalId(),
    downtime_type_name: graphContext.optionalTextInput(),
    downtime_class: graphContext.optionalMode('OPERATIONAL', 'CRITICAL'),
    production_requirement: graphContext.optionalMode('required', 'not_required'),
    comment: graphContext.optionalTextInput(),
    additional_work_id: graphContext.optionalId(),
    additional_work_type_id: graphContext.optionalId(),
    additional_work_name: graphContext.optionalTextInput(),
    quantity_produced: graphContext.optionalTextInput(),
  });
}

export type Section02Context = InferGraphContext<ReturnType<typeof createSection02ContextSchema>>;

export function isSection02ContextScalarOnly(context: Section02Context): boolean {
  return Object.values(context).every((value) => value === undefined || value === null || ['string', 'number', 'boolean'].includes(typeof value));
}
