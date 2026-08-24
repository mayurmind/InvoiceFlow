import { z } from 'zod';
import { resolveRuntimeDatabaseUrl } from './database-url';
import { parseDurationToMs } from '../utilities/duration';

const envSchema = z
  .object({
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
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ALLOWED_ORIGINS: z
      .string()
      .min(1, 'CORS_ALLOWED_ORIGINS cannot be empty')
      .transform((val) => val.split(',').map((origin) => origin.trim())),
    ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters'),
    REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
    CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z
      .string()
      .default('15m')
      .refine(
        (val) => {
          try {
            const ms = parseDurationToMs(val);
            return ms >= 60 * 1000 && ms <= 24 * 60 * 60 * 1000;
          } catch {
            return false;
          }
        },
        { message: 'ACCESS_TOKEN_TTL must be between 1m and 24h and use strict format' },
      ),
    REFRESH_TOKEN_TTL: z
      .string()
      .default('7d')
      .refine(
        (val) => {
          try {
            const ms = parseDurationToMs(val);
            return ms >= 60 * 60 * 1000 && ms <= 30 * 24 * 60 * 60 * 1000;
          } catch {
            return false;
          }
        },
        { message: 'REFRESH_TOKEN_TTL must be between 1h and 30d and use strict format' },
      ),
    JWT_ISSUER: z.string().default('invoiceflow-api'),
    JWT_AUDIENCE: z.string().default('invoiceflow-web'),
    EMAIL_PROVIDER: z.enum(['mock', 'resend']).default('mock'),
    EMAIL_API_KEY: z.string().optional(),
    EMAIL_FROM_ADDRESS: z
      .string({ required_error: 'EMAIL_FROM_ADDRESS is required' })
      .email('EMAIL_FROM_ADDRESS must be a valid email')
      .max(320)
      .refine((val) => !/[\r\n]/.test(val), { message: 'CR/LF forbidden' }),
    EMAIL_FROM_NAME: z
      .string({ required_error: 'EMAIL_FROM_NAME is required' })
      .trim()
      .min(1)
      .max(100)
      .refine((val) => !/[\r\n]/.test(val), { message: 'CR/LF forbidden' }),
  })
  .superRefine((data, ctx) => {
    try {
      const accessMs = parseDurationToMs(data.ACCESS_TOKEN_TTL);
      const refreshMs = parseDurationToMs(data.REFRESH_TOKEN_TTL);
      if (refreshMs <= accessMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'REFRESH_TOKEN_TTL must be strictly greater than ACCESS_TOKEN_TTL',
          path: ['REFRESH_TOKEN_TTL'],
        });
      }
    } catch {
      // Errors are already caught by individual field refinement
    }

    if (data.NODE_ENV === 'production' && data.EMAIL_PROVIDER !== 'resend') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'EMAIL_PROVIDER must be resend in production',
        path: ['EMAIL_PROVIDER'],
      });
    }
    if (
      (data.NODE_ENV === 'test' || data.NODE_ENV === 'development') &&
      data.EMAIL_PROVIDER !== 'mock'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'EMAIL_PROVIDER must be mock in test and development environments',
        path: ['EMAIL_PROVIDER'],
      });
    }
    if (
      data.EMAIL_PROVIDER === 'resend' &&
      (!data.EMAIL_API_KEY || data.EMAIL_API_KEY.trim() === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'EMAIL_API_KEY is required and non-empty when provider is resend',
        path: ['EMAIL_API_KEY'],
      });
    }
  });

export const parseEnv = (environment: NodeJS.ProcessEnv = process.env) => {
  const envToParse = { ...environment };

  if (envToParse.NODE_ENV === 'test' || envToParse.NODE_ENV === 'development') {
    envToParse.EMAIL_FROM_ADDRESS = envToParse.EMAIL_FROM_ADDRESS || 'test@invoiceflow.local';
    envToParse.EMAIL_FROM_NAME = envToParse.EMAIL_FROM_NAME || 'Test Sender';
    envToParse.EMAIL_API_KEY = envToParse.EMAIL_API_KEY || 're_dummy_test_key_only';
  }

  const parsed = envSchema.safeParse(envToParse);
  if (!parsed.success) {
    const errorMsg =
      '❌ Invalid environment variables: ' +
      JSON.stringify(parsed.error.flatten().fieldErrors) +
      '\n';
    process.stderr.write(errorMsg);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write('❌ Invalid database configuration: ' + errorMessage + '\n');
    process.exit(1);
  }
};

export const env = parseEnv();
