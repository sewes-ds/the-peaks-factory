import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { callNotificationRuntime } from '../services/notifications.js';
import {
  createNotificationScanner,
  type NotificationScannerStatus
} from '../services/notificationScanner.js';

declare module 'fastify' {
  interface FastifyInstance {
    notificationScannerStatus: () => NotificationScannerStatus;
  }
}

export const notificationScannerPlugin: FastifyPluginAsync = fp(async (app) => {
  const enabled = app.config.APP_ENV === 'production' || app.config.APP_ENV === 'staging';
  const scanner = createNotificationScanner({
    scan: () => callNotificationRuntime(app.db, 'scan_active_downtimes_for_notifications'),
    onSuccess: (status) => {
      app.log.info({ notificationScanner: status }, 'notification downtime scan completed');
    },
    onFailure: (error, status) => {
      app.log.error({ err: error, notificationScanner: status }, 'notification downtime scan failed');
    }
  });

  app.decorate('notificationScannerStatus', scanner.status);
  if (enabled) scanner.start();
  app.addHook('onClose', async () => {
    scanner.stop();
  });
});
