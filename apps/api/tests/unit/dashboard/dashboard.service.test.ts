import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../../../src/features/dashboard/dashboard.service';
import { DashboardRepository } from '../../../src/features/dashboard/dashboard.repository';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../../src/generated/prisma/client';

vi.mock('../../../src/features/dashboard/dashboard.repository');

describe('DashboardService - getSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates dashboard data correctly', async () => {
    vi.mocked(DashboardRepository.getInvoiceTotals).mockResolvedValue({
      outstandingAmount: new Prisma.Decimal(500),
      paidAmount: new Prisma.Decimal(1000),
    });

    vi.mocked(DashboardRepository.getInvoiceStatusCounts).mockResolvedValue([
      { status: InvoiceStatus.PAID, _count: { id: 10 } },
      { status: InvoiceStatus.SENT, _count: { id: 5 } },
    ] as never);

    vi.mocked(DashboardRepository.getRecentInvoices).mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNumber: 'INV/001',
        status: InvoiceStatus.SENT,
        dueDate: new Date('2026-10-01T00:00:00.000Z'),
        client: { name: 'Acme Corp' },
        total: new Prisma.Decimal(100),
      } as never,
    ]);

    vi.mocked(DashboardRepository.getRecentPayments).mockResolvedValue([
      {
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(100),
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.RECORDED,
        paidAt: new Date('2026-09-01T00:00:00.000Z'),
      } as never,
    ]);

    const result = await DashboardService.getSummary();

    expect(result.outstandingAmount).toBe('500');
    expect(result.paidAmount).toBe('1000');
    expect(result.invoiceStatusCounts[InvoiceStatus.PAID]).toBe(10);
    expect(result.invoiceStatusCounts[InvoiceStatus.SENT]).toBe(5);
    expect(result.invoiceStatusCounts[InvoiceStatus.DRAFT]).toBe(0); // Defaulted
    expect(result.recentInvoices[0].clientName).toBe('Acme Corp');
    expect(result.recentInvoices[0].dueDate).toBe('2026-10-01T00:00:00.000Z');
    expect(result.recentPayments[0].amount).toBe('100');
  });
});
