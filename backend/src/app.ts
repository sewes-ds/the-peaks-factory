import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { parseRuntimeEnv, type RuntimeEnv } from './config/env.js';
import { createRedactingLogSecurity } from './logging/redactingLogStream.js';
import { authPlugin } from './plugins/auth.js';
import { adminSessionPlugin } from './plugins/adminSession.js';
import { dbPlugin } from './plugins/db.js';
import { errorPlugin } from './plugins/errors.js';
import { notificationDeliveryPlugin } from './plugins/notificationDelivery.js';
import { notificationScannerPlugin } from './plugins/notificationScanner.js';
import { publicRequestSecurityPlugin } from './plugins/publicRequestSecurity.js';
import { adminCatalogRoutes } from './routes/adminCatalog.js';
import { adminAuthRoutes } from './routes/adminAuth.js';
import { adminTelegramQrAuthRoutes } from './routes/adminTelegramQrAuth.js';
import { adminWebCatalogRoutes } from './routes/adminWebCatalog.js';
import { authRoutes } from './routes/auth.js';
import { appEntrypointRoutes } from './routes/appEntrypoint.js';
import { exportRoutes } from './routes/exports.js';
import { healthRoutes } from './routes/health.js';
import { managerReadModelRoutes } from './routes/managerReadModels.js';
import { notificationRoutes } from './routes/notifications.js';
import { operationRoutes } from './routes/operations.js';
import { operatorReadModelRoutes } from './routes/operatorReadModels.js';
import { productionRoutes } from './routes/production.js';
import { salaryRoutes } from './routes/salary.js';
import { shiftRoutes } from './routes/shifts.js';
import { telegramBotRoutes } from './routes/telegramBot.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: RuntimeEnv;
  }
}

export type BuildAppOptions = {
  env?: NodeJS.ProcessEnv;
};

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = parseRuntimeEnv(options.env);
  const logSecurity = createRedactingLogSecurity();
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      serializers: logSecurity.serializers,
      stream: logSecurity.stream
    }
  });

  app.decorate('config', config);
  await app.register(errorPlugin);
  await app.register(publicRequestSecurityPlugin);
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(adminSessionPlugin);
  await app.register(notificationScannerPlugin);
  await app.register(notificationDeliveryPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminAuthRoutes);
  await app.register(adminTelegramQrAuthRoutes);
  await app.register(adminWebCatalogRoutes);
  await app.register(appEntrypointRoutes);
  await app.register(telegramBotRoutes);
  await app.register(shiftRoutes);
  await app.register(productionRoutes);
  await app.register(operationRoutes);
  await app.register(operatorReadModelRoutes);
  await app.register(managerReadModelRoutes);
  await app.register(adminCatalogRoutes);
  await app.register(salaryRoutes);
  await app.register(notificationRoutes);
  await app.register(exportRoutes);

  return app;
}
