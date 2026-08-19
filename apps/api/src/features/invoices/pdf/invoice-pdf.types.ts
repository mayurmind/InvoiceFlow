export interface InvoicePdfSupplier {
  legalName: string;
  displayName: string;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  email: string | null;
  phone: string | null;
}

export interface InvoicePdfRecipient {
  name: string;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  email: string | null;
  phone: string | null;
}

export interface InvoicePdfMetadata {
  invoiceNumber: string;
  invoiceDate: string; // DD/MM/YYYY
  dueDate: string | null; // DD/MM/YYYY
  financialYear: string;
  placeOfSupplyState: string;
  placeOfSupplyStateCode: string;
  currency: string;
}

export interface InvoicePdfItem {
  lineNumber: number;
  description: string;
  sacCode: string | null;
  quantity: string;
  rate: string;
  discountAmount: string; // INR 0.00
  taxableAmount: string; // INR 0.00
  gstRate: string; // "18.00"
  cgstAmount: string; // INR 0.00
  sgstAmount: string; // INR 0.00
  igstAmount: string; // INR 0.00
  totalAmount: string; // INR 0.00
}

export interface InvoicePdfTotals {
  subtotal: string;
  discountTotal: string;
  taxableTotal: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  total: string;
  paidAmount: string;
  outstandingAmount: string;
}

export interface InvoicePdfPaymentDetails {
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  upiId: string | null;
}

export interface InvoicePdfModel {
  supplier: InvoicePdfSupplier;
  recipient: InvoicePdfRecipient;
  metadata: InvoicePdfMetadata;
  items: InvoicePdfItem[];
  totals: InvoicePdfTotals;
  paymentDetails: InvoicePdfPaymentDetails | null;
  notes: string | null;
  terms: string | null;
}
