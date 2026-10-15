import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { RuntimeApiFunctionName } from '../db/runtimeApiRegistry.js';
import { ApiError } from '../db/errors.js';
import { callExportRuntime } from '../services/exports.js';

const idSchema = z.string().regex(/^[1-9][0-9]*$/);
const dateSchema = z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
const textSchema = z.string().trim().min(1);

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.post('/exports/google-sheets', async (request) => {
    const actor = await app.requireActor(request);
    const body = parseExportPart(
      z.object({
        export_type: z.literal('management_mvp_export'),
        from_date: dateSchema,
        to_date: dateSchema
      }),
      request.body
    );
    return callExportRuntime(app.db, actor, 'create_google_sheets_export_run', [
      body.export_type,
      body.from_date,
      body.to_date
    ]);
  });

  registerExportAction(app, '/exports/google-sheets/:export_run_id/success', 'finish_google_sheets_export_run_success', z.object({ sheet_url: textSchema }));
  registerExportAction(app, '/exports/google-sheets/:export_run_id/failed', 'finish_google_sheets_export_run_failed', z.object({ error_message: textSchema }));
  registerExportAction(app, '/exports/google-sheets/:export_run_id/cancel', 'cancel_google_sheets_export_run');
};

function registerExportAction<TSchema extends z.ZodTypeAny>(
  app: Parameters<FastifyPluginAsync>[0],
  path: string,
  functionName: RuntimeApiFunctionName,
  bodySchema?: TSchema
): void {
  app.post(path, async (request) => {
    const actor = await app.requireActor(request);
    const params = parseExportPart(z.object({ export_run_id: idSchema }), request.params);
    const body = bodySchema ? parseExportPart(bodySchema, request.body) : {};
    return callExportRuntime(app.db, actor, functionName, [params.export_run_id, ...Object.values(body as Record<string, unknown>)]);
  });
}

export function parseExportPart<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid export request');
  }

  return result.data;
}
