import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../db/errors.js';
import {
  emergencyCloseEmployeeShift,
  finishEmployeeShift,
  startEmployeeShift
} from '../services/shifts.js';

const bigintIdSchema = z.string().regex(/^[1-9][0-9]*$/);

const emergencyCloseParamsSchema = z.object({
  target_employee_id: bigintIdSchema
});

const emergencyCloseBodySchema = z.object({
  reason: z.string().trim().min(1)
});

export const shiftRoutes: FastifyPluginAsync = async (app) => {
  app.post('/shifts/start', async (request) => {
    const actor = await app.requireActor(request);
    return startEmployeeShift(app.db, actor);
  });

  app.post('/shifts/finish', async (request) => {
    const actor = await app.requireActor(request);
    return finishEmployeeShift(app.db, actor);
  });

  app.post('/shifts/:target_employee_id/emergency-close', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseShiftRequestPart(emergencyCloseParamsSchema, request.params);
    const body = parseShiftRequestPart(emergencyCloseBodySchema, request.body);

    return emergencyCloseEmployeeShift(app.db, actor, params.target_employee_id, body.reason);
  });
};

export function parseShiftRequestPart<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid shift request');
  }

  return result.data;
}
