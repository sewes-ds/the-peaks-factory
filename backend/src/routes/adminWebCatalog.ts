import { randomBytes } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { setAdminNoStore } from '../auth/adminCookies.js';
import { ApiError } from '../db/errors.js';
import { renderAdminQrLabelSvg } from '../presentation/adminQrLabel.js';
import {
  createAdminActivityType,
  deactivateAdminActivityType,
  moveAdminActivityType,
  prepareAdminQrLabel,
  saveAdminAdditionalWorkType,
  saveAdminEmployee,
  saveAdminMachine,
  saveAdminPosition,
  saveAdminSku
} from '../services/adminWebCatalog.js';

const idSchema = z.string().regex(/^[1-9][0-9]*$/);
const optionalIdSchema = idSchema.nullable().optional().transform((value) => value ?? null);
const nameSchema = z.string().trim().min(1).max(200);
const optionalTextSchema = z.string().trim().max(500).nullable().optional()
  .transform((value) => value || null);
const reasonSchema = z.string().trim().min(3).max(500);
const decimalSchema = z.string().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?$/);
const optionalPositiveDecimalSchema = z.string()
  .regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,3})?$/)
  .nullable()
  .optional()
  .transform((value) => value || null);
const activityClassSchema = z.enum(['BREAK', 'OPERATIONAL', 'CRITICAL']);

const employeeSchema = z.object({
  employee_id: optionalIdSchema,
  full_name: nameSchema,
  phone_e164: z.string().regex(/^\+[0-9]{7,15}$/),
  position_id: idSchema,
  employee_status_id: idSchema,
  reason: reasonSchema
}).strict();

const positionSchema = z.object({
  position_id: optionalIdSchema,
  position_name: nameSchema,
  position_description: optionalTextSchema,
  is_production_position: z.boolean(),
  is_active: z.boolean(),
  reason: reasonSchema
}).strict();

const machineSchema = z.object({
  machine_id: optionalIdSchema,
  machine_name: nameSchema,
  workshop_name: optionalTextSchema,
  machine_use_status_id: idSchema,
  rotate_qr: z.boolean().optional().default(false),
  reason: reasonSchema
}).strict();

const skuSchema = z.object({
  sku_id: optionalIdSchema,
  sku_code: z.string().trim().min(1).max(100),
  sku_name: optionalTextSchema,
  sku_unit_id: idSchema,
  planned_productivity_per_hour: optionalPositiveDecimalSchema,
  current_sku_tariff_uzs: decimalSchema,
  is_active: z.boolean(),
  rotate_qr: z.boolean().optional().default(false),
  reason: reasonSchema
}).strict();

const additionalWorkTypeSchema = z.object({
  additional_work_type_id: optionalIdSchema,
  additional_work_type_name: nameSchema,
  is_active: z.boolean(),
  reason: reasonSchema
}).strict();

const createActivityTypeSchema = z.object({
  activity_class: activityClassSchema,
  technical_code: z.string().trim().regex(/^[a-z][a-z0-9_]*$/).max(100).optional(),
  display_name: nameSchema,
  display_order: z.number().int().min(0).max(100000).optional(),
  profile_id: idSchema,
  reason: reasonSchema
}).strict();

const moveActivityTypeSchema = z.object({
  activity_class: activityClassSchema,
  activity_type_id: idSchema,
  direction: z.enum(['UP', 'DOWN'])
}).strict();

const deactivateActivityTypeSchema = z.object({
  activity_class: activityClassSchema,
  activity_type_id: idSchema,
  reason: reasonSchema
}).strict();

const qrLabelSchema = z.object({
  resource_kind: z.enum(['MACHINE', 'SKU']),
  resource_id: idSchema
}).strict();

export const adminWebCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.post('/admin-api/catalog/qr-label', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(qrLabelSchema, request.body);
    const label = await prepareAdminQrLabel(
      app.db,
      actor.sessionTokenHash,
      input.resource_kind,
      input.resource_id
    );
    const svg = await renderAdminQrLabelSvg(label);
    const prefix = label.resource_kind === 'MACHINE' ? 'machine' : 'sku';
    return reply
      .header('content-security-policy', "default-src 'none'")
      .header('x-content-type-options', 'nosniff')
      .header('content-disposition', `attachment; filename="${prefix}-${label.resource_id}-qr.svg"`)
      .type('image/svg+xml; charset=utf-8')
      .send(svg);
  });

  app.post('/admin-api/catalog/employees', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(employeeSchema, request.body);
    return { result: await saveAdminEmployee(app.db, actor.sessionTokenHash, {
      employeeId: input.employee_id,
      fullName: input.full_name,
      phoneE164: input.phone_e164,
      positionId: input.position_id,
      employeeStatusId: input.employee_status_id,
      reason: input.reason
    }) };
  });

  app.post('/admin-api/catalog/positions', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(positionSchema, request.body);
    return { result: await saveAdminPosition(app.db, actor.sessionTokenHash, {
      positionId: input.position_id,
      positionName: input.position_name,
      positionDescription: input.position_description,
      isProductionPosition: input.is_production_position,
      isActive: input.is_active,
      reason: input.reason
    }) };
  });

  app.post('/admin-api/catalog/machines', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(machineSchema, request.body);
    return { result: await saveAdminMachine(app.db, actor.sessionTokenHash, {
      machineId: input.machine_id,
      machineName: input.machine_name,
      workshopName: input.workshop_name,
      machineUseStatusId: input.machine_use_status_id,
      newQrToken: input.machine_id === null || input.rotate_qr ? createQrToken() : null,
      reason: input.reason
    }) };
  });

  app.post('/admin-api/catalog/skus', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(skuSchema, request.body);
    return { result: await saveAdminSku(app.db, actor.sessionTokenHash, {
      skuId: input.sku_id,
      skuCode: input.sku_code,
      skuName: input.sku_name,
      skuUnitId: input.sku_unit_id,
      plannedProductivityPerHour: input.planned_productivity_per_hour,
      currentSkuTariffUzs: input.current_sku_tariff_uzs,
      isActive: input.is_active,
      newQrToken: input.sku_id === null || input.rotate_qr ? createQrToken() : null,
      reason: input.reason
    }) };
  });

  app.post('/admin-api/catalog/additional-work-types', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(additionalWorkTypeSchema, request.body);
    return { result: await saveAdminAdditionalWorkType(app.db, actor.sessionTokenHash, {
      additionalWorkTypeId: input.additional_work_type_id,
      additionalWorkTypeName: input.additional_work_type_name,
      isActive: input.is_active,
      reason: input.reason
    }) };
  });

  app.post('/admin-api/catalog/activity-types', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(createActivityTypeSchema, request.body);
    return { result: await createAdminActivityType(app.db, actor.sessionTokenHash, {
      activityClass: input.activity_class,
      displayName: input.display_name,
      profileId: input.profile_id,
      reason: input.reason
    }) };
  });

  app.post('/admin-api/catalog/activity-types/move', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(moveActivityTypeSchema, request.body);
    return { result: await moveAdminActivityType(app.db, actor.sessionTokenHash, {
      activityClass: input.activity_class,
      activityTypeId: input.activity_type_id,
      direction: input.direction
    }) };
  });

  app.post('/admin-api/catalog/activity-types/deactivate', async (request, reply) => {
    setAdminNoStore(reply);
    const actor = await app.requireAdminActor(request, { mutation: true });
    const input = parseBody(deactivateActivityTypeSchema, request.body);
    return { result: await deactivateAdminActivityType(app.db, actor.sessionTokenHash, {
      activityClass: input.activity_class,
      activityTypeId: input.activity_type_id,
      reason: input.reason
    }) };
  });
};

function parseBody<TSchema extends z.ZodTypeAny>(schema: TSchema, body: unknown): z.output<TSchema> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'bad_request', 'Проверьте заполнение обязательных полей');
  }
  return parsed.data;
}

function createQrToken(): string {
  return randomBytes(24).toString('base64url');
}
