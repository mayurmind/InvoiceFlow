import { apiClient } from '../../../lib/api/client';
import type { InvoiceCreatePayload, InvoiceDetailResponse, InvoiceUpdatePayload } from '../types/invoice.types';

export const invoicesApi = {
  createInvoice: async (payload: InvoiceCreatePayload): Promise<InvoiceDetailResponse> => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    const response = await apiClient.post<InvoiceDetailResponse>('/invoices', {
      body: payload,
      headers: { 'x-csrf-token': csrfToken },
    });
    return response as unknown as InvoiceDetailResponse;
  },

  updateInvoice: async (invoiceId: string, payload: InvoiceUpdatePayload): Promise<InvoiceDetailResponse> => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    const response = await apiClient.put<InvoiceDetailResponse>(`/invoices/${invoiceId}`, {
      body: payload,
      headers: { 'x-csrf-token': csrfToken },
    });
    return response as unknown as InvoiceDetailResponse;
  },

  issueInvoice: async (invoiceId: string): Promise<InvoiceDetailResponse> => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    const response = await apiClient.post<InvoiceDetailResponse>(`/invoices/${invoiceId}/issue`, {
      body: {},
      headers: { 'x-csrf-token': csrfToken },
    });
    return response as unknown as InvoiceDetailResponse;
  },

  cancelInvoice: async (invoiceId: string, payload: { reason: string }): Promise<InvoiceDetailResponse> => {
    const { csrfToken } = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
    const response = await apiClient.post<InvoiceDetailResponse>(`/invoices/${invoiceId}/cancel`, {
      body: payload,
      headers: { 'x-csrf-token': csrfToken },
    });
    return response as unknown as InvoiceDetailResponse;
  },
};

