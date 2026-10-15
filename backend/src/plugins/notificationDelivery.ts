import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { runOwnedNotificationDeliveryCycle } from '../services/notificationDelivery.js';
import {
  createNotificationDeliveryWorker,
  type NotificationDeliveryWorkerStatus
} from '../services/notificationDeliveryWorker.js';
import { createTelegramNotificationProvider } from '../services/telegramNotificationProvider.js';

declare module 'fastify' {
  interface FastifyInstance {
    notificationDeliveryStatus: () => NotificationDeliveryWorkerStatus;
  }
}

export const notificationDeliveryPlugin: FastifyPluginAsync = fp(async (app) => {
  const enabled = app.config.APP_ENV === 'production' || app.config.APP_ENV === 'staging';
  const provider = createTelegramNotificationProvider({ botToken: app.config.TELEGRAM_BOT_TOKEN });
  const worker = createNotificationDeliveryWorker({
    deliver: () => runOwnedNotificationDeliveryCycle(app.db, provider),
    onSuccess: (status) => {
      const result = status.lastResult;
      if (result && (result.sent > 0 || result.hidden > 0 || result.sendFailed > 0 || result.hideFailed > 0)) {
        app.log.info({ notificationDelivery: status }, 'notification delivery cycle completed');
      }
    },
    onFailure: (status) => {
      app.log.error({ notificationDelivery: status }, 'notification delivery cycle failed');
    }
  });

  app.decorate('notificationDeliveryStatus', worker.status);
  if (enabled) {
    app.addHook('onReady', async () => {
      worker.start();
    });
  }
  app.addHook('onClose', async () => {
    await worker.stop();
  });
});
