import { z } from 'zod';

export const PaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  UPI: 'UPI',
  CHEQUE: 'CHEQUE',
  OTHER: 'OTHER',
} as const;

export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

export const PaymentStatus = {
  RECORDED: 'RECORDED',
  REVERSED: 'REVERSED',
} as const;

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

export const paymentRecordSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER']),
  reference: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().uuid('Idempotency key is missing or invalid'),
});

export type PaymentRecordPayload = z.infer<typeof paymentRecordSchema>;

export const paymentReverseSchema = z.object({
  reversalReason: z.string().min(1, 'Reversal reason is required'),
});

export type PaymentReversePayload = z.infer<typeof paymentReverseSchema>;

export interface PaymentResponse {
  id: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  idempotencyKey: string;
  recordedByUserId: string;
  paidAt: string;
  reversedAt: string | null;
  reversedByUserId: string | null;
  reversalReason: string | null;
  createdAt: string;
}
