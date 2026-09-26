import { z } from 'zod';
import { ALL_ROLES } from '../roles';
import { MIN_PASSWORD, USERNAME_RE } from '../users';

const password = z
  .string()
  .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`)
  .max(100, 'That password is too long');

export const newUserSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_RE, '3–30 letters or numbers (dot, dash and underscore allowed, no spaces)'),
  displayName: z.string().trim().min(2, 'Enter a name').max(60),
  role: z.enum(ALL_ROLES),
  password,
});

export const userUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2, 'Enter a name').max(60),
    role: z.enum(ALL_ROLES),
    active: z.boolean(),
    password,
  })
  .partial();
