import type { ApiClient } from '../foundation/apiClient';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
} from '../foundation/graphProtocol/command';
import { mutationPaths } from '../foundation/apiClient';
import {
  decodeOperationMutationResult,
  decodeProductionMutationResult,
  decodeShiftMutationResult,
} from './contracts';
import { createSection02ContextSchema, type Section02Context } from './context';

export const SECTION02_BUSINESS_ACTION_IDS = Object.freeze([
  'START_SHIFT',
  'START_PRODUCTION',
  'FINISH_PRODUCTION',
  'START_BREAK',
  'FINISH_BREAK',
  'START_OPERATIONAL_DOWNTIME',
  'START_CRITICAL_DOWNTIME',
  'FINISH_DOWNTIME',
  'REQUEST_ADDITIONAL_WORK',
  'START_ADDITIONAL_WORK',
  'FINISH_ADDITIONAL_WORK',
  'FINISH_SHIFT',
] as const);

export type Section02BusinessActionId = typeof SECTION02_BUSINESS_ACTION_IDS[number];
export type Section02CommandOutcome = 'PRIMARY' | 'SECONDARY';

function required(input: Section02Context, field: keyof Section02Context): string {
  const value = input[field];
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Section 02 action requires context.${field}.`);
  return value.trim();
}

function endpoint(actionId: Section02BusinessActionId): string {
  if (actionId === 'START_SHIFT') return mutationPaths.startShift;
  if (actionId === 'FINISH_SHIFT') return mutationPaths.finishShift;
  if (actionId === 'START_PRODUCTION') return mutationPaths.startProduction;
  if (actionId === 'FINISH_PRODUCTION') return '/production-operations/:production_operation_id/finish';
  if (actionId === 'START_BREAK') return mutationPaths.startBreak;
  if (actionId === 'FINISH_BREAK') return mutationPaths.finishBreak;
  if (actionId === 'START_OPERATIONAL_DOWNTIME' || actionId === 'START_CRITICAL_DOWNTIME') return mutationPaths.startDowntime;
  if (actionId === 'FINISH_DOWNTIME') return '/machine-downtimes/:downtime_id/finish';
  if (actionId === 'REQUEST_ADDITIONAL_WORK') return mutationPaths.requestAdditionalWork;
  if (actionId === 'START_ADDITIONAL_WORK') return '/additional-works/:additional_work_id/start';
  return '/additional-works/:additional_work_id/finish';
}

async function execute(apiClient: ApiClient, actionId: Section02BusinessActionId, input: Section02Context) {
  let resultId: string;
  let outcome: Section02CommandOutcome = 'PRIMARY';
  if (actionId === 'START_SHIFT' || actionId === 'FINISH_SHIFT') {
    const response = decodeShiftMutationResult(await apiClient.request<unknown>(endpoint(actionId), { method: 'POST', body: {} }));
    resultId = response.employee_shift_id;
  } else if (actionId === 'START_PRODUCTION') {
    const response = decodeProductionMutationResult(await apiClient.request<unknown>(mutationPaths.startProduction, {
      method: 'POST', body: { machine_id: required(input, 'machine_id'), sku_id: required(input, 'sku_id') },
    }));
    resultId = response.production_operation_id;
  } else if (actionId === 'FINISH_PRODUCTION') {
    const productionOperationId = required(input, 'production_operation_id');
    const response = decodeProductionMutationResult(await apiClient.request<unknown>(mutationPaths.finishProduction(productionOperationId), {
      method: 'POST', body: { quantity_produced: required(input, 'quantity_produced') },
    }));
    resultId = response.production_operation_id;
  } else if (actionId === 'START_BREAK') {
    const response = decodeOperationMutationResult(await apiClient.request<unknown>(mutationPaths.startBreak, {
      method: 'POST', body: { break_type_id: required(input, 'break_type_id') },
    }));
    resultId = response.id;
  } else if (actionId === 'FINISH_BREAK') {
    const response = decodeOperationMutationResult(await apiClient.request<unknown>(mutationPaths.finishBreak, { method: 'POST', body: {} }));
    resultId = response.id;
  } else if (actionId === 'START_OPERATIONAL_DOWNTIME' || actionId === 'START_CRITICAL_DOWNTIME') {
    const productionOperationId = input.production_requirement === 'required'
      ? required(input, 'production_operation_id')
      : null;
    const response = decodeOperationMutationResult(await apiClient.request<unknown>(mutationPaths.startDowntime, {
      method: 'POST',
      body: {
        machine_id: required(input, 'machine_id'),
        downtime_type_id: required(input, 'downtime_type_id'),
        production_operation_id: productionOperationId,
        comment: actionId === 'START_CRITICAL_DOWNTIME' ? required(input, 'comment') : null,
      },
    }));
    resultId = response.id;
  } else if (actionId === 'FINISH_DOWNTIME') {
    const response = decodeOperationMutationResult(await apiClient.request<unknown>(mutationPaths.finishDowntime(required(input, 'downtime_id')), { method: 'POST', body: {} }));
    resultId = response.id;
    outcome = input.production_operation_id === undefined ? 'SECONDARY' : 'PRIMARY';
  } else if (actionId === 'REQUEST_ADDITIONAL_WORK') {
    const response = decodeOperationMutationResult(await apiClient.request<unknown>(mutationPaths.requestAdditionalWork, {
      method: 'POST', body: { additional_work_type_id: required(input, 'additional_work_type_id') },
    }));
    resultId = response.id;
  } else if (actionId === 'START_ADDITIONAL_WORK') {
    const response = decodeOperationMutationResult(await apiClient.request<unknown>(mutationPaths.startAdditionalWork(required(input, 'additional_work_id')), { method: 'POST', body: {} }));
    resultId = response.id;
  } else {
    const response = decodeOperationMutationResult(await apiClient.request<unknown>(mutationPaths.finishAdditionalWork(required(input, 'additional_work_id')), { method: 'POST', body: {} }));
    resultId = response.id;
  }
  return Object.freeze({ outcome, entities: Object.freeze({ result_id: resultId }) });
}

function createCommand(apiClient: ApiClient, actionId: Section02BusinessActionId) {
  const inputSchema = defineGraphCommandInput(createSection02ContextSchema());
  return graphCommandFor(inputSchema).define({
    command: actionId,
    method: 'POST',
    endpoint: endpoint(actionId),
    outcomes: ['PRIMARY', 'SECONDARY'],
    entities: defineGraphCommandEntities({ result_id: graphCommandEntity.id() }),
    request: async (input) => Object.freeze({ command: actionId, ...(await execute(apiClient, actionId, input)) }),
  });
}

export function createSection02BusinessCommands(apiClient: ApiClient) {
  return Object.freeze(Object.fromEntries(SECTION02_BUSINESS_ACTION_IDS.map((actionId) => [actionId, createCommand(apiClient, actionId)]))) as Readonly<Record<Section02BusinessActionId, ReturnType<typeof createCommand>>>;
}
