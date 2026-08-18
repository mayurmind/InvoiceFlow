import { describe, it, expect } from 'vitest';
import {
  invoiceCreateSchema,
  strictCalendarDateSchema,
  invoiceIdParamSchema,
  invoiceListQuerySchema,
  invoiceUpdateSchema,
  invoiceIssueSchema,
} from '../../../src/features/invoices/invoices.schemas';

// Using strings for status enum to avoid unresolved module imports in this mock environment
// while still testing the exact string values that Prisma accepts

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const makeValidUpdatePayload = () => ({
  clientId: VALID_UUID,
  invoiceDate: '2026-08-16',
  items: [
    {
      description: 'Consulting service',
      quantity: '1.000',
      rate: '100.00',
      discountAmount: '0.00',
      gstRate: '18.00',
    },
  ],
});

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

  describe('invoiceIdParamSchema', () => {
    it('valid UUID succeeds', () => {
      expect(
        invoiceIdParamSchema.safeParse({ invoiceId: '550e8400-e29b-41d4-a716-446655440000' })
          .success,
      ).toBe(true);
    });

    it('invalid UUID fails', () => {
      expect(invoiceIdParamSchema.safeParse({ invoiceId: 'not-a-uuid' }).success).toBe(false);
    });

    it('unknown parameter fails', () => {
      expect(
        invoiceIdParamSchema.safeParse({
          invoiceId: '550e8400-e29b-41d4-a716-446655440000',
          extra: 'not-allowed',
        }).success,
      ).toBe(false);
    });
  });

  describe('invoiceListQuerySchema', () => {
    describe('defaults and coercion', () => {
      it('empty query succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({}).success).toBe(true);
      });

      it('empty query defaults page to 1', () => {
        const result = invoiceListQuerySchema.safeParse({});
        if (!result.success) throw new Error('Expected schema parse success');
        expect(result.data.page).toBe(1);
      });

      it('empty query defaults limit to 20', () => {
        const result = invoiceListQuerySchema.safeParse({});
        if (!result.success) throw new Error('Expected schema parse success');
        expect(result.data.limit).toBe(20);
      });

      it('string page is coerced', () => {
        const result = invoiceListQuerySchema.safeParse({ page: '2' });
        if (!result.success) throw new Error('Expected schema parse success');
        expect(result.data.page).toBe(2);
      });

      it('string limit is coerced', () => {
        const result = invoiceListQuerySchema.safeParse({ limit: '50' });
        if (!result.success) throw new Error('Expected schema parse success');
        expect(result.data.limit).toBe(50);
      });
    });

    describe('page validation', () => {
      it('page 1 succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ page: 1 }).success).toBe(true);
      });

      it('page 0 fails', () => {
        expect(invoiceListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
      });

      it('negative page fails', () => {
        expect(invoiceListQuerySchema.safeParse({ page: -1 }).success).toBe(false);
      });

      it('fractional page fails', () => {
        expect(invoiceListQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
      });
    });

    describe('limit validation', () => {
      it('limit 1 succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ limit: 1 }).success).toBe(true);
      });

      it('limit 100 succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ limit: 100 }).success).toBe(true);
      });

      it('limit 0 fails', () => {
        expect(invoiceListQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
      });

      it('limit 101 fails', () => {
        expect(invoiceListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
      });

      it('fractional limit fails', () => {
        expect(invoiceListQuerySchema.safeParse({ limit: 5.5 }).success).toBe(false);
      });
    });

    describe('status validation', () => {
      it('DRAFT succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ status: 'DRAFT' }).success).toBe(true);
      });

      it('SENT succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ status: 'SENT' }).success).toBe(true);
      });

      it('PARTIALLY_PAID succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ status: 'PARTIALLY_PAID' }).success).toBe(true);
      });

      it('PAID succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ status: 'PAID' }).success).toBe(true);
      });

      it('CANCELLED succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ status: 'CANCELLED' }).success).toBe(true);
      });

      it('unknown status fails', () => {
        expect(invoiceListQuerySchema.safeParse({ status: 'UNKNOWN' }).success).toBe(false);
      });
    });

    describe('client filter', () => {
      it('valid client UUID succeeds', () => {
        expect(
          invoiceListQuerySchema.safeParse({ clientId: '550e8400-e29b-41d4-a716-446655440000' })
            .success,
        ).toBe(true);
      });

      it('malformed client UUID fails', () => {
        expect(invoiceListQuerySchema.safeParse({ clientId: 'not-uuid' }).success).toBe(false);
      });
    });

    describe('invoiceDate filters', () => {
      it('invoiceDateFrom accepts a valid calendar date', () => {
        expect(invoiceListQuerySchema.safeParse({ invoiceDateFrom: '2026-08-01' }).success).toBe(
          true,
        );
      });

      it('invoiceDateTo accepts a valid calendar date', () => {
        expect(invoiceListQuerySchema.safeParse({ invoiceDateTo: '2026-08-31' }).success).toBe(
          true,
        );
      });

      it('valid invoice-date range succeeds', () => {
        expect(
          invoiceListQuerySchema.safeParse({
            invoiceDateFrom: '2026-08-01',
            invoiceDateTo: '2026-08-31',
          }).success,
        ).toBe(true);
      });

      it('impossible invoiceDateFrom fails', () => {
        expect(invoiceListQuerySchema.safeParse({ invoiceDateFrom: '2026-02-30' }).success).toBe(
          false,
        );
      });

      it('impossible invoiceDateTo fails', () => {
        expect(invoiceListQuerySchema.safeParse({ invoiceDateTo: '2026-04-31' }).success).toBe(
          false,
        );
      });

      it('malformed invoice date format fails', () => {
        expect(invoiceListQuerySchema.safeParse({ invoiceDateFrom: '01-08-2026' }).success).toBe(
          false,
        );
      });

      it('invoiceDateFrom after invoiceDateTo fails', () => {
        expect(
          invoiceListQuerySchema.safeParse({
            invoiceDateFrom: '2026-08-20',
            invoiceDateTo: '2026-08-10',
          }).success,
        ).toBe(false);
      });

      it('identical invoiceDateFrom and invoiceDateTo succeeds', () => {
        expect(
          invoiceListQuerySchema.safeParse({
            invoiceDateFrom: '2026-08-10',
            invoiceDateTo: '2026-08-10',
          }).success,
        ).toBe(true);
      });

      it('future invoice list-filter date succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ invoiceDateFrom: '2099-01-01' }).success).toBe(
          true,
        );
      });
    });

    describe('dueDate filters', () => {
      it('dueDateFrom accepts valid calendar date', () => {
        expect(invoiceListQuerySchema.safeParse({ dueDateFrom: '2026-08-01' }).success).toBe(true);
      });

      it('dueDateTo accepts valid calendar date', () => {
        expect(invoiceListQuerySchema.safeParse({ dueDateTo: '2026-09-30' }).success).toBe(true);
      });

      it('valid due-date range succeeds', () => {
        expect(
          invoiceListQuerySchema.safeParse({ dueDateFrom: '2026-08-01', dueDateTo: '2026-09-30' })
            .success,
        ).toBe(true);
      });

      it('impossible dueDateFrom fails', () => {
        expect(invoiceListQuerySchema.safeParse({ dueDateFrom: '2026-02-30' }).success).toBe(false);
      });

      it('impossible dueDateTo fails', () => {
        expect(invoiceListQuerySchema.safeParse({ dueDateTo: '2026-06-31' }).success).toBe(false);
      });

      it('malformed due-date format fails', () => {
        expect(invoiceListQuerySchema.safeParse({ dueDateFrom: '2026/08/01' }).success).toBe(false);
      });

      it('dueDateFrom after dueDateTo fails', () => {
        expect(
          invoiceListQuerySchema.safeParse({ dueDateFrom: '2026-09-20', dueDateTo: '2026-09-10' })
            .success,
        ).toBe(false);
      });

      it('identical dueDateFrom and dueDateTo succeeds', () => {
        expect(
          invoiceListQuerySchema.safeParse({ dueDateFrom: '2026-09-10', dueDateTo: '2026-09-10' })
            .success,
        ).toBe(true);
      });

      it('future due-date filter succeeds', () => {
        expect(invoiceListQuerySchema.safeParse({ dueDateTo: '2099-12-31' }).success).toBe(true);
      });
    });

    describe('strict list query', () => {
      it('unknown list-query key fails', () => {
        expect(invoiceListQuerySchema.safeParse({ unknownQueryField: 'not-allowed' }).success).toBe(
          false,
        );
      });
    });
    describe('invoiceUpdateSchema', () => {
      describe('valid update payload / optional fields', () => {
        it('complete valid replacement succeeds', () => {
          const result = invoiceUpdateSchema.safeParse(makeValidUpdatePayload());
          expect(result.success).toBe(true);
        });

        it('explicit dueDate succeeds', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            dueDate: '2026-08-31',
          });
          expect(result.success).toBe(true);
        });

        it('explicit valid placeOfSupplyStateCode succeeds', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            placeOfSupplyStateCode: '27',
          });
          expect(result.success).toBe(true);
        });

        it('omitted notes succeeds', () => {
          const payload = makeValidUpdatePayload();
          // ensure property is absent
          expect('notes' in payload).toBe(false);
          const result = invoiceUpdateSchema.safeParse(payload);
          expect(result.success).toBe(true);
        });

        it('notes = null succeeds', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            notes: null,
          });
          expect(result.success).toBe(true);
        });

        it('notes string succeeds', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            notes: 'Internal invoice note',
          });
          expect(result.success).toBe(true);
        });

        it('omitted terms succeeds', () => {
          const payload = makeValidUpdatePayload();
          const result = invoiceUpdateSchema.safeParse(payload);
          expect(result.success).toBe(true);
        });

        it('terms = null succeeds', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            terms: null,
          });
          expect(result.success).toBe(true);
        });

        it('terms string succeeds', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            terms: 'terms',
          });
          expect(result.success).toBe(true);
        });

        it('omitted sacCode succeeds', () => {
          const payload = makeValidUpdatePayload();
          // sacCode is inside item
          const result = invoiceUpdateSchema.safeParse(payload);
          expect(result.success).toBe(true);
        });

        it('sacCode = null succeeds', () => {
          const payload = makeValidUpdatePayload();
          const items = [...payload.items];
          items[0] = { ...items[0], sacCode: null };
          const result = invoiceUpdateSchema.safeParse({ ...payload, items });
          expect(result.success).toBe(true);
        });

        it('sacCode string succeeds', () => {
          const payload = makeValidUpdatePayload();
          const items = [...payload.items];
          items[0] = { ...items[0], sacCode: '998314' };
          const result = invoiceUpdateSchema.safeParse({ ...payload, items });
          expect(result.success).toBe(true);
        });

        it('omitted discountAmount succeeds', () => {
          const payload = makeValidUpdatePayload();
          const items = [...payload.items];
          const itemWithoutDiscount = { ...items[0] };
          delete (itemWithoutDiscount as Record<string, unknown>).discountAmount;
          items[0] = itemWithoutDiscount;
          const result = invoiceUpdateSchema.safeParse({ ...payload, items });
          expect(result.success).toBe(true);
        });

        it('omitted discountAmount receives schema default', () => {
          const payload = makeValidUpdatePayload();
          const items = [...payload.items];
          const itemWithoutDiscount = { ...items[0] };
          delete (itemWithoutDiscount as Record<string, unknown>).discountAmount;
          items[0] = itemWithoutDiscount;
          const result = invoiceUpdateSchema.safeParse({ ...payload, items });
          if (!result.success) throw new Error('Expected schema parse success');
          expect(result.data.items[0].discountAmount).toBe('0.00');
        });
      });

      describe('strict top-level server-owned fields', () => {
        it('unknown top-level field fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            unknownField: 'bad',
          });
          expect(result.success).toBe(false);
        });

        it('status fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            status: 'DRAFT',
          });
          expect(result.success).toBe(false);
        });

        it('invoiceNumber fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            invoiceNumber: 'INV-001',
          });
          expect(result.success).toBe(false);
        });

        it('financialYear fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            financialYear: '26-27',
          });
          expect(result.success).toBe(false);
        });

        it('subtotal fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            subtotal: '100.00',
          });
          expect(result.success).toBe(false);
        });

        it('discountTotal fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            discountTotal: '0.00',
          });
          expect(result.success).toBe(false);
        });

        it('taxableTotal fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            taxableTotal: '100.00',
          });
          expect(result.success).toBe(false);
        });

        it('cgstTotal fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            cgstTotal: '9.00',
          });
          expect(result.success).toBe(false);
        });

        it('sgstTotal fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            sgstTotal: '9.00',
          });
          expect(result.success).toBe(false);
        });

        it('igstTotal fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            igstTotal: '18.00',
          });
          expect(result.success).toBe(false);
        });

        it('total fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            total: '118.00',
          });
          expect(result.success).toBe(false);
        });

        it('paidAmount fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            paidAmount: '0.00',
          });
          expect(result.success).toBe(false);
        });

        it('outstandingAmount fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            outstandingAmount: '118.00',
          });
          expect(result.success).toBe(false);
        });

        it('sentAt fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            sentAt: '2026-08-16T00:00:00.000Z',
          });
          expect(result.success).toBe(false);
        });

        it('sentByUserId fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            sentByUserId: VALID_UUID,
          });
          expect(result.success).toBe(false);
        });

        it('cancelledAt fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            cancelledAt: '2026-08-16T00:00:00.000Z',
          });
          expect(result.success).toBe(false);
        });

        it('cancellationReason fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            cancellationReason: 'Cancelled',
          });
          expect(result.success).toBe(false);
        });

        it('createdByUserId fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            createdByUserId: VALID_UUID,
          });
          expect(result.success).toBe(false);
        });

        it('createdAt fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            createdAt: '2026-08-16T00:00:00.000Z',
          });
          expect(result.success).toBe(false);
        });

        it('updatedAt fails', () => {
          const result = invoiceUpdateSchema.safeParse({
            ...makeValidUpdatePayload(),
            updatedAt: '2026-08-16T00:00:00.000Z',
          });
          expect(result.success).toBe(false);
        });
      });

      describe('required update fields', () => {
        it('missing clientId fails', () => {
          const payload = makeValidUpdatePayload();
          delete (payload as Record<string, unknown>).clientId;
          const result = invoiceUpdateSchema.safeParse(payload);
          expect(result.success).toBe(false);
        });

        it('missing invoiceDate fails', () => {
          const payload = makeValidUpdatePayload();
          delete (payload as Record<string, unknown>).invoiceDate;
          const result = invoiceUpdateSchema.safeParse(payload);
          expect(result.success).toBe(false);
        });

        it('missing items fails', () => {
          const payload = makeValidUpdatePayload();
          delete (payload as Record<string, unknown>).items;
          const result = invoiceUpdateSchema.safeParse(payload);
          expect(result.success).toBe(false);
        });
      });
    });

    describe('item count', () => {
      it('empty items fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items = [];
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('one item succeeds', () => {
        const payload = makeValidUpdatePayload();
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('exactly 100 items succeeds', () => {
        const payload = makeValidUpdatePayload();
        payload.items = Array.from({ length: 100 }, () => ({ ...payload.items[0] }));
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('101 items fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items = Array.from({ length: 101 }, () => ({ ...payload.items[0] }));
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    describe('item strictness / server-owned fields', () => {
      it('item id fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0] = { ...payload.items[0], id: VALID_UUID } as Record<string, unknown>;
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('lineNumber fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0] = { ...payload.items[0], lineNumber: 1 } as Record<string, unknown>;
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('taxableAmount fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0] = { ...payload.items[0], taxableAmount: '100.00' } as Record<
          string,
          unknown
        >;
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('cgstAmount fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0] = { ...payload.items[0], cgstAmount: '9.00' } as Record<string, unknown>;
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('sgstAmount fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0] = { ...payload.items[0], sgstAmount: '9.00' } as Record<string, unknown>;
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('igstAmount fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0] = { ...payload.items[0], igstAmount: '18.00' } as Record<string, unknown>;
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('totalAmount fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0] = { ...payload.items[0], totalAmount: '118.00' } as Record<
          string,
          unknown
        >;
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    describe('description validation', () => {
      it('non-empty description succeeds', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].description = 'Consulting service';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('empty description fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].description = '';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('whitespace-only description fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].description = '   ';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('description exactly 500 characters succeeds', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].description = 'A'.repeat(500);
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('description over 500 characters fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].description = 'A'.repeat(501);
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    describe('quantity syntax', () => {
      it('integer quantity succeeds', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].quantity = '1';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('one-decimal quantity succeeds', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].quantity = '1.0';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('three-decimal quantity succeeds', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].quantity = '1.000';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });

      it('four-decimal quantity fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].quantity = '1.0001';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('negative quantity syntax fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].quantity = '-1';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('alphabetic quantity fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].quantity = 'abc';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('decimal with no integer part fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].quantity = '.5';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });

      it('trailing decimal point fails', () => {
        const payload = makeValidUpdatePayload();
        payload.items[0].quantity = '1.';
        const result = invoiceUpdateSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('rate syntax', () => {
    it('integer rate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].rate = '100';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('one-decimal rate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].rate = '100.5';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('two-decimal rate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].rate = '100.50';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('three-decimal rate fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].rate = '100.501';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('negative rate syntax fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].rate = '-100';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('alphabetic rate fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].rate = 'abc';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe('discountAmount syntax', () => {
    it('integer discountAmount succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].discountAmount = '10';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('one-decimal discountAmount succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].discountAmount = '10.5';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('two-decimal discountAmount succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].discountAmount = '10.50';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('three-decimal discountAmount fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].discountAmount = '10.501';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('negative discountAmount syntax fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].discountAmount = '-10';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('alphabetic discountAmount fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].discountAmount = 'abc';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe('gstRate schema syntax only', () => {
    it('integer gstRate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].gstRate = '18';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('one-decimal gstRate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].gstRate = '18.0';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('two-decimal gstRate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].gstRate = '18.00';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('syntactically valid unsupported domain rate 9.99 succeeds at SCHEMA level', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].gstRate = '9.99';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('three-decimal gstRate fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].gstRate = '18.001';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('negative gstRate syntax fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].gstRate = '-18';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('alphabetic gstRate fails', () => {
      const payload = makeValidUpdatePayload();
      payload.items[0].gstRate = 'abc';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe('placeOfSupplyStateCode', () => {
    it('valid Indian State/UT code succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.placeOfSupplyStateCode = '27';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('invalid two-character state code fails', () => {
      const payload = makeValidUpdatePayload();
      payload.placeOfSupplyStateCode = '99';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('malformed one-character state code fails', () => {
      const payload = makeValidUpdatePayload();
      payload.placeOfSupplyStateCode = '7';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('malformed three-character state code fails', () => {
      const payload = makeValidUpdatePayload();
      payload.placeOfSupplyStateCode = '027';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe('update calendar dates', () => {
    it('valid invoiceDate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.invoiceDate = '2026-08-16';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('leap-day invoiceDate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.invoiceDate = '2024-02-29';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('impossible invoiceDate fails', () => {
      const payload = makeValidUpdatePayload();
      payload.invoiceDate = '2026-02-30';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('malformed invoiceDate format fails', () => {
      const payload = makeValidUpdatePayload();
      payload.invoiceDate = '16-08-2026';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('valid dueDate succeeds', () => {
      const payload = makeValidUpdatePayload();
      payload.dueDate = '2026-08-31';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('impossible dueDate fails', () => {
      const payload = makeValidUpdatePayload();
      payload.dueDate = '2026-04-31';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('malformed dueDate format fails', () => {
      const payload = makeValidUpdatePayload();
      payload.dueDate = '2026/08/31';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(false);
    });

    it('future invoiceDate succeeds at SCHEMA level', () => {
      const payload = makeValidUpdatePayload();
      payload.invoiceDate = '2099-01-01';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });

    it('dueDate before invoiceDate succeeds at SCHEMA level', () => {
      const payload = makeValidUpdatePayload();
      payload.invoiceDate = '2026-08-16';
      payload.dueDate = '2026-08-15';
      expect(invoiceUpdateSchema.safeParse(payload).success).toBe(true);
    });
  });

  describe('invoiceIssueSchema', () => {
    it('S-01 valid empty body succeeds', () => {
      expect(invoiceIssueSchema.safeParse({}).success).toBe(true);
    });

    it('S-03 invoiceNumber mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ invoiceNumber: 'INV/25-26/0001' }).success).toBe(false);
    });

    it('S-04 financialYear mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ financialYear: '25-26' }).success).toBe(false);
    });

    it('S-05 status mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ status: 'SENT' }).success).toBe(false);
    });

    it('S-06 businessSnapshot mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ businessSnapshot: {} }).success).toBe(false);
    });

    it('S-07 clientSnapshot mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ clientSnapshot: {} }).success).toBe(false);
    });

    it('S-08 snapshotVersion mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ snapshotVersion: 1 }).success).toBe(false);
    });

    it('S-09 sentAt mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ sentAt: new Date().toISOString() }).success).toBe(
        false,
      );
    });

    it('S-10 sentByUserId mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ sentByUserId: VALID_UUID }).success).toBe(false);
    });

    it('S-11 recipient mass assignment fails', () => {
      expect(invoiceIssueSchema.safeParse({ recipient: 'client@example.com' }).success).toBe(false);
    });

    it('S-12 arbitrary unknown field fails', () => {
      expect(invoiceIssueSchema.safeParse({ unknownField: 'foo' }).success).toBe(false);
    });
  });
});
