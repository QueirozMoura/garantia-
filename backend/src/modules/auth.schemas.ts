import { z } from 'zod';

const emailSchema = z
  .string({ message: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Invalid email address' }));

export const registerSchema = z.object({
  name: z.string({ message: 'Name is required' }).trim().min(1).max(100),
  email: emailSchema,
  password: z.string({ message: 'Password is required' }).min(8).max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ message: 'Password is required' }).min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
