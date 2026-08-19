import { EmailDeliveryStatus } from '../../../generated/prisma/client';

export interface SendInvoiceEmailInput {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
  idempotencyKey: string;
}

export interface SendInvoiceEmailResult {
  provider: string;
  providerMessageId: string | null;
}

export interface EmailDeliveryDto {
  id: string;
  invoiceId: string;
  recipientEmail: string;
  status: EmailDeliveryStatus;
  attemptNumber: number;
  attemptedAt: Date;
  acceptedAt: Date | null;
  failedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
}
