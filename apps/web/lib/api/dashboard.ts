import { apiClient } from './client';

export interface DashboardSummary {
  outstandingAmount: string;
  paidAmount: string;
  invoiceStatusCounts: {
    DRAFT: number;
    SENT: number;
    PARTIALLY_PAID: number;
    PAID: number;
    CANCELLED: number;
  };
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string | null;
    status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
    dueDate: string;
    clientName: string;
    total: string;
  }>;
  recentPayments: Array<{
    id: string;
    invoiceId: string;
    amount: string;
    method: 'BANK_TRANSFER' | 'UPI' | 'CASH' | 'CHEQUE' | 'OTHER';
    status: 'COMPLETED' | 'REVERSED';
    paidAt: string;
  }>;
}

export async function getDashboardSummaryApi(): Promise<DashboardSummary> {
  return apiClient<DashboardSummary>('/api/v1/dashboard/summary');
}
