import { z } from 'zod';

export const loginSchema = {
  body: z
    .object({
      email: z.string().trim().toLowerCase().max(320).email('Invalid email address format'),
      password: z.string().max(128, 'Password must be at most 128 characters'),
    })
    .strict(),
};

export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z.string().min(15).max(128),
      newPassword: z.string().min(15).max(128),
    })
    .strict(),
};
