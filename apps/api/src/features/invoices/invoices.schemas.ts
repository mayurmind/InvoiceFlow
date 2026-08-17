import { z } from 'zod';
import { VALID_STATE_CODES } from '../business-settings/business-settings.constants';

// Strict calendar date validation that checks if the date actually exists (UTC safe)
export const strictCalendarDateSchema = z.string().superRefine((val, ctx) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be YYYY-MM-DD',
    });
    return;
  }

  // Check if date is valid (e.g., rejects 2026-02-31) using UTC parsing
  const [year, month, day] = val.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid calendar date',
    });
  }
});

export const invoiceCreateSchema = z
  .object({
    clientId: z.string().uuid(),
    invoiceDate: strictCalendarDateSchema,
    dueDate: strictCalendarDateSchema.optional(),
    placeOfSupplyStateCode: z
      .string()
      .trim()
      .length(2)
      .refine((value) => VALID_STATE_CODES.has(value), 'Invalid Indian State/UT Code')
      .optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    terms: z.string().trim().max(5000).nullable().optional(),
    items: z
      .array(
        z
          .object({
            description: z.string().trim().min(1).max(500),
            sacCode: z.string().trim().max(20).nullable().optional(),
            quantity: z.string().regex(/^\d+(?:\.\d{1,3})?$/),
            rate: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
            discountAmount: z
              .string()
              .regex(/^\d+(?:\.\d{1,2})?$/)
              .default('0.00'),
            gstRate: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
