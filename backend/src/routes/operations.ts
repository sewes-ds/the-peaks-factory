import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../db/errors.js';
import {
  accrueAdditionalWorkSalary,
  approveAdditionalWorkRequest,
  assignAdditionalWork,
  cancelAdditionalWork,
  cancelMachineDowntime,
  emergencyFinishOperatorBreak,
  finishAdditionalWork,
  finishMachineDowntime,
  finishOperatorBreak,
  markAdditionalWorkWithoutAccrual,
  rejectAdditionalWorkRequest,
  requestAdditionalWork,
  startAdditionalWork,
  startMachineDowntime,
  startOperatorBreak
} from '../services/operations.js';

const idSchema = z.string().regex(/^[1-9][0-9]*$/);
const numericSchema = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const optionalCommentSchema = z.object({
  comment: z.string().trim().min(1).nullable().optional(),
  reason: z.string().trim().min(1).nullable().optional()
});
const reasonSchema = z.object({ reason: z.string().trim().min(1) });

export const operationRoutes: FastifyPluginAsync = async (app) => {
  app.post('/machine-downtimes/start', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseOperationRequestPart(
      z.object({
        machine_id: idSchema,
        downtime_type_id: idSchema,
        production_operation_id: idSchema.nullable().optional(),
        comment: z.string().trim().min(1).nullable().optional()
      }),
      request.body
    );
    return startMachineDowntime(app.db, actor, {
      machineId: body.machine_id,
      productionOperationId: body.production_operation_id,
      downtimeTypeId: body.downtime_type_id,
      comment: body.comment ?? null
    });
  });

  app.post('/machine-downtimes/:downtime_id/finish', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ downtime_id: idSchema }), request.params);
    const body = parseOperationRequestPart(optionalCommentSchema, request.body);
    return finishMachineDowntime(app.db, actor, params.downtime_id, body.comment ?? null, body.reason ?? body.comment ?? null);
  });

  app.post('/machine-downtimes/:downtime_id/cancel', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ downtime_id: idSchema }), request.params);
    const body = parseOperationRequestPart(reasonSchema, request.body);
    return cancelMachineDowntime(app.db, actor, params.downtime_id, body.reason);
  });

  app.post('/operator-breaks/start', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseOperationRequestPart(z.object({ break_type_id: idSchema }), request.body);
    return startOperatorBreak(app.db, actor, body.break_type_id);
  });

  app.post('/operator-breaks/finish', async (request) => {
    const actor = await app.requireActor(request);
    return finishOperatorBreak(app.db, actor);
  });

  app.post('/operator-breaks/:target_employee_id/emergency-finish', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ target_employee_id: idSchema }), request.params);
    const body = parseOperationRequestPart(reasonSchema, request.body);
    return emergencyFinishOperatorBreak(app.db, actor, params.target_employee_id, body.reason);
  });

  app.post('/additional-works/assign', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseOperationRequestPart(
      z.object({ employee_id: idSchema, additional_work_type_id: idSchema }),
      request.body
    );
    return assignAdditionalWork(app.db, actor, body.employee_id, body.additional_work_type_id);
  });

  app.post('/additional-works/request', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseOperationRequestPart(z.object({ additional_work_type_id: idSchema }), request.body);
    return requestAdditionalWork(app.db, actor, body.additional_work_type_id);
  });

  app.post('/additional-works/:additional_work_id/start', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ additional_work_id: idSchema }), request.params);
    return startAdditionalWork(app.db, actor, params.additional_work_id);
  });

  app.post('/additional-works/:additional_work_id/finish', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ additional_work_id: idSchema }), request.params);
    const body = parseOperationRequestPart(optionalCommentSchema, request.body);
    return finishAdditionalWork(app.db, actor, params.additional_work_id, body.comment ?? null);
  });

  app.post('/additional-works/:additional_work_id/approve-request', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ additional_work_id: idSchema }), request.params);
    const body = parseOperationRequestPart(optionalCommentSchema, request.body);
    return approveAdditionalWorkRequest(app.db, actor, params.additional_work_id, body.comment ?? null);
  });

  app.post('/additional-works/:additional_work_id/reject-request', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ additional_work_id: idSchema }), request.params);
    const body = parseOperationRequestPart(reasonSchema, request.body);
    return rejectAdditionalWorkRequest(app.db, actor, params.additional_work_id, body.reason);
  });

  app.post('/additional-works/:additional_work_id/cancel', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ additional_work_id: idSchema }), request.params);
    const body = parseOperationRequestPart(reasonSchema, request.body);
    return cancelAdditionalWork(app.db, actor, params.additional_work_id, body.reason);
  });

  app.post('/additional-works/:additional_work_id/mark-without-accrual', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ additional_work_id: idSchema }), request.params);
    const body = parseOperationRequestPart(reasonSchema, request.body);
    return markAdditionalWorkWithoutAccrual(app.db, actor, params.additional_work_id, body.reason);
  });

  app.post('/additional-works/:additional_work_id/accrue-salary', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseOperationRequestPart(z.object({ additional_work_id: idSchema }), request.params);
    const body = parseOperationRequestPart(
      z.object({ amount_uzs: numericSchema, quantity: numericSchema.nullable().optional() }),
      request.body
    );
    return accrueAdditionalWorkSalary(app.db, actor, {
      additionalWorkId: params.additional_work_id,
      amountUzs: body.amount_uzs,
      quantity: body.quantity ?? null
    });
  });
};

export function parseOperationRequestPart<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid operation request');
  }

  return result.data;
}
