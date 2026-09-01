import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole, PaymentMethod, Payment } from '../../src/generated/prisma/client';
import { Prisma } from '../../src/generated/prisma/client';

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

import { PaymentsService } from '../../src/features/payments/payments.service';
import { ConflictError, NotFoundError } from '../../src/errors/application.error';

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

describe('Integration: Payments Reversal Route', () => {
  const invoiceId = '550e8400-e29b-41d4-a716-446655440000';
  const paymentId = '550e8400-e29b-41d4-a716-446655440001';
  const url = `/api/v1/invoices/${invoiceId}/payments/${paymentId}/reverse`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reverses a valid payment and returns it', async () => {
    vi.mocked(PaymentsService.reversePayment).mockResolvedValue(
      makePaymentFixture({ id: paymentId, status: 'REVERSED', reversalReason: 'Mistake' }),
    );

    const res = await request(app).post(url).send({
      reversalReason: 'Mistake',
    });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(paymentId);
    expect(res.body.status).toBe('REVERSED');
  });

  it('rejects reversal of an already reversed payment', async () => {
    vi.mocked(PaymentsService.reversePayment).mockRejectedValue(
      new ConflictError('Payment is already reversed'),
    );

    const res = await request(app).post(url).send({
      reversalReason: 'Already done',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects reversal if payment not found', async () => {
    vi.mocked(PaymentsService.reversePayment).mockRejectedValue(
      new NotFoundError('Payment not found'),
    );

    const res = await request(app).post(url).send({
      reversalReason: 'Wrong ID',
    });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
