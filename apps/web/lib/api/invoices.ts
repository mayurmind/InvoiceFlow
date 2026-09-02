import { apiClient } from './client';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface InvoiceItem {
  id?: string;
  description: string;
  sacCode?: string | null;
  quantity: string;
  rate: string;
  discountAmount: string;
  taxableAmount?: string;
  gstRate: string;
  cgstAmount?: string;
  sgstAmount?: string;
  igstAmount?: string;
  total?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  placeOfSupplyStateCode: string;
  notes?: string | null;
  terms?: string | null;
  subtotal: string;
  totalDiscount: string;
  totalTaxable: string;
  totalCgst: string;
  totalSgst: string;
  totalIgst: string;
  totalGst: string;
  total: string;
  paidAmount: string;
  outstandingAmount: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  issuedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  clientId: string;
  client?: {
    id: string;
    name: string;
    email?: string | null;
    gstin?: string | null;
    addressLine1?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    postalCode?: string;
  };
  items: InvoiceItem[];
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
  clientId?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export interface CreateInvoicePayload {
  clientId: string;
  invoiceDate: string;
  dueDate?: string;
  placeOfSupplyStateCode?: string;
  notes?: string | null;
  terms?: string | null;
  items: Array<{
    description: string;
    sacCode?: string | null;
    quantity: string;
    rate: string;
    discountAmount: string;
    gstRate: string;
  }>;
}

export interface EmailDelivery {
  id: string;
  recipientEmail: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  providerMessageId?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export async function getInvoicesApi(params?: InvoiceListParams): Promise<InvoiceListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.status) query.set('status', params.status);
  if (params?.clientId) query.set('clientId', params.clientId);
  if (params?.invoiceDateFrom) query.set('invoiceDateFrom', params.invoiceDateFrom);
  if (params?.invoiceDateTo) query.set('invoiceDateTo', params.invoiceDateTo);
  if (params?.dueDateFrom) query.set('dueDateFrom', params.dueDateFrom);
  if (params?.dueDateTo) query.set('dueDateTo', params.dueDateTo);

  const qs = query.toString();
  return apiClient<InvoiceListResponse>(`/api/v1/invoices${qs ? `?${qs}` : ''}`);
}

export async function getInvoiceApi(id: string): Promise<{ invoice: Invoice }> {
  return apiClient<{ invoice: Invoice }>(`/api/v1/invoices/${id}`);
}

export async function createInvoiceApi(data: CreateInvoicePayload): Promise<{ invoice: Invoice }> {
  return apiClient<{ invoice: Invoice }>('/api/v1/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateInvoiceApi(
  id: string,
  data: CreateInvoicePayload,
): Promise<{ invoice: Invoice }> {
  return apiClient<{ invoice: Invoice }>(`/api/v1/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function issueInvoiceApi(id: string): Promise<{ invoice: Invoice }> {
  return apiClient<{ invoice: Invoice }>(`/api/v1/invoices/${id}/issue`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function cancelInvoiceApi(id: string, reason: string): Promise<{ invoice: Invoice }> {
  return apiClient<{ invoice: Invoice }>(`/api/v1/invoices/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function getInvoicePdfBlobApi(id: string): Promise<Blob> {
  return apiClient<Blob>(`/api/v1/invoices/${id}/pdf`);
}

export async function sendInvoiceEmailApi(
  id: string,
): Promise<{ success: boolean; messageId?: string }> {
  return apiClient<{ success: boolean; messageId?: string }>(`/api/v1/invoices/${id}/send`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function resendInvoiceEmailApi(
  id: string,
): Promise<{ success: boolean; messageId?: string }> {
  return apiClient<{ success: boolean; messageId?: string }>(`/api/v1/invoices/${id}/resend`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getInvoiceEmailDeliveriesApi(
  id: string,
): Promise<{ emailDeliveries: EmailDelivery[] }> {
  return apiClient<{ emailDeliveries: EmailDelivery[] }>(`/api/v1/invoices/${id}/email-deliveries`);
}
