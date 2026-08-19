import { describe, expect, it } from 'vitest';

import { Prisma, InvoiceStatus } from '../../../../src/generated/prisma/client';
import { ConflictError } from '../../../../src/errors/application.error';
import {
  buildInvoicePdfModel,
  formatPdfDate,
  formatPdfMoney,
  getSafeFilename,
} from '../../../../src/features/invoices/pdf/invoice-pdf.mapper';

describe('invoice-pdf.mapper', () => {
  describe('formatPdfDate', () => {
    it('M-19 UTC date 2026-03-31', () => {
      expect(formatPdfDate(new Date(Date.UTC(2026, 2, 31)))).toBe('31/03/2026');
    });
    it('M-20 UTC date 2026-04-01', () => {
      expect(formatPdfDate(new Date(Date.UTC(2026, 3, 1)))).toBe('01/04/2026');
    });
    it('M-21 UTC normal date', () => {
      expect(formatPdfDate(new Date(Date.UTC(2026, 7, 16)))).toBe('16/08/2026');
    });
  });

  describe('formatPdfMoney', () => {
    it('M-22 INR 0.00', () => expect(formatPdfMoney('0.00')).toBe('INR 0.00'));
    it('M-23 INR 1.00', () => expect(formatPdfMoney('1.00')).toBe('INR 1.00'));
    it('M-24 INR 1,234.56', () => expect(formatPdfMoney('1234.56')).toBe('INR 1,234.56'));
    it('M-25 INR 1,23,456.78', () => expect(formatPdfMoney('123456.78')).toBe('INR 1,23,456.78'));
    it('M-26 INR 1,23,45,678.90', () =>
      expect(formatPdfMoney('12345678.90')).toBe('INR 1,23,45,678.90'));
    it('M-27 money formatter uses NO numeric conversion', () => {
      // Demonstrated by correctly handling a massive string without losing precision
      expect(formatPdfMoney('9007199254740991123.45')).toBe('INR 90,07,19,92,54,74,09,91,123.45');
    });
  });

  describe('getSafeFilename', () => {
    it('M-28 safe invoice filename', () => {
      expect(getSafeFilename('INV-26-27-0001')).toBe('Invoice-INV-26-27-0001.pdf');
    });
    it('M-29 slash replacement', () => {
      expect(getSafeFilename('INV/26-27/0001')).toBe('Invoice-INV-26-27-0001.pdf');
    });
    it('M-30 CRLF/header injection sanitized', () => {
      expect(getSafeFilename('INV\r\n/0001')).toBe('Invoice-INV-0001.pdf');
    });
    it('M-31 control characters sanitized', () => {
      expect(getSafeFilename('INV\x00/0001')).toBe('Invoice-INV-0001.pdf');
    });
    it('M-32 long filename bounded', () => {
      const longName = 'A'.repeat(200);
      expect(getSafeFilename(longName).length).toBeLessThanOrEqual(104); // 100 + .pdf
    });
  });

  describe('buildInvoicePdfModel', () => {
    const validSupplier = {
      version: 1,
      legalName: 'Test Corp',
      displayName: 'Test',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      addressLine1: 'Line 1',
      addressLine2: null,
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: '27',
      postalCode: '400001',
      country: 'India',
      email: null,
      phone: null,
      logoStorageKey: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankName: null,
      bankIfsc: null,
      upiId: null,
    };

    const validClient = {
      version: 1,
      clientId: 'c1',
      name: 'Client 1',
      email: null,
      phone: null,
      gstin: null,
      pan: null,
      addressLine1: 'C Line 1',
      addressLine2: null,
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      postalCode: '411001',
      country: 'India',
    };

    const validInvoice = {
      id: 'i1',
      clientId: 'c1',
      status: InvoiceStatus.SENT,
      invoiceNumber: 'INV/26-27/0001',
      financialYear: '2026-27',
      snapshotVersion: 1,
      businessSnapshot: validSupplier,
      clientSnapshot: validClient,
      sentAt: new Date(),
      sentByUserId: 'u1',
      currency: 'INR',
      invoiceDate: new Date(Date.UTC(2026, 7, 16)),
      dueDate: null,
      placeOfSupplyState: 'Maharashtra',
      placeOfSupplyStateCode: '27',
      notes: null,
      terms: null,
      subtotal: new Prisma.Decimal(100),
      discountTotal: new Prisma.Decimal(0),
      taxableTotal: new Prisma.Decimal(100),
      cgstTotal: new Prisma.Decimal(9),
      sgstTotal: new Prisma.Decimal(9),
      igstTotal: new Prisma.Decimal(0),
      total: new Prisma.Decimal(118),
      paidAmount: new Prisma.Decimal(0),
      outstandingAmount: new Prisma.Decimal(118),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdByUserId: 'u1',
      cancelledAt: null,
      cancellationReason: null,
      items: [
        {
          id: 'item2',
          invoiceId: 'i1',
          lineNumber: 2,
          description: 'Item 2',
          sacCode: null,
          quantity: new Prisma.Decimal(1),
          rate: new Prisma.Decimal(50),
          discountAmount: new Prisma.Decimal(0),
          taxableAmount: new Prisma.Decimal(50),
          gstRate: new Prisma.Decimal(18),
          cgstAmount: new Prisma.Decimal(4.5),
          sgstAmount: new Prisma.Decimal(4.5),
          igstAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(59),
        },
        {
          id: 'item1',
          invoiceId: 'i1',
          lineNumber: 1,
          description: 'Item 1',
          sacCode: null,
          quantity: new Prisma.Decimal(1),
          rate: new Prisma.Decimal(50),
          discountAmount: new Prisma.Decimal(0),
          taxableAmount: new Prisma.Decimal(50),
          gstRate: new Prisma.Decimal(18),
          cgstAmount: new Prisma.Decimal(4.5),
          sgstAmount: new Prisma.Decimal(4.5),
          igstAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(59),
        },
      ],
    };

    it('M-01 valid issued invoice -> model', () => {
      const model = buildInvoicePdfModel(
        validInvoice as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>,
      );
      expect(model.metadata.invoiceNumber).toBe('INV/26-27/0001');
      expect(model.totals.total).toBe('INR 118.00');
    });

    it('M-02 exact BusinessSnapshotV1 mapping', () => {
      const model = buildInvoicePdfModel(
        validInvoice as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>,
      );
      expect(model.supplier.legalName).toBe('Test Corp');
    });

    it('M-03 exact ClientSnapshotV1 mapping', () => {
      const model = buildInvoicePdfModel(
        validInvoice as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>,
      );
      expect(model.recipient.name).toBe('Client 1');
    });

    it('M-04 invoicePrefix absent from supplier model', () => {
      const model = buildInvoicePdfModel({
        ...validInvoice,
        businessSnapshot: { ...validSupplier, invoicePrefix: 'INV' },
      } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>);
      expect(
        (model.supplier as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>)
          .invoicePrefix,
      ).toBeUndefined();
    });

    it('M-05 defaultDueDays absent', () => {
      const model = buildInvoicePdfModel({
        ...validInvoice,
        businessSnapshot: { ...validSupplier, defaultDueDays: 15 },
      } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>);
      expect(
        (model.supplier as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>)
          .defaultDueDays,
      ).toBeUndefined();
    });

    it('M-06 client notes absent', () => {
      const model = buildInvoicePdfModel({
        ...validInvoice,
        clientSnapshot: { ...validClient, notes: 'Secret note' },
      } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>);
      expect(
        (model.recipient as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>)
          .notes,
      ).toBeUndefined();
    });

    it('M-07 DRAFT rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          status: InvoiceStatus.DRAFT,
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-08 missing invoiceNumber rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          invoiceNumber: null,
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-09 missing financialYear rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          financialYear: null,
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-10 snapshotVersion != 1 rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          snapshotVersion: 2,
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-11 null businessSnapshot rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          businessSnapshot: null,
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-12 null clientSnapshot rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          clientSnapshot: null,
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-13 null sentAt rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          sentAt: null,
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-14 malformed business snapshot rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          businessSnapshot: { version: 1, wrong: true },
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-15 malformed client snapshot rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          clientSnapshot: { version: 1, wrong: true },
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-16 unexpected snapshot keys rejected', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          businessSnapshot: { ...validSupplier, extra: 123 },
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-17 unsupported currency rejected safely', () => {
      expect(() =>
        buildInvoicePdfModel({
          ...validInvoice,
          currency: 'USD',
        } as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>),
      ).toThrow(ConflictError);
    });

    it('M-18 items sorted lineNumber ASC', () => {
      const model = buildInvoicePdfModel(
        validInvoice as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>,
      );
      expect(model.items[0].lineNumber).toBe(1);
      expect(model.items[1].lineNumber).toBe(2);
    });

    it('M-33 nullable optional supplier fields handled', () => {
      const model = buildInvoicePdfModel(
        validInvoice as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>,
      );
      expect(model.supplier.addressLine2).toBeNull();
    });

    it('M-34 nullable recipient fields handled', () => {
      const model = buildInvoicePdfModel(
        validInvoice as unknown as Prisma.InvoiceGetPayload<{ include: { items: true } }>,
      );
      expect(model.recipient.email).toBeNull();
    });
  });
});
