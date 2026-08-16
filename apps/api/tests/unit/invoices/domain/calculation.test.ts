import { describe, it, expect } from 'vitest';
import {
  calculateInvoiceItem,
  calculateInvoiceTotals,
} from '../../../../src/features/invoices/domain/calculation';
import { serializeMoney } from '../../../../src/features/invoices/domain/decimal';
import { TaxContext } from '../../../../src/features/invoices/domain/types';

describe('Calculation Engine', () => {
  const baseContext: TaxContext = {
    supplierStateCode: '27',
    placeOfSupplyStateCode: '27',
    isGstRegistered: true,
  };

  describe('TaxContext Validation', () => {
    it('rejects invalid supplier state code', () => {
      expect(() =>
        calculateInvoiceItem(
          { quantity: '1', rate: '100', discountAmount: '0', gstRate: '0' },
          { ...baseContext, supplierStateCode: 'ABC' },
        ),
      ).toThrowError(/INVALID_STATE_CODE/);
    });

    it('rejects invalid place of supply state code', () => {
      expect(() =>
        calculateInvoiceItem(
          { quantity: '1', rate: '100', discountAmount: '0', gstRate: '0' },
          { ...baseContext, placeOfSupplyStateCode: '1' }, // Needs 2 digits
        ),
      ).toThrowError(/INVALID_STATE_CODE/);
    });
  });

  describe('Unregistered Business', () => {
    it('accepts 0% GST for unregistered business', () => {
      const result = calculateInvoiceItem(
        { quantity: '1', rate: '100', discountAmount: '0', gstRate: '0' },
        { ...baseContext, isGstRegistered: false },
      );
      expect(serializeMoney(result.totalAmount)).toBe('100.00');
    });

    it('rejects >0% GST for unregistered business', () => {
      expect(() =>
        calculateInvoiceItem(
          { quantity: '1', rate: '100', discountAmount: '0', gstRate: '5' },
          { ...baseContext, isGstRegistered: false },
        ),
      ).toThrowError(/GST_NOT_ALLOWED_FOR_UNREGISTERED_BUSINESS/);
    });
  });

  describe('Line Gross & Discount', () => {
    it('calculates gross with fractional exactness', () => {
      const result = calculateInvoiceItem(
        { quantity: '1.5', rate: '10.25', discountAmount: '0', gstRate: '0' },
        baseContext,
      );
      // 1.5 * 10.25 = 15.375 -> rounded to 15.38
      expect(serializeMoney(result.lineGross)).toBe('15.38');
    });

    it('rejects discount > gross', () => {
      expect(() =>
        calculateInvoiceItem(
          { quantity: '1', rate: '100', discountAmount: '101', gstRate: '0' },
          baseContext,
        ),
      ).toThrowError(/DISCOUNT_EXCEEDS_GROSS/);
    });

    it('accepts full discount', () => {
      const result = calculateInvoiceItem(
        { quantity: '1', rate: '100', discountAmount: '100', gstRate: '0' },
        baseContext,
      );
      expect(serializeMoney(result.taxableAmount)).toBe('0.00');
      expect(serializeMoney(result.totalAmount)).toBe('0.00');
    });
  });

  describe('GST Whitelist', () => {
    it('rejects invalid GST rates', () => {
      expect(() =>
        calculateInvoiceItem(
          { quantity: '1', rate: '100', discountAmount: '0', gstRate: '1' },
          baseContext,
        ),
      ).toThrowError(/INVALID_GST_RATE/);
    });

    it('accepts standard rates', () => {
      ['0', '5', '12', '18', '28'].forEach((rate) => {
        calculateInvoiceItem(
          { quantity: '1', rate: '100', discountAmount: '0', gstRate: rate },
          baseContext,
        ); // Should not throw
      });
    });
  });

  describe('Intra-State vs Inter-State', () => {
    it('splits Intra-State GST into CGST and SGST', () => {
      const result = calculateInvoiceItem(
        { quantity: '1', rate: '100', discountAmount: '0', gstRate: '18' },
        baseContext,
      );
      expect(serializeMoney(result.cgstAmount)).toBe('9.00');
      expect(serializeMoney(result.sgstAmount)).toBe('9.00');
      expect(serializeMoney(result.igstAmount)).toBe('0.00');
      expect(serializeMoney(result.totalAmount)).toBe('118.00');
    });

    it('applies Inter-State GST fully to IGST', () => {
      const result = calculateInvoiceItem(
        { quantity: '1', rate: '100', discountAmount: '0', gstRate: '18' },
        { ...baseContext, placeOfSupplyStateCode: '29' },
      );
      expect(serializeMoney(result.cgstAmount)).toBe('0.00');
      expect(serializeMoney(result.sgstAmount)).toBe('0.00');
      expect(serializeMoney(result.igstAmount)).toBe('18.00');
      expect(serializeMoney(result.totalAmount)).toBe('118.00');
    });
  });

  describe('Paisa Rule', () => {
    it('keeps CGST and SGST independently rounded even if total tax deviates by 1 paisa from IGST equivalent', () => {
      // taxableAmount = 0.10, rate = 5%
      // 5% of 0.10 = 0.005
      // If Intra-state:
      // CGST = 2.5% of 0.10 = 0.0025 -> rounded = 0.00
      // SGST = 2.5% of 0.10 = 0.0025 -> rounded = 0.00
      // Total tax = 0.00

      const intra = calculateInvoiceItem(
        { quantity: '1', rate: '0.10', discountAmount: '0', gstRate: '5' },
        baseContext,
      );
      expect(serializeMoney(intra.cgstAmount)).toBe('0.00');
      expect(serializeMoney(intra.sgstAmount)).toBe('0.00');
      expect(serializeMoney(intra.totalAmount)).toBe('0.10');

      // If Inter-state:
      // IGST = 5% of 0.10 = 0.005 -> rounded = 0.01
      // Total tax = 0.01
      const inter = calculateInvoiceItem(
        { quantity: '1', rate: '0.10', discountAmount: '0', gstRate: '5' },
        { ...baseContext, placeOfSupplyStateCode: '29' },
      );
      expect(serializeMoney(inter.igstAmount)).toBe('0.01');
      expect(serializeMoney(inter.totalAmount)).toBe('0.11');
    });
  });

  describe('Overflow', () => {
    it('throws on line gross overflow', () => {
      expect(() =>
        calculateInvoiceItem(
          { quantity: '9999999', rate: '999999', discountAmount: '0', gstRate: '0' },
          baseContext,
        ),
      ).toThrowError(/CALCULATION_OVERFLOW/);
    });
  });

  describe('Aggregation', () => {
    it('aggregates multiple items accurately', () => {
      const item1 = calculateInvoiceItem(
        { quantity: '2', rate: '100', discountAmount: '10', gstRate: '18' },
        baseContext,
      );
      // gross = 200, disc = 10, taxable = 190, cgst = 17.10, sgst = 17.10, total = 224.20
      const item2 = calculateInvoiceItem(
        { quantity: '1', rate: '500', discountAmount: '50', gstRate: '0' },
        baseContext,
      );
      // gross = 500, disc = 50, taxable = 450, cgst = 0, sgst = 0, total = 450.00

      const totals = calculateInvoiceTotals([item1, item2]);

      expect(serializeMoney(totals.subtotal)).toBe('700.00');
      expect(serializeMoney(totals.discountTotal)).toBe('60.00');
      expect(serializeMoney(totals.taxableTotal)).toBe('640.00');
      expect(serializeMoney(totals.cgstTotal)).toBe('17.10');
      expect(serializeMoney(totals.sgstTotal)).toBe('17.10');
      expect(serializeMoney(totals.total)).toBe('674.20');
      expect(serializeMoney(totals.outstandingAmount)).toBe('674.20');
    });

    it('rejects empty items array', () => {
      expect(() => calculateInvoiceTotals([])).toThrowError(/EMPTY_ITEMS/);
    });

    it('rejects too many items', () => {
      const items = Array.from({ length: 101 }, () =>
        calculateInvoiceItem(
          { quantity: '1', rate: '1', discountAmount: '0', gstRate: '0' },
          baseContext,
        ),
      );
      expect(() => calculateInvoiceTotals(items)).toThrowError(/TOO_MANY_ITEMS/);
    });

    it('throws on aggregation overflow', () => {
      const item = calculateInvoiceItem(
        { quantity: '1', rate: '9999999999.00', discountAmount: '0', gstRate: '0' },
        baseContext,
      );
      // Two items will exceed 9999999999.99
      expect(() => calculateInvoiceTotals([item, item])).toThrowError(/CALCULATION_OVERFLOW/);
    });
  });

  describe('Determinism', () => {
    it('yields exact same results for identical inputs', () => {
      const res1 = calculateInvoiceItem(
        { quantity: '3.141', rate: '27.18', discountAmount: '1.23', gstRate: '12' },
        baseContext,
      );
      const res2 = calculateInvoiceItem(
        { quantity: '3.141', rate: '27.18', discountAmount: '1.23', gstRate: '12' },
        baseContext,
      );
      expect(serializeMoney(res1.totalAmount)).toBe(serializeMoney(res2.totalAmount));
      expect(serializeMoney(res1.taxableAmount)).toBe(serializeMoney(res2.taxableAmount));
    });
  });
});
