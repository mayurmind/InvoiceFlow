import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
  return parsed.data;
};

export const env = parseEnv();
