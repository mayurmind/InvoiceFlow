import { z } from 'zod';

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

export const auditListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    actorUserId: z.string().uuid().optional(),
    action: z.string().trim().optional(),
    entityType: z.string().trim().optional(),
    entityId: z.string().uuid().optional(),
    dateFrom: strictCalendarDateSchema.optional(),
    dateTo: strictCalendarDateSchema.optional(),
  })
  .strict();
