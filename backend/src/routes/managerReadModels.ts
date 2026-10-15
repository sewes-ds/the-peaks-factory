import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../db/errors.js';
import {
  getManagerAdditionalWorks,
  getManagerAdditionalWorkTypesAvailable,
  getManagerCriticalDowntimeTypes,
  getManagerDowntimes,
  getManagerEmployeeCard,
  getManagerEmployeeCompletedWorkCard,
  getManagerEmployeeCompletedWorks,
  getManagerEmployeeSalary,
  getManagerEmployeeSalaryHistory,
  getManagerEmployees,
  getManagerMachineCard,
  getManagerMachineCompletedProductionOperations,
  getManagerMachines,
  getManagerOpenTasks,
  getManagerSalaryCorrectionContext,
  getManagerSalaryCorrectionTypesAvailable,
  getManagerWorkplaceState
} from '../readModels/managerReadModels.js';

const machineIdSchema = z.object({
  machine_id: z.string().regex(/^[1-9][0-9]*$/)
});
const employeeIdSchema = z.object({
  employee_id: z.string().regex(/^[1-9][0-9]*$/)
});
const additionalWorkTypesQuerySchema = z.object({
  employee_id: z.string().regex(/^[1-9][0-9]*$/).optional(),
  additional_work_type_id: z.string().regex(/^[1-9][0-9]*$/).optional()
}).refine(
  (value) => value.additional_work_type_id === undefined || value.employee_id !== undefined,
  { message: 'employee_id is required with additional_work_type_id' }
);
const completedWorkCardSchema = z.object({
  employee_id: z.string().regex(/^[1-9][0-9]*$/),
  work_type: z.enum(['production', 'additional_work']),
  operation_id: z.string().regex(/^[1-9][0-9]*$/)
});
const periodQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'last_30_days']).default('today'),
  type: z.enum(['all', 'production', 'additional_work']).default('all')
});
const machinePeriodQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'last_30_days']).default('today')
});

export const managerReadModelRoutes: FastifyPluginAsync = async (app) => {
  app.get('/manager/workplace-state', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerWorkplaceState(app.db, actor);
  });

  app.get('/manager/machines', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerMachines(app.db, actor);
  });

  app.get('/manager/machines/:machine_id/completed-production-operations', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseManagerReadModelParams(machineIdSchema, request.params);
    const query = parseManagerReadModelParams(machinePeriodQuerySchema, request.query);
    return getManagerMachineCompletedProductionOperations(app.db, actor, params.machine_id, query.period);
  });

  app.get('/manager/machines/:machine_id', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseManagerReadModelParams(machineIdSchema, request.params);
    return getManagerMachineCard(app.db, actor, params.machine_id);
  });

  app.get('/manager/downtimes', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerDowntimes(app.db, actor);
  });

  app.get('/manager/downtime-types/critical', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerCriticalDowntimeTypes(app.db, actor);
  });

  app.get('/manager/additional-works', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerAdditionalWorks(app.db, actor);
  });

  app.get('/manager/additional-work-types/available', async (request) => {
    const actor = await app.requireActor(request);
    const query = parseManagerReadModelParams(additionalWorkTypesQuerySchema, request.query);
    return getManagerAdditionalWorkTypesAvailable(
      app.db,
      actor,
      query.employee_id,
      query.additional_work_type_id
    );
  });

  app.get('/manager/notifications/open-tasks', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerOpenTasks(app.db, actor);
  });

  app.get('/manager/employees', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerEmployees(app.db, actor);
  });

  app.get('/manager/salary-correction-context', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerSalaryCorrectionContext(app.db, actor);
  });

  app.get('/manager/salary-correction-types/available', async (request) => {
    const actor = await app.requireActor(request);
    return getManagerSalaryCorrectionTypesAvailable(app.db, actor);
  });

  app.get('/manager/employees/:employee_id/completed-works/:work_type/:operation_id', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseManagerReadModelParams(completedWorkCardSchema, request.params);
    return getManagerEmployeeCompletedWorkCard(
      app.db,
      actor,
      params.employee_id,
      params.work_type,
      params.operation_id
    );
  });

  app.get('/manager/employees/:employee_id/completed-works', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseManagerReadModelParams(employeeIdSchema, request.params);
    const query = parseManagerReadModelParams(periodQuerySchema, request.query);
    return getManagerEmployeeCompletedWorks(app.db, actor, params.employee_id, query.period, query.type);
  });

  app.get('/manager/employees/:employee_id/salary/history', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseManagerReadModelParams(employeeIdSchema, request.params);
    return getManagerEmployeeSalaryHistory(app.db, actor, params.employee_id);
  });

  app.get('/manager/employees/:employee_id/salary', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseManagerReadModelParams(employeeIdSchema, request.params);
    return getManagerEmployeeSalary(app.db, actor, params.employee_id);
  });

  app.get('/manager/employees/:employee_id', async (request) => {
    const actor = await app.requireActor(request);
    const params = parseManagerReadModelParams(employeeIdSchema, request.params);
    return getManagerEmployeeCard(app.db, actor, params.employee_id);
  });
};

function parseManagerReadModelParams<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid manager read-model request');
  }

  return result.data;
}
