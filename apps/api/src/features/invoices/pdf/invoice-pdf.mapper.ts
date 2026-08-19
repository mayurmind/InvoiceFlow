import { z } from 'zod';
import { Prisma, InvoiceStatus } from '../../../generated/prisma/client';
import { ConflictError } from '../../../errors/application.error';
import { InvoicePdfModel, InvoicePdfItem } from './invoice-pdf.types';

export const businessSnapshotV1PdfSchema = z
  .object({
    version: z.literal(1),
    legalName: z.string(),
    displayName: z.string(),
    gstin: z.string().nullable(),
    pan: z.string().nullable(),
    addressLine1: z.string(),
    addressLine2: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    stateCode: z.string(),
    postalCode: z.string(),
    country: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    logoStorageKey: z.string().nullable(),
    bankAccountName: z.string().nullable(),
    bankAccountNumber: z.string().nullable(),
    bankName: z.string().nullable(),
    bankIfsc: z.string().nullable(),
    upiId: z.string().nullable(),
  })
  .strict();

export const clientSnapshotV1PdfSchema = z
  .object({
    version: z.literal(1),
    clientId: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    gstin: z.string().nullable(),
    pan: z.string().nullable(),
    addressLine1: z.string(),
    addressLine2: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    stateCode: z.string(),
    postalCode: z.string(),
    country: z.string(),
  })
  .strict();

export function formatPdfDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

export function formatPdfMoney(amountString: string): string {
  // Input is expected to be a fixed decimal string, e.g. "123456.78" or "0.00"
  const [intPart, decPart] = amountString.split('.');

  // Indian numbering system grouping
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const decimalStr = decPart !== undefined ? `.${decPart}` : '.00';
  return `INR ${formattedInt}${decimalStr}`;
}

export function getSafeFilename(invoiceNumber: string): string {
  // Replace slashes with hyphens first (frozen rule)
  let base = invoiceNumber.replace(/\//g, '-');

  // ASCII allowlist: A-Z, a-z, 0-9, ., _, -
  // Replace everything else with a hyphen
  base = base.replace(/[^A-Za-z0-9._-]/g, '-');

  // Collapse repeated hyphens
  base = base.replace(/-+/g, '-');

  // Strip leading/trailing hyphens
  base = base.replace(/^-+|-+$/g, '');

  if (!base) {
    base = 'Invoice';
  }

  // Sane length bound
  if (base.length > 90) {
    base = base.substring(0, 90);
  }

  return `Invoice-${base}.pdf`;
}

export function buildInvoicePdfModel(
  invoice: Prisma.InvoiceGetPayload<{ include: { items: true } }>,
): InvoicePdfModel {
  if (invoice.status === InvoiceStatus.DRAFT || invoice.invoiceNumber === null) {
    throw new ConflictError('Invoice must be finalized before a PDF can be generated');
  }

  if (
    invoice.financialYear === null ||
    invoice.snapshotVersion !== 1 ||
    invoice.businessSnapshot === null ||
    invoice.clientSnapshot === null ||
    invoice.sentAt === null
  ) {
    throw new ConflictError('Invoice issuance data is incomplete or corrupted');
  }

  if (invoice.currency !== 'INR') {
    throw new ConflictError('Unsupported currency for PDF rendering');
  }

  const parsedBusiness = businessSnapshotV1PdfSchema.safeParse(invoice.businessSnapshot);
  if (!parsedBusiness.success) {
    throw new ConflictError('Malformed or unsupported business snapshot version');
  }
  const supplierRaw = parsedBusiness.data;

  const parsedClient = clientSnapshotV1PdfSchema.safeParse(invoice.clientSnapshot);
  if (!parsedClient.success) {
    throw new ConflictError('Malformed or unsupported client snapshot version');
  }
  const recipientRaw = parsedClient.data;

  const items: InvoicePdfItem[] = invoice.items
    .slice()
    .sort(
      (
        a: Prisma.InvoiceItemGetPayload<Record<string, never>>,
        b: Prisma.InvoiceItemGetPayload<Record<string, never>>,
      ) => a.lineNumber - b.lineNumber,
    )
    .map((item: Prisma.InvoiceItemGetPayload<Record<string, never>>) => ({
      lineNumber: item.lineNumber,
      description: item.description,
      sacCode: item.sacCode,
      quantity: item.quantity.toString(),
      rate: formatPdfMoney(item.rate.toFixed(2)),
      discountAmount: formatPdfMoney(item.discountAmount.toFixed(2)),
      taxableAmount: formatPdfMoney(item.taxableAmount.toFixed(2)),
      gstRate: item.gstRate.toFixed(2),
      cgstAmount: formatPdfMoney(item.cgstAmount.toFixed(2)),
      sgstAmount: formatPdfMoney(item.sgstAmount.toFixed(2)),
      igstAmount: formatPdfMoney(item.igstAmount.toFixed(2)),
      totalAmount: formatPdfMoney(item.totalAmount.toFixed(2)),
    }));

  const hasBankDetails =
    supplierRaw.bankAccountName !== null ||
    supplierRaw.bankAccountNumber !== null ||
    supplierRaw.bankName !== null ||
    supplierRaw.bankIfsc !== null ||
    supplierRaw.upiId !== null;

  return {
    supplier: {
      legalName: supplierRaw.legalName,
      displayName: supplierRaw.displayName,
      gstin: supplierRaw.gstin,
      pan: supplierRaw.pan,
      addressLine1: supplierRaw.addressLine1,
      addressLine2: supplierRaw.addressLine2,
      city: supplierRaw.city,
      state: supplierRaw.state,
      stateCode: supplierRaw.stateCode,
      postalCode: supplierRaw.postalCode,
      country: supplierRaw.country,
      email: supplierRaw.email,
      phone: supplierRaw.phone,
    },
    recipient: {
      name: recipientRaw.name,
      gstin: recipientRaw.gstin,
      pan: recipientRaw.pan,
      addressLine1: recipientRaw.addressLine1,
      addressLine2: recipientRaw.addressLine2,
      city: recipientRaw.city,
      state: recipientRaw.state,
      stateCode: recipientRaw.stateCode,
      postalCode: recipientRaw.postalCode,
      country: recipientRaw.country,
      email: recipientRaw.email,
      phone: recipientRaw.phone,
    },
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: formatPdfDate(invoice.invoiceDate),
      dueDate: invoice.dueDate ? formatPdfDate(invoice.dueDate) : null,
      financialYear: invoice.financialYear,
      placeOfSupplyState: invoice.placeOfSupplyState,
      placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
      currency: invoice.currency,
    },
    items,
    totals: {
      subtotal: formatPdfMoney(invoice.subtotal.toFixed(2)),
      discountTotal: formatPdfMoney(invoice.discountTotal.toFixed(2)),
      taxableTotal: formatPdfMoney(invoice.taxableTotal.toFixed(2)),
      cgstTotal: formatPdfMoney(invoice.cgstTotal.toFixed(2)),
      sgstTotal: formatPdfMoney(invoice.sgstTotal.toFixed(2)),
      igstTotal: formatPdfMoney(invoice.igstTotal.toFixed(2)),
      total: formatPdfMoney(invoice.total.toFixed(2)),
      paidAmount: formatPdfMoney(invoice.paidAmount.toFixed(2)),
      outstandingAmount: formatPdfMoney(invoice.outstandingAmount.toFixed(2)),
    },
    paymentDetails: hasBankDetails
      ? {
          bankAccountName: supplierRaw.bankAccountName ?? null,
          bankAccountNumber: supplierRaw.bankAccountNumber ?? null,
          bankName: supplierRaw.bankName ?? null,
          bankIfsc: supplierRaw.bankIfsc ?? null,
          upiId: supplierRaw.upiId ?? null,
        }
      : null,
    notes: invoice.notes,
    terms: invoice.terms,
  };
}
