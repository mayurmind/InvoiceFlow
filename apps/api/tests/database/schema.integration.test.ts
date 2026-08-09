import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/database/prisma';

describe('Database Schema & Catalog Integration', () => {
  it('DB-01: Connects strictly to invoiceflow_test database', async () => {
    const result = await prisma.$queryRaw<
      { current_database: string }[]
    >`SELECT current_database();`;
    expect(result[0].current_database).toBe('invoiceflow_test');
  });

  it('DB-02: Contains frozen migration history', async () => {
    const migrations = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date; rolled_back_at: Date }[]
    >`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY started_at ASC;
    `;

    expect(migrations.length).toBe(2);

    expect(migrations[0].migration_name).toBe('20260808090814_init_database_foundation');
    expect(migrations[0].finished_at).not.toBeNull();
    expect(migrations[0].rolled_back_at).toBeNull();

    expect(migrations[1].migration_name).toBe('20260808094134_add_database_integrity_protections');
    expect(migrations[1].finished_at).not.toBeNull();
    expect(migrations[1].rolled_back_at).toBeNull();
  });

  it('DB-03: Contains 10 core tables', async () => {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename != '_prisma_migrations'
      ORDER BY tablename ASC;
    `;

    const tableNames = tables.map((t) => t.tablename);
    const expectedTables = [
      'audit_logs',
      'business_settings',
      'clients',
      'email_deliveries',
      'invoice_counters',
      'invoice_items',
      'invoices',
      'payments',
      'sessions',
      'users',
    ];

    expectedTables.forEach((t) => expect(tableNames).toContain(t));
    expect(tableNames.length).toBe(10);
  });

  it('DB-04: Contains 5 custom enum types', async () => {
    const enums = await prisma.$queryRaw<{ typname: string }[]>`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typtype = 'e';
    `;

    const enumNames = enums.map((e) => e.typname);
    const expectedEnums = [
      'UserRole',
      'InvoiceStatus',
      'PaymentMethod',
      'PaymentStatus',
      'EmailDeliveryStatus',
    ];

    expectedEnums.forEach((e) => expect(enumNames).toContain(e));
    expect(enumNames.length).toBe(5);
  });

  it('DB-05: Contains 19 exact CHECK constraints', async () => {
    const checks = await prisma.$queryRaw<{ conname: string }[]>`
      SELECT conname
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.contype = 'c'
        AND n.nspname = 'public';
    `;

    const checkNames = checks.map((c) => c.conname);
    const expectedChecks = [
      'sessions_expiresat_check',
      'business_settings_defaultduedays_check',
      'business_settings_singletonkey_check',
      'business_settings_invoiceprefix_check',
      'clients_isarchived_check',
      'invoices_duedate_check',
      'invoices_financials_positive_check',
      'invoices_discount_check',
      'invoices_total_match_check',
      'invoices_snapshot_version_check',
      'invoices_lifecycle_check',
      'invoice_items_numeric_check',
      'invoice_counters_sequence_check',
      'invoice_counters_prefix_check',
      'invoice_counters_financialyear_check',
      'payments_amount_check',
      'payments_status_check',
      'email_deliveries_attempt_check',
      'email_deliveries_status_check',
    ];

    expect([...checkNames].sort()).toEqual([...expectedChecks].sort());
  });

  it('DB-06: Contains 3 trigger functions', async () => {
    const functions = await prisma.$queryRaw<{ proname: string }[]>`
      SELECT proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'protect_financial_record_delete',
          'protect_audit_log_mutation',
          'protect_invoice_item_mutation'
        );
    `;

    const functionNames = functions.map((f) => f.proname);
    expect(functionNames).toContain('protect_financial_record_delete');
    expect(functionNames).toContain('protect_audit_log_mutation');
    expect(functionNames).toContain('protect_invoice_item_mutation');
    expect(functionNames.length).toBe(3);
  });

  it('DB-07: Contains 5 non-internal triggers', async () => {
    const triggers = await prisma.$queryRaw<{ tgname: string }[]>`
      SELECT tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND t.tgisinternal = false;
    `;

    const triggerNames = triggers.map((t) => t.tgname);
    expect(triggerNames).toContain('protect_invoices_delete');
    expect(triggerNames).toContain('protect_payments_delete');
    expect(triggerNames).toContain('protect_email_deliveries_delete');
    expect(triggerNames).toContain('protect_audit_logs_mutation');
    expect(triggerNames).toContain('protect_invoice_items_mutation');
    expect(triggerNames.length).toBe(5);
  });
});
