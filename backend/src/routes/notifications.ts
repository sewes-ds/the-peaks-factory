import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { RuntimeApiFunctionName } from '../db/runtimeApiRegistry.js';
import { ApiError } from '../db/errors.js';
import { assertInternalWorkerToken } from '../auth/internalWorker.js';
import { callNotificationRuntime } from '../services/notifications.js';

const idSchema = z.string().regex(/^[1-9][0-9]*$/);
const textSchema = z.string().trim().min(1);

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  registerNotificationAction(app, '/notifications/:notification_id/sent', 'mark_notification_sent', z.object({ provider_message_id: textSchema }), 'worker');
  registerNotificationAction(app, '/notifications/:notification_id/delivered', 'mark_notification_delivered', undefined, 'worker');
  registerNotificationAction(app, '/notifications/:notification_id/read', 'mark_notification_read', undefined, true);
  registerNotificationAction(app, '/notifications/:notification_id/failed', 'mark_notification_failed', z.object({ error_message: textSchema }), 'worker');
  registerNotificationAction(
    app,
    '/notifications/:notification_id/hide-from-chat',
    'hide_notification_from_chat',
    z.object({ hide_for_employee: z.boolean(), hide_for_admin: z.boolean() }),
    'worker'
  );

  app.post('/notifications/scan-active-downtimes', async (request) => {
    requireInternalWorker(request.headers['x-internal-worker-token'], app.config.INTERNAL_WORKER_TOKEN);
    return callNotificationRuntime(app.db, 'scan_active_downtimes_for_notifications');
  });
};

function registerNotificationAction<TSchema extends z.ZodTypeAny>(
  app: Parameters<FastifyPluginAsync>[0],
  path: string,
  functionName: RuntimeApiFunctionName,
  bodySchema?: TSchema,
  boundary: true | 'worker' | false = false
): void {
  app.post(path, async (request) => {
    if (boundary === true) {
      await app.requireActor(request);
    } else if (boundary === 'worker') {
      requireInternalWorker(request.headers['x-internal-worker-token'], app.config.INTERNAL_WORKER_TOKEN);
    }

    const params = parseNotificationPart(z.object({ notification_id: idSchema }), request.params);
    const body = bodySchema ? parseNotificationPart(bodySchema, request.body) : {};
    return callNotificationRuntime(app.db, functionName, [params.notification_id, ...Object.values(body as Record<string, unknown>)]);
  });
}

export function parseNotificationPart<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, 'bad_request', 'Invalid notification request');
  }

  return result.data;
}

function requireInternalWorker(actualToken: unknown, expectedToken: string): void {
  assertInternalWorkerToken(actualToken, expectedToken);
}
