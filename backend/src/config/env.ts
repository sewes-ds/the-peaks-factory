import { z } from 'zod';
import {
  parsePublicBaseUrl,
  type AppEnvironment,
  type PublicUrlConfig
} from './publicBaseUrl.js';

const runtimeEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{1,28}bot$/i),
  TELEGRAM_BOT_WEBHOOK_SECRET_TOKEN: z.string().min(32),
  TELEGRAM_BOT_WEBHOOK_PATH_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().min(1),
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().min(1).default(86400),
  TELEGRAM_SELF_BINDING_TOKEN_SECRET: z.string().min(32),
  TELEGRAM_SELF_BINDING_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  INTERNAL_WORKER_TOKEN: z.string().min(1)
});

type ParsedRuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export type RuntimeEnv = Omit<ParsedRuntimeEnv, keyof PublicUrlConfig> & PublicUrlConfig;

export function parseRuntimeEnv(source: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  if (source.TELEGRAM_MINI_APP_PUBLIC_URL !== undefined) {
    throw new Error('TELEGRAM_MINI_APP_PUBLIC_URL is not supported; configure PUBLIC_BASE_URL only');
  }

  const env = runtimeEnvSchema.parse(source);
  assertRuntimeDatabaseUrl(env.DATABASE_URL);
  const publicUrl = parsePublicBaseUrl(env.PUBLIC_BASE_URL, env.APP_ENV);
  return { ...env, ...publicUrl };
}

export function assertRuntimeDatabaseUrl(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);

  if (parsed.username !== 'app_runtime_role') {
    throw new Error('DATABASE_URL must use app_runtime_role for backend runtime');
  }
}

export function assertPublicBaseUrl(publicUrl: string, appEnv: AppEnvironment): void {
  parsePublicBaseUrl(publicUrl, appEnv);
}
