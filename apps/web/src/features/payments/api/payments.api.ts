import { apiClient } from '../../../lib/api/client';
import type { PaymentRecordPayload, PaymentReversePayload, PaymentResponse } from '../types/payments.types';

export const paymentsApi = {
  recordPayment: async (invoiceId: string, payload: PaymentRecordPayload): Promise<PaymentResponse> => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    return apiClient.post<PaymentResponse>(`/invoices/${invoiceId}/payments`, { 
      body: payload,
      headers: { 'x-csrf-token': csrfToken }
    });
  },

  reversePayment: async (invoiceId: string, paymentId: string, payload: PaymentReversePayload): Promise<PaymentResponse> => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    return apiClient.post<PaymentResponse>(`/invoices/${invoiceId}/payments/${paymentId}/reverse`, { 
      body: payload,
      headers: { 'x-csrf-token': csrfToken }
    });
  },
};
