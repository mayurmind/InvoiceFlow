import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/database/prisma';
import { UserRole, InvoiceStatus } from '../../src/generated/prisma/client';
import { ClientsRepository } from '../../src/features/clients/clients.repository';
import { InvoicesRepository } from '../../src/features/invoices/invoices.repository';

const testAdminId = '00000000-0000-0000-0000-000000000001';

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: vi.fn((req, _res, next) => {
      req.auth = {
        sessionId: 'mock-session-id',
        user: {
          id: testAdminId,
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.SUPER_ADMIN,
          mustChangePassword: false,
          lastLoginAt: null,
        },
      };
      next();
    }),
  };
});

vi.mock('../../src/features/auth/origin.middleware', () => ({
  originGuard: vi.fn((_req, _res, next) => next()),
}));

vi.mock('../../src/features/auth/csrf.middleware', () => ({
  requireCsrfToken: vi.fn((_req, _res, next) => next()),
}));

describe('Invoices Database Integration - Concurrency & Atomicity', () => {
  let clientId: string;
  let testBusinessSettingsId: string;
  let validPayload: Record<string, unknown>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    testBusinessSettingsId = crypto.randomUUID();
    clientId = crypto.randomUUID();

    validPayload = {
      clientId,
      invoiceDate: '2026-08-16',
      items: [
        {
          description: 'Item A',
          quantity: '2.000',
          rate: '500.00',
          gstRate: '18.00',
        },
      ],
    };

    await prisma.user.upsert({
      where: { id: testAdminId },
      update: {},
      create: {
        id: testAdminId,
        email: 'testadmin-invoices@invoiceflow.com',
        firstName: 'Test',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
        passwordHash: 'dummyhash',
      },
    });

    await prisma.businessSettings.upsert({
      where: { singletonKey: 'DEFAULT' },
      update: {},
      create: {
        id: testBusinessSettingsId,
        singletonKey: 'DEFAULT',
        legalName: 'Test Legal Name',
        displayName: 'Test Display Name',
        addressLine1: 'Test Address Line 1',
        city: 'Test City',
        state: 'Test State',
        postalCode: '123456',
        country: 'India',
        gstin: '27AAAAA0000A1Z5',
        stateCode: '27',
        defaultDueDays: 15,
      },
    });

    await prisma.client.upsert({
      where: { id: clientId },
      update: { isArchived: false },
      create: {
        id: clientId,
        name: 'Test Client',
        addressLine1: 'Test Client Address',
        city: 'Test City',
        state: 'Test State',
        postalCode: '123456',
        country: 'India',
        stateCode: '27',
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Clean up specifically the rows we created
    await prisma.invoiceItem.deleteMany({ where: { invoice: { clientId } } });

    await prisma.$executeRaw`ALTER TABLE public."audit_logs" DISABLE TRIGGER USER`;
    await prisma.auditLog.deleteMany({ where: { actorUserId: testAdminId } });
    await prisma.$executeRaw`ALTER TABLE public."audit_logs" ENABLE TRIGGER USER`;

    await prisma.$executeRaw`ALTER TABLE public."invoices" DISABLE TRIGGER USER`;
    await prisma.invoice.deleteMany({ where: { clientId } });
    await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;

    await prisma.client.deleteMany({ where: { id: clientId } });
    await prisma.businessSettings.deleteMany({ where: { singletonKey: 'DEFAULT' } });
    await prisma.user.deleteMany({ where: { id: testAdminId } });
  });

  it('successful DRAFT creation persists exact rows', async () => {
    const response = await request(app).post('/api/v1/invoices').send(validPayload);
    expect(response.status).toBe(201);

    const invoices = await prisma.invoice.findMany({ include: { items: true } });
    expect(invoices.length).toBe(1);
    const inv = invoices[0];
    expect(inv.items.length).toBe(1);

    const auditLogs = await prisma.auditLog.findMany();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe('INVOICE_CREATED');
    expect(auditLogs[0].entityType).toBe('INVOICE');
    expect(auditLogs[0].entityId).toBe(inv.id);
    expect(auditLogs[0].metadata).toStrictEqual({ itemCount: 1 });
  });

  it('DRAFT lifecycle persists expected nulls', async () => {
    const response = await request(app).post('/api/v1/invoices').send(validPayload);
    expect(response.status).toBe(201);

    const invoices = await prisma.invoice.findMany();
    const inv = invoices[0];

    expect(inv.status).toBe(InvoiceStatus.DRAFT);
    expect(inv.invoiceNumber).toBeNull();
    expect(inv.financialYear).toBeNull();
    expect(inv.businessSnapshot).toBeNull();
    expect(inv.clientSnapshot).toBeNull();
    expect(inv.sentAt).toBeNull();
    expect(inv.sentByUserId).toBeNull();
    expect(inv.cancelledAt).toBeNull();
    expect(inv.cancellationReason).toBeNull();
  });

  it('Invoice item database evidence', async () => {
    const response = await request(app).post('/api/v1/invoices').send(validPayload);
    expect(response.status).toBe(201);

    const items = await prisma.invoiceItem.findMany();
    expect(items.length).toBe(1);
    const item = items[0];

    expect(item.lineNumber).toBe(1);
    expect(item.quantity.toString()).toBe('2'); // Prisma decimal to string
    expect(item.rate.toString()).toBe('500');
    expect(item.discountAmount.toString()).toBe('0');
    expect(item.taxableAmount.toString()).toBe('1000');
    expect(item.gstRate.toString()).toBe('18');
    expect(item.cgstAmount.toString()).toBe('90');
    expect(item.sgstAmount.toString()).toBe('90');
    expect(item.igstAmount.toString()).toBe('0');
    expect(item.totalAmount.toString()).toBe('1180');
  });

  it('Missing Business Settings: 404 NOT_FOUND', async () => {
    await prisma.$executeRaw`TRUNCATE TABLE public."business_settings" CASCADE`;
    const response = await request(app).post('/api/v1/invoices').send(validPayload);
    expect(response.status).toBe(404);

    const invoices = await prisma.invoice.findMany();
    expect(invoices.length).toBe(0);
  });

  it('Missing Client: 404 NOT_FOUND', async () => {
    const response = await request(app)
      .post('/api/v1/invoices')
      .send({
        ...validPayload,
        clientId: '00000000-0000-0000-0000-000000000002',
      });
    expect(response.status).toBe(404);

    const invoices = await prisma.invoice.findMany();
    expect(invoices.length).toBe(0);
  });

  it('Archived Client: 409 CONFLICT', async () => {
    await prisma.client.update({
      where: { id: clientId },
      data: { isArchived: true, archivedAt: new Date() },
    });
    const response = await request(app).post('/api/v1/invoices').send(validPayload);
    expect(response.status).toBe(409);

    const invoices = await prisma.invoice.findMany();
    expect(invoices.length).toBe(0);
  });

  it('InvoiceCalculationError: 400 ValidationError', async () => {
    const response = await request(app)
      .post('/api/v1/invoices')
      .send({
        ...validPayload,
        items: [
          {
            description: 'Item A',
            quantity: '2.000',
            rate: '500.00',
            gstRate: '19.00', // invalid gst rate
          },
        ],
      });
    expect(response.status).toBe(400);

    const invoices = await prisma.invoice.findMany();
    expect(invoices.length).toBe(0);
  });

  it('Item failure rollback: if InvoiceItem insertion fails, no Invoice remains', async () => {
    vi.spyOn(InvoicesRepository, 'createInvoiceItems').mockRejectedValue(
      new Error('Simulated DB Failure'),
    );

    const response = await request(app).post('/api/v1/invoices').send(validPayload);
    expect(response.status).toBe(500);

    const invoices = await prisma.invoice.findMany();
    expect(invoices.length).toBe(0);
    const auditLogs = await prisma.auditLog.findMany();
    expect(auditLogs.length).toBe(0);
    const invoiceItems = await prisma.invoiceItem.findMany();
    expect(invoiceItems.length).toBe(0);

    vi.restoreAllMocks();
  });

  it('Audit failure rollback: if Audit insertion fails, no Invoice remains', async () => {
    vi.spyOn(InvoicesRepository, 'createInvoiceAuditLog').mockRejectedValue(
      new Error('Simulated DB Failure'),
    );

    const response = await request(app).post('/api/v1/invoices').send(validPayload);
    expect(response.status).toBe(500);

    const invoices = await prisma.invoice.findMany();
    expect(invoices.length).toBe(0);
    const auditLogs = await prisma.auditLog.findMany();
    expect(auditLogs.length).toBe(0);
    const invoiceItems = await prisma.invoiceItem.findMany();
    expect(invoiceItems.length).toBe(0);

    vi.restoreAllMocks();
  });

  it('Client concurrency test (Client row-level locking using SELECT ... FOR UPDATE)', async () => {
    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    let locked = false;

    // Hold the transaction open right after the locks are acquired
    const originalCreate = InvoicesRepository.createInvoiceItems;
    vi.spyOn(InvoicesRepository, 'createInvoiceItems').mockImplementation(async (data, tx) => {
      locked = true;
      await lockPromise;
      return originalCreate.call(InvoicesRepository, data, tx);
    });

    // Start request A. It will acquire the client lock, then hang in createInvoiceItems.
    const reqPromiseA = request(app)
      .post('/api/v1/invoices')
      .send(validPayload)
      .then((r) => r);

    // Wait until request A reaches createDraftInvoice
    for (let i = 0; i < 20; i++) {
      if (locked) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(locked).toBe(true);

    let archivedFinished = false;
    // Attempt to archive the client in another connection. This should BLOCK
    // because request A is holding the row-level lock via SELECT ... FOR UPDATE.
    const archivePromise = prisma.$transaction(async (tx) => {
      // simulate the archive update
      await tx.client.update({
        where: { id: clientId },
        data: { isArchived: true, archivedAt: new Date() },
      });
      archivedFinished = true;
    });

    // wait a bit to ensure it's blocked
    await new Promise((r) => setTimeout(r, 200));
    expect(archivedFinished).toBe(false);

    // Release request A's transaction
    resolveLock!();

    await reqPromiseA;
    await archivePromise;
    expect(archivedFinished).toBe(true);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    expect(client?.isArchived).toBe(true);

    vi.restoreAllMocks();
  });

  it('Business Settings lock discipline: lock order is correct', async () => {
    const trace: string[] = [];

    const originalLockClientForLifecycle = ClientsRepository.lockClientForLifecycle;
    vi.spyOn(ClientsRepository, 'lockClientForLifecycle').mockImplementation(async (id, tx) => {
      trace.push('lockClientForLifecycle');
      return originalLockClientForLifecycle.call(ClientsRepository, id, tx);
    });

    const originalQueryRawUnsafe = prisma.$executeRawUnsafe;
    vi.spyOn(prisma, '$executeRawUnsafe').mockImplementation(
      async (query: string, ...values: unknown[]) => {
        if (query.includes('pg_advisory_xact_lock')) {
          trace.push('acquireSingletonLock');
        }
        return originalQueryRawUnsafe.call(prisma, query, ...values);
      },
    );

    await request(app).post('/api/v1/invoices').send(validPayload);

    expect(trace).toEqual(['acquireSingletonLock', 'lockClientForLifecycle']);
    vi.restoreAllMocks();
  });
});
/ /   T e s t   i m p l e m e n t a t i o n s   a d d e d  
 