import { z } from 'zod';
import {
  VALID_STATE_CODES,
  INDIA_STATES_AND_UT,
  REGEX_PAN,
  REGEX_PIN,
} from '../business-settings/business-settings.constants';

const normalizeNullable = (val: string | null | undefined): string | null => {
  if (val === null || val === undefined) return null;
  const trimmed = val.trim();
  return trimmed === '' ? null : trimmed;
};

// Base schema for client profile fields used in both Create and Update
const clientProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(200, 'Name must be at most 200 characters'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(320, 'Email must be at most 320 characters')
      .email('Invalid email format')
      .nullable()
      .optional()
      .transform(normalizeNullable),
    phone: z
      .string()
      .trim()
      .max(30, 'Phone must be at most 30 characters')
      .nullable()
      .optional()
      .transform(normalizeNullable),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .length(15, 'GSTIN must be exactly 15 characters')
      .nullable()
      .optional()
      .transform(normalizeNullable),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .regex(REGEX_PAN, 'Invalid PAN format')
      .nullable()
      .optional()
      .transform(normalizeNullable),
    addressLine1: z
      .string()
      .trim()
      .min(1, 'Address Line 1 is required')
      .max(200, 'Address Line 1 must be at most 200 characters'),
    addressLine2: z
      .string()
      .trim()
      .max(200, 'Address Line 2 must be at most 200 characters')
      .nullable()
      .optional()
      .transform(normalizeNullable),
    city: z
      .string()
      .trim()
      .min(1, 'City is required')
      .max(100, 'City must be at most 100 characters'),
    state: z
      .string()
      .trim()
      .min(1, 'State is required')
      .max(100, 'State must be at most 100 characters'),
    stateCode: z.string().trim().length(2, 'State Code must be 2 characters'),
    postalCode: z.string().trim().regex(REGEX_PIN, 'Invalid Indian Postal Code'),
    country: z.literal('India'),
    notes: z
      .string()
      .trim()
      .max(5000, 'Notes must be at most 5000 characters')
      .nullable()
      .optional()
      .transform(normalizeNullable),
  })
  .strict(); // Disallow unknown fields

export const createClientSchema = clientProfileSchema
  .superRefine((data, ctx) => {
    // Validate stateCode
    if (!VALID_STATE_CODES.has(data.stateCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid Indian State/UT Code',
        path: ['stateCode'],
      });
      return;
    }

    // Validate that state matches the controlled mapping for stateCode
    const stateInfo = INDIA_STATES_AND_UT.find((s) => s.code === data.stateCode);
    if (!stateInfo || stateInfo.name !== data.state) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'State name does not match the provided stateCode',
        path: ['state'],
      });
      return;
    }

    // Cross-validate GSTIN
    if (data.gstin) {
      if (!/^[0-9A-Z]{15}$/.test(data.gstin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'GSTIN must be 15 alphanumeric characters',
          path: ['gstin'],
        });
      } else {
        const gstinStatePrefix = data.gstin.substring(0, 2);
        if (gstinStatePrefix !== data.stateCode) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'GSTIN state prefix does not match the provided stateCode',
            path: ['gstin'],
          });
        }

        const embeddedPan = data.gstin.substring(2, 12);
        if (!REGEX_PAN.test(embeddedPan)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'GSTIN contains an invalid embedded PAN',
            path: ['gstin'],
          });
        }

        if (data.pan && data.pan !== embeddedPan) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Supplied PAN does not match the embedded PAN in GSTIN',
            path: ['pan'],
          });
        }
      }
    }
  })
  .transform((data) => {
    // Canonicalize state to the controlled mapping name for the given stateCode
    const stateInfo = INDIA_STATES_AND_UT.find((s) => s.code === data.stateCode)!;
    return {
      ...data,
      state: stateInfo.name,
    };
  });

export const updateClientSchema = createClientSchema;

export const clientLifecycleBodySchema = z.object({}).strict().optional();

export const clientListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
    status: z.enum(['active', 'archived', 'all']).default('active'),
    stateCode: z.string().trim().length(2).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.stateCode && !VALID_STATE_CODES.has(data.stateCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid Indian State/UT Code',
        path: ['stateCode'],
      });
    }
  });

export const clientIdParamSchema = z
  .object({
    clientId: z.string().uuid('Invalid Client ID format'),
  })
  .strict();
