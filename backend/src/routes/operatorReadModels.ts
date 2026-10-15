import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../db/errors.js';
import {
  getAvailableAdditionalWorkTypes,
  getAvailableDowntimeTypes,
  getOperatorAdditionalWorkState,
  getOperatorBreakTypes,
  getOperatorMachineByQr,
  getOperatorMachines,
  getOperatorSalaryHistory,
  getOperatorSalaryTotals,
  getOperatorSkuByQr,
  getOperatorSkus,
  getOperatorWorkplaceState
} from '../readModels/operatorReadModels.js';

const qrPayloadSchema = z.object({
  qr_payload: z.string().trim().min(1).max(128)
});

const MACHINE_QR_PAYLOAD_PATTERN = /^peaks-machine:v1:([A-Za-z0-9_-]{32})$/;
const SKU_QR_PAYLOAD_PATTERN = /^peaks-sku:v1:([A-Za-z0-9_-]{32})$/;

export const operatorReadModelRoutes: FastifyPluginAsync = async (app) => {
  app.get('/operator/workplace-state', async (request) => {
    const actor = await app.requireActor(request);
    return getOperatorWorkplaceState(app.db, actor);
  });

  app.get('/operator/additional-work-state', async (request) => {
    const actor = await app.requireActor(request);
    return getOperatorAdditionalWorkState(app.db, actor);
  });

  app.get('/operator/additional-work-types/available', async (request) => {
    const actor = await app.requireActor(request);
    return getAvailableAdditionalWorkTypes(app.db, actor);
  });

  app.get('/operator/downtime-types/available', async (request) => {
    const actor = await app.requireActor(request);
    return getAvailableDowntimeTypes(app.db, actor);
  });

  app.get('/operator/machines', async (request) => {
    const actor = await app.requireActor(request);
    return getOperatorMachines(app.db, actor);
  });

  app.post('/operator/machines/resolve-qr', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseOperatorReadModelParams(qrPayloadSchema, request.body);
    const qrToken = extractMachineQrToken(body.qr_payload);
    return qrToken === null
      ? { found: false as const, error_code: 'MACHINE_QR_NOT_FOUND' as const }
      : getOperatorMachineByQr(app.db, actor, qrToken);
  });

  app.get('/operator/skus', async (request) => {
    await app.requireActor(request);
    return getOperatorSkus(app.db);
  });

  app.post('/operator/skus/resolve-qr', async (request) => {
    await app.requireActor(request);
    const body = parseOperatorReadModelParams(qrPayloadSchema, request.body);
    const qrToken = extractSkuQrToken(body.qr_payload);
    return qrToken === null
      ? { found: false as const, error_code: 'SKU_QR_NOT_FOUND' as const }
      : getOperatorSkuByQr(app.db, qrToken);
  });

  app.get('/operator/break-types', async (request) => {
    await app.requireActor(request);
    return getOperatorBreakTypes(app.db);
  });

  app.get('/operator/salary', async (request) => {
    const actor = await app.requireActor(request);
    return getOperatorSalaryTotals(app.db, actor);
  });

  app.get('/operator/salary/history', async (request) => {
    const actor = await app.requireActor(request);
    return getOperatorSalaryHistory(app.db, actor);
  });
};

export function parseOperatorReadModelParams<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid operator read-model request');
  }

  return result.data;
}

export function extractMachineQrToken(qrPayload: string): string | null {
  return MACHINE_QR_PAYLOAD_PATTERN.exec(qrPayload)?.[1] ?? null;
}

export function extractSkuQrToken(qrPayload: string): string | null {
  return SKU_QR_PAYLOAD_PATTERN.exec(qrPayload)?.[1] ?? null;
}
