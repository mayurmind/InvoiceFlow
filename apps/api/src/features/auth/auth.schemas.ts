import { z } from 'zod';

export const loginSchema = {
  body: z
    .object({
      email: z.string().trim().toLowerCase().max(320).email('Invalid email address format'),
      password: z.string().max(128, 'Password must be at most 128 characters'),
    })
    .strict(),
};
