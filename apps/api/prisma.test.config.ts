import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { validateSafeTestDatabaseUrl } from './src/config/database-url';

const rawTestDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!rawTestDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required for test database operations.');
}

const testDatabaseUrl = validateSafeTestDatabaseUrl(rawTestDatabaseUrl);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: testDatabaseUrl,
  },
});
