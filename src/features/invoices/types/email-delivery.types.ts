export const EmailDeliveryStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  FAILED: 'FAILED',
} as const;

export type EmailDeliveryStatus = typeof EmailDeliveryStatus[keyof typeof EmailDeliveryStatus];

export interface EmailDeliveryResponse {
  id: string;
  invoiceId: string;
  recipientEmail: string;
  status: EmailDeliveryStatus;
  attemptNumber: number;
  attemptedAt: string;
  acceptedAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
}
