export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export interface InvoiceCreatePayload {
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
    discountAmount?: string;
    gstRate: string;
  }>;
}

export type InvoiceUpdatePayload = InvoiceCreatePayload;

export interface InvoiceListItemResponse {
  id: string;
  clientId: string;
  invoiceNumber: string | null;
  financialYear: string | null;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  placeOfSupplyState: string;
  placeOfSupplyStateCode: string;
  subtotal: string;
  discountTotal: string;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  total: string;
  paidAmount: string;
  outstandingAmount: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListResponse {
  data: InvoiceListItemResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface InvoiceDetailResponse {
  id: string;
  clientId: string;
  invoiceNumber: string | null;
  financialYear: string | null;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  placeOfSupplyState: string;
  placeOfSupplyStateCode: string;
  notes: string | null;
  terms: string | null;
  subtotal: string;
  discountTotal: string;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  total: string;
  paidAmount: string;
  outstandingAmount: string;
  items: Array<{
    id: string;
    lineNumber: number;
    description: string;
    sacCode: string | null;
    quantity: string;
    rate: string;
    discountAmount: string;
    taxableAmount: string;
    gstRate: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    totalAmount: string;
  }>;
  payments: import('../../payments/types/payments.types').PaymentResponse[];
  createdByUserId: string | null;
  sentByUserId: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientListResponse {
  data: ClientResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
