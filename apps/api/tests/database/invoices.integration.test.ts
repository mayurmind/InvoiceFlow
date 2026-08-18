import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/database/prisma';
import { UserRole, InvoiceStatus } from '../../src/generated/prisma/client';
import { ClientsRepository } from '../../src/features/clients/clients.repository';
import { InvoicesRepository } from '../../src/features/invoices/invoices.repository';
import { InvoicesService } from '../../src/features/invoices/invoices.service';
import { InvoiceUpdatePayload } from '../../src/features/invoices/invoices.types';

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

describe('P5.4 DB: Persistence, Locking, Concurrency', () => {
  let clientId1: string;
  let clientId2: string;

  const cleanup = async () => {
    if (clientId1 && clientId2) {
      await prisma.$executeRaw`ALTER TABLE public."audit_logs" DISABLE TRIGGER USER`;
      try {
        await prisma.auditLog.deleteMany({ where: { actorUserId: testAdminId } });
      } finally {
        await prisma.$executeRaw`ALTER TABLE public."audit_logs" ENABLE TRIGGER USER`;
      }

      await prisma.$executeRaw`ALTER TABLE public."invoices" DISABLE TRIGGER USER`;
      await prisma.$executeRaw`ALTER TABLE public."invoice_items" DISABLE TRIGGER USER`;
      try {
        await prisma.invoiceItem.deleteMany({
          where: { invoice: { clientId: { in: [clientId1, clientId2] } } },
        });
        await prisma.invoice.deleteMany({ where: { clientId: { in: [clientId1, clientId2] } } });
      } finally {
        try {
          await prisma.$executeRaw`ALTER TABLE public."invoice_items" ENABLE TRIGGER USER`;
        } finally {
          await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;
        }
      }

      await prisma.client.deleteMany({ where: { id: { in: [clientId1, clientId2] } } });
      await prisma.businessSettings.deleteMany({ where: { singletonKey: 'DEFAULT' } });
    }
    clientId1 = randomUUID();
    clientId2 = randomUUID();
  };
  let testBusinessSettingsId: string;
  let validCreatePayload: Record<string, unknown>;
  const auditCtx = { ipAddress: '127.0.0.1', userAgent: 'test', requestId: 'test-req-id' };

  beforeEach(async () => {
    vi.restoreAllMocks();
    clientId1 = crypto.randomUUID();
    clientId2 = crypto.randomUUID();
    testBusinessSettingsId = crypto.randomUUID();

    validCreatePayload = {
      clientId: clientId1,
      invoiceDate: '2026-08-16',
      items: [{ description: 'Item 1', quantity: '2.000', rate: '500.00', gstRate: '18.00' }],
    };

    await prisma.user.upsert({
      where: { id: testAdminId },
      update: {},
      create: {
        id: testAdminId,
        email: 'test-db@invoiceflow.com',
        firstName: 'T',
        lastName: 'A',
        role: UserRole.SUPER_ADMIN,
        passwordHash: 'hash',
      },
    });

    await prisma.businessSettings.upsert({
      where: { singletonKey: 'DEFAULT' },
      update: { defaultDueDays: 15, stateCode: '27' },
      create: {
        id: testBusinessSettingsId,
        singletonKey: 'DEFAULT',
        legalName: 'LN',
        displayName: 'DN',
        addressLine1: 'A1',
        city: 'C',
        state: 'S',
        postalCode: '111',
        country: 'India',
        gstin: '27AAAAA0000A1Z5',
        stateCode: '27',
        defaultDueDays: 15,
      },
    });

    await prisma.client.createMany({
      data: [
        {
          id: clientId1,
          name: 'Client 1',
          addressLine1: 'A',
          city: 'C',
          state: 'S',
          postalCode: '11',
          country: 'India',
          stateCode: '27',
        },
        {
          id: clientId2,
          name: 'Client 2',
          addressLine1: 'A',
          city: 'C',
          state: 'S',
          postalCode: '11',
          country: 'India',
          stateCode: '29',
        },
      ],
    });
  });

  afterEach(async () => {
    await cleanup();
    await prisma.user.deleteMany({ where: { id: testAdminId } });
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.user.deleteMany({ where: { id: testAdminId } });
  });

  async function createDraft(overrides: Record<string, unknown> = {}) {
    return InvoicesService.createInvoice(
      testAdminId,
      { ...validCreatePayload, ...overrides },
      auditCtx,
    );
  }

  function getUpdatePayload(
    inv: {
      clientId: string;
      invoiceDate: Date | string;
      dueDate: Date | string | null;
      notes: string | null;
      terms: string | null;
      placeOfSupplyStateCode: string;
      items: Array<{
        description: string;
        sacCode: string | null;
        quantity: string | number;
        rate: string | number;
        discountAmount: string | number;
        gstRate: string | number;
      }>;
    },
    overrides: Record<string, unknown> = {},
  ) {
    return {
      clientId: inv.clientId,
      invoiceDate:
        typeof inv.invoiceDate === 'string'
          ? inv.invoiceDate
          : inv.invoiceDate.toISOString().split('T')[0],
      dueDate: inv.dueDate
        ? typeof inv.dueDate === 'string'
          ? inv.dueDate
          : inv.dueDate.toISOString().split('T')[0]
        : null,
      notes: inv.notes,
      terms: inv.terms,
      placeOfSupplyStateCode: inv.placeOfSupplyStateCode,
      items: inv.items.map((i) => ({
        description: i.description,
        sacCode: i.sacCode,
        quantity: i.quantity.toString(),
        rate: i.rate.toString(),
        discountAmount: i.discountAmount.toString(),
        gstRate: i.gstRate.toString(),
      })),
      ...overrides,
    };
  }

  it('A/B - List persistence and count consistency', async () => {
    const inv1 = await createDraft({ invoiceDate: '2026-08-01' });
    const inv2 = await createDraft({ invoiceDate: '2026-08-02', clientId: clientId2 });

    const result = await InvoicesService.listInvoices({ page: 1, limit: 10 });
    expect(result.pagination.total).toBeGreaterThanOrEqual(2);
    expect(result.data.length).toBeGreaterThanOrEqual(2);

    const savedInv1 = result.data.find((i) => i.id === inv1.id);
    expect(savedInv1).toBeDefined();

    const filterResult = await InvoicesService.listInvoices({
      clientId: clientId2,
      page: 1,
      limit: 10,
    });
    expect(filterResult.data.length).toBe(1);
    expect(filterResult.data[0].id).toBe(inv2.id);
    expect(filterResult.pagination.total).toBe(1);
  });

  it('C - Detail persistence', async () => {
    const inv = await createDraft({
      items: [
        { description: 'Item 1', quantity: '1.000', rate: '100.00', gstRate: '18.00' },
        { description: 'Item 2', quantity: '2.000', rate: '50.00', gstRate: '18.00' },
      ],
    });

    const detail = await InvoicesService.getInvoiceById(inv.id);
    expect(detail.items.length).toBe(2);
    expect(detail.items[0].lineNumber).toBe(1);
    expect(detail.items[1].lineNumber).toBe(2);
    expect(detail.items[0].description).toBe('Item 1');
    expect(detail.items[1].description).toBe('Item 2');
    expect(detail.subtotal).toBe('200.00');
  });

  it('D - Detail not found', async () => {
    await expect(InvoicesService.getInvoiceById(crypto.randomUUID())).rejects.toThrow(
      'Invoice not found',
    );
  });

  it('E - Mode A real persistence', async () => {
    const inv = await createDraft();
    const originalItemIds = inv.items.map((i) => i.id);

    const updatePayload: InvoiceUpdatePayload = getUpdatePayload(inv, {
      items: [
        {
          description: 'New 1',
          quantity: '1.000',
          rate: '200.00',
          gstRate: '18.00',
          discountAmount: '0.00',
        },
        {
          description: 'New 2',
          quantity: '1.000',
          rate: '300.00',
          gstRate: '18.00',
          discountAmount: '0.00',
        },
      ],
    });

    const updated = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      updatePayload,
      auditCtx,
    );
    expect(updated.items.length).toBe(2);
    expect(updated.items.map((i) => i.id).some((id) => originalItemIds.includes(id))).toBe(false);
    expect(updated.items[0].lineNumber).toBe(1);
    expect(updated.items[1].lineNumber).toBe(2);
    expect(updated.subtotal).toBe('500.00');
  });

  it('F - Mode A payment reset', async () => {
    const inv = await createDraft();
    await prisma.$executeRaw`ALTER TABLE public."invoices" DISABLE TRIGGER USER`;
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { paidAmount: 50.0, outstandingAmount: 1130.0 },
    });
    await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;

    const updatePayload: InvoiceUpdatePayload = getUpdatePayload(inv, {
      items: [
        {
          description: 'Changed',
          quantity: '1.000',
          rate: '100.00',
          gstRate: '18.00',
          discountAmount: '0.00',
        },
      ],
    });

    const updated = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      updatePayload,
      auditCtx,
    );
    expect(updated.paidAmount).toBe('0.00');
    expect(updated.outstandingAmount).toBe('118.00');
  });

  it('G - Mode B real persistence', async () => {
    const inv = await createDraft();
    const originalItemIds = inv.items.map((i) => i.id);

    const updated = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { clientId: clientId2 }),
      auditCtx,
    );
    expect(updated.items.map((i) => i.id)).toEqual(originalItemIds);
    expect(updated.clientId).toBe(clientId2);
  });

  it('H/I - INTRA -> INTER -> INTRA', async () => {
    const inv = await createDraft({ clientId: clientId1 });
    expect(inv.items[0].cgstAmount).not.toBe('0.00');
    expect(inv.items[0].igstAmount).toBe('0.00');

    const inter = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { clientId: clientId2, placeOfSupplyStateCode: undefined }),
      auditCtx,
    );
    expect(inter.items[0].cgstAmount).toBe('0.00');
    expect(inter.items[0].igstAmount).not.toBe('0.00');

    const intra = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { clientId: clientId1, placeOfSupplyStateCode: undefined }),
      auditCtx,
    );
    expect(intra.items[0].cgstAmount).not.toBe('0.00');
    expect(intra.items[0].igstAmount).toBe('0.00');
  });

  it('J - Changed Client explicit POS precedence', async () => {
    const inv = await createDraft();
    const updated = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { clientId: clientId2, placeOfSupplyStateCode: '27' }),
      auditCtx,
    );
    expect(updated.placeOfSupplyStateCode).toBe('27');
    expect(updated.items[0].igstAmount).toBe('0.00');
  });

  it('K - Same client archived', async () => {
    const inv = await createDraft();
    await prisma.client.update({
      where: { id: clientId1 },
      data: { isArchived: true, archivedAt: new Date() },
    });
    const updated = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { notes: 'Updated notes' }),
      auditCtx,
    );
    expect(updated.notes).toBe('Updated notes');
    await prisma.client.update({
      where: { id: clientId1 },
      data: { isArchived: false, archivedAt: null },
    });
  });

  it('L - Changed client archived', async () => {
    const inv = await createDraft();
    await prisma.client.update({
      where: { id: clientId2 },
      data: { isArchived: true, archivedAt: new Date() },
    });
    await expect(
      InvoicesService.updateInvoice(
        testAdminId,
        inv.id,
        getUpdatePayload(inv, { clientId: clientId2 }),
        auditCtx,
      ),
    ).rejects.toThrow('Cannot use an archived client');
    await prisma.client.update({
      where: { id: clientId2 },
      data: { isArchived: false, archivedAt: null },
    });
  });

  it('M - Mode C real persistence', async () => {
    const inv = await createDraft();
    const updated = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { notes: 'New notes' }),
      auditCtx,
    );
    expect(updated.notes).toBe('New notes');
    expect(updated.items.map((i) => i.id)).toEqual(inv.items.map((i) => i.id));
    expect(updated.totalAmount).toBe(inv.totalAmount);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(inv.updatedAt.getTime());
  });

  it('N/O/P/Q - True NO-OP database behavior & Decimal Equivalent & Settings Drift & Default Due Days', async () => {
    const inv = await createDraft();
    const originalUpdatedAt = inv.updatedAt;
    const initialLogsCount = await prisma.auditLog.count();

    await prisma.businessSettings.update({
      where: { singletonKey: 'DEFAULT' },
      data: { defaultDueDays: 30 },
    });

    const updated = await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, {
        clientId: clientId1,
        invoiceDate: '2026-08-16',
        items: [
          { description: 'Item 1', quantity: '2', rate: '500', gstRate: '18', discountAmount: '0' },
        ],
      }),
      auditCtx,
    );

    expect(updated.updatedAt.getTime()).toBe(originalUpdatedAt.getTime());
    expect(updated.dueDate).toBe(inv.dueDate);

    const newLogsCount = await prisma.auditLog.count();
    expect(newLogsCount).toBe(initialLogsCount);
  });

  it('R/S - Audit real persistence and changedFields', async () => {
    const inv = await createDraft();
    await prisma.$executeRaw`ALTER TABLE public."audit_logs" DISABLE TRIGGER USER`;
    await prisma.auditLog.deleteMany();
    await prisma.$executeRaw`ALTER TABLE public."audit_logs" ENABLE TRIGGER USER`;
    await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { notes: '1', terms: '2' }),
      auditCtx,
    );

    const logs = await prisma.auditLog.findMany();
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('INVOICE_UPDATED');
    expect(logs[0].entityType).toBe('INVOICE');
    expect(logs[0].entityId).toBe(inv.id);
    expect(logs[0].metadata).toMatchObject({ changedFields: ['notes', 'terms'] });
  });

  it('T/U - No audit on read or NO-OP', async () => {
    const inv = await createDraft();
    await prisma.$executeRaw`ALTER TABLE public."audit_logs" DISABLE TRIGGER USER`;
    await prisma.auditLog.deleteMany();
    await prisma.$executeRaw`ALTER TABLE public."audit_logs" ENABLE TRIGGER USER`;

    await InvoicesService.getInvoiceById(inv.id);
    await InvoicesService.listInvoices({ page: 1, limit: 10 });
    await InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { notes: null }),
      auditCtx,
    );

    const logs = await prisma.auditLog.count();
    expect(logs).toBe(0);
  });

  it('V - Invoice row lock - real', async () => {
    const inv = await createDraft();
    let resolveBlock: () => void;
    const blockPromise = new Promise<void>((r) => {
      resolveBlock = r;
    });

    const originalLock = InvoicesRepository.lockInvoiceForUpdate;
    let locked = false;
    vi.spyOn(InvoicesRepository, 'lockInvoiceForUpdate').mockImplementation(async (id, tx) => {
      const res = await originalLock.call(InvoicesRepository, id, tx);
      if (id === inv.id && !locked) {
        locked = true;
        await blockPromise;
      }
      return res;
    });

    const tx1 = InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { notes: 'A' }),
      auditCtx,
    );

    for (let i = 0; i < 20; i++) {
      if (locked) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    let tx2Finished = false;
    const tx2 = InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { notes: 'B' }),
      auditCtx,
    ).then(() => {
      tx2Finished = true;
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(tx2Finished).toBe(false);

    resolveBlock!();
    await Promise.all([tx1, tx2]);
    expect(tx2Finished).toBe(true);
  });

  it('X - Client lifecycle lock', async () => {
    const inv = await createDraft();
    let resolveBlock: () => void;
    const blockPromise = new Promise<void>((r) => {
      resolveBlock = r;
    });

    const originalLock = ClientsRepository.lockClientForLifecycle;
    let locked = false;
    vi.spyOn(ClientsRepository, 'lockClientForLifecycle').mockImplementation(async (id, tx) => {
      const res = await originalLock.call(ClientsRepository, id, tx);
      if (id === clientId2 && !locked) {
        locked = true;
        await blockPromise;
      }
      return res;
    });

    const tx1 = InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, { clientId: clientId2 }),
      auditCtx,
    );

    for (let i = 0; i < 20; i++) {
      if (locked) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    let tx2Finished = false;
    const tx2 = prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT id FROM public."clients" WHERE id = $1 FOR UPDATE`,
        clientId2,
      );
      tx2Finished = true;
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(tx2Finished).toBe(false);

    resolveBlock!();
    await Promise.all([tx1, tx2]);
    expect(tx2Finished).toBe(true);
  });

  it('Z/AA/AB - Same-Invoice concurrent updates / Last-write-wins', async () => {
    const inv = await createDraft();

    let resolveBlock: () => void;
    const blockPromise = new Promise<void>((r) => {
      resolveBlock = r;
    });

    const originalLock = InvoicesRepository.lockInvoiceForUpdate;
    let locked = false;
    vi.spyOn(InvoicesRepository, 'lockInvoiceForUpdate').mockImplementation(async (id, tx) => {
      const res = await originalLock.call(InvoicesRepository, id, tx);
      if (id === inv.id && !locked) {
        locked = true;
        await blockPromise;
      }
      return res;
    });

    const p1 = InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, {
        notes: 'A',
        items: [{ description: 'Item A', quantity: '1', rate: '100', gstRate: '18' }],
      }),
      auditCtx,
    );

    for (let i = 0; i < 20; i++) {
      if (locked) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    const p2 = InvoicesService.updateInvoice(
      testAdminId,
      inv.id,
      getUpdatePayload(inv, {
        notes: 'B',
        items: [{ description: 'Item B', quantity: '2', rate: '200', gstRate: '18' }],
      }),
      auditCtx,
    );

    resolveBlock!();
    await Promise.all([p1, p2]);

    const finalInv = await InvoicesService.getInvoiceById(inv.id);
    expect(finalInv.notes).toBe('B');
    expect(finalInv.items[0].description).toBe('Item B');
  });

  it('AC - Failure rollback', async () => {
    const inv = await createDraft();
    vi.spyOn(InvoicesRepository, 'updateInvoice').mockRejectedValue(
      new Error('Simulated domain failure'),
    );

    await expect(
      InvoicesService.updateInvoice(
        testAdminId,
        inv.id,
        getUpdatePayload(inv, { notes: 'Failed' }),
        auditCtx,
      ),
    ).rejects.toThrow('Simulated domain failure');

    const unchanged = await InvoicesService.getInvoiceById(inv.id);
    expect(unchanged.notes).toBeNull();
  });

  it('AD - Non-DRAFT update', async () => {
    const inv = await createDraft();
    await prisma.$executeRaw`UPDATE public."invoices" SET "status" = 'SENT', "invoiceNumber" = 'INV-TEST', "financialYear" = '26-27', "sentAt" = NOW(), "businessSnapshot" = '{}'::jsonb, "clientSnapshot" = '{}'::jsonb WHERE "id" = ${inv.id}::uuid`;

    await expect(
      InvoicesService.updateInvoice(
        testAdminId,
        inv.id,
        getUpdatePayload(inv, { notes: 'A' }),
        auditCtx,
      ),
    ).rejects.toThrow('Only DRAFT invoices can be modified');
  });

  it('AE - Database format / precision', async () => {
    const inv = await createDraft();
    const raw = await prisma.$queryRaw<
      Record<string, unknown>[]
    >`SELECT quantity, rate, "totalAmount" FROM public."invoice_items" WHERE "invoiceId" = ${inv.id}::uuid`;

    expect(raw[0].quantity.toString()).toBe('2');
    expect(raw[0].rate.toString()).toBe('500');
    expect(raw[0].totalAmount.toString()).toBe('1180');
  });
});

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
    await prisma.$executeRaw`ALTER TABLE public."invoice_items" DISABLE TRIGGER USER`;
    try {
      await prisma.invoiceItem.deleteMany({ where: { invoice: { clientId } } });
    } finally {
      await prisma.$executeRaw`ALTER TABLE public."invoice_items" ENABLE TRIGGER USER`;
    }

    await prisma.$executeRaw`ALTER TABLE public."audit_logs" DISABLE TRIGGER USER`;
    try {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testAdminId } });
    } finally {
      await prisma.$executeRaw`ALTER TABLE public."audit_logs" ENABLE TRIGGER USER`;
    }

    await prisma.$executeRaw`ALTER TABLE public."invoices" DISABLE TRIGGER USER`;
    try {
      await prisma.invoice.deleteMany({ where: { clientId } });
    } finally {
      await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;
    }

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

  it('Late AuditLog failure fully rolls back Mode A update (transaction)', async () => {
    const response = await request(app).post('/api/v1/invoices').send(validPayload);
    expect(response.status).toBe(201);

    const invoice = await prisma.invoice.findFirstOrThrow({ include: { items: true } });
    const originalItemIds = invoice.items.map((i) => i.id).sort();
    const originalUpdatedAt = invoice.updatedAt.getTime();
    const originalAuditCount = await prisma.auditLog.count();

    const updatePayload = {
      ...validPayload,
      items: [
        {
          description: 'New Item 1',
          quantity: '1.000',
          rate: '200.00',
          gstRate: '18.00',
        },
        {
          description: 'New Item 2',
          quantity: '1.000',
          rate: '300.00',
          gstRate: '18.00',
        },
      ],
    };

    const originalCreateAuditLog = InvoicesRepository.createInvoiceAuditLog;
    vi.spyOn(InvoicesRepository, 'createInvoiceAuditLog').mockImplementation(async (data, tx) => {
      if (data.action === 'INVOICE_UPDATED') {
        throw new Error('Simulated Late AuditLog Failure');
      }
      return originalCreateAuditLog.call(InvoicesRepository, data, tx);
    });

    try {
      await expect(
        InvoicesService.updateInvoice(
          testAdminId,
          invoice.id,
          updatePayload as Parameters<typeof InvoicesService.updateInvoice>[2],
          {
            ipAddress: '1',
            userAgent: '2',
            requestId: '3',
          },
        ),
      ).rejects.toThrow('Simulated Late AuditLog Failure');

      const refetched = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { items: true },
      });

      expect(refetched.subtotal.toString()).toBe('1000');
      expect(refetched.updatedAt.getTime()).toBe(originalUpdatedAt);
      expect(refetched.items.length).toBe(1);
      expect(refetched.items.map((i) => i.id).sort()).toEqual(originalItemIds);
      expect(refetched.items[0].description).toBe('Item A');

      const newAuditCount = await prisma.auditLog.count();
      expect(newAuditCount).toBe(originalAuditCount);
    } finally {
      vi.restoreAllMocks();
    }
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

    const businessSettingsRepo =
      await import('../../src/features/business-settings/business-settings.repository');
    const originalAcquire = businessSettingsRepo.acquireSingletonLock;
    const spy = vi
      .spyOn(businessSettingsRepo, 'acquireSingletonLock')
      .mockImplementation(async (tx) => {
        trace.push('acquireSingletonLock');
        return originalAcquire(tx);
      });

    await request(app).post('/api/v1/invoices').send(validPayload);

    expect(trace).toEqual(['acquireSingletonLock', 'lockClientForLifecycle']);

    spy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('P6.2 DB - Atomic Invoice Issuance (Gate B)', () => {
    let clientId1: string;
    let clientId2: string;
    let testBusinessSettingsId: string;
    let validPayload: Record<string, unknown>;

    const cleanup = async () => {
      if (clientId1 && clientId2) {
        await prisma.$executeRaw`ALTER TABLE public."audit_logs" DISABLE TRIGGER USER`;
        try {
          await prisma.auditLog.deleteMany({ where: { actorUserId: testAdminId } });
        } finally {
          await prisma.$executeRaw`ALTER TABLE public."audit_logs" ENABLE TRIGGER USER`;
        }

        await prisma.$executeRaw`ALTER TABLE public."invoices" DISABLE TRIGGER USER`;
        await prisma.$executeRaw`ALTER TABLE public."invoice_items" DISABLE TRIGGER USER`;
        try {
          await prisma.invoiceItem.deleteMany({
            where: { invoice: { clientId: { in: [clientId1, clientId2] } } },
          });
          await prisma.invoice.deleteMany({ where: { clientId: { in: [clientId1, clientId2] } } });
        } finally {
          try {
            await prisma.$executeRaw`ALTER TABLE public."invoice_items" ENABLE TRIGGER USER`;
          } finally {
            await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;
          }
        }

        await prisma.client.deleteMany({ where: { id: { in: [clientId1, clientId2] } } });
        await prisma.businessSettings.deleteMany({ where: { singletonKey: 'DEFAULT' } });
        await prisma.invoiceCounter.deleteMany({});
      }
    };

    beforeEach(async () => {
      vi.restoreAllMocks();
      clientId1 = crypto.randomUUID();
      clientId2 = crypto.randomUUID();
      testBusinessSettingsId = crypto.randomUUID();

      validPayload = {
        clientId: clientId1,
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
          email: 'testadmin-issue@invoiceflow.com',
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

      await prisma.client.createMany({
        data: [
          {
            id: clientId1,
            name: 'Client 1',
            addressLine1: 'A',
            city: 'C',
            state: 'S',
            postalCode: '11',
            country: 'India',
            stateCode: '27',
          },
          {
            id: clientId2,
            name: 'Client 2',
            addressLine1: 'A',
            city: 'C',
            state: 'S',
            postalCode: '11',
            country: 'India',
            stateCode: '29',
          },
        ],
      });
    });

    afterEach(async () => {
      await cleanup();
      await prisma.user.deleteMany({ where: { id: testAdminId } });
      vi.restoreAllMocks();
    });

    async function createDraft(overrides: Record<string, unknown> = {}) {
      const res = await request(app)
        .post('/api/v1/invoices')
        .send({ ...validPayload, ...overrides });
      if (res.status !== 201)
        throw new Error(`Failed to create draft: ${JSON.stringify(res.body)}`);
      return res.body;
    }

    it('DB-01 â€” SUCCESS: Full issuance data persistence (DRAFT -> SENT, fields, audit)', async () => {
      const draft = await createDraft();

      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      expect(res.status).toBe(200);

      const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(inv.status).toBe(InvoiceStatus.SENT);
      expect(inv.invoiceNumber).toBe('INV/26-27/0001');
      expect(inv.financialYear).toBe('26-27');
      expect(inv.businessSnapshot).not.toBeNull();
      expect(inv.clientSnapshot).not.toBeNull();
      expect(inv.snapshotVersion).toBe(1);
      expect(inv.sentAt).not.toBeNull();
      expect(inv.sentByUserId).toBe(testAdminId);

      const auditLogs = await prisma.auditLog.findMany({
        where: { entityId: draft.id, action: 'INVOICE_ISSUED' },
      });
      expect(auditLogs.length).toBe(1);
    });

    it('DB-02 â€” ROLLBACK: Fails if not DRAFT', async () => {
      const draft = await createDraft();
      await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      await prisma.invoice.update({
        where: { id: draft.id },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: 'Test cancellation',
        },
      });

      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('Only DRAFT invoices can be issued');
    });

    it('DB-03 â€” ROLLBACK: Fails if Client is archived (lifecycle lock verified)', async () => {
      const draft = await createDraft();

      await prisma.client.update({
        where: { id: clientId1 },
        data: { isArchived: true, archivedAt: new Date() },
      });

      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe('Cannot issue invoice for an archived client');

      const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(inv.status).toBe(InvoiceStatus.DRAFT);
      expect(inv.invoiceNumber).toBeNull();
    });

    it('DB-04 â€” CONCURRENCY: Two requests issue SAME invoice. One wins, one fails (409)', async () => {
      const draft = await createDraft();

      const p1 = request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      const p2 = request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});

      const [r1, r2] = await Promise.all([p1, p2]);
      const statuses = [r1.status, r2.status].sort();

      // Idempotent behavior expects [200, 200]
      expect(statuses).toEqual([200, 200]);

      const counter = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
      });
      expect(counter.nextSequence).toBe(2);
    });

    it("DB-05 â€” CONCURRENCY: Two requests issue DIFFERENT invoices. Both succeed, counters don't collide.", async () => {
      const draft1 = await createDraft({ invoiceDate: '2026-08-16' });
      const draft2 = await createDraft({ invoiceDate: '2026-08-16' });

      const p1 = request(app).post(`/api/v1/invoices/${draft1.id}/issue`).send({});
      const p2 = request(app).post(`/api/v1/invoices/${draft2.id}/issue`).send({});

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);

      const inv1 = await prisma.invoice.findUniqueOrThrow({ where: { id: draft1.id } });
      const inv2 = await prisma.invoice.findUniqueOrThrow({ where: { id: draft2.id } });

      expect([inv1.invoiceNumber, inv2.invoiceNumber].sort()).toEqual([
        'INV/26-27/0001',
        'INV/26-27/0002',
      ]);

      const counter = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
      });
      expect(counter.nextSequence).toBe(3);
    });

    it('DB-06 â€” CONCURRENCY: Invoice row lock blocks concurrent Update', async () => {
      const draft = await createDraft();

      let resolveLock: () => void;
      const lockPromise = new Promise<void>((r) => {
        resolveLock = r;
      });
      let locked = false;

      const originalGetCounter = InvoicesRepository.lockInvoiceCounterForUpdate;
      vi.spyOn(InvoicesRepository, 'lockInvoiceCounterForUpdate').mockImplementation(
        async (fy, prefix, tx) => {
          locked = true;
          await lockPromise;
          return originalGetCounter.call(InvoicesRepository, fy, prefix, tx);
        },
      );

      const issuePromise = request(app)
        .post(`/api/v1/invoices/${draft.id}/issue`)
        .send({})
        .then((response) => response);

      for (let i = 0; i < 20; i++) {
        if (locked) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      expect(locked).toBe(true);

      let updateFinished = false;
      const updatePromise = InvoicesService.updateInvoice(
        testAdminId,
        draft.id,
        { ...validPayload, notes: 'concurrent update' } as InvoiceUpdatePayload,
        { ipAddress: '1', userAgent: '2', requestId: '3' },
      )
        .then(() => {
          updateFinished = true;
        })
        .catch(() => {
          updateFinished = true;
        });

      await new Promise((r) => setTimeout(r, 100));
      expect(updateFinished).toBe(false);

      resolveLock!();

      await Promise.all([issuePromise, updatePromise]);

      expect(updateFinished).toBe(true);
    });

    it('DB-07 â€” CONCURRENCY: Invoice row lock blocks concurrent Delete/Archive', async () => {
      const draft = await createDraft();

      let resolveLock: () => void;
      const lockPromise = new Promise<void>((r) => {
        resolveLock = r;
      });
      let locked = false;

      const originalGetCounter = InvoicesRepository.lockInvoiceCounterForUpdate;
      vi.spyOn(InvoicesRepository, 'lockInvoiceCounterForUpdate').mockImplementation(
        async (fy, prefix, tx) => {
          locked = true;
          await lockPromise;
          return originalGetCounter.call(InvoicesRepository, fy, prefix, tx);
        },
      );

      const issuePromise = request(app)
        .post(`/api/v1/invoices/${draft.id}/issue`)
        .send({})
        .then((response) => response);

      for (let i = 0; i < 20; i++) {
        if (locked) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      expect(locked).toBe(true);

      let deleteFinished = false;
      const deletePromise = prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT id FROM public."invoices" WHERE id = $1 FOR UPDATE`,
          draft.id,
        );
        deleteFinished = true;
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(deleteFinished).toBe(false);

      resolveLock!();

      await Promise.all([issuePromise, deletePromise]);

      expect(deleteFinished).toBe(true);
    });

    it('DB-08 â€” CONCURRENCY: Issuance blocks concurrent Client Archival (Client lock precedence)', async () => {
      const draft = await createDraft();

      let resolveLock: () => void;
      const lockPromise = new Promise<void>((r) => {
        resolveLock = r;
      });
      let locked = false;

      const originalGetCounter = InvoicesRepository.lockInvoiceCounterForUpdate;
      vi.spyOn(InvoicesRepository, 'lockInvoiceCounterForUpdate').mockImplementation(
        async (fy, prefix, tx) => {
          locked = true;
          await lockPromise;
          return originalGetCounter.call(InvoicesRepository, fy, prefix, tx);
        },
      );

      const issuePromise = request(app)
        .post(`/api/v1/invoices/${draft.id}/issue`)
        .send({})
        .then((response) => response);

      for (let i = 0; i < 20; i++) {
        if (locked) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      expect(locked).toBe(true);

      let archiveFinished = false;
      const archivePromise = prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT id FROM public."clients" WHERE id = $1 FOR UPDATE`,
          clientId1,
        );
        archiveFinished = true;
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(archiveFinished).toBe(false);

      resolveLock!();

      await Promise.all([issuePromise, archivePromise]);

      expect(archiveFinished).toBe(true);
    });

    it('DB-09 â€” COUNTER: First invoice in Financial Year (creates counter)', async () => {
      const draft = await createDraft({ invoiceDate: '2026-08-16' });

      await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});

      const counter = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
      });
      expect(counter.nextSequence).toBe(2);
    });

    it('DB-10 â€” COUNTER: Subsequent invoice in Financial Year (increments counter)', async () => {
      await prisma.invoiceCounter.create({ data: { financialYear: '26-27', nextSequence: 5 } });

      const draft = await createDraft({ invoiceDate: '2026-08-16' });
      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});

      expect(res.body.invoiceNumber).toBe('INV/26-27/0005');

      const counter = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
      });
      expect(counter.nextSequence).toBe(6);
    });

    it('DB-11 â€” COUNTER: Maximum limit exhausted (throws exhaustion ConflictError)', async () => {
      await prisma.invoiceCounter.create({ data: { financialYear: '26-27', nextSequence: 10000 } });

      const draft = await createDraft({ invoiceDate: '2026-08-16' });
      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe(
        'Maximum invoice sequence reached for this financial year',
      );
    });

    it('DB-12 â€” COUNTER: Independent financial years (25-26 vs 26-27 do not collide)', async () => {
      await prisma.invoiceCounter.create({ data: { financialYear: '25-26', nextSequence: 10 } });

      const draft = await createDraft({ invoiceDate: '2026-08-16' }); // 26-27
      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});

      expect(res.body.invoiceNumber).toBe('INV/26-27/0001');

      const counter2627 = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
      });
      expect(counter2627.nextSequence).toBe(2);

      const counter2526 = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '25-26', prefix: 'INV' } },
      });
      expect(counter2526.nextSequence).toBe(10);
    });

    it('DB-13 â€” ERROR: Missing Client triggers rollback', async () => {
      const draft = await createDraft();
      const { ClientsRepository } = await import('../../src/features/clients/clients.repository');
      vi.spyOn(ClientsRepository, 'getClientById').mockResolvedValue(null);

      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      expect(res.status).toBe(404);

      const inv = await prisma.invoice.findUnique({ where: { id: draft.id } });
      expect(inv?.status).toBe(InvoiceStatus.DRAFT);
    });

    it('DB-14 â€” ERROR: Missing Business Settings triggers rollback', async () => {
      const draft = await createDraft();
      await prisma.businessSettings.deleteMany({});

      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      expect(res.status).toBe(404);

      const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(inv.status).toBe(InvoiceStatus.DRAFT);
    });

    it('DB-15 â€” ERROR: Missing Invoice triggers rollback', async () => {
      const res = await request(app)
        .post('/api/v1/invoices/550e8400-e29b-41d4-a716-446655440001/issue')
        .send({});
      expect(res.status).toBe(404);
    });
    it('DB-16 — ROLLBACK: Failure after counter mutation rolls back completely', async () => {
      const draft = await createDraft({ invoiceDate: '2026-08-16' });

      await prisma.invoiceCounter.upsert({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
        update: { nextSequence: 42 },
        create: { financialYear: '26-27', prefix: 'INV', nextSequence: 42 },
      });

      const initialCounter = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
      });
      expect(initialCounter.nextSequence).toBe(42);

      const initialAuditCount = await prisma.auditLog.count({
        where: { entityId: draft.id, action: 'INVOICE_ISSUED' },
      });

      const { InvoicesRepository } =
        await import('../../src/features/invoices/invoices.repository');
      vi.spyOn(InvoicesRepository, 'createInvoiceAuditLog').mockRejectedValueOnce(
        new Error('Simulated failure after counter mutation'),
      );

      const res = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      expect(res.status).toBe(500);

      const invAfterFailure = await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } });
      expect(invAfterFailure.status).toBe(InvoiceStatus.DRAFT);
      expect(invAfterFailure.invoiceNumber).toBeNull();
      expect(invAfterFailure.financialYear).toBeNull();
      expect(invAfterFailure.snapshotVersion).toBe(1);

      const { Prisma } = await import('../../src/generated/prisma/client');
      if (invAfterFailure.businessSnapshot === Prisma.DbNull) {
        expect(invAfterFailure.businessSnapshot).toBe(Prisma.DbNull);
      } else {
        expect(invAfterFailure.businessSnapshot).toBeNull();
      }

      if (invAfterFailure.clientSnapshot === Prisma.DbNull) {
        expect(invAfterFailure.clientSnapshot).toBe(Prisma.DbNull);
      } else {
        expect(invAfterFailure.clientSnapshot).toBeNull();
      }

      expect(invAfterFailure.sentAt).toBeNull();
      expect(invAfterFailure.sentByUserId).toBeNull();

      const counterAfterFailure = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
      });
      expect(counterAfterFailure.nextSequence).toBe(42);

      const auditCountAfterFailure = await prisma.auditLog.count({
        where: { entityId: draft.id, action: 'INVOICE_ISSUED' },
      });
      expect(auditCountAfterFailure).toBe(initialAuditCount);

      vi.restoreAllMocks();

      const resSuccess = await request(app).post(`/api/v1/invoices/${draft.id}/issue`).send({});
      expect(resSuccess.status).toBe(200);
      expect(resSuccess.body.invoiceNumber).toBe('INV/26-27/0042');

      const counterAfterSuccess = await prisma.invoiceCounter.findUniqueOrThrow({
        where: { financialYear_prefix: { financialYear: '26-27', prefix: 'INV' } },
      });
      expect(counterAfterSuccess.nextSequence).toBe(43);
    });
  });
});
