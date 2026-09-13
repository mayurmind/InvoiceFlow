export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export const PaymentMethod = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  UPI: 'UPI',
  CASH: 'CASH',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

export const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

export interface DashboardSummaryDto {
  outstandingAmount: string;
  paidAmount: string;
  invoiceStatusCounts: Record<InvoiceStatus, number>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    status: InvoiceStatus;
    dueDate: string;
    clientName: string;
    total: string;
  }>;
  recentPayments: Array<{
    id: string;
    invoiceId: string;
    amount: string;
    method: PaymentMethod;
    status: PaymentStatus;
    paidAt: string;
  }>;
}

export interface ClientListResponse {
  data: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
