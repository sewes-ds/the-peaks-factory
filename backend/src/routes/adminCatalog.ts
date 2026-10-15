import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { RuntimeApiFunctionName } from '../db/runtimeApiRegistry.js';
import { ApiError } from '../db/errors.js';
import {
  assertCanManageDictionaries,
  readDowntimeNotificationRules,
  readDowntimeProfiles,
  readDowntimeTypesForAdmin,
  readOperatorBreakProfiles,
  readOperatorBreakTypesForAdmin
} from '../readModels/activityCatalogAdmin.js';
import { callAdminCatalogRuntime } from '../services/adminCatalog.js';

const idSchema = z.string().regex(/^[1-9][0-9]*$/);
const textSchema = z.string().trim().min(1);
const nullableTextSchema = z.string().trim().min(1).nullable().optional();
const numericSchema = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const technicalCodeSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const downtimeNotificationPermissionSchema = z.enum([
  'can_receive_production_notifications',
  'can_receive_director_notifications'
]);
const downtimeNotificationKindSchema = z.enum(['TYPE_IMMEDIATE', 'ELAPSED_THRESHOLD']);

export const adminCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.post('/admin/employees', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseAdminCatalogPart(
      z.object({
        full_name: textSchema,
        phone_e164: textSchema,
        position_id: idSchema,
        tariff_category: nullableTextSchema,
        employee_status_id: idSchema
      }),
      request.body
    );
    return callAdminCatalogRuntime(app.db, actor, 'create_employee', [
      body.full_name,
      body.phone_e164,
      body.position_id,
      body.tariff_category ?? null,
      body.employee_status_id
    ]);
  });

  app.post('/admin/employees/:employee_id/update', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseAdminCatalogPart(z.object({ employee_id: idSchema }), request.params);
    const body = parseAdminCatalogPart(
      z.object({
        full_name: textSchema,
        phone_e164: textSchema,
        position_id: idSchema,
        tariff_category: nullableTextSchema
      }),
      request.body
    );
    return callAdminCatalogRuntime(app.db, actor, 'update_employee', [
      params.employee_id,
      body.full_name,
      body.phone_e164,
      body.position_id,
      body.tariff_category ?? null
    ]);
  });

  registerAction(app, '/admin/employees/:employee_id/status', 'change_employee_status', z.object({ employee_status_id: idSchema, reason: textSchema }));
  registerAction(app, '/admin/employees/:employee_id/roles/assign', 'assign_employee_role', z.object({ role_id: idSchema, reason: textSchema }));
  registerAction(app, '/admin/employees/:employee_id/roles/revoke', 'revoke_employee_role', z.object({ role_id: idSchema, reason: textSchema }));
  registerAction(
    app,
    '/admin/employees/:employee_id/telegram/bind',
    'bind_employee_telegram_user',
    z.object({ telegram_user_id: idSchema, telegram_username: nullableTextSchema, reason: textSchema })
  );
  registerAction(app, '/admin/employees/:employee_id/telegram/reset', 'reset_employee_telegram_user', z.object({ reason: textSchema }));
  registerAction(app, '/admin/machines/:machine_id/rotate-qr', 'rotate_machine_qr_token', z.object({ qr_token: textSchema, reason: textSchema }));
  registerAction(app, '/admin/skus/:sku_id/rotate-qr', 'rotate_sku_qr_token', z.object({ qr_token: textSchema, reason: textSchema }));
  registerAction(app, '/admin/skus/:sku_id/tariff', 'update_sku_tariff', z.object({ tariff_rate: numericSchema, reason: textSchema }));

  app.get('/admin/operator-break-profiles', async (request) => {
    const actor = await app.requireActor(request);
    await assertCanManageDictionaries(app.db, actor.employeeId.toString());
    return { profiles: await readOperatorBreakProfiles(app.db) };
  });

  app.post('/admin/operator-break-profiles', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseAdminCatalogPart(
      z.object({
        technical_code: technicalCodeSchema,
        profile_name: textSchema,
        allows_during_open_production: z.boolean(),
        blocks_production_start: z.boolean(),
        blocks_self_production_finish: z.boolean(),
        blocks_additional_work_start: z.boolean(),
        blocks_shift_finish: z.boolean(),
        reason: textSchema
      }),
      request.body
    );
    return callAdminCatalogRuntime(app.db, actor, 'create_operator_break_behavior_profile', [
      body.technical_code,
      body.profile_name,
      body.allows_during_open_production,
      body.blocks_production_start,
      body.blocks_self_production_finish,
      body.blocks_additional_work_start,
      body.blocks_shift_finish,
      body.reason
    ]);
  });

  registerCatalogDeactivation(
    app,
    '/admin/operator-break-profiles/:profile_id/deactivate',
    'profile_id',
    'deactivate_operator_break_behavior_profile'
  );

  app.get('/admin/operator-break-types', async (request) => {
    const actor = await app.requireActor(request);
    await assertCanManageDictionaries(app.db, actor.employeeId.toString());
    return { types: await readOperatorBreakTypesForAdmin(app.db) };
  });

  app.post('/admin/operator-break-types', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseAdminCatalogPart(
      z.object({
        technical_code: technicalCodeSchema,
        display_name: textSchema,
        display_order: nonNegativeIntegerSchema,
        behavior_profile_id: idSchema,
        reason: textSchema
      }),
      request.body
    );
    return callAdminCatalogRuntime(app.db, actor, 'create_operator_break_type', [
      body.technical_code,
      body.display_name,
      body.display_order,
      body.behavior_profile_id,
      body.reason
    ]);
  });

  registerCatalogDeactivation(
    app,
    '/admin/operator-break-types/:type_id/deactivate',
    'type_id',
    'deactivate_operator_break_type'
  );

  registerDowntimeCatalogScope(app, 'operational', 'OPERATIONAL');
  registerDowntimeCatalogScope(app, 'critical', 'CRITICAL');
};

function registerDowntimeCatalogScope(
  app: Parameters<FastifyPluginAsync>[0],
  routeClass: 'operational' | 'critical',
  downtimeClass: 'OPERATIONAL' | 'CRITICAL'
): void {
  const createProfileFunction: RuntimeApiFunctionName = routeClass === 'operational'
    ? 'create_operational_downtime_behavior_profile'
    : 'create_critical_downtime_behavior_profile';
  const deactivateProfileFunction: RuntimeApiFunctionName = routeClass === 'operational'
    ? 'deactivate_operational_downtime_behavior_profile'
    : 'deactivate_critical_downtime_behavior_profile';
  const createTypeFunction: RuntimeApiFunctionName = routeClass === 'operational'
    ? 'create_operational_downtime_type'
    : 'create_critical_downtime_type';
  const deactivateTypeFunction: RuntimeApiFunctionName = routeClass === 'operational'
    ? 'deactivate_operational_downtime_type'
    : 'deactivate_critical_downtime_type';
  const createNotificationRuleFunction: RuntimeApiFunctionName = routeClass === 'operational'
    ? 'create_operational_downtime_notification_rule'
    : 'create_critical_downtime_notification_rule';
  const deactivateNotificationRuleFunction: RuntimeApiFunctionName = routeClass === 'operational'
    ? 'deactivate_operational_downtime_notification_rule'
    : 'deactivate_critical_downtime_notification_rule';

  app.get(`/admin/machine-downtime-profiles/${routeClass}`, async (request) => {
    const actor = await app.requireActor(request);
    await assertCanManageDictionaries(app.db, actor.employeeId.toString());
    return { profiles: await readDowntimeProfiles(app.db, downtimeClass) };
  });

  app.post(`/admin/machine-downtime-profiles/${routeClass}`, async (request) => {
    const actor = await app.requireActor(request);
    const commonSchema = {
      technical_code: technicalCodeSchema,
      profile_name: textSchema,
      operator_requires_start_comment: z.boolean(),
      blocks_production_finish: z.boolean(),
      blocks_shift_finish: z.boolean(),
      reason: textSchema
    };
    const body = parseAdminCatalogPart(
      routeClass === 'operational'
        ? z.object(commonSchema)
        : z.object({ ...commonSchema, machine_status_effect: z.enum(['DOWNTIME', 'BROKEN']) }),
      request.body
    );
    const params: unknown[] = [
      body.technical_code,
      body.profile_name,
      body.operator_requires_start_comment,
      body.blocks_production_finish,
      body.blocks_shift_finish
    ];
    if ('machine_status_effect' in body) {
      params.push(body.machine_status_effect);
    }
    params.push(body.reason);
    return callAdminCatalogRuntime(app.db, actor, createProfileFunction, params);
  });

  registerCatalogDeactivation(
    app,
    `/admin/machine-downtime-profiles/${routeClass}/:profile_id/deactivate`,
    'profile_id',
    deactivateProfileFunction
  );

  app.get(`/admin/machine-downtime-types/${routeClass}`, async (request) => {
    const actor = await app.requireActor(request);
    await assertCanManageDictionaries(app.db, actor.employeeId.toString());
    return { types: await readDowntimeTypesForAdmin(app.db, downtimeClass) };
  });

  app.post(`/admin/machine-downtime-types/${routeClass}`, async (request) => {
    const actor = await app.requireActor(request);
    const body = parseAdminCatalogPart(
      z.object({
        technical_code: technicalCodeSchema,
        display_name: textSchema,
        display_order: nonNegativeIntegerSchema,
        behavior_profile_id: idSchema,
        reason: textSchema
      }),
      request.body
    );
    return callAdminCatalogRuntime(app.db, actor, createTypeFunction, [
      body.technical_code,
      body.display_name,
      body.display_order,
      body.behavior_profile_id,
      body.reason
    ]);
  });

  registerCatalogDeactivation(
    app,
    `/admin/machine-downtime-types/${routeClass}/:type_id/deactivate`,
    'type_id',
    deactivateTypeFunction
  );

  app.get(`/admin/machine-downtime-profiles/${routeClass}/notification-rules`, async (request) => {
    const actor = await app.requireActor(request);
    await assertCanManageDictionaries(app.db, actor.employeeId.toString());
    return { rules: await readDowntimeNotificationRules(app.db, downtimeClass) };
  });

  app.post(`/admin/machine-downtime-profiles/${routeClass}/:profile_id/notification-rules`, async (request) => {
    const actor = await app.requireActor(request);
    const params = parseAdminCatalogPart(z.object({ profile_id: idSchema }), request.params);
    const body = parseAdminCatalogPart(
      z.object({
        technical_code: technicalCodeSchema,
        threshold_minutes: nonNegativeIntegerSchema,
        recipient_permission_code: downtimeNotificationPermissionSchema,
        notification_kind: downtimeNotificationKindSchema,
        priority: nonNegativeIntegerSchema,
        reason: textSchema
      }),
      request.body
    );
    return callAdminCatalogRuntime(app.db, actor, createNotificationRuleFunction, [
      params.profile_id,
      body.technical_code,
      body.threshold_minutes,
      body.recipient_permission_code,
      body.notification_kind,
      body.priority,
      body.reason
    ]);
  });

  registerCatalogDeactivation(
    app,
    `/admin/machine-downtime-profiles/${routeClass}/notification-rules/:rule_id/deactivate`,
    'rule_id',
    deactivateNotificationRuleFunction
  );
}

function registerCatalogDeactivation(
  app: Parameters<FastifyPluginAsync>[0],
  path: string,
  parameterName: 'profile_id' | 'type_id' | 'rule_id',
  functionName: RuntimeApiFunctionName
): void {
  app.post(path, async (request) => {
    const actor = await app.requireActor(request);
    const params = parseAdminCatalogPart(z.record(idSchema), request.params);
    const body = parseAdminCatalogPart(z.object({ reason: textSchema }), request.body);
    const targetId = params[parameterName];
    if (!targetId) {
      throw new ApiError(400, 'bad_request', 'Invalid activity catalog target');
    }
    return callAdminCatalogRuntime(app.db, actor, functionName, [targetId, body.reason]);
  });
}

function registerAction<TSchema extends z.ZodObject<Record<string, z.ZodTypeAny>>>(
  app: Parameters<FastifyPluginAsync>[0],
  path: string,
  functionName: RuntimeApiFunctionName,
  bodySchema: TSchema
): void {
  app.post(path, async (request) => {
    const actor = await app.requireActor(request);
    const params = parseAdminCatalogPart(
      z.object({ employee_id: idSchema.optional(), machine_id: idSchema.optional(), sku_id: idSchema.optional() }),
      request.params
    );
    const body = parseAdminCatalogPart(bodySchema, request.body);
    const targetId = params.employee_id ?? params.machine_id ?? params.sku_id;
    if (!targetId) {
      throw new ApiError(400, 'bad_request', 'Invalid admin catalog request');
    }

    return callAdminCatalogRuntime(app.db, actor, functionName, [targetId, ...Object.values(body)]);
  });
}

export function parseAdminCatalogPart<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid admin catalog request');
  }

  return result.data;
}
