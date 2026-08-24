import { InvoicePdfModel } from '../pdf/invoice-pdf.types';

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeSubject(unsafe: string): string {
  if (/[\r\n]/.test(unsafe)) {
    throw new Error('Email subject contains prohibited CR/LF characters');
  }
  return unsafe.trim();
}

export interface GeneratedEmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export function generateInvoiceEmailTemplate(model: InvoicePdfModel): GeneratedEmailTemplate {
  const invoiceNumber = model.metadata.invoiceNumber;
  const supplierName = model.supplier.displayName;
  const recipientName = model.recipient.name;
  const date = model.metadata.invoiceDate;
  const dueDateStr = model.metadata.dueDate ? ` (Due: ${model.metadata.dueDate})` : '';
  const total = model.totals.total;

  const rawSubject = `Invoice ${invoiceNumber} from ${supplierName}`;
  const subject = sanitizeSubject(rawSubject);

  const textBody = `Hello ${recipientName},

Please find attached the GST invoice ${invoiceNumber} from ${supplierName}.

Invoice Date: ${date}${dueDateStr}
Total Amount: ${total}

A PDF copy of this invoice is attached to this email.

Thank you,
${supplierName}`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="font-family: sans-serif; color: #333; line-height: 1.6;">
  <p>Hello ${escapeHtml(recipientName)},</p>
  <p>Please find attached the GST invoice <strong>${escapeHtml(invoiceNumber)}</strong> from <strong>${escapeHtml(supplierName)}</strong>.</p>
  <ul>
    <li><strong>Invoice Date:</strong> ${escapeHtml(date)}</li>
    ${model.metadata.dueDate ? `<li><strong>Due Date:</strong> ${escapeHtml(model.metadata.dueDate)}</li>` : ''}
    <li><strong>Total Amount:</strong> ${escapeHtml(total)}</li>
  </ul>
  <p>A PDF copy of this invoice is attached to this email.</p>
  <p>Thank you,<br>${escapeHtml(supplierName)}</p>
</body>
</html>`;

  return { subject, htmlBody, textBody };
}
