import { InvoicesRepository } from '../invoices.repository';
import { NotFoundError } from '../../../errors/application.error';
import { buildInvoicePdfModel, getSafeFilename } from './invoice-pdf.mapper';
import { renderInvoicePdf } from './invoice-pdf.renderer';

export class InvoicePdfService {
  /**
   * Generates a PDF buffer for a finalized invoice.
   * Returns the PDF buffer and a sanitized filename safe for HTTP headers.
   */
  static async generateInvoicePdf(
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Single read, no lock.
    const invoice = await InvoicesRepository.getInvoiceWithItems(invoiceId);

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Mapper enforces eligibility (must be issued, version=1, valid snapshots, etc.)
    const model = buildInvoicePdfModel(invoice);

    // Renderer is pure
    const buffer = await renderInvoicePdf(model);

    const filename = getSafeFilename(invoice.invoiceNumber as string);

    return { buffer, filename };
  }
}
