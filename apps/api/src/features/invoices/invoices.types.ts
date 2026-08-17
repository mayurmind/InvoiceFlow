import { InvoiceStatus } from '../../generated/prisma/client';

export interface InvoiceCreatePayload {
  clientId: string;
  invoiceDate: string;
  dueDate?: string;
  placeOfSupplyStateCode?: string;
  notes?: string | null;
  terms?: string | null;
  items: {
    description: string;
    sacCode?: string | null;
    quantity: string;
    rate: string;
    discountAmount?: string;
    gstRate: string;
  }[];
}

export interface DraftInvoiceResponse {
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
  items: {
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
  }[];
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
