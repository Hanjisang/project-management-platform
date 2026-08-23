import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().url().optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_PATH: z.string().default('./storage'),
  AI_ENABLED: z.enum(['true', 'false']).default('false'),
  AI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-5-mini'),
  AI_FAKE_ENABLED: z.enum(['true', 'false']).default('false'),
  DINGTALK_APP_KEY: z.string().optional(),
  DINGTALK_APP_SECRET: z.string().optional(),
  DINGTALK_SIGNING_SECRET: z.string().optional(),
  DINGTALK_STREAM_ENABLED: z.enum(['true', 'false']).default('false'),
  ZENTAO_BASE_URL: optionalUrl,
  ZENTAO_TOKEN: z.string().optional(),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
});

export function validateEnvironment(input: Record<string, unknown>): Record<string, unknown> {
  return schema.parse(input);
}
