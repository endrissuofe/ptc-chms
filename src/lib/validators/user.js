import { z } from 'zod';
import { ALL_ROLES } from '../roles';
import { JOINABLE_ROLES, MIN_PASSWORD, USERNAME_RE } from '../users';
import { isValidPhone } from '../phone';

const password = z
  .string()
  .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`)
  .max(100, 'That password is too long');

const name = z.string().trim().min(2, 'Enter a name').max(60);
const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(120);
const optionalEmail = z.union([email, z.literal('').transform(() => null)]);
const phone = z.string().refine(isValidPhone, 'Enter a Nigerian mobile number');
const optionalPhone = z.union([phone, z.literal('').transform(() => null)]);
const alerts = z.object({ followUp: z.boolean(), celebrations: z.boolean() }).partial();

export const newUserSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_RE, '3–30 letters or numbers (dot, dash and underscore allowed, no spaces)'),
  displayName: name,
  role: z.enum(ALL_ROLES),
  password,
  email: optionalEmail.optional(),
});

export const userUpdateSchema = z
  .object({
    displayName: name,
    role: z.enum(ALL_ROLES),
    active: z.boolean(),
    password,
    email: optionalEmail,
    phone: optionalPhone,
    alerts,
  })
  .partial();

/** Someone signing up with a team's invite link. `website` is a trap field left empty by people. */
export const joinSchema = z.object({
  token: z.string().min(10).max(100),
  displayName: name,
  phone,
  email,
  password,
  website: z.string().max(200).optional(),
});

export const approveSchema = z.object({ role: z.enum(JOINABLE_ROLES) });

export const joinRoleSchema = z.enum(JOINABLE_ROLES);

/** Anyone, on My account. A new password needs the current one. */
export const accountSchema = z
  .object({
    displayName: name,
    email: optionalEmail,
    phone: optionalPhone,
    alerts,
    currentPassword: z.string().max(100),
    newPassword: password,
  })
  .partial()
  .superRefine((v, ctx) => {
    if (v.newPassword && !v.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentPassword'],
        message: 'Enter your current password',
      });
    }
  });
