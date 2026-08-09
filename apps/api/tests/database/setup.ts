import 'dotenv/config';
import { afterAll, beforeAll } from 'vitest';
import { validateSafeTestDatabaseUrl } from '../../src/config/database-url';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://runtime:runtime@localhost:5432/invoiceflow_dev';
process.env.PORT ??= '5000';
process.env.HOST ??= '127.0.0.1';
process.env.LOG_LEVEL ??= 'silent';
process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost:3000';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for database integration tests.');
}

validateSafeTestDatabaseUrl(testDatabaseUrl);

beforeAll(async () => {
  const { connectDatabase } = await import('../../src/database/prisma');
  await connectDatabase();
});

afterAll(async () => {
  const { disconnectDatabase } = await import('../../src/database/prisma');
  await disconnectDatabase();
});
