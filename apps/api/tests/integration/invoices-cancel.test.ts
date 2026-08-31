import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/database/prisma';
import { UserRole, InvoiceStatus, Prisma } from '../../src/generated/prisma/client';

// Preserve real PrismaClient export, but mock middleware for auth isolation
vi.mock('../../src/generated/prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/generated/prisma/client')>();
  return { ...actual };
});

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: vi.fn(async (req, _res, next) => {
      req.auth = { user: { id: 'admin-id', role: UserRole.SUPER_ADMIN, email: 'mock' } };
      next();
    }),
  };
});

vi.mock('../../src/features/auth/origin.middleware', () => ({
  originGuard: vi.fn((req, res, next) => next()),
}));
vi.mock('../../src/features/auth/csrf.middleware', () => ({
  requireCsrfToken: vi.fn((req, res, next) => next()),
}));

const makeInvoiceFixture = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  clientId: 'client-123',
  invoiceNumber: 'INV/26-27/0001',
  financialYear: '26-27',
  status: InvoiceStatus.SENT,
  invoiceDate: new Date('2026-08-20T00:00:00.000Z'),
  dueDate: new Date('2026-09-04T00:00:00.000Z'),
  currency: 'INR',
  placeOfSupplyState: 'Maharashtra',
  placeOfSupplyStateCode: '27',
  notes: null,
  terms: null,
  subtotal: new Prisma.Decimal('1000.00'),
  discountTotal: new Prisma.Decimal('0.00'),
  taxableTotal: new Prisma.Decimal('1000.00'),
  cgstTotal: new Prisma.Decimal('90.00'),
  sgstTotal: new Prisma.Decimal('90.00'),
  igstTotal: new Prisma.Decimal('0.00'),
  total: new Prisma.Decimal('1180.00'),
  paidAmount: new Prisma.Decimal('0.00'),
  outstandingAmount: new Prisma.Decimal('1180.00'),
  snapshotVersion: 1,
  businessSnapshot: {},
  clientSnapshot: {},
  sentAt: new Date('2026-08-20T10:00:00.000Z'),
  cancelledAt: null,
  cancellationReason: null,
  createdByUserId: 'user-123',
  sentByUserId: 'user-123',
  createdAt: new Date('2026-08-20T09:00:00.000Z'),
  updatedAt: new Date('2026-08-20T10:00:00.000Z'),
  items: [],
  ...overrides,
});

describe('Integration: Invoices Cancellation Route', () => {
  const validPayload = { reason: 'Cancellation due to error' };
  const url = `/api/v1/invoices/550e8400-e29b-41d4-a716-446655440000/cancel`;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy and mock Prisma methods for behavioral testing without DB side-effects
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => await cb(prisma));
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([]);
    vi.spyOn(prisma.invoice, 'findUnique').mockResolvedValue(
      makeInvoiceFixture() as Awaited<ReturnType<typeof prisma.invoice.findUnique>>,
    );
    vi.spyOn(prisma.payment, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.emailDelivery, 'count').mockResolvedValue(0);
    vi.spyOn(prisma.invoice, 'update').mockResolvedValue(
      makeInvoiceFixture({
        status: InvoiceStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: validPayload.reason,
      }) as Awaited<ReturnType<typeof prisma.invoice.update>>,
    );
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue(
      {} as Awaited<ReturnType<typeof prisma.auditLog.create>>,
    );
  });

  it('successful cancellation updates status and creates audit', async () => {
    const res = await request(app).post(url).send(validPayload);
    expect(res.status).toBe(200);
    expect(prisma.invoice.update).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects DRAFT', async () => {
    vi.spyOn(prisma.invoice, 'findUnique').mockResolvedValue(
      makeInvoiceFixture({ status: InvoiceStatus.DRAFT }) as Awaited<
        ReturnType<typeof prisma.invoice.findUnique>
      >,
    );
    const res = await request(app).post(url).send(validPayload);
    expect(res.status).toBe(409);
  });

  it('rejects PARTIALLY_PAID', async () => {
    vi.spyOn(prisma.invoice, 'findUnique').mockResolvedValue(
      makeInvoiceFixture({ status: InvoiceStatus.PARTIALLY_PAID }) as Awaited<
        ReturnType<typeof prisma.invoice.findUnique>
      >,
    );
    const res = await request(app).post(url).send(validPayload);
    expect(res.status).toBe(409);
  });

  it('rejects PAID', async () => {
    vi.spyOn(prisma.invoice, 'findUnique').mockResolvedValue(
      makeInvoiceFixture({ status: InvoiceStatus.PAID }) as Awaited<
        ReturnType<typeof prisma.invoice.findUnique>
      >,
    );
    const res = await request(app).post(url).send(validPayload);
    expect(res.status).toBe(409);
  });

  it('rejects already CANCELLED', async () => {
    vi.spyOn(prisma.invoice, 'findUnique').mockResolvedValue(
      makeInvoiceFixture({ status: InvoiceStatus.CANCELLED }) as Awaited<
        ReturnType<typeof prisma.invoice.findUnique>
      >,
    );
    const res = await request(app).post(url).send(validPayload);
    expect(res.status).toBe(409);
  });

  it('blocks if RECORDED payment exists', async () => {
    vi.spyOn(prisma.payment, 'count').mockResolvedValue(1);
    const res = await request(app).post(url).send(validPayload);
    expect(res.status).toBe(409);
  });

  it('blocks if PENDING email exists', async () => {
    vi.spyOn(prisma.emailDelivery, 'count').mockResolvedValue(1);
    const res = await request(app).post(url).send(validPayload);
    expect(res.status).toBe(409);
  });
});
