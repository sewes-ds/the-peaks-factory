import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { RuntimeApiFunctionName } from '../db/runtimeApiRegistry.js';
import { ApiError } from '../db/errors.js';
import { callSalaryRuntime, createAndApproveSalaryRuntime } from '../services/salary.js';

const idSchema = z.string().regex(/^[1-9][0-9]*$/);
const numericSchema = z.string().regex(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const nonNegativeCanonicalDecimalSchema = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const reasonSchema = z.object({ reason: z.string().trim().min(1) });
const salaryCorrectionSchema = z.object({
  employee_id: idSchema,
  employee_shift_id: idSchema,
  salary_correction_type_id: idSchema,
  amount: numericSchema,
  reason: z.string().trim().min(1)
});
const productionCorrectionSchema = z.object({
  production_operation_id: idSchema,
  old_quantity: nonNegativeCanonicalDecimalSchema,
  new_quantity: nonNegativeCanonicalDecimalSchema,
  reason: z.string().trim().min(1)
});

type ProductionCorrectionRequest = {
  production_operation_id: string;
  old_quantity: string;
  new_quantity: string;
  reason: string;
};

export type ProductionCorrectionRuntimeParams = readonly [string, string, null, string];

export const salaryRoutes: FastifyPluginAsync = async (app) => {
  app.post('/salary-corrections', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseSalaryPart(salaryCorrectionSchema, request.body);
    return callSalaryRuntime(app.db, actor, 'create_salary_correction', [
      body.employee_id,
      body.employee_shift_id,
      body.salary_correction_type_id,
      body.amount,
      body.reason
    ]);
  });

  app.post('/salary-corrections/apply', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseSalaryPart(salaryCorrectionSchema, request.body);
    return createAndApproveSalaryRuntime(
      app.db,
      actor,
      'create_salary_correction',
      'approve_salary_correction',
      [
        body.employee_id,
        body.employee_shift_id,
        body.salary_correction_type_id,
        body.amount,
        body.reason
      ]
    );
  });

  registerById(app, '/salary-corrections/:id/approve', 'approve_salary_correction');
  registerById(app, '/salary-corrections/:id/reject', 'reject_salary_correction', reasonSchema);
  registerById(app, '/salary-corrections/:id/cancel', 'cancel_salary_correction', reasonSchema);

  app.post('/production-operation-corrections', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseSalaryPart(productionCorrectionSchema, request.body);
    return callSalaryRuntime(app.db, actor, 'create_production_operation_correction', adaptProductionCorrectionRuntimeParams(body));
  });

  app.post('/production-operation-corrections/apply', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseSalaryPart(productionCorrectionSchema, request.body);
    return createAndApproveSalaryRuntime(
      app.db,
      actor,
      'create_production_operation_correction',
      'approve_production_operation_correction',
      adaptProductionCorrectionRuntimeParams(body)
    );
  });

  registerById(app, '/production-operation-corrections/:id/approve', 'approve_production_operation_correction');
  registerById(app, '/production-operation-corrections/:id/reject', 'reject_production_operation_correction', reasonSchema);
  registerById(app, '/production-operation-corrections/:id/cancel', 'cancel_production_operation_correction', reasonSchema);
  registerById(app, '/salary-entries/:id/reverse', 'reverse_salary_entry', reasonSchema);
  registerById(app, '/salary-entries/:id/emergency-reverse', 'emergency_reverse_salary_entry', z.object({ reason: z.string().trim().min(1), comment: z.string().trim().min(1) }));
};

function registerById<TSchema extends z.ZodTypeAny>(
  app: Parameters<FastifyPluginAsync>[0],
  path: string,
  functionName: RuntimeApiFunctionName,
  bodySchema?: TSchema
): void {
  app.post(path, async (request) => {
    const actor = await app.requireActor(request);
    const params = parseSalaryPart(z.object({ id: idSchema }), request.params);
    const body = bodySchema ? parseSalaryPart(bodySchema, request.body) : {};
    return callSalaryRuntime(app.db, actor, functionName, [params.id, ...Object.values(body as Record<string, unknown>)]);
  });
}

export function parseSalaryPart<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid salary request');
  }

  return result.data;
}

export function adaptProductionCorrectionRuntimeParams(body: ProductionCorrectionRequest): ProductionCorrectionRuntimeParams {
  return [body.production_operation_id, exactProductionQuantityDelta(body.old_quantity, body.new_quantity), null, body.reason];
}

export function exactProductionQuantityDelta(oldQuantity: string, newQuantity: string): string {
  if (!nonNegativeCanonicalDecimalSchema.safeParse(oldQuantity).success || !nonNegativeCanonicalDecimalSchema.safeParse(newQuantity).success) {
    throw new ApiError(400, 'bad_request', 'Invalid salary request');
  }

  const oldParts = splitDecimal(oldQuantity);
  const newParts = splitDecimal(newQuantity);
  const scale = oldParts.fraction.length > newParts.fraction.length ? oldParts.fraction.length : newParts.fraction.length;
  const oldScaled = BigInt(`${oldParts.integer}${oldParts.fraction.padEnd(scale, '0')}`);
  const newScaled = BigInt(`${newParts.integer}${newParts.fraction.padEnd(scale, '0')}`);
  const delta = newScaled - oldScaled;

  if (delta === 0n) {
    throw new ApiError(400, 'bad_request', 'Production correction must change quantity');
  }

  const sign = delta < 0n ? '-' : '';
  const magnitude = (delta < 0n ? -delta : delta).toString();

  if (scale === 0) {
    return `${sign}${magnitude}`;
  }

  const paddedMagnitude = magnitude.padStart(scale + 1, '0');
  const integer = paddedMagnitude.slice(0, -scale);
  const fraction = paddedMagnitude.slice(-scale).replace(/0+$/, '');

  return fraction.length === 0 ? `${sign}${integer}` : `${sign}${integer}.${fraction}`;
}

function splitDecimal(value: string): { integer: string; fraction: string } {
  const [integer, fraction = ''] = value.split('.');
  return { integer, fraction };
}
