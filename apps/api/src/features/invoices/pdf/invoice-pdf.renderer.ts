import PDFDocument from 'pdfkit';
import { InvoicePdfModel } from './invoice-pdf.types';

export function renderInvoicePdf(model: InvoicePdfModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        bufferPages: true,
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Invoice ${model.metadata.invoiceNumber}`,
          Author: model.supplier.legalName,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const margin = 50;
      const contentWidth = 595.28 - margin * 2;
      const contentBottom = 841.89 - 80; // leave room for footer

      const drawHeader = () => {
        doc.fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', margin, margin);
        doc
          .fontSize(10)
          .font('Helvetica')
          .text('ORIGINAL FOR RECIPIENT', margin, margin + 25);
      };

      const drawSupplier = (yOffset: number) => {
        doc.fontSize(12).font('Helvetica-Bold').text(model.supplier.legalName, margin, yOffset);
        let currentY = yOffset + 15;
        doc.fontSize(10).font('Helvetica');
        if (model.supplier.displayName && model.supplier.displayName !== model.supplier.legalName) {
          doc.text(model.supplier.displayName, margin, currentY);
          currentY += 12;
        }
        doc.text(`${model.supplier.addressLine1}`, margin, currentY);
        currentY += 12;
        if (model.supplier.addressLine2) {
          doc.text(`${model.supplier.addressLine2}`, margin, currentY);
          currentY += 12;
        }
        doc.text(
          `${model.supplier.city}, ${model.supplier.state} - ${model.supplier.postalCode}`,
          margin,
          currentY,
        );
        currentY += 12;
        doc.text(`${model.supplier.country}`, margin, currentY);
        currentY += 15;

        if (model.supplier.gstin) {
          doc
            .font('Helvetica-Bold')
            .text('GSTIN: ', margin, currentY, { continued: true })
            .font('Helvetica')
            .text(model.supplier.gstin);
          currentY += 12;
        }
        if (model.supplier.pan) {
          doc
            .font('Helvetica-Bold')
            .text('PAN: ', margin, currentY, { continued: true })
            .font('Helvetica')
            .text(model.supplier.pan);
          currentY += 12;
        }
        if (model.supplier.email) {
          doc.text(`Email: ${model.supplier.email}`, margin, currentY);
          currentY += 12;
        }
        if (model.supplier.phone) {
          doc.text(`Phone: ${model.supplier.phone}`, margin, currentY);
        }
        return currentY + 15;
      };

      const drawMetadata = (yOffset: number) => {
        const startX = 350;
        let currentY = yOffset;
        doc.fontSize(10);

        const labelX = startX;
        const valX = startX + 90;

        const addRow = (label: string, val: string) => {
          doc.font('Helvetica-Bold').text(label, labelX, currentY);
          doc.font('Helvetica').text(val, valX, currentY, { width: 100, align: 'right' });
          currentY += 15;
        };

        addRow('Invoice No:', model.metadata.invoiceNumber);
        addRow('Invoice Date:', model.metadata.invoiceDate);
        if (model.metadata.dueDate) {
          addRow('Due Date:', model.metadata.dueDate);
        }
        addRow('Financial Year:', `FY ${model.metadata.financialYear}`);
        addRow(
          'State of Supply:',
          `${model.metadata.placeOfSupplyState} (${model.metadata.placeOfSupplyStateCode})`,
        );
        addRow('Currency:', model.metadata.currency);

        return currentY + 10;
      };

      const drawRecipient = (yOffset: number) => {
        let currentY = yOffset;
        doc.fontSize(11).font('Helvetica-Bold').text('Bill To:', margin, currentY);
        currentY += 15;

        doc.fontSize(10).font('Helvetica-Bold').text(model.recipient.name, margin, currentY);
        currentY += 12;
        doc.font('Helvetica');
        doc.text(`${model.recipient.addressLine1}`, margin, currentY);
        currentY += 12;
        if (model.recipient.addressLine2) {
          doc.text(`${model.recipient.addressLine2}`, margin, currentY);
          currentY += 12;
        }
        doc.text(
          `${model.recipient.city}, ${model.recipient.state} - ${model.recipient.postalCode}`,
          margin,
          currentY,
        );
        currentY += 12;
        doc.text(`${model.recipient.country}`, margin, currentY);
        currentY += 15;

        if (model.recipient.gstin) {
          doc
            .font('Helvetica-Bold')
            .text('GSTIN: ', margin, currentY, { continued: true })
            .font('Helvetica')
            .text(model.recipient.gstin);
          currentY += 12;
        }
        if (model.recipient.pan) {
          doc
            .font('Helvetica-Bold')
            .text('PAN: ', margin, currentY, { continued: true })
            .font('Helvetica')
            .text(model.recipient.pan);
          currentY += 12;
        }
        return currentY + 15;
      };

      let currentY = margin;
      drawHeader();
      currentY += 40;

      const supplierBottom = drawSupplier(currentY);
      drawMetadata(currentY);

      currentY = Math.max(supplierBottom, currentY + 90);
      doc
        .moveTo(margin, currentY)
        .lineTo(margin + contentWidth, currentY)
        .strokeColor('#dddddd')
        .stroke();
      currentY += 15;

      currentY = drawRecipient(currentY);

      // TABLE
      const cols = {
        hash: margin,
        desc: margin + 20,
        sac: margin + 170,
        qty: margin + 220,
        rate: margin + 250,
        disc: margin + 300,
        taxVal: margin + 350,
        gst: margin + 410,
        total: margin + 440,
      };

      const drawTableHeader = (y: number) => {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('#', cols.hash, y);
        doc.text('Description', cols.desc, y);
        doc.text('SAC', cols.sac, y);
        doc.text('Qty', cols.qty, y, { width: 30, align: 'right' });
        doc.text('Rate', cols.rate, y, { width: 45, align: 'right' });
        doc.text('Disc.', cols.disc, y, { width: 45, align: 'right' });
        doc.text('Taxable', cols.taxVal, y, { width: 55, align: 'right' });
        doc.text('GST%', cols.gst, y, { width: 25, align: 'right' });
        doc.text('Line Total', cols.total, y, {
          width: contentWidth - (cols.total - margin),
          align: 'right',
        });

        doc
          .moveTo(margin, y + 15)
          .lineTo(margin + contentWidth, y + 15)
          .stroke();
        return y + 20;
      };

      currentY = drawTableHeader(currentY);

      doc.font('Helvetica').fontSize(9);
      for (const item of model.items) {
        const descHeight = doc.heightOfString(item.description, {
          width: cols.sac - cols.desc - 10,
        });
        if (currentY + descHeight > contentBottom) {
          doc.addPage();
          currentY = drawTableHeader(margin);
          doc.font('Helvetica').fontSize(9);
        }

        doc.text(item.lineNumber.toString(), cols.hash, currentY);
        doc.text(item.description, cols.desc, currentY, { width: cols.sac - cols.desc - 10 });
        doc.text(item.sacCode || '-', cols.sac, currentY);
        doc.text(item.quantity, cols.qty, currentY, { width: 30, align: 'right' });
        doc.text(item.rate.replace('INR ', ''), cols.rate, currentY, { width: 45, align: 'right' });
        doc.text(item.discountAmount.replace('INR ', ''), cols.disc, currentY, {
          width: 45,
          align: 'right',
        });
        doc.text(item.taxableAmount.replace('INR ', ''), cols.taxVal, currentY, {
          width: 55,
          align: 'right',
        });
        doc.text(item.gstRate, cols.gst, currentY, { width: 25, align: 'right' });
        doc.text(item.totalAmount.replace('INR ', ''), cols.total, currentY, {
          width: contentWidth - (cols.total - margin),
          align: 'right',
        });

        currentY += descHeight + 10;
      }

      doc
        .moveTo(margin, currentY)
        .lineTo(margin + contentWidth, currentY)
        .stroke();
      currentY += 15;

      const ensureSpace = (needed: number) => {
        if (currentY + needed > contentBottom) {
          doc.addPage();
          currentY = margin;
        }
      };

      // Summary
      ensureSpace(120);
      const summaryLeft = 350;
      const summaryValX = 450;

      const drawSummaryRow = (label: string, val: string, bold = false) => {
        if (bold) doc.font('Helvetica-Bold');
        else doc.font('Helvetica');
        doc.text(label, summaryLeft, currentY);
        doc.text(val, summaryValX, currentY, { width: 100, align: 'right' });
        currentY += 15;
      };

      drawSummaryRow('Subtotal', model.totals.subtotal);
      if (model.totals.discountTotal !== 'INR 0.00') {
        drawSummaryRow('Discount', `-${model.totals.discountTotal}`);
      }
      drawSummaryRow('Taxable Value', model.totals.taxableTotal);

      // Determine if IGST or CGST/SGST
      if (model.totals.igstTotal !== 'INR 0.00') {
        drawSummaryRow('IGST', model.totals.igstTotal);
      } else {
        if (model.totals.cgstTotal !== 'INR 0.00' || model.totals.sgstTotal !== 'INR 0.00') {
          drawSummaryRow('CGST', model.totals.cgstTotal);
          drawSummaryRow('SGST', model.totals.sgstTotal);
        }
      }

      currentY += 5;
      drawSummaryRow('Grand Total', model.totals.total, true);
      currentY += 5;
      drawSummaryRow('Paid Amount', model.totals.paidAmount);
      drawSummaryRow('Outstanding', model.totals.outstandingAmount, true);

      currentY += 20;

      // Reverse Charge Constraint
      ensureSpace(20);
      doc.fontSize(10).font('Helvetica-Bold').text('Reverse Charge: No', margin, currentY);
      // Comment: P6.3 V1 supports forward-charge service invoices only.
      currentY += 20;

      if (model.notes) {
        const height = doc.heightOfString(model.notes, { width: contentWidth });
        ensureSpace(height + 20);
        doc.font('Helvetica-Bold').text('Notes:', margin, currentY);
        currentY += 15;
        doc.font('Helvetica').text(model.notes, margin, currentY, { width: contentWidth });
        currentY += height + 15;
      }

      if (model.terms) {
        const height = doc.heightOfString(model.terms, { width: contentWidth });
        ensureSpace(height + 20);
        doc.font('Helvetica-Bold').text('Terms & Conditions:', margin, currentY);
        currentY += 15;
        doc.font('Helvetica').text(model.terms, margin, currentY, { width: contentWidth });
        currentY += height + 15;
      }

      if (model.paymentDetails) {
        ensureSpace(100);
        doc.font('Helvetica-Bold').text('Payment Details:', margin, currentY);
        currentY += 15;
        doc.font('Helvetica');
        const p = model.paymentDetails;
        if (p.bankAccountName) {
          doc.text(`Account Name: ${p.bankAccountName}`, margin, currentY);
          currentY += 12;
        }
        if (p.bankAccountNumber) {
          doc.text(`Account No: ${p.bankAccountNumber}`, margin, currentY);
          currentY += 12;
        }
        if (p.bankName) {
          doc.text(`Bank: ${p.bankName}`, margin, currentY);
          currentY += 12;
        }
        if (p.bankIfsc) {
          doc.text(`IFSC: ${p.bankIfsc}`, margin, currentY);
          currentY += 12;
        }
        if (p.upiId) {
          doc.text(`UPI ID: ${p.upiId}`, margin, currentY);
          currentY += 12;
        }
        currentY += 15;
      }

      // Signature area
      ensureSpace(100);
      currentY += 30; // some spacing
      doc
        .font('Helvetica')
        .text(`For ${model.supplier.legalName}`, margin, currentY, { align: 'right' });
      currentY += 50;
      doc.moveTo(400, currentY).lineTo(545, currentY).stroke();
      currentY += 5;
      doc.text('Authorized Signatory', margin, currentY, { align: 'right' });

      // Add page numbers
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(9);
        const footerY = 841.89 - 40;
        doc.text(`Page ${i + 1} of ${pages.count}`, margin, footerY, { align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
