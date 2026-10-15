import { buildApp } from './app.js';

const app = await buildApp();

const shutdown = async (): Promise<void> => {
  await app.close();
};

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0));
});

await app.listen({
  host: app.config.HOST,
  port: app.config.PORT
});
