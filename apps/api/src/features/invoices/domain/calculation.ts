import { Prisma } from '../../../generated/prisma/client';
import {
  CalculatedInvoiceItem,
  CalculatedInvoiceTotals,
  InvoiceCalculationError,
  InvoiceCalculationItemInput,
  TaxContext,
} from './types';
import {
  parseMoney,
  parseQuantity,
  parseGstRate,
  roundMoney,
  assertDerivedMoneyRange,
} from './decimal';

const VALID_GST_RATES = ['0.00', '5.00', '12.00', '18.00', '28.00'];

function isValidStateCode(code: string): boolean {
  return /^\d{2}$/.test(code);
}

export function calculateInvoiceItem(
  input: InvoiceCalculationItemInput,
  context: TaxContext,
): CalculatedInvoiceItem {
  if (!isValidStateCode(context.supplierStateCode)) {
    throw new InvoiceCalculationError(
      'INVALID_STATE_CODE',
      'supplierStateCode must be exactly two ASCII digits',
    );
  }
  if (!isValidStateCode(context.placeOfSupplyStateCode)) {
    throw new InvoiceCalculationError(
      'INVALID_STATE_CODE',
      'placeOfSupplyStateCode must be exactly two ASCII digits',
    );
  }

  const quantity = parseQuantity(input.quantity);
  const rate = parseMoney(input.rate);
  const discountAmount = parseMoney(input.discountAmount);
  const rawGstRate = parseGstRate(input.gstRate);

  // Canonical string formatting for whitelist check
  const gstRateString = rawGstRate.toFixed(2);
  if (!VALID_GST_RATES.includes(gstRateString)) {
    throw new InvoiceCalculationError('INVALID_GST_RATE', 'Unrecognized GST rate');
  }

  if (!context.isGstRegistered && gstRateString !== '0.00') {
    throw new InvoiceCalculationError(
      'GST_NOT_ALLOWED_FOR_UNREGISTERED_BUSINESS',
      'Unregistered business cannot charge GST',
    );
  }

  // Calculate gross
  const rawGross = quantity.mul(rate);
  const lineGross = roundMoney(rawGross);
  assertDerivedMoneyRange(lineGross);

  // Discount validation
  if (discountAmount.greaterThan(lineGross)) {
    throw new InvoiceCalculationError(
      'DISCOUNT_EXCEEDS_GROSS',
      'Discount cannot exceed line gross',
    );
  }

  // Taxable amount
  const taxableAmount = lineGross.sub(discountAmount);
  assertDerivedMoneyRange(taxableAmount);

  const gstRate = rawGstRate; // Retain Prisma.Decimal type
  let cgstAmount = new Prisma.Decimal('0.00');
  let sgstAmount = new Prisma.Decimal('0.00');
  let igstAmount = new Prisma.Decimal('0.00');

  if (gstRate.greaterThan(0)) {
    const isIntraState = context.supplierStateCode === context.placeOfSupplyStateCode;

    if (isIntraState) {
      const halfRate = gstRate.div(2);
      const rawCgst = taxableAmount.mul(halfRate).div(100);
      const rawSgst = taxableAmount.mul(halfRate).div(100);

      cgstAmount = roundMoney(rawCgst);
      sgstAmount = roundMoney(rawSgst);
    } else {
      const rawIgst = taxableAmount.mul(gstRate).div(100);
      igstAmount = roundMoney(rawIgst);
    }
  }

  assertDerivedMoneyRange(cgstAmount);
  assertDerivedMoneyRange(sgstAmount);
  assertDerivedMoneyRange(igstAmount);

  // Total
  const totalAmount = taxableAmount.add(cgstAmount).add(sgstAmount).add(igstAmount);
  assertDerivedMoneyRange(totalAmount);

  return {
    lineGross,
    discountAmount,
    taxableAmount,
    gstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
  };
}

export function calculateInvoiceTotals(items: CalculatedInvoiceItem[]): CalculatedInvoiceTotals {
  if (items.length === 0) {
    throw new InvoiceCalculationError('EMPTY_ITEMS', 'At least one item is required');
  }
  if (items.length > 100) {
    throw new InvoiceCalculationError('TOO_MANY_ITEMS', 'Maximum 100 items allowed');
  }

  let subtotal = new Prisma.Decimal('0.00');
  let discountTotal = new Prisma.Decimal('0.00');
  let taxableTotal = new Prisma.Decimal('0.00');
  let cgstTotal = new Prisma.Decimal('0.00');
  let sgstTotal = new Prisma.Decimal('0.00');
  let igstTotal = new Prisma.Decimal('0.00');

  for (const item of items) {
    subtotal = subtotal.add(item.lineGross);
    discountTotal = discountTotal.add(item.discountAmount);
    taxableTotal = taxableTotal.add(item.taxableAmount);
    cgstTotal = cgstTotal.add(item.cgstAmount);
    sgstTotal = sgstTotal.add(item.sgstAmount);
    igstTotal = igstTotal.add(item.igstAmount);
  }

  assertDerivedMoneyRange(subtotal);
  assertDerivedMoneyRange(discountTotal);
  assertDerivedMoneyRange(taxableTotal);
  assertDerivedMoneyRange(cgstTotal);
  assertDerivedMoneyRange(sgstTotal);
  assertDerivedMoneyRange(igstTotal);

  const total = taxableTotal.add(cgstTotal).add(sgstTotal).add(igstTotal);
  assertDerivedMoneyRange(total);

  return {
    subtotal,
    discountTotal,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    total,
    paidAmount: new Prisma.Decimal('0.00'),
    outstandingAmount: total,
  };
}
