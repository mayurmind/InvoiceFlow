import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole, PaymentMethod, Payment } from '../../src/generated/prisma/client';
import { Prisma } from '../../src/generated/prisma/client';
import { PaymentsService } from '../../src/features/payments/payments.service';

const makePaymentFixture = (overrides: Partial<Payment> = {}): Payment => ({
  id: '550e8400-e29b-41d4-a716-446655440001',
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
    reversePayment: vi.fn(),
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
      req.auth = {
        user: { id: 'test-user', role, email: 'test@example.com' },
      } as unknown as import('../../src/features/auth/auth.middleware').AuthContext;
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

describe('P7.2 Security Matrix: Payment Reversal', () => {
  const invoiceId = '550e8400-e29b-41d4-a716-446655440000';
  const paymentId = '550e8400-e29b-41d4-a716-446655440001';
  const url = `/api/v1/invoices/${invoiceId}/payments/${paymentId}/reverse`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PaymentsService.reversePayment).mockResolvedValue(
      makePaymentFixture({ id: paymentId, status: 'REVERSED', reversalReason: 'Mistake' }),
    );
  });

  // Authentication & Authorization
  it('SEC-REV-01: SUPER_ADMIN can reverse payment', async () => {
    const res = await request(app)
      .post(url)
      .set('x-mock-role', UserRole.SUPER_ADMIN)
      .send({ reversalReason: 'Mistake' });
    expect(res.status).toBe(200);
  });
  it('SEC-REV-02: STAFF can reverse payment', async () => {
    const res = await request(app)
      .post(url)
      .set('x-mock-role', UserRole.STAFF)
      .send({ reversalReason: 'Mistake' });
    expect(res.status).toBe(200);
  });
  it('SEC-REV-03: VIEWER cannot reverse payment (403)', async () => {
    const res = await request(app)
      .post(url)
      .set('x-mock-role', UserRole.VIEWER)
      .send({ reversalReason: 'Mistake' });
    expect(res.status).toBe(403);
  });
  it('SEC-REV-04: Unauthenticated rejected (401)', async () => {
    const res = await request(app)
      .post(url)
      .set('x-mock-auth', 'none')
      .send({ reversalReason: 'Mistake' });
    expect(res.status).toBe(401);
  });
  it('SEC-REV-05: Missing Origin rejected (403)', async () => {
    const res = await request(app)
      .post(url)
      .set('x-origin-verified', 'false')
      .send({ reversalReason: 'Mistake' });
    expect(res.status).toBe(403);
  });

  // Input Validation
  it('SEC-REV-11: Reject missing reversalReason', async () => {
    const res = await request(app).post(url).send({});
    expect(res.status).toBe(400);
  });
  it('SEC-REV-12: Reject empty reversalReason', async () => {
    const res = await request(app).post(url).send({ reversalReason: '' });
    expect(res.status).toBe(400);
  });
  it('SEC-REV-13: Reject exceedingly long reversalReason', async () => {
    const res = await request(app)
      .post(url)
      .send({ reversalReason: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });
});
