import { apiClient } from '../../../lib/api/client';
import type { PaymentRecordPayload, PaymentReversePayload, PaymentResponse } from '../types/payments.types';

export const paymentsApi = {
  recordPayment: async (invoiceId: string, payload: PaymentRecordPayload): Promise<PaymentResponse> => {
    return apiClient.post<PaymentResponse>(`/invoices/${invoiceId}/payments`, { body: payload });
  },

  reversePayment: async (invoiceId: string, paymentId: string, payload: PaymentReversePayload): Promise<PaymentResponse> => {
    return apiClient.post<PaymentResponse>(`/invoices/${invoiceId}/payments/${paymentId}/reverse`, { body: payload });
  },
};
