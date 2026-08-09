import { z } from 'zod';
import { resolveRuntimeDatabaseUrl } from './database-url';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL is required' })
    .min(1, 'DATABASE_URL cannot be empty')
    .refine((url) => url.startsWith('postgresql://') || url.startsWith('postgres://'), {
      message: 'DATABASE_URL must be a valid PostgreSQL connection string',
    }),
  TEST_DATABASE_URL: z.string().optional(),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 65535, {
      message: 'PORT must be a valid port number',
    })
    .default('5000'),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(1, 'CORS_ALLOWED_ORIGINS cannot be empty')
    .transform((val) => val.split(',').map((origin) => origin.trim())),
});

export const parseEnv = (environment: NodeJS.ProcessEnv = process.env) => {
  const parsed = envSchema.safeParse(environment);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  try {
    const { TEST_DATABASE_URL: testDatabaseUrl, ...parsedEnvironment } = parsed.data;

    const databaseUrl = resolveRuntimeDatabaseUrl({
      nodeEnv: parsedEnvironment.NODE_ENV,
      databaseUrl: parsedEnvironment.DATABASE_URL,
      testDatabaseUrl,
    });

    return {
      ...parsedEnvironment,
      DATABASE_URL: databaseUrl,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      '❌ Invalid database configuration:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exit(1);
  }
};

export const env = parseEnv();
