import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { UserRole, PaymentMethod, Payment } from '../../src/generated/prisma/client';
import { Prisma } from '../../src/generated/prisma/client';

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

// Mock the PaymentsService
vi.mock('../../src/features/payments/payments.service', () => ({
  PaymentsService: {
    recordPayment: vi.fn(),
  },
}));

import { PaymentsService } from '../../src/features/payments/payments.service';
import { ConflictError } from '../../src/errors/application.error';

// Mock auth middlewares
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

describe('Integration: Payments Recording Route', () => {
  const invoiceId = '550e8400-e29b-41d4-a716-446655440000';
  const url = `/api/v1/invoices/${invoiceId}/payments`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a valid payment and updates invoice to PARTIALLY_PAID', async () => {
    vi.mocked(PaymentsService.recordPayment).mockResolvedValue(makePaymentFixture({ id: 'pay-123' }));

    const res = await request(app).post(url).send({
      amount: "40.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: 'idem-1',
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('pay-123');
  });

  it('rejects overpayment', async () => {
    vi.mocked(PaymentsService.recordPayment).mockRejectedValue(new ConflictError('Payment amount exceeds outstanding balance'));

    const res = await request(app).post(url).send({
      amount: "150.00",
      method: PaymentMethod.CASH,
      idempotencyKey: 'idem-2',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns existing payment for idempotent replay', async () => {
    vi.mocked(PaymentsService.recordPayment).mockResolvedValue(makePaymentFixture({ id: 'existing-pay' }));

    const res = await request(app).post(url).send({
      amount: "40.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: 'idem-1',
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('existing-pay');
  });

  it('rejects idempotent replay with conflicting payload', async () => {
    vi.mocked(PaymentsService.recordPayment).mockRejectedValue(new ConflictError('Idempotency key already used with different payload'));

    const res = await request(app).post(url).send({
      amount: "50.00", // conflicting amount
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: 'idem-1',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects payment on DRAFT invoice', async () => {
    vi.mocked(PaymentsService.recordPayment).mockRejectedValue(new ConflictError('Cannot record payment on invoice in DRAFT status'));

    const res = await request(app).post(url).send({
      amount: "40.00",
      method: PaymentMethod.BANK_TRANSFER,
      idempotencyKey: 'idem-3',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});
