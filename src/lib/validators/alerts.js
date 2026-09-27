import { z } from 'zod';

const emails = z
  .array(z.string().trim().toLowerCase().email('Check this email address'))
  .max(30, 'Up to 30 addresses');

export const alertSettingsSchema = z
  .object({ followupEmails: emails, pastorEmails: emails, followUpReport: z.boolean() })
  .partial();

export const testEmailSchema = z.object({
  to: z.string().trim().toLowerCase().email('Enter a valid email address'),
});
