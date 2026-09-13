import { z } from 'zod';
import {
  VALID_STATE_CODES,
  INDIA_STATES_AND_UT,
  REGEX_PAN,
  REGEX_PIN,
} from '../../business-settings/constants/business-settings.constants';

// ============================================================
// DTOs matching the backend
// ============================================================

export interface ClientResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  notes: string | null;
  isArchived: boolean;
  archivedAt: string | null; // serialized date
  createdAt: string; // serialized date
  updatedAt: string; // serialized date
}

export type ClientStatusFilter = 'active' | 'archived' | 'all';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ClientListResponse {
  data: ClientResponse[];
  pagination: PaginationMeta;
}

// ============================================================
// Frontend Form Schemas (matching backend validation logic)
// ============================================================

const normalizeNullable = (val: string | null | undefined): string | null => {
  if (val === null || val === undefined) return null;
  const trimmed = val.trim();
  return trimmed === '' ? null : trimmed;
};

export const clientFormSchema = z
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
      .or(z.literal(''))
      .nullable()
      .optional()
      .transform(normalizeNullable),
    phone: z
      .string()
      .trim()
      .max(30, 'Phone must be at most 30 characters')
      .or(z.literal(''))
      .nullable()
      .optional()
      .transform(normalizeNullable),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .length(15, 'GSTIN must be exactly 15 characters')
      .or(z.literal(''))
      .nullable()
      .optional()
      .transform(normalizeNullable),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .regex(REGEX_PAN, 'Invalid PAN format')
      .or(z.literal(''))
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
      .or(z.literal(''))
      .nullable()
      .optional()
      .transform(normalizeNullable),
    city: z
      .string()
      .trim()
      .min(1, 'City is required')
      .max(100, 'City must be at most 100 characters'),
    stateCode: z
      .string()
      .trim()
      .min(1, 'State is required')
      .length(2, 'State Code must be 2 characters'),
    postalCode: z.string().trim().regex(REGEX_PIN, 'Invalid Indian Postal Code'),
    notes: z
      .string()
      .trim()
      .max(5000, 'Notes must be at most 5000 characters')
      .or(z.literal(''))
      .nullable()
      .optional()
      .transform(normalizeNullable),
  })
  .superRefine((data, ctx) => {
    // Validate stateCode
    if (!VALID_STATE_CODES.has(data.stateCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a valid State/UT',
        path: ['stateCode'],
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
            message: 'GSTIN state prefix does not match the selected state',
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
  });

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export interface ClientCreatePayload {
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string; // the backend will overwrite this anyway, but the contract expects it
  stateCode: string;
  postalCode: string;
  country: string; // literal 'India'
  notes: string | null;
}

export type ClientUpdatePayload = ClientCreatePayload;

// Helper to construct the backend payload from form values
export function toClientPayload(data: ClientFormValues): ClientCreatePayload {
  const stateInfo = INDIA_STATES_AND_UT.find((s) => s.code === data.stateCode);
  return {
    ...data,
    state: stateInfo?.name || '',
    country: 'India',
  };
}
