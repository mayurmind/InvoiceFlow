import { InvoiceStatus } from '../../generated/prisma/client';
import { DashboardRepository } from './dashboard.repository';
import { DashboardSummaryDto } from './dashboard.schemas';

export class DashboardService {
  static async getSummary(): Promise<DashboardSummaryDto> {
    const [totals, statusCountsRaw, recentInvoicesRaw, recentPaymentsRaw] = await Promise.all([
      DashboardRepository.getInvoiceTotals(),
      DashboardRepository.getInvoiceStatusCounts(),
      DashboardRepository.getRecentInvoices(5),
      DashboardRepository.getRecentPayments(5),
    ]);

    // Initialize all counts to 0
    const statusCounts = {
      [InvoiceStatus.DRAFT]: 0,
      [InvoiceStatus.SENT]: 0,
      [InvoiceStatus.PARTIALLY_PAID]: 0,
      [InvoiceStatus.PAID]: 0,
      [InvoiceStatus.CANCELLED]: 0,
    };

    // Populate counts
    statusCountsRaw.forEach((count) => {
      statusCounts[count.status] = count._count.id;
    });

    return {
      outstandingAmount: totals.outstandingAmount.toString(),
      paidAmount: totals.paidAmount.toString(),
      invoiceStatusCounts: statusCounts,
      recentInvoices: recentInvoicesRaw.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        dueDate: inv.dueDate.toISOString(), // Standardizing as ISO 8601 strings
        clientName: inv.client.name,
        total: inv.total.toString(),
      })),
      recentPayments: recentPaymentsRaw.map((pay) => ({
        id: pay.id,
        invoiceId: pay.invoiceId,
        amount: pay.amount.toString(),
        method: pay.method,
        status: pay.status,
        paidAt: pay.paidAt.toISOString(),
      })),
    };
  }
}
