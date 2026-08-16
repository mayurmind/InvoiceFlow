import { Prisma } from '../../../generated/prisma/client';

export type InvoiceCalculationErrorCode =
  | 'INVALID_DECIMAL'
  | 'INVALID_SCALE'
  | 'VALUE_OUT_OF_RANGE'
  | 'INVALID_QUANTITY'
  | 'INVALID_RATE'
  | 'INVALID_DISCOUNT'
  | 'DISCOUNT_EXCEEDS_GROSS'
  | 'INVALID_GST_RATE'
  | 'GST_NOT_ALLOWED_FOR_UNREGISTERED_BUSINESS'
  | 'INVALID_STATE_CODE'
  | 'CALCULATION_OVERFLOW'
  | 'EMPTY_ITEMS'
  | 'TOO_MANY_ITEMS';

export class InvoiceCalculationError extends Error {
  public readonly code: InvoiceCalculationErrorCode;

  constructor(code: InvoiceCalculationErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'InvoiceCalculationError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface InvoiceCalculationItemInput {
  quantity: string;
  rate: string;
  discountAmount: string;
  gstRate: string;
}

export interface TaxContext {
  supplierStateCode: string;
  placeOfSupplyStateCode: string;
  isGstRegistered: boolean;
}

export interface CalculatedInvoiceItem {
  lineGross: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  gstRate: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}

export interface CalculatedInvoiceTotals {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxableTotal: Prisma.Decimal;
  cgstTotal: Prisma.Decimal;
  sgstTotal: Prisma.Decimal;
  igstTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
}
