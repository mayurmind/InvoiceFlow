import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentsService } from '../../../src/features/payments/payments.service';
import { PaymentsRepository } from '../../../src/features/payments/payments.repository';
import { Prisma, InvoiceStatus, PaymentMethod, PaymentStatus } from '../../../src/generated/prisma/client';
import { ConflictError, NotFoundError } from '../../../src/errors/application.error';
import { Payment, Invoice } from '../../../src/generated/prisma/client';

const makeInvoiceFixture = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-uuid',
  clientId: 'client-1',
  invoiceNumber: 'INV/2026/001',
  financialYear: '2026',
  status: InvoiceStatus.PAID,
  invoiceDate: new Date(),
  dueDate: new Date(),
  subtotal: new Prisma.Decimal(100),
  discountTotal: new Prisma.Decimal(0),
  taxableTotal: new Prisma.Decimal(100),
  cgstTotal: new Prisma.Decimal(0),
  sgstTotal: new Prisma.Decimal(0),
  igstTotal: new Prisma.Decimal(0),
  total: new Prisma.Decimal(100),
  paidAmount: new Prisma.Decimal(100),
  outstandingAmount: new Prisma.Decimal(0),
  placeOfSupplyState: 'Maharashtra',
  placeOfSupplyStateCode: '27',
  currency: 'INR',
  snapshotVersion: 1,
  businessSnapshot: null,
  clientSnapshot: null,
  terms: null,
  notes: null,
  sentAt: null,
  cancelledAt: null,
  cancellationReason: null,
  createdByUserId: 'user-1',
  sentByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makePaymentFixture = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'pay-1',
  invoiceId: 'inv-uuid',
  amount: new Prisma.Decimal(100),
  method: PaymentMethod.BANK_TRANSFER,
  status: PaymentStatus.RECORDED,
  reference: null,
  notes: null,
  idempotencyKey: 'key-1',
  paidAt: new Date(),
  recordedByUserId: 'user-1',
  reversedAt: null,
  reversedByUserId: null,
  reversalReason: null,
  createdAt: new Date(),
  ...overrides,
});

vi.mock('../../../src/features/payments/payments.repository');
vi.mock('../../../src/database/transaction', () => ({
  runInTransaction: vi.fn((cb) => cb({})), // pass empty tx object
}));

describe('PaymentsService - reversePayment', () => {
  const actorUserId = 'actor-user-id';
  const invoiceId = 'inv-uuid';
  const paymentId = 'pay-1';
  const auditContext = { requestId: 'req-1', ipAddress: '127.0.0.1', userAgent: 'test' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects if payment not found', async () => {
    vi.mocked(PaymentsRepository.getPaymentById).mockResolvedValue(null);

    await expect(
      PaymentsService.reversePayment(
        invoiceId,
        paymentId,
        actorUserId,
        { reversalReason: 'Mistake' },
        auditContext,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects if payment does not belong to invoice', async () => {
    vi.mocked(PaymentsRepository.getPaymentById).mockResolvedValue(
      makePaymentFixture({ invoiceId: 'other-inv' })
    );

    await expect(
      PaymentsService.reversePayment(
        invoiceId,
        paymentId,
        actorUserId,
        { reversalReason: 'Mistake' },
        auditContext,
      ),
    ).rejects.toThrow(/Payment does not belong to this invoice/);
  });

  it('rejects if payment is already reversed', async () => {
    vi.mocked(PaymentsRepository.getPaymentById).mockResolvedValue(
      makePaymentFixture({ status: PaymentStatus.REVERSED })
    );

    await expect(
      PaymentsService.reversePayment(
        invoiceId,
        paymentId,
        actorUserId,
        { reversalReason: 'Mistake' },
        auditContext,
      ),
    ).rejects.toThrow(/Payment is already reversed/);
  });

  it('rejects if invoice not found', async () => {
    vi.mocked(PaymentsRepository.getPaymentById).mockResolvedValue(makePaymentFixture());
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(null);

    await expect(
      PaymentsService.reversePayment(
        invoiceId,
        paymentId,
        actorUserId,
        { reversalReason: 'Mistake' },
        auditContext,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects if reversal would result in negative paid amount (inconsistent state)', async () => {
    vi.mocked(PaymentsRepository.getPaymentById).mockResolvedValue(makePaymentFixture({ amount: new Prisma.Decimal(100) }));
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(makeInvoiceFixture({
      status: InvoiceStatus.PARTIALLY_PAID,
      paidAmount: new Prisma.Decimal(50), // Less than payment amount
      outstandingAmount: new Prisma.Decimal(50)
    }));

    await expect(
      PaymentsService.reversePayment(
        invoiceId,
        paymentId,
        actorUserId,
        { reversalReason: 'Inconsistent state' },
        auditContext,
      ),
    ).rejects.toThrow(/negative paid amount/);
  });

  it('reverses a full payment correctly', async () => {
    vi.mocked(PaymentsRepository.getPaymentById).mockResolvedValue(makePaymentFixture());
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(makeInvoiceFixture());
    vi.mocked(PaymentsRepository.updatePaymentStatus).mockResolvedValue(makePaymentFixture({ status: PaymentStatus.REVERSED }));

    await PaymentsService.reversePayment(
      invoiceId,
      paymentId,
      actorUserId,
      { reversalReason: 'Accidental charge' },
      auditContext,
    );

    expect(PaymentsRepository.updatePaymentStatus).toHaveBeenCalledWith(
      paymentId,
      {
        status: PaymentStatus.REVERSED,
        reversedAt: expect.any(Date),
        reversedByUserId: actorUserId,
        reversalReason: 'Accidental charge',
      },
      expect.anything(),
    );

    expect(PaymentsRepository.updateInvoiceTotalsAndStatus).toHaveBeenCalledWith(
      invoiceId,
      {
        paidAmount: new Prisma.Decimal(0),
        outstandingAmount: new Prisma.Decimal(100),
        status: InvoiceStatus.SENT,
      },
      expect.anything(),
    );

    expect(PaymentsRepository.createPaymentAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PAYMENT_REVERSED',
        metadata: expect.objectContaining({
          reason: 'Accidental charge',
          previousInvoiceStatus: InvoiceStatus.PAID,
          resultingInvoiceStatus: InvoiceStatus.SENT,
          previousOutstanding: '0',
          resultingOutstanding: '100',
        }),
      }),
      expect.anything(),
    );
  });

  it('reverses a partial payment correctly', async () => {
    vi.mocked(PaymentsRepository.getPaymentById).mockResolvedValue(makePaymentFixture({ amount: new Prisma.Decimal(40) }));
    vi.mocked(PaymentsRepository.getInvoiceById).mockResolvedValue(makeInvoiceFixture({
      status: InvoiceStatus.PARTIALLY_PAID,
      paidAmount: new Prisma.Decimal(90),
      outstandingAmount: new Prisma.Decimal(10)
    }));
    vi.mocked(PaymentsRepository.updatePaymentStatus).mockResolvedValue(makePaymentFixture({ status: PaymentStatus.REVERSED }));

    await PaymentsService.reversePayment(
      invoiceId,
      paymentId,
      actorUserId,
      { reversalReason: 'Wrong amount' },
      auditContext,
    );

    expect(PaymentsRepository.updateInvoiceTotalsAndStatus).toHaveBeenCalledWith(
      invoiceId,
      {
        paidAmount: new Prisma.Decimal(50),
        outstandingAmount: new Prisma.Decimal(50),
        status: InvoiceStatus.PARTIALLY_PAID,
      },
      expect.anything(),
    );
  });
});
