import 'dotenv/config';
import { validateSafeTestDatabaseUrl } from '../../src/config/database-url';
import { Client } from 'pg';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://runtime:runtime@localhost:5432/invoiceflow_dev';
process.env.PORT ??= '5000';
process.env.HOST ??= '127.0.0.1';
process.env.LOG_LEVEL ??= 'silent';
process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost:3000';

let globalSetupCompleted = false;
let preSuiteCounts: Record<string, number> = {};

export function assertCleanPreSuiteCounts(counts: Record<string, number>, tables: string[]) {
  const contaminated: string[] = [];
  for (const table of tables) {
    if (counts[table] > 0) {
      contaminated.push(`Table '${table}' contains ${counts[table]} unexpected persistent rows.`);
    }
  }

  if (contaminated.length > 0) {
    throw new Error(
      `PRE-SUITE DATABASE CONTAMINATION:\n${contaminated.join('\n')}\nClean invoiceflow_test before running database integration tests.`,
    );
  }
}

const CORE_TABLES = [
  'users',
  'sessions',
  'business_settings',
  'clients',
  'invoices',
  'invoice_items',
  'invoice_counters',
  'payments',
  'email_deliveries',
  'audit_logs',
];

async function getTableCounts(client: Client): Promise<Record<string, number>> {
  const result = await client.query<{
    users: number;
    sessions: number;
    business_settings: number;
    clients: number;
    invoices: number;
    invoice_items: number;
    invoice_counters: number;
    payments: number;
    email_deliveries: number;
    audit_logs: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM public."users") AS users,
      (SELECT COUNT(*)::int FROM public."sessions") AS sessions,
      (SELECT COUNT(*)::int FROM public."business_settings") AS business_settings,
      (SELECT COUNT(*)::int FROM public."clients") AS clients,
      (SELECT COUNT(*)::int FROM public."invoices") AS invoices,
      (SELECT COUNT(*)::int FROM public."invoice_items") AS invoice_items,
      (SELECT COUNT(*)::int FROM public."invoice_counters") AS invoice_counters,
      (SELECT COUNT(*)::int FROM public."payments") AS payments,
      (SELECT COUNT(*)::int FROM public."email_deliveries") AS email_deliveries,
      (SELECT COUNT(*)::int FROM public."audit_logs") AS audit_logs
  `);

  return result.rows[0] as unknown as Record<string, number>;
}

export async function setup() {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for global database setup.');
  }

  validateSafeTestDatabaseUrl(testDatabaseUrl);

  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();

  try {
    const dbResult = await client.query('SELECT current_database()');
    const currentDb = dbResult.rows[0].current_database;

    if (currentDb !== 'invoiceflow_test') {
      throw new Error(
        `Global setup safety check failed: Expected invoiceflow_test, got ${currentDb}`,
      );
    }

    preSuiteCounts = await getTableCounts(client);
    assertCleanPreSuiteCounts(preSuiteCounts, CORE_TABLES);

    globalSetupCompleted = true;
  } finally {
    await client.end();
  }
}

export async function teardown() {
  if (!globalSetupCompleted) {
    return;
  }

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for global database teardown.');
  }

  validateSafeTestDatabaseUrl(testDatabaseUrl);

  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();

  try {
    const dbResult = await client.query('SELECT current_database()');
    const currentDb = dbResult.rows[0].current_database;

    if (currentDb !== 'invoiceflow_test') {
      throw new Error(
        `Global teardown safety check failed: Expected invoiceflow_test, got ${currentDb}`,
      );
    }

    const postSuiteCounts = await getTableCounts(client);

    for (const table of CORE_TABLES) {
      if (preSuiteCounts[table] !== postSuiteCounts[table]) {
        throw new Error(
          `SUITE ISOLATION FAILURE: Table '${table}' count changed from ${preSuiteCounts[table]} to ${postSuiteCounts[table]}. ` +
            `A database test failed to roll back its persistent data.`,
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      '\n✅ SUITE ISOLATION PASS: All 10 application-table row counts equal the pre-suite snapshot (Persistent row delta: 0).',
    );
  } finally {
    await client.end();
  }
}
