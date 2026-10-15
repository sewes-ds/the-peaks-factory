import { mutationPaths, operatorReadModelPaths } from '../../foundation/apiClient';
import type { ReadModelKey } from '../../foundation/refetchPolicy';
import type { S02ActionId } from '../../section02/section02GraphActions';

export type S02ActionBindingKind = 'mutation' | 'readModel' | 'localTransition' | 'notImplementedYet';

export type S02ActionBinding = {
  actionId: S02ActionId;
  kind: S02ActionBindingKind;
  method?: 'GET' | 'POST';
  endpoint?: string;
  bodyContract?: string;
  refetch?: ReadModelKey[];
  successTransition?: string;
};

export const S02_ACTION_BINDINGS: Record<S02ActionId, S02ActionBinding> = {
  start_shift: {
    actionId: 'start_shift',
    kind: 'mutation',
    method: 'POST',
    endpoint: mutationPaths.startShift,
    bodyContract: '{}',
    refetch: ['operator_workplace_state'],
    successTransition: 'operator_workplace'
  },
  start_production: {
    actionId: 'start_production',
    kind: 'localTransition',
    successTransition: 'start_production.machine_entry'
  },
  finish_production: {
    actionId: 'finish_production',
    kind: 'mutation',
    method: 'POST',
    endpoint: '/production-operations/:production_operation_id/finish',
    bodyContract: '{ quantity_produced }',
    refetch: ['operator_workplace_state'],
    successTransition: 'operator_workplace'
  },
  scan_machine_qr: {
    actionId: 'scan_machine_qr',
    kind: 'localTransition',
    method: 'POST',
    endpoint: operatorReadModelPaths.machineQr,
    bodyContract: '{ qr_payload }',
    successTransition: 'start_production.sku_list'
  },
  select_machine_from_list: {
    actionId: 'select_machine_from_list',
    kind: 'readModel',
    method: 'GET',
    endpoint: operatorReadModelPaths.machines,
    successTransition: 'start_production.machine_list'
  },
  select_machine: {
    actionId: 'select_machine',
    kind: 'localTransition',
    successTransition: 'start_production.sku_entry'
  },
  scan_sku_qr: {
    actionId: 'scan_sku_qr',
    kind: 'localTransition',
    method: 'POST',
    endpoint: operatorReadModelPaths.skuQr,
    bodyContract: '{ qr_payload }',
    successTransition: 'start_production.sku_qr_result'
  },
  select_sku_from_list: {
    actionId: 'select_sku_from_list',
    kind: 'readModel',
    method: 'GET',
    endpoint: operatorReadModelPaths.skus,
    successTransition: 'start_production.sku_list'
  },
  select_sku: {
    actionId: 'select_sku',
    kind: 'mutation',
    method: 'POST',
    endpoint: mutationPaths.startProduction,
    bodyContract: '{ machine_id, sku_id }',
    refetch: ['operator_workplace_state'],
    successTransition: 'operator_workplace'
  },
  start_break: {
    actionId: 'start_break',
    kind: 'mutation',
    method: 'POST',
    endpoint: mutationPaths.startBreak,
    bodyContract: '{ break_type_id }',
    refetch: ['operator_workplace_state'],
    successTransition: 'operator_workplace'
  },
  finish_break: {
    actionId: 'finish_break',
    kind: 'mutation',
    method: 'POST',
    endpoint: mutationPaths.finishBreak,
    bodyContract: '{}',
    refetch: ['operator_workplace_state'],
    successTransition: 'operator_workplace'
  },
  start_downtime: {
    actionId: 'start_downtime',
    kind: 'mutation',
    method: 'POST',
    endpoint: mutationPaths.startDowntime,
    bodyContract: '{ machine_id, production_operation_id, downtime_type_id, comment }',
    refetch: ['operator_workplace_state'],
    successTransition: 'operational: operator_workplace; critical: S02-N28'
  },
  finish_downtime_operational: {
    actionId: 'finish_downtime_operational',
    kind: 'mutation',
    method: 'POST',
    endpoint: '/machine-downtimes/:downtime_id/finish',
    bodyContract: '{}',
    refetch: ['operator_workplace_state'],
    successTransition: 'operator_workplace'
  },
  finish_downtime_critical: {
    actionId: 'finish_downtime_critical',
    kind: 'mutation',
    method: 'POST',
    endpoint: '/machine-downtimes/:downtime_id/finish',
    bodyContract: '{}',
    refetch: ['operator_workplace_state'],
    successTransition: 'operator_workplace'
  },
  additional_work: {
    actionId: 'additional_work',
    kind: 'readModel',
    method: 'GET',
    endpoint: operatorReadModelPaths.additionalWorkState,
    refetch: ['operator_additional_work_state', 'operator_workplace_state'],
    successTransition: 'S02-N11'
  },
  select_additional_work_type: {
    actionId: 'select_additional_work_type',
    kind: 'localTransition',
    successTransition: 'S02-AW02'
  },
  request_additional_work: {
    actionId: 'request_additional_work',
    kind: 'mutation',
    method: 'POST',
    endpoint: mutationPaths.requestAdditionalWork,
    bodyContract: '{ additional_work_type_id }',
    refetch: ['operator_additional_work_state', 'operator_workplace_state'],
    successTransition: 'S02-N11'
  },
  start_additional_work: {
    actionId: 'start_additional_work',
    kind: 'mutation',
    method: 'POST',
    endpoint: '/additional-works/:additional_work_id/start',
    bodyContract: '{}',
    refetch: ['operator_additional_work_state', 'operator_workplace_state'],
    successTransition: 'S02-N11'
  },
  finish_additional_work: {
    actionId: 'finish_additional_work',
    kind: 'mutation',
    method: 'POST',
    endpoint: '/additional-works/:additional_work_id/finish',
    bodyContract: '{}',
    refetch: ['operator_additional_work_state', 'operator_workplace_state'],
    successTransition: 'S02-AW05; refetch on ordinary Back'
  },
  finish_shift: {
    actionId: 'finish_shift',
    kind: 'mutation',
    method: 'POST',
    endpoint: mutationPaths.finishShift,
    bodyContract: '{}',
    refetch: ['operator_workplace_state'],
    successTransition: 'shift_not_started'
  },
  salary: {
    actionId: 'salary',
    kind: 'readModel',
    method: 'GET',
    endpoint: operatorReadModelPaths.salary,
    successTransition: 'salary.summary'
  },
  back: {
    actionId: 'back',
    kind: 'localTransition'
  }
};
