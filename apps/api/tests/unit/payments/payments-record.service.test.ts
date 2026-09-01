import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentsService } from '../../../src/features/payments/payments.service';
import { PaymentsRepository } from '../../../src/features/payments/payments.repository';
import { Prisma, InvoiceStatus, PaymentMethod } from '../../../src/generated/prisma/client';
import { ConflictError, NotFoundError } from '../../../src/errors/application.error';
import { Payment, Invoice } from '../../../src/generated/prisma/client';

const makeInvoiceFixture = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-uuid',
  clientId: 'client-1',
  invoiceNumber: 'INV/2026/001',
  financialYear: '2026',
  status: InvoiceStatus.SENT,
  issueDate: new Date(),
  dueDate: new Date(),
  subtotal: new Prisma.Decimal(100),
  taxTotal: new Prisma.Decimal(0),
  total: new Prisma.Decimal(100),
  paidAmount: new Prisma.Decimal(0),
  outstandingAmount: new Prisma.Decimal(100),
  terms: null,
  notes: null,
  createdById: 'user-1',
  updatedById: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  ...overrides,
});

const makePaymentFixture = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'pay-1',
  invoiceId: 'inv-uuid',
  amount: new Prisma.Decimal(100),
  method: PaymentMethod.BANK_TRANSFER,
  status: 'RECORDED',
  reference: null,
  notes: null,
  idempotencyKey: 'key-1',
  paidAt: new Date(),
  recordedByUserId: 'user-1',
  reversedAt: null,
  reversedByUserId: null,
  reversalReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

vi.mock('../../../src/features/payments/payments.repository');
vi.mock('../../../src/database/transaction', () => ({
  runInTransaction: vi.fn((cb) => cb({})), // pass empty tx object
}));

describe('PaymentsService - recordPayment', () => {
  const actorUserId = 'actor-user-id';
  const invoiceId = 'inv-uuid';
  const auditContext = { requestId: 'req-1', ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects if invoice not found', async () => {
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(null);

    await expect(
      PaymentsService.recordPayment(
        invoiceId,
        actorUserId,
        {
          amount: '100.00',
          method: PaymentMethod.BANK_TRANSFER,
          idempotencyKey: 'key-1',
        },
        auditContext,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns existing payment if idempotency key matches completely', async () => {
    const existingPayment = makePaymentFixture();

    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(makeInvoiceFixture());
    vi.mocked(PaymentsRepository.getPaymentByIdempotencyKey).mockResolvedValue(existingPayment);

    const result = await PaymentsService.recordPayment(
      invoiceId,
      actorUserId,
      {
        amount: '100.00',
        method: PaymentMethod.BANK_TRANSFER,
        idempotencyKey: 'key-1',
      },
      auditContext,
    );

    expect(result).toEqual(existingPayment);
    expect(PaymentsRepository.createPaymentRecord).not.toHaveBeenCalled();
  });

  it('throws ConflictError if idempotency key payload mismatches', async () => {
    const existingPayment = makePaymentFixture({ amount: new Prisma.Decimal(200) });

    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(makeInvoiceFixture());
    vi.mocked(PaymentsRepository.getPaymentByIdempotencyKey).mockResolvedValue(existingPayment);

    await expect(
      PaymentsService.recordPayment(
        invoiceId,
        actorUserId,
        {
          amount: '100.00',
          method: PaymentMethod.BANK_TRANSFER,
          idempotencyKey: 'key-1',
        },
        auditContext,
      ),
    ).rejects.toThrow(ConflictError);
  });

  it('throws ConflictError if invoice is DRAFT', async () => {
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(
      makeInvoiceFixture({ status: InvoiceStatus.DRAFT }),
    );
    vi.mocked(PaymentsRepository.getPaymentByIdempotencyKey).mockResolvedValue(null);

    await expect(
      PaymentsService.recordPayment(
        invoiceId,
        actorUserId,
        {
          amount: '100.00',
          method: PaymentMethod.BANK_TRANSFER,
          idempotencyKey: 'key-1',
        },
        auditContext,
      ),
    ).rejects.toThrow(/Cannot record payment on invoice in DRAFT status/);
  });

  it('throws ConflictError on overpayment', async () => {
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(
      makeInvoiceFixture({ outstandingAmount: new Prisma.Decimal(50) }),
    );
    vi.mocked(PaymentsRepository.getPaymentByIdempotencyKey).mockResolvedValue(null);

    await expect(
      PaymentsService.recordPayment(
        invoiceId,
        actorUserId,
        {
          amount: '100.00',
          method: PaymentMethod.BANK_TRANSFER,
          idempotencyKey: 'key-1',
        },
        auditContext,
      ),
    ).rejects.toThrow(/Payment amount exceeds outstanding balance/);
  });

  it('processes partial payment correctly', async () => {
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(
      makeInvoiceFixture({
        paidAmount: new Prisma.Decimal(0),
        outstandingAmount: new Prisma.Decimal(100),
      }),
    );
    vi.mocked(PaymentsRepository.getPaymentByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(PaymentsRepository.createPaymentRecord).mockResolvedValue(
      makePaymentFixture({ id: 'pay-new' }),
    );

    await PaymentsService.recordPayment(
      invoiceId,
      actorUserId,
      {
        amount: '40.00',
        method: PaymentMethod.BANK_TRANSFER,
        idempotencyKey: 'key-1',
      },
      auditContext,
    );

    expect(PaymentsRepository.updateInvoiceTotalsAndStatus).toHaveBeenCalledWith(
      invoiceId,
      {
        paidAmount: new Prisma.Decimal(40),
        outstandingAmount: new Prisma.Decimal(60),
        status: InvoiceStatus.PARTIALLY_PAID,
      },
      expect.anything(),
    );

    expect(PaymentsRepository.createPaymentAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_CREATED',
        metadata: expect.objectContaining({
          previousInvoiceStatus: InvoiceStatus.SENT,
          resultingInvoiceStatus: InvoiceStatus.PARTIALLY_PAID,
          previousOutstanding: '100',
          resultingOutstanding: '60',
        }),
      }),
      expect.anything(),
    );
  });

  it('processes full payment correctly', async () => {
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(
      makeInvoiceFixture({
        status: InvoiceStatus.PARTIALLY_PAID,
        paidAmount: new Prisma.Decimal(40),
        outstandingAmount: new Prisma.Decimal(60),
      }),
    );
    vi.mocked(PaymentsRepository.getPaymentByIdempotencyKey).mockResolvedValue(null);
    vi.mocked(PaymentsRepository.createPaymentRecord).mockResolvedValue(
      makePaymentFixture({ id: 'pay-full', method: PaymentMethod.CASH }),
    );

    await PaymentsService.recordPayment(
      invoiceId,
      actorUserId,
      {
        amount: '60.00',
        method: PaymentMethod.CASH,
        idempotencyKey: 'key-2',
      },
      auditContext,
    );

    expect(PaymentsRepository.updateInvoiceTotalsAndStatus).toHaveBeenCalledWith(
      invoiceId,
      {
        paidAmount: new Prisma.Decimal(100),
        outstandingAmount: new Prisma.Decimal(0),
        status: InvoiceStatus.PAID,
      },
      expect.anything(),
    );
  });
});
