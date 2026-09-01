import { z } from 'zod';
import { PaymentMethod } from '../../generated/prisma/client';

export const paymentRecordBodySchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid decimal string')
    .refine((val) => parseFloat(val) > 0, { message: 'Amount must be greater than zero' }),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().min(1).max(100),
});

export type PaymentRecordBodyDto = z.infer<typeof paymentRecordBodySchema>;
