import { z } from 'zod';
import { InvoiceStatus, PaymentMethod, PaymentStatus } from '../../generated/prisma/client';

export const dashboardSummaryResponseSchema = z.object({
  outstandingAmount: z.string(),
  paidAmount: z.string(),
  invoiceStatusCounts: z.object({
    [InvoiceStatus.DRAFT]: z.number(),
    [InvoiceStatus.SENT]: z.number(),
    [InvoiceStatus.PARTIALLY_PAID]: z.number(),
    [InvoiceStatus.PAID]: z.number(),
    [InvoiceStatus.CANCELLED]: z.number(),
  }),
  recentInvoices: z.array(
    z.object({
      id: z.string().uuid(),
      invoiceNumber: z.string().nullable(),
      status: z.nativeEnum(InvoiceStatus),
      dueDate: z.string(),
      clientName: z.string(),
      total: z.string(),
    })
  ),
  recentPayments: z.array(
    z.object({
      id: z.string().uuid(),
      invoiceId: z.string().uuid(),
      amount: z.string(),
      method: z.nativeEnum(PaymentMethod),
      status: z.nativeEnum(PaymentStatus),
      paidAt: z.string(),
    })
  ),
});

export type DashboardSummaryDto = z.infer<typeof dashboardSummaryResponseSchema>;
