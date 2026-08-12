import { z } from 'zod';
import { UserRole } from '../../generated/prisma/client';

export const listUsersSchema = {
  query: z
    .object({
      limit: z
        .string()
        .regex(/^[1-9][0-9]*$/, 'Limit must be a positive integer without leading zeros')
        .transform(Number)
        .refine((val) => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
        .optional()
        .default('20'),
      offset: z
        .string()
        .regex(/^(0|[1-9][0-9]*)$/, 'Offset must be a non-negative integer without leading zeros')
        .transform(Number)
        .refine((val) => val <= Number.MAX_SAFE_INTEGER, 'Offset must be a safe integer')
        .optional()
        .default('0'),
      role: z.enum([UserRole.SUPER_ADMIN, UserRole.STAFF, UserRole.VIEWER]).optional(),
      isActive: z
        .enum(['true', 'false'], {
          errorMap: () => ({ message: 'isActive must be exactly "true" or "false"' }),
        })
        .transform((val) => val === 'true')
        .optional(),
    })
    .strict(),
};

export type ListUsersQuery = z.infer<typeof listUsersSchema.query>;

export const getUserSchema = {
  params: z
    .object({
      userId: z.string().uuid('Invalid user ID'),
    })
    .strict(),
};

export const createUserSchema = {
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().max(320),
      firstName: z.string().trim().min(1).max(100),
      lastName: z.string().trim().min(1).max(100),
      role: z.enum([UserRole.STAFF, UserRole.VIEWER]),
      temporaryPassword: z.string().min(15).max(128),
    })
    .strict(),
};

export const updateUserRoleSchema = {
  params: z
    .object({
      userId: z.string().uuid('Invalid user ID'),
    })
    .strict(),
  body: z
    .object({
      role: z.enum([UserRole.STAFF, UserRole.VIEWER]),
    })
    .strict(),
};
