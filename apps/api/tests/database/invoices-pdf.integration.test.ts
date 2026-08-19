import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { prisma } from '../../src/database/prisma';
import { UserRole } from '../../src/generated/prisma/client';
import { InvoicesService } from '../../src/features/invoices/invoices.service';
import { InvoicePdfService } from '../../src/features/invoices/pdf/invoice-pdf.service';

const testAdminId = '00000000-0000-0000-0000-000000000001';

describe('P6.3 DB: Invoice PDF Generation', () => {
  let clientId: string;
  const auditCtx = { ipAddress: '127.0.0.1', userAgent: 'test', requestId: 'test-req-id' };

  beforeEach(async () => {
    vi.restoreAllMocks();
    clientId = randomUUID();

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
        where: { invoice: { clientId } },
      });
      await prisma.invoice.deleteMany({ where: { clientId } });
    } finally {
      try {
        await prisma.$executeRaw`ALTER TABLE public."invoice_items" ENABLE TRIGGER USER`;
      } finally {
        await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;
      }
    }

    await prisma.client.deleteMany({ where: { id: clientId } });
    await prisma.businessSettings.deleteMany({ where: { singletonKey: 'DEFAULT' } });

    await prisma.user.upsert({
      where: { id: testAdminId },
      update: {},
      create: {
        id: testAdminId,
        email: 'test-db@invoiceflow.com',
        firstName: 'T',
        lastName: 'A',
        role: UserRole.SUPER_ADMIN,
        passwordHash: 'dummy',
      },
    });

    await prisma.businessSettings.create({
      data: {
        legalName: 'Test Business Corp',
        displayName: 'Test Business',
        addressLine1: 'Test Address 1',
        city: 'Mumbai',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '400001',
        country: 'India',
        gstin: '27AAAAA0000A1Z5',
        invoicePrefix: 'INV',
        defaultDueDays: 30,
      },
    });

    await prisma.client.create({
      data: {
        id: clientId,
        name: 'Real DB Client',
        addressLine1: 'Client Address 1',
        city: 'Pune',
        state: 'Maharashtra',
        stateCode: '27',
        postalCode: '411001',
        country: 'India',
        createdByUserId: testAdminId,
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRaw`ALTER TABLE public."audit_logs" DISABLE TRIGGER USER`;
    try {
      await prisma.auditLog.deleteMany({ where: { actorUserId: testAdminId } });
    } finally {
      await prisma.$executeRaw`ALTER TABLE public."audit_logs" ENABLE TRIGGER USER`;
    }

    await prisma.$executeRaw`ALTER TABLE public."invoices" DISABLE TRIGGER USER`;
    await prisma.$executeRaw`ALTER TABLE public."invoice_items" DISABLE TRIGGER USER`;
    try {
      await prisma.invoiceItem.deleteMany();
      await prisma.invoice.deleteMany();
      await prisma.invoiceCounter.deleteMany();
    } finally {
      await prisma.$executeRaw`ALTER TABLE public."invoices" ENABLE TRIGGER USER`;
      await prisma.$executeRaw`ALTER TABLE public."invoice_items" ENABLE TRIGGER USER`;
    }

    await prisma.client.delete({ where: { id: clientId } });
    await prisma.businessSettings.deleteMany();
    await prisma.user.delete({ where: { id: testAdminId } });
  });

  it('DB-01 Generates PDF for a real issued invoice in the database', async () => {
    // 1. Create Draft
    const draft = await InvoicesService.createInvoice(
      testAdminId,
      {
        clientId,
        invoiceDate: '2026-08-16',
        items: [
          {
            description: 'Consulting Real DB',
            quantity: '1.000',
            rate: '1000.00',
            gstRate: '18.00',
          },
        ],
      },
      auditCtx,
    );

    // 2. Issue Invoice (Locks, allocates number, snapshots, saves)
    const issued = await InvoicesService.issueInvoice(testAdminId, draft.id, auditCtx);

    // 3. Verify it was issued
    expect(issued.status).toBe('SENT');
    expect(issued.invoiceNumber).toBeDefined();

    // 4. Generate PDF using exact DB state
    const result = await InvoicePdfService.generateInvoicePdf(issued.id);

    // 5. Verify Buffer generated
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.filename).toBe('Invoice-' + issued.invoiceNumber!.replace(/\//g, '-') + '.pdf');
  });
});
