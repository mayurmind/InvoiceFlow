import { describe, it, expect } from 'vitest';
import { generateInvoiceEmailTemplate } from '../../../../src/features/invoices/email/invoice-email.template';
import { InvoicePdfModel } from '../../../../src/features/invoices/pdf/invoice-pdf.types';

describe('Invoice Email Template', () => {
  it('generates HTML and text emails correctly with due date', () => {
    const model: InvoicePdfModel = {
      metadata: {
        invoiceNumber: 'INV-123',
        invoiceDate: '2023-01-01',
        dueDate: '2023-01-15',
      },
      supplier: {
        displayName: 'Supplier Inc',
        email: 'supplier@example.com',
        address: '123 St',
      },
      recipient: {
        name: 'Client LLC',
        email: 'client@example.com',
        address: '456 Ave',
      },
      items: [],
      totals: {
        subtotal: '100',
        taxTotal: '10',
        total: '110',
      },
    };

    const template = generateInvoiceEmailTemplate(model);

    expect(template.subject).toBe('Invoice INV-123 from Supplier Inc');
    expect(template.htmlBody).toContain('INV-123');
    expect(template.htmlBody).toContain('Supplier Inc');
    expect(template.htmlBody).toContain('110');
    expect(template.htmlBody).toContain('2023-01-15');

    expect(template.textBody).toContain('INV-123');
    expect(template.textBody).toContain('110');
    expect(template.textBody).toContain('Due: 2023-01-15');
  });

  it('omits due date if not present in metadata', () => {
    const model: InvoicePdfModel = {
      metadata: {
        invoiceNumber: 'INV-124',
        invoiceDate: '2023-01-01',
      },
      supplier: {
        displayName: 'Supplier Inc',
        address: '123 St',
      },
      recipient: {
        name: 'Client LLC',
        address: '456 Ave',
      },
      items: [],
      totals: {
        subtotal: '100',
        taxTotal: '10',
        total: '110',
      },
    };

    const template = generateInvoiceEmailTemplate(model);
    expect(template.subject).toBe('Invoice INV-124 from Supplier Inc');
    expect(template.htmlBody).not.toContain('Due Date');
    expect(template.textBody).not.toContain('Due Date');
  });
});
