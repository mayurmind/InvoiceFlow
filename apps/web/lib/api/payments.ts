import { apiClient } from './client';
import { Invoice } from './invoices';

export type PaymentMethod = 'BANK_TRANSFER' | 'UPI' | 'CASH' | 'CHEQUE' | 'OTHER';
export type PaymentStatus = 'COMPLETED' | 'REVERSED';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string | null;
  notes?: string | null;
  reversalReason?: string | null;
  reversedAt?: string | null;
  paidAt: string;
  createdAt: string;
}

export interface RecordPaymentPayload {
  amount: string;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  idempotencyKey?: string;
}

export interface ReversePaymentPayload {
  reversalReason: string;
}

export interface RecordPaymentResponse {
  payment: Payment;
  invoice: Invoice;
}

export interface ReversePaymentResponse {
  payment: Payment;
  invoice: Invoice;
}

export async function recordPaymentApi(
  invoiceId: string,
  payload: RecordPaymentPayload,
): Promise<RecordPaymentResponse> {
  const idempotencyKey =
    payload.idempotencyKey || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  return apiClient<RecordPaymentResponse>(`/api/v1/invoices/${invoiceId}/payments`, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      idempotencyKey,
    }),
  });
}

export async function reversePaymentApi(
  invoiceId: string,
  paymentId: string,
  payload: ReversePaymentPayload,
): Promise<ReversePaymentResponse> {
  return apiClient<ReversePaymentResponse>(
    `/api/v1/invoices/${invoiceId}/payments/${paymentId}/reverse`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
