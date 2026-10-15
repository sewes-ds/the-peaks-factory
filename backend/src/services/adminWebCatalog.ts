import { callRuntimeFunction } from '../db/callRuntimeFunction.js';
import { mapPostgresError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';

export type AdminSaveResult = Readonly<{
  created: boolean;
  qr_rotated?: boolean;
  employee_id?: string;
  position_id?: string;
  machine_id?: string;
  sku_id?: string;
  additional_work_type_id?: string;
}>;

export type AdminActivityTypeResult = Readonly<{
  activity_type_id: string;
  activity_class: 'BREAK' | 'OPERATIONAL' | 'CRITICAL';
  is_active?: boolean;
}>;

export type AdminQrLabel = Readonly<{
  resource_kind: 'MACHINE' | 'SKU';
  resource_id: string;
  title: string;
  subtitle: string | null;
  payload: string;
}>;

export async function prepareAdminQrLabel(
  pool: DbPool,
  sessionTokenHash: string,
  resourceKind: 'MACHINE' | 'SKU',
  resourceId: string
): Promise<AdminQrLabel> {
  return callAdminCatalog(pool, 'prepare_admin_qr_label', [
    sessionTokenHash,
    resourceKind,
    resourceId
  ]);
}

export async function saveAdminEmployee(
  pool: DbPool,
  sessionTokenHash: string,
  input: Readonly<{
    employeeId: string | null;
    fullName: string;
    phoneE164: string;
    positionId: string;
    employeeStatusId: string;
    reason: string;
  }>
): Promise<AdminSaveResult> {
  return callAdminCatalog(pool, 'save_admin_employee', [
    sessionTokenHash,
    input.employeeId,
    input.fullName,
    input.phoneE164,
    input.positionId,
    input.employeeStatusId,
    input.reason
  ]);
}

export async function saveAdminPosition(
  pool: DbPool,
  sessionTokenHash: string,
  input: Readonly<{
    positionId: string | null;
    positionName: string;
    positionDescription: string | null;
    isProductionPosition: boolean;
    isActive: boolean;
    reason: string;
  }>
): Promise<AdminSaveResult> {
  return callAdminCatalog(pool, 'save_admin_position', [
    sessionTokenHash,
    input.positionId,
    input.positionName,
    input.positionDescription,
    input.isProductionPosition,
    input.isActive,
    input.reason
  ]);
}

export async function saveAdminMachine(
  pool: DbPool,
  sessionTokenHash: string,
  input: Readonly<{
    machineId: string | null;
    machineName: string;
    workshopName: string | null;
    machineUseStatusId: string;
    newQrToken: string | null;
    reason: string;
  }>
): Promise<AdminSaveResult> {
  return callAdminCatalog(pool, 'save_admin_machine', [
    sessionTokenHash,
    input.machineId,
    input.machineName,
    input.workshopName,
    input.machineUseStatusId,
    input.newQrToken,
    input.reason
  ]);
}

export async function saveAdminSku(
  pool: DbPool,
  sessionTokenHash: string,
  input: Readonly<{
    skuId: string | null;
    skuCode: string;
    skuName: string | null;
    skuUnitId: string;
    plannedProductivityPerHour: string | null;
    currentSkuTariffUzs: string;
    isActive: boolean;
    newQrToken: string | null;
    reason: string;
  }>
): Promise<AdminSaveResult> {
  return callAdminCatalog(pool, 'save_admin_sku', [
    sessionTokenHash,
    input.skuId,
    input.skuCode,
    input.skuName,
    input.skuUnitId,
    input.plannedProductivityPerHour,
    input.currentSkuTariffUzs,
    input.isActive,
    input.newQrToken,
    input.reason
  ]);
}

export async function saveAdminAdditionalWorkType(
  pool: DbPool,
  sessionTokenHash: string,
  input: Readonly<{
    additionalWorkTypeId: string | null;
    additionalWorkTypeName: string;
    isActive: boolean;
    reason: string;
  }>
): Promise<AdminSaveResult> {
  return callAdminCatalog(pool, 'save_admin_additional_work_type', [
    sessionTokenHash,
    input.additionalWorkTypeId,
    input.additionalWorkTypeName,
    input.isActive,
    input.reason
  ]);
}

export async function createAdminActivityType(
  pool: DbPool,
  sessionTokenHash: string,
  input: Readonly<{
    activityClass: 'BREAK' | 'OPERATIONAL' | 'CRITICAL';
    displayName: string;
    profileId: string;
    reason: string;
  }>
): Promise<AdminActivityTypeResult> {
  return callAdminCatalog(pool, 'create_admin_activity_type', [
    sessionTokenHash,
    input.activityClass,
    null,
    input.displayName,
    null,
    input.profileId,
    input.reason
  ]);
}

export async function moveAdminActivityType(
  pool: DbPool,
  sessionTokenHash: string,
  input: Readonly<{
    activityClass: 'BREAK' | 'OPERATIONAL' | 'CRITICAL';
    activityTypeId: string;
    direction: 'UP' | 'DOWN';
  }>
): Promise<AdminActivityTypeResult & { moved: boolean }> {
  return callAdminCatalog(pool, 'move_admin_activity_type', [
    sessionTokenHash,
    input.activityClass,
    input.activityTypeId,
    input.direction
  ]);
}

export async function deactivateAdminActivityType(
  pool: DbPool,
  sessionTokenHash: string,
  input: Readonly<{
    activityClass: 'BREAK' | 'OPERATIONAL' | 'CRITICAL';
    activityTypeId: string;
    reason: string;
  }>
): Promise<AdminActivityTypeResult> {
  return callAdminCatalog(pool, 'deactivate_admin_activity_type', [
    sessionTokenHash,
    input.activityClass,
    input.activityTypeId,
    input.reason
  ]);
}

async function callAdminCatalog<TResult>(
  pool: DbPool,
  functionName:
    | 'prepare_admin_qr_label'
    | 'save_admin_employee'
    | 'save_admin_position'
    | 'save_admin_machine'
    | 'save_admin_sku'
    | 'save_admin_additional_work_type'
    | 'create_admin_activity_type'
    | 'move_admin_activity_type'
    | 'deactivate_admin_activity_type',
  params: readonly unknown[]
): Promise<TResult> {
  try {
    return await callRuntimeFunction<TResult>(pool, { functionName, params });
  } catch (error) {
    throw mapPostgresError(error);
  }
}
