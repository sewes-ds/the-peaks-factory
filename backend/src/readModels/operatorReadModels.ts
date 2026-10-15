import type { ActorContext } from '../auth/actorContext.js';
import type { DbPool } from '../db/pool.js';
import {
  resolveAdditionalWorkProjection,
  resolveAvailableDowntimeTypesForProductionState,
  resolveEmployeeWorkplaceState,
  resolveMachineProjection,
  resolveMachineQrProjection,
  resolveSalaryHistory,
  resolveSalaryTotals,
  resolveSkuList,
  resolveSkuQrProjection
} from './domainState.js';
import {
  readActiveBreakTypeRows,
  readActiveDowntimeTypes,
  readActiveSkuRows,
  readEmployeeActiveProduction,
  readEmployeeAdditionalWorkStateRows,
  readEmployeeSalaryHistory,
  readEmployeeSalaryTotals,
  readEmployeeWorkplaceSnapshot,
  readMachineStateRows,
  readOperatorAvailableAdditionalWorkTypeRows,
  readSkuQrStateRows
} from './sharedQueries.js';
import type {
  AdditionalWorkTypesAvailableResponse,
  AvailableDowntimeTypesResponse,
  BreakTypesResponse,
  MachineListResponse,
  MachineQrLookupResponse,
  OperatorAdditionalWorkStateResponse,
  OperatorWorkplaceStateResponse,
  SalaryHistoryResponse,
  SalaryTotalsResponse,
  SkuListResponse,
  SkuQrLookupResponse
} from './types.js';

export async function getOperatorWorkplaceState(
  pool: DbPool,
  actor: ActorContext
): Promise<OperatorWorkplaceStateResponse> {
  const actorEmployeeId = actor.employeeId.toString();
  const row = await readEmployeeWorkplaceSnapshot(pool, actorEmployeeId);

  return {
    actor_employee_id: actorEmployeeId,
    actor_full_name: row?.employee_full_name ?? '',
    ...resolveEmployeeWorkplaceState(row)
  };
}

export async function getOperatorAdditionalWorkState(
  pool: DbPool,
  actor: ActorContext
): Promise<OperatorAdditionalWorkStateResponse> {
  const actorEmployeeId = actor.employeeId.toString();
  const rows = await readEmployeeAdditionalWorkStateRows(pool, actorEmployeeId);
  const additionalWorkState = resolveAdditionalWorkProjection(rows);

  return {
    actor_employee_id: actorEmployeeId,
    ...additionalWorkState
  };
}

export async function getAvailableAdditionalWorkTypes(
  pool: DbPool,
  actor: ActorContext
): Promise<AdditionalWorkTypesAvailableResponse> {
  return {
    additional_work_types: await readOperatorAvailableAdditionalWorkTypeRows(
      pool,
      actor.employeeId.toString()
    )
  };
}

export async function getAvailableDowntimeTypes(
  pool: DbPool,
  actor: ActorContext
): Promise<AvailableDowntimeTypesResponse> {
  const actorEmployeeId = actor.employeeId.toString();
  const activeProduction = await readEmployeeActiveProduction(pool, actorEmployeeId);
  const rows = await readActiveDowntimeTypes(pool);
  const hasActiveProduction = activeProduction != null;

  return {
    active_production_operation_id: activeProduction?.production_operation_id ?? null,
    available_downtime_types: resolveAvailableDowntimeTypesForProductionState(hasActiveProduction, rows)
  };
}

export async function getOperatorMachines(pool: DbPool, actor: ActorContext): Promise<MachineListResponse> {
  const rows = await readMachineStateRows(pool, actor.employeeId.toString());
  return { machines: rows.map(resolveMachineProjection) };
}

export async function getOperatorMachineByQr(
  pool: DbPool,
  actor: ActorContext,
  qrToken: string
): Promise<MachineQrLookupResponse> {
  const rows = await readMachineStateRows(pool, actor.employeeId.toString(), qrToken);
  const machine = rows[0];

  if (!machine) {
    return { found: false, error_code: 'MACHINE_QR_NOT_FOUND' };
  }

  return { found: true, machine: resolveMachineQrProjection(machine) };
}

export async function getOperatorSkus(pool: DbPool): Promise<SkuListResponse> {
  const rows = await readActiveSkuRows(pool);

  return { skus: resolveSkuList(rows) };
}

export async function getOperatorSkuByQr(pool: DbPool, qrToken: string): Promise<SkuQrLookupResponse> {
  const rows = await readSkuQrStateRows(pool, qrToken);
  const sku = rows[0];

  if (!sku) {
    return { found: false, error_code: 'SKU_QR_NOT_FOUND' };
  }

  return { found: true, sku: resolveSkuQrProjection(sku) };
}

export async function getOperatorBreakTypes(pool: DbPool): Promise<BreakTypesResponse> {
  return { break_types: await readActiveBreakTypeRows(pool) };
}

export async function getOperatorSalaryTotals(pool: DbPool, actor: ActorContext): Promise<SalaryTotalsResponse> {
  const actorEmployeeId = actor.employeeId.toString();
  const row = await readEmployeeSalaryTotals(pool, actorEmployeeId);

  return resolveSalaryTotals(actorEmployeeId, row);
}

export async function getOperatorSalaryHistory(pool: DbPool, actor: ActorContext): Promise<SalaryHistoryResponse> {
  const actorEmployeeId = actor.employeeId.toString();
  const rows = await readEmployeeSalaryHistory(pool, actorEmployeeId);

  return resolveSalaryHistory(actorEmployeeId, rows);
}
