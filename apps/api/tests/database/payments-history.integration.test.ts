import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/database/prisma';
import { UserRole, InvoiceStatus, PaymentMethod, PaymentStatus } from '../../src/generated/prisma/client';

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

describe('F21 DB: Payment History & API Coverage', () => {
  let clientId: string;
  let otherClientId: string;

  const cleanup = async () => {
    await prisma.$executeRaw`ALTER TABLE public."audit_logs" DISABLE TRIGGER USER`;
    await prisma.auditLog.deleteMany();
    await prisma.$executeRaw`ALTER TABLE public."audit_logs" ENABLE TRIGGER USER`;
    await prisma.payment.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.client.deleteMany();
  };

  beforeEach(async () => {
    await cleanup();
    const c1 = await prisma.client.create({
      data: {
        name: 'Test Client 1',
        email: 't1@example.com',
        stateCode: '27',
        createdByUserId: testAdminId,
      },
    });
    clientId = c1.id;
    const c2 = await prisma.client.create({
      data: {
        name: 'Test Client 2',
        email: 't2@example.com',
        stateCode: '27',
        createdByUserId: testAdminId,
      },
    });
    otherClientId = c2.id;
  });

  afterEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });

  it('1. GET /api/v1/invoices/:invoiceId returns multiple real payment records mapped and ordered', async () => {
    const invoiceId = randomUUID();
    
    // Create base invoice
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        clientId,
        status: InvoiceStatus.PARTIALLY_PAID,
        invoiceDate: new Date(),
        dueDate: new Date(),
        currency: 'INR',
        placeOfSupplyState: 'Maharashtra',
        placeOfSupplyStateCode: '27',
        subtotal: 1000,
        discountTotal: 0,
        taxableTotal: 1000,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        total: 1000,
        paidAmount: 300,
        outstandingAmount: 700,
        createdByUserId: testAdminId,
      },
    });

    // Create Payment 1 (Older)
    await prisma.payment.create({
      data: {
        id: randomUUID(),
        invoiceId,
        amount: 100,
        method: PaymentMethod.CASH,
        status: PaymentStatus.RECORDED,
        reference: 'CASH-01',
        notes: 'First payment',
        idempotencyKey: 'key-1',
        recordedByUserId: testAdminId,
        paidAt: new Date('2024-01-01T10:00:00.000Z'),
      },
    });

    // Create Payment 2 (Newer)
    await prisma.payment.create({
      data: {
        id: randomUUID(),
        invoiceId,
        amount: 200,
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.RECORDED,
        reference: 'BANK-01',
        notes: 'Second payment',
        idempotencyKey: 'key-2',
        recordedByUserId: testAdminId,
        paidAt: new Date('2024-01-02T10:00:00.000Z'),
      },
    });

    const res = await request(app).get(\`/api/v1/invoices/\${invoiceId}\`);
    expect(res.status).toBe(200);
    
    // 1. Returns multiple real records
    expect(res.body.payments).toBeDefined();
    expect(res.body.payments.length).toBe(2);

    // 3. Ordered by paidAt DESC
    expect(res.body.payments[0].method).toBe('BANK_TRANSFER'); // Newer
    expect(res.body.payments[1].method).toBe('CASH'); // Older

    // 2. Mapped and sanitized
    expect(res.body.payments[0].amount).toBe('200.00'); // Check string format
    expect(res.body.payments[0].reference).toBe('BANK-01');
    expect(res.body.payments[0].status).toBe('RECORDED');
  });

  it('4. An invoice with no payments returns payments: []', async () => {
    const invoiceId = randomUUID();
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        clientId,
        status: InvoiceStatus.SENT,
        invoiceDate: new Date(),
        dueDate: new Date(),
        currency: 'INR',
        placeOfSupplyState: 'Maharashtra',
        placeOfSupplyStateCode: '27',
        subtotal: 1000,
        discountTotal: 0,
        taxableTotal: 1000,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        total: 1000,
        paidAmount: 0,
        outstandingAmount: 1000,
        createdByUserId: testAdminId,
      },
    });

    const res = await request(app).get(\`/api/v1/invoices/\${invoiceId}\`);
    expect(res.status).toBe(200);
    expect(res.body.payments).toEqual([]);
  });

  it('5. A reversed payment remains visible with status REVERSED and reversal metadata', async () => {
    const invoiceId = randomUUID();
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        clientId,
        status: InvoiceStatus.SENT,
        invoiceDate: new Date(),
        dueDate: new Date(),
        currency: 'INR',
        placeOfSupplyState: 'Maharashtra',
        placeOfSupplyStateCode: '27',
        subtotal: 1000,
        discountTotal: 0,
        taxableTotal: 1000,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        total: 1000,
        paidAmount: 0,
        outstandingAmount: 1000,
        createdByUserId: testAdminId,
      },
    });

    await prisma.payment.create({
      data: {
        id: randomUUID(),
        invoiceId,
        amount: 100,
        method: PaymentMethod.CASH,
        status: PaymentStatus.REVERSED,
        reference: 'CASH-01',
        notes: 'First payment',
        idempotencyKey: 'key-1',
        recordedByUserId: testAdminId,
        paidAt: new Date('2024-01-01T10:00:00.000Z'),
        reversedAt: new Date('2024-01-02T10:00:00.000Z'),
        reversedByUserId: testAdminId,
        reversalReason: 'Accidental entry',
      },
    });

    const res = await request(app).get(\`/api/v1/invoices/\${invoiceId}\`);
    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBe(1);
    expect(res.body.payments[0].status).toBe('REVERSED');
    expect(res.body.payments[0].reversalReason).toBe('Accidental entry');
    expect(res.body.payments[0].reversedAt).toBeDefined();
  });

  it('6. Payments belonging to another invoice are never returned', async () => {
    const invoice1Id = randomUUID();
    const invoice2Id = randomUUID();

    await prisma.invoice.createMany({
      data: [
        {
          id: invoice1Id,
          clientId,
          status: InvoiceStatus.PARTIALLY_PAID,
          invoiceDate: new Date(),
          dueDate: new Date(),
          currency: 'INR',
          placeOfSupplyState: 'Maharashtra',
          placeOfSupplyStateCode: '27',
          subtotal: 1000,
          discountTotal: 0,
          taxableTotal: 1000,
          cgstTotal: 0,
          sgstTotal: 0,
          igstTotal: 0,
          total: 1000,
          paidAmount: 100,
          outstandingAmount: 900,
          createdByUserId: testAdminId,
        },
        {
          id: invoice2Id,
          clientId: otherClientId,
          status: InvoiceStatus.PARTIALLY_PAID,
          invoiceDate: new Date(),
          dueDate: new Date(),
          currency: 'INR',
          placeOfSupplyState: 'Maharashtra',
          placeOfSupplyStateCode: '27',
          subtotal: 1000,
          discountTotal: 0,
          taxableTotal: 1000,
          cgstTotal: 0,
          sgstTotal: 0,
          igstTotal: 0,
          total: 1000,
          paidAmount: 200,
          outstandingAmount: 800,
          createdByUserId: testAdminId,
        }
      ]
    });

    await prisma.payment.create({
      data: {
        id: randomUUID(),
        invoiceId: invoice1Id,
        amount: 100,
        method: PaymentMethod.CASH,
        status: PaymentStatus.RECORDED,
        idempotencyKey: 'key-1',
        recordedByUserId: testAdminId,
      },
    });

    await prisma.payment.create({
      data: {
        id: randomUUID(),
        invoiceId: invoice2Id,
        amount: 200,
        method: PaymentMethod.CASH,
        status: PaymentStatus.RECORDED,
        idempotencyKey: 'key-2',
        recordedByUserId: testAdminId,
      },
    });

    const res = await request(app).get(\`/api/v1/invoices/\${invoice1Id}\`);
    expect(res.status).toBe(200);
    expect(res.body.payments.length).toBe(1);
    expect(res.body.payments[0].amount).toBe('100.00'); // Ensure it only grabs invoice1 payment
  });
});
