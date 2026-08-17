import { describe, it, expect } from 'vitest';
import {
  invoiceCreateSchema,
  strictCalendarDateSchema,
} from '../../../src/features/invoices/invoices.schemas';

describe('Invoices Schemas', () => {
  describe('strictCalendarDateSchema', () => {
    it('accepts valid dates', () => {
      expect(strictCalendarDateSchema.safeParse('2026-08-16').success).toBe(true);
      expect(strictCalendarDateSchema.safeParse('2024-02-29').success).toBe(true); // Leap year
    });

    it('rejects invalid format', () => {
      expect(strictCalendarDateSchema.safeParse('16-08-2026').success).toBe(false);
      expect(strictCalendarDateSchema.safeParse('2026/08/16').success).toBe(false);
    });

    it('rejects impossible dates', () => {
      expect(strictCalendarDateSchema.safeParse('2026-02-31').success).toBe(false);
      expect(strictCalendarDateSchema.safeParse('2026-04-31').success).toBe(false);
      expect(strictCalendarDateSchema.safeParse('2025-02-29').success).toBe(false); // Not leap year
    });
  });

  describe('invoiceCreateSchema', () => {
    const validPayload = {
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      invoiceDate: '2026-08-16',
      placeOfSupplyStateCode: '27',
      items: [
        {
          description: 'Test Item',
          quantity: '1.000',
          rate: '1000.00',
          gstRate: '18.00',
        },
      ],
    };

    it('accepts valid payload', () => {
      expect(invoiceCreateSchema.safeParse(validPayload).success).toBe(true);
    });

    it('rejects unknown fields (strict)', () => {
      const payloadWithUnknown = { ...validPayload, unknownField: true };
      expect(invoiceCreateSchema.safeParse(payloadWithUnknown).success).toBe(false);
    });

    it('rejects server-owned fields like status, total, etc.', () => {
      expect(invoiceCreateSchema.safeParse({ ...validPayload, status: 'SENT' }).success).toBe(
        false,
      );
      expect(invoiceCreateSchema.safeParse({ ...validPayload, total: '1180.00' }).success).toBe(
        false,
      );
    });

    it('validates placeOfSupplyStateCode', () => {
      expect(
        invoiceCreateSchema.safeParse({ ...validPayload, placeOfSupplyStateCode: '99' }).success,
      ).toBe(false);
    });

    it('validates items limits (1-100)', () => {
      expect(invoiceCreateSchema.safeParse({ ...validPayload, items: [] }).success).toBe(false);

      const tooManyItems = Array(101).fill(validPayload.items[0]);
      expect(invoiceCreateSchema.safeParse({ ...validPayload, items: tooManyItems }).success).toBe(
        false,
      );
    });
  });
});
