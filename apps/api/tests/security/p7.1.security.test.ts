import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole, PaymentMethod, Payment } from '../../src/generated/prisma/client';
import { Prisma } from '../../src/generated/prisma/client';
import { PaymentsService } from '../../src/features/payments/payments.service';

const makePaymentFixture = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'pay-123',
  invoiceId: '550e8400-e29b-41d4-a716-446655440000',
  amount: new Prisma.Decimal(10),
  method: PaymentMethod.CASH,
  status: 'RECORDED',
  reference: null,
  notes: null,
  idempotencyKey: 'idem-1',
  paidAt: new Date(),
  recordedByUserId: 'user-1',
  reversedAt: null,
  reversedByUserId: null,
  reversalReason: null,
  createdAt: new Date(),
  ...overrides,
});

vi.mock('../../src/features/payments/payments.service', () => ({
  PaymentsService: {
    recordPayment: vi.fn(),
  },
}));

vi.mock('../../src/features/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/auth/auth.middleware')>();
  return {
    ...actual,
    authenticateRequest: vi.fn(async (req, res, next) => {
      if (req.headers['x-mock-auth'] === 'none') {
        const errorModule = await import('../../src/errors/application.error');
        return next(new errorModule.UnauthorizedError());
      }
      const role = (req.headers['x-mock-role'] as UserRole) || UserRole.SUPER_ADMIN;
      req.auth = { user: { id: 'test-user', role, email: 'test@example.com' } } as unknown as import('../../src/features/auth/auth.middleware').AuthContext;
      next();
    }),
    requirePasswordChangeCompleted: vi.fn((req, res, next) => next()),
  };
});

vi.mock('../../src/features/auth/csrf.middleware', () => ({
  requireCsrfToken: vi.fn((req, res, next) => next()),
}));

vi.mock('../../src/features/auth/origin.middleware', () => ({
  originGuard: vi.fn((req, res, next) => {
    if (req.headers['x-origin-verified'] === 'false') {
      return res.status(403).json({ error: 'Origin Forbidden' });
    }
    next();
  }),
}));

describe('P7.1 Security Matrix: Payment Recording', () => {
  const invoiceId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PaymentsService.recordPayment).mockResolvedValue(makePaymentFixture({ id: 'pay-123' }));
  });

  // Authentication & Authorization
  it('SEC-PAY-01: SUPER_ADMIN can record payment', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).set('x-mock-role', UserRole.SUPER_ADMIN).send({ amount: '10.00', method: PaymentMethod.CASH, idempotencyKey: 'sec-1' });
    expect(res.status).toBe(201);
  });
  it('SEC-PAY-02: STAFF can record payment', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).set('x-mock-role', UserRole.STAFF).send({ amount: '10.00', method: PaymentMethod.CASH, idempotencyKey: 'sec-2' });
    expect(res.status).toBe(201);
  });
  it('SEC-PAY-03: VIEWER cannot record payment (403)', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).set('x-mock-role', UserRole.VIEWER).send({ amount: '10.00', method: PaymentMethod.CASH, idempotencyKey: 'sec-3' });
    expect(res.status).toBe(403);
  });
  it('SEC-PAY-04: Unauthenticated rejected (401)', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).set('x-mock-auth', 'none').send({ amount: '10.00', method: PaymentMethod.CASH, idempotencyKey: 'sec-4' });
    expect(res.status).toBe(401);
  });
  it('SEC-PAY-05: Missing Origin rejected (403)', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).set('x-origin-verified', 'false').send({ amount: '10.00', method: PaymentMethod.CASH, idempotencyKey: 'sec-5' });
    expect(res.status).toBe(403);
  });

  // Input Validation
  it('SEC-PAY-11: Reject missing amount', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).send({ method: PaymentMethod.CASH, idempotencyKey: 'sec-11' });
    expect(res.status).toBe(400);
  });
  it('SEC-PAY-12: Reject non-string amount', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).send({ amount: 10, method: PaymentMethod.CASH, idempotencyKey: 'sec-12' });
    expect(res.status).toBe(400);
  });
  it('SEC-PAY-13: Reject invalid decimal strings', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).send({ amount: "12.34.56", method: PaymentMethod.CASH, idempotencyKey: 'sec-13' });
    expect(res.status).toBe(400);
  });
  it('SEC-PAY-14: Reject negative amount', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).send({ amount: "-100.00", method: PaymentMethod.CASH, idempotencyKey: 'sec-14' });
    expect(res.status).toBe(400);
  });
  it('SEC-PAY-15: Reject zero amount', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).send({ amount: "0.00", method: PaymentMethod.CASH, idempotencyKey: 'sec-15' });
    expect(res.status).toBe(400);
  });
  it('SEC-PAY-16: Reject missing idempotencyKey', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).send({ amount: "10.00", method: PaymentMethod.CASH });
    expect(res.status).toBe(400);
  });
  it('SEC-PAY-20: Reject missing paymentMethod', async () => {
    const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).send({ amount: "10.00", idempotencyKey: 'sec-20' });
    expect(res.status).toBe(400);
  });
});
