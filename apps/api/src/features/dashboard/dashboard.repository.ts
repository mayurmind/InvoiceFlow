import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma';

export class DashboardRepository {
  static async getInvoiceTotals() {
    const [outstandingResult, paidResult] = await Promise.all([
      prisma.invoice.aggregate({
        _sum: { outstandingAmount: true },
        where: { status: { in: ['SENT', 'PARTIALLY_PAID'] } },
      }),
      prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'PAID'] } },
      }),
    ]);

    return {
      outstandingAmount: outstandingResult._sum.outstandingAmount || new Prisma.Decimal(0),
      paidAmount: paidResult._sum.paidAmount || new Prisma.Decimal(0),
    };
  }

  static async getInvoiceStatusCounts() {
    const counts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    return counts;
  }

  static async getRecentInvoices(limit: number = 5) {
    return prisma.invoice.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        client: {
          select: { name: true },
        },
      },
    });
  }

  static async getRecentPayments(limit: number = 5) {
    return prisma.payment.findMany({
      orderBy: {
        paidAt: 'desc',
      },
      take: limit,
    });
  }
}
