import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../db/errors.js';
import {
  cancelProductionOperation,
  finishProductionOperation,
  startProductionOperation
} from '../services/production.js';

const bigintIdSchema = z.string().regex(/^[1-9][0-9]*$/);
const numericTextSchema = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);

const startBodySchema = z.object({
  machine_id: bigintIdSchema,
  sku_id: bigintIdSchema
});

const operationParamsSchema = z.object({
  production_operation_id: bigintIdSchema
});

const finishBodySchema = z.object({
  quantity_produced: numericTextSchema,
  comment: z.string().trim().min(1).nullable().optional()
});

const cancelBodySchema = z.object({
  reason: z.string().trim().min(1)
});

export const productionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/production-operations/start', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseProductionRequestPart(startBodySchema, request.body);

    return startProductionOperation(app.db, actor, body.machine_id, body.sku_id);
  });

  app.post('/production-operations/:production_operation_id/finish', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseProductionRequestPart(operationParamsSchema, request.params);
    const body = parseProductionRequestPart(finishBodySchema, request.body);

    return finishProductionOperation(
      app.db,
      actor,
      params.production_operation_id,
      body.quantity_produced,
      body.comment ?? null
    );
  });

  app.post('/production-operations/:production_operation_id/cancel', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseProductionRequestPart(operationParamsSchema, request.params);
    const body = parseProductionRequestPart(cancelBodySchema, request.body);

    return cancelProductionOperation(app.db, actor, params.production_operation_id, body.reason);
  });
};

export function parseProductionRequestPart<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid production operation request');
  }

  return result.data;
}
