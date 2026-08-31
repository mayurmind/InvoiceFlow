import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoicesService } from '../../../src/features/invoices/invoices.service';
import { InvoicesRepository } from '../../../src/features/invoices/invoices.repository';
import { InvoiceStatus, Prisma } from '../../../src/generated/prisma/client';
import { ConflictError } from '../../../src/errors/application.error';

vi.mock('../../../src/features/invoices/invoices.repository', () => ({
  InvoicesRepository: {
    lockInvoiceForUpdate: vi.fn(),
    getInvoiceWithItems: vi.fn(),
    hasActiveRecordedPayments: vi.fn(),
    hasPendingEmailDeliveries: vi.fn(),
    markInvoiceCancelled: vi.fn(),
    createInvoiceAuditLog: vi.fn(),
  },
}));

vi.mock('../../../src/database/transaction', () => ({
  runInTransaction: vi.fn((cb) => cb({} as unknown)),
}));

const makeInvoiceFixture = (overrides = {}) => ({
  id: 'inv-123',
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

describe('InvoicesService.cancelInvoice Unit Tests', () => {
  const actorUserId = 'actor-user-id';
  const invoiceId = 'inv-123';
  const reason = 'Client requested cancellation';
  const auditContext = { requestId: 'req-1', ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(() => {
    vi.clearAllMocks();

    const before = makeInvoiceFixture();
    const after = makeInvoiceFixture({
      status: InvoiceStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason,
      updatedAt: new Date(),
    });

    vi.mocked(InvoicesRepository.getInvoiceWithItems)
      .mockResolvedValueOnce(
        before as Awaited<ReturnType<typeof InvoicesRepository.getInvoiceWithItems>>,
      )
      .mockResolvedValueOnce(
        after as Awaited<ReturnType<typeof InvoicesRepository.getInvoiceWithItems>>,
      );

    vi.mocked(InvoicesRepository.hasActiveRecordedPayments).mockResolvedValue(false);
    vi.mocked(InvoicesRepository.hasPendingEmailDeliveries).mockResolvedValue(false);
    vi.mocked(InvoicesRepository.markInvoiceCancelled).mockResolvedValue(
      after as Awaited<ReturnType<typeof InvoicesRepository.markInvoiceCancelled>>,
    );
  });

  it('orchestrates narrow cancellation and audit exactly once', async () => {
    const res = await InvoicesService.cancelInvoice(actorUserId, invoiceId, reason, auditContext);

    expect(InvoicesRepository.lockInvoiceForUpdate).toHaveBeenCalledWith(
      invoiceId,
      expect.anything(),
    );
    expect(InvoicesRepository.markInvoiceCancelled).toHaveBeenCalledWith(
      invoiceId,
      { cancelledAt: expect.any(Date), cancellationReason: reason },
      expect.anything(),
    );
    expect(InvoicesRepository.createInvoiceAuditLog).toHaveBeenCalledTimes(1);
    expect(InvoicesRepository.createInvoiceAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { previousStatus: 'SENT', resultingStatus: 'CANCELLED', reason },
      }),
      expect.anything(),
    );
    expect(res.status).toBe(InvoiceStatus.CANCELLED);
  });

  it('rolls back and blocks if preconditions fail', async () => {
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockReset();
    vi.mocked(InvoicesRepository.getInvoiceWithItems).mockResolvedValue(
      makeInvoiceFixture({ status: InvoiceStatus.DRAFT }) as Awaited<
        ReturnType<typeof InvoicesRepository.getInvoiceWithItems>
      >,
    );
    await expect(
      InvoicesService.cancelInvoice(actorUserId, invoiceId, reason, auditContext),
    ).rejects.toThrowError(new ConflictError('Only SENT invoices can be cancelled'));

    expect(InvoicesRepository.markInvoiceCancelled).not.toHaveBeenCalled();
    expect(InvoicesRepository.createInvoiceAuditLog).not.toHaveBeenCalled();
  });
});
