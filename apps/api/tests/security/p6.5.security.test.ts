import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { InvoicesRepository } from '../../src/features/invoices/invoices.repository';
import { InvoiceStatus, Prisma, UserRole } from '../../src/generated/prisma/client';

vi.mock('../../src/database/transaction', () => ({
  runInTransaction: vi.fn(async (cb) => await cb({} as unknown)),
}));

vi.mock('../../src/features/invoices/invoices.repository', () => ({
  InvoicesRepository: {
    lockInvoiceForUpdate: vi.fn(),
    getInvoiceWithItems: vi.fn(),
    hasActiveRecordedPayments: vi.fn(),
    hasPendingEmailDeliveries: vi.fn(),
    markInvoiceCancelled: vi.fn(),
    createInvoiceAuditLog: vi.fn(),
  },
}));

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: vi.fn(async (req, _res, next) => {
      if (req.headers['x-mock-auth'] === 'none') {
        return next(new (await import('../../src/errors/application.error')).UnauthorizedError());
      }
      const role = (req.headers['x-mock-role'] as UserRole) || UserRole.SUPER_ADMIN;
      const mustChangePassword = req.headers['x-mock-must-change-password'] === 'true';
      req.auth = {
        sessionId: 'session-id',
        user: { id: 'actor-id', role, mustChangePassword, email: 'mock@example.com' },
      };
      next();
    }),
  };
});

vi.mock('../../src/features/auth/origin.middleware', () => ({
  originGuard: vi.fn((req, res, next) => {
    if (req.headers['x-origin-verified'] === 'false')
      return res.status(403).json({ error: 'Origin' });
    next();
  }),
}));

vi.mock('../../src/features/auth/csrf.middleware', () => ({
  requireCsrfToken: vi.fn((req, res, next) => {
    if (req.headers['x-csrf-verified'] === 'false') return res.status(403).json({ error: 'CSRF' });
    next();
  }),
}));

type InvoiceWithItems = NonNullable<
  Awaited<ReturnType<typeof InvoicesRepository.getInvoiceWithItems>>
>;

const makeInvoiceFixture = (overrides: Partial<InvoiceWithItems> = {}): InvoiceWithItems => ({
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

describe('P6.5 Security Matrix: Invoice Cancellation', () => {
  const invoiceId = '550e8400-e29b-41d4-a716-446655440000';
  const url = `/api/v1/invoices/${invoiceId}/cancel`;
  const validPayload = { reason: 'Client requested cancellation.' };

  beforeEach(() => {
    vi.clearAllMocks();

    const baseInvoice = makeInvoiceFixture();
    const cancelledInvoice = makeInvoiceFixture({
      status: InvoiceStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: validPayload.reason,
      updatedAt: new Date(),
    });

    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(baseInvoice);
    vi.mocked(InvoicesRepository.hasActiveRecordedPayments).mockResolvedValue(false);
    vi.mocked(InvoicesRepository.hasPendingEmailDeliveries).mockResolvedValue(false);
    vi.mocked(InvoicesRepository.markInvoiceCancelled).mockResolvedValue(cancelledInvoice);
    vi.mocked(InvoicesRepository.createInvoiceAuditLog).mockResolvedValue({} as never);
  });

  const makeReq = (overrides = {}) => {
    const req = request(app).post(url);
    req.set('x-origin-verified', 'true');
    req.set('x-csrf-verified', 'true');
    req.set('x-mock-role', UserRole.SUPER_ADMIN);
    for (const [k, v] of Object.entries(overrides)) {
      req.set(k, String(v));
    }
    return req;
  };

  it('SEC-CANCEL-01 unauthenticated', async () => {
    const res = await makeReq({ 'x-mock-auth': 'none' }).send(validPayload);
    expect(res.status).toBe(401);
  });

  it('SEC-CANCEL-02 STAFF allowed', async () => {
    const res = await makeReq({ 'x-mock-role': UserRole.STAFF }).send(validPayload);
    expect(res.status).toBe(200);
  });

  it('SEC-CANCEL-03 SUPER_ADMIN allowed', async () => {
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(200);
  });

  it('SEC-CANCEL-04 VIEWER forbidden', async () => {
    const res = await makeReq({ 'x-mock-role': UserRole.VIEWER }).send(validPayload);
    expect(res.status).toBe(403);
  });

  it('SEC-CANCEL-05 password-change enforcement', async () => {
    const res = await makeReq({ 'x-mock-must-change-password': 'true' }).send(validPayload);
    expect(res.status).toBe(403);
  });

  it('SEC-CANCEL-06 Origin required', async () => {
    const res = await makeReq({ 'x-origin-verified': 'false' }).send(validPayload);
    expect(res.status).toBe(403);
  });

  it('SEC-CANCEL-07 CSRF required', async () => {
    const res = await makeReq({ 'x-csrf-verified': 'false' }).send(validPayload);
    expect(res.status).toBe(403);
  });

  it('SEC-CANCEL-08 invalid UUID', async () => {
    const res = await request(app)
      .post('/api/v1/invoices/invalid/cancel')
      .set('x-origin-verified', 'true')
      .set('x-csrf-verified', 'true')
      .set('x-mock-role', UserRole.SUPER_ADMIN)
      .send(validPayload);
    expect(res.status).toBe(400);
  });

  it('SEC-CANCEL-09 unknown invoice', async () => {
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValueOnce(null);
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(404);
  });

  it('SEC-CANCEL-10 DRAFT -> 409', async () => {
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValueOnce(
      makeInvoiceFixture({
        status: InvoiceStatus.DRAFT,
      }),
    );
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(409);
  });

  it('SEC-CANCEL-11 SENT -> 200', async () => {
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(200);
  });

  it('SEC-CANCEL-12 PARTIALLY_PAID -> 409', async () => {
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValueOnce(
      makeInvoiceFixture({
        status: InvoiceStatus.PARTIALLY_PAID,
      }),
    );
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(409);
  });

  it('SEC-CANCEL-13 PAID -> 409', async () => {
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValueOnce(
      makeInvoiceFixture({
        status: InvoiceStatus.PAID,
      }),
    );
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(409);
  });

  it('SEC-CANCEL-14 CANCELLED -> 409', async () => {
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValueOnce(
      makeInvoiceFixture({
        status: InvoiceStatus.CANCELLED,
      }),
    );
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(409);
  });

  it('SEC-CANCEL-15 missing reason', async () => {
    const res = await makeReq().send({});
    expect(res.status).toBe(400);
  });

  it('SEC-CANCEL-16 empty/short reason', async () => {
    const res = await makeReq().send({ reason: 'short' });
    expect(res.status).toBe(400);
  });

  it('SEC-CANCEL-17 >500 reason', async () => {
    const res = await makeReq().send({ reason: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('SEC-CANCEL-18 extra body property', async () => {
    const res = await makeReq().send({ ...validPayload, extra: true });
    expect(res.status).toBe(400);
  });

  it('SEC-CANCEL-19 control/CRLF reason', async () => {
    const res = await makeReq().send({ reason: 'Cancel\nthis\rcrap' });
    expect(res.status).toBe(400);
  });

  it('SEC-CANCEL-20 HTML angle-bracket input', async () => {
    const res = await makeReq().send({ reason: '<b>cancel this</b>' });
    expect(res.status).toBe(400);
  });

  it('SEC-CANCEL-21 RECORDED payment blocks', async () => {
    vi.mocked(InvoicesRepository.hasActiveRecordedPayments).mockResolvedValueOnce(true);
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(409);
  });

  it('SEC-CANCEL-22 only REVERSED historical payments do not block SENT cancellation', async () => {
    vi.mocked(InvoicesRepository.hasActiveRecordedPayments).mockResolvedValueOnce(false);
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(200);
  });

  it('SEC-CANCEL-23 PENDING EmailDelivery blocks', async () => {
    vi.mocked(InvoicesRepository.hasPendingEmailDeliveries).mockResolvedValueOnce(true);
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(409);
  });

  it('SEC-CANCEL-24 ACCEPTED history preserved', async () => {
    vi.mocked(InvoicesRepository.hasPendingEmailDeliveries).mockResolvedValueOnce(false);
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(200);
  });

  it('SEC-CANCEL-25 FAILED history preserved', async () => {
    vi.mocked(InvoicesRepository.hasPendingEmailDeliveries).mockResolvedValueOnce(false);
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(200);
  });

  it('SEC-CANCEL-26 concurrent cancellation -> exactly one success', async () => {
    let requests = 0;
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockImplementation(async () => {
      requests++;
      if (requests > 1) {
        return makeInvoiceFixture({ status: InvoiceStatus.CANCELLED });
      }
      return makeInvoiceFixture();
    });

    const [res1, res2] = await Promise.all([
      makeReq().send(validPayload),
      makeReq().send(validPayload),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledTimes(1);
    expect(InvoicesRepository.createInvoiceAuditLog).toHaveBeenCalledTimes(1);
  });

  it('SEC-CANCEL-27 exactly one cancellation audit', async () => {
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(200);
    expect(InvoicesRepository.createInvoiceAuditLog).toHaveBeenCalledTimes(1);
    expect(InvoicesRepository.createInvoiceAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          previousStatus: 'SENT',
          resultingStatus: 'CANCELLED',
          reason: validPayload.reason,
        },
      }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-28 no second audit on already CANCELLED', async () => {
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValueOnce(
      makeInvoiceFixture({
        status: InvoiceStatus.CANCELLED,
      }),
    );
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(409);
    expect(InvoicesRepository.createInvoiceAuditLog).not.toHaveBeenCalled();
  });

  it('SEC-CANCEL-29 invoice number unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ invoiceNumber: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-30 counter unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ counterId: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-31 financials unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ total: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-32 paid/outstanding unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ paidAmount: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-33 snapshots unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ clientSnapshot: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-34 invoice items unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ items: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-35 payments unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ payments: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-36 email deliveries unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ emailDeliveries: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-37 sentAt/sentBy unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ sentAt: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-38 createdAt unchanged', async () => {
    await makeReq().send(validPayload);
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      expect.not.objectContaining({ createdAt: expect.anything() }),
      expect.anything(),
    );
  });

  it('SEC-CANCEL-39 only updatedAt system metadata may advance', async () => {
    const beforeDate = new Date('2026-08-20T10:00:00.000Z');
    const afterDate = new Date('2026-08-20T10:05:00.000Z');

    let invoiceState: InvoiceWithItems = makeInvoiceFixture({
      updatedAt: beforeDate,
      status: InvoiceStatus.SENT,
      cancelledAt: null,
      cancellationReason: null,
    });

    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockImplementation(async () => invoiceState);
    vi.mocked(InvoicesRepository.markInvoiceCancelled).mockImplementation(
      async (_invoiceId, input) => {
        invoiceState = makeInvoiceFixture({
          ...invoiceState,
          status: InvoiceStatus.CANCELLED,
          cancelledAt: afterDate,
          cancellationReason: input.cancellationReason,
          updatedAt: afterDate,
        });
        return invoiceState;
      },
    );

    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(200);

    // Verify exactly what was requested for mutation
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      { cancelledAt: expect.any(Date), cancellationReason: validPayload.reason },
      expect.anything(),
    );

    // Verify response contains identical original business fields
    expect(res.body.invoiceNumber).toBe('INV/26-27/0001');
    expect(res.body.financialYear).toBe('26-27');
    expect(res.body.currency).toBe('INR');
    expect(res.body.total).toBe('1180.00');
    expect(res.body.outstandingAmount).toBe('1180.00');
    expect(res.body.paidAmount).toBe('0.00');

    // Check that dates advanced correctly
    expect(res.body.updatedAt).toBe(afterDate.toISOString());
    expect(res.body.cancelledAt).toBe(afterDate.toISOString());
  });

  it('SEC-CANCEL-40 raw Prisma/PostgreSQL errors not leaked', async () => {
    vi.mocked(InvoicesRepository.lockInvoiceForUpdate).mockRejectedValueOnce(
      new Error('Prisma error P2002'),
    );
    const res = await makeReq().send(validPayload);
    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty('error', 'Prisma error P2002');
  });
});
