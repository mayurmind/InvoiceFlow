import { z } from 'zod';
import {
  VALID_STATE_CODES,
  REGEX_PAN,
  REGEX_PIN,
  REGEX_IFSC,
  REGEX_UPI,
  REGEX_INVOICE_PREFIX,
} from './business-settings.constants';

export const updateBusinessSettingsSchema = {
  body: z
    .object({
      legalName: z.string().trim().min(1).max(200),
      displayName: z.string().trim().min(1).max(200),
      gstin: z
        .string()
        .trim()
        .toUpperCase()
        .length(15, 'GSTIN must be exactly 15 characters')
        .regex(/^[A-Z0-9]{15}$/, 'GSTIN must be alphanumeric')
        .optional()
        .nullable(),
      pan: z
        .string()
        .trim()
        .toUpperCase()
        .regex(REGEX_PAN, 'Invalid PAN format')
        .optional()
        .nullable(),
      addressLine1: z.string().trim().min(1).max(200),
      addressLine2: z.string().trim().max(200).optional().nullable(),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(1).max(100),
      stateCode: z
        .string()
        .trim()
        .length(2, 'State Code must be 2 characters')
        .refine((code) => VALID_STATE_CODES.has(code), 'Invalid Indian State/UT Code'),
      postalCode: z.string().trim().regex(REGEX_PIN, 'Invalid Indian Postal Code'),
      country: z.literal('India'),
      email: z.string().trim().toLowerCase().email().max(320).optional().nullable(),
      phone: z.string().trim().max(30).optional().nullable(),
      logoStorageKey: z.string().trim().max(500).optional().nullable(),
      invoicePrefix: z
        .string()
        .trim()
        .toUpperCase()
        .regex(
          REGEX_INVOICE_PREFIX,
          'Invoice Prefix can only contain letters, numbers, hyphens, and slashes',
        )
        .min(1)
        .max(5),
      defaultDueDays: z.number().int().min(0).max(365),
      bankAccountName: z.string().trim().max(200).optional().nullable(),
      bankAccountNumber: z.string().trim().max(50).optional().nullable(),
      bankName: z.string().trim().max(200).optional().nullable(),
      bankIfsc: z
        .string()
        .trim()
        .toUpperCase()
        .regex(REGEX_IFSC, 'Invalid IFSC format')
        .optional()
        .nullable(),
      upiId: z.string().trim().regex(REGEX_UPI, 'Invalid UPI ID format').optional().nullable(),
    })
    .strict()
    .superRefine((data, ctx) => {
      // 1. If GSTIN is provided, validate its structure
      if (data.gstin) {
        const gstinStateCode = data.gstin.substring(0, 2);
        const gstinPan = data.gstin.substring(2, 12);

        if (gstinStateCode !== data.stateCode) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'GSTIN first two characters must match the provided stateCode',
            path: ['gstin'],
          });
        }

        if (!REGEX_PAN.test(gstinPan)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'GSTIN embedded PAN is invalid',
            path: ['gstin'],
          });
        }

        // 2. If PAN is also provided, they must match
        if (data.pan && data.pan !== gstinPan) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'GSTIN embedded PAN does not match the provided PAN',
            path: ['gstin'],
          });
        }
      }
    }),
};
