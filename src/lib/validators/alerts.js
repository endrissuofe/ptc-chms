import { z } from 'zod';

const emails = z
  .array(z.string().trim().toLowerCase().email('Check this email address'))
  .max(30, 'Up to 30 addresses');

export const alertSettingsSchema = z
  .object({
    followupEmails: emails,
    pastorEmails: emails,
    followUpReport: z.boolean(),
    celebrationEmails: emails,
    celebrationReport: z.boolean(),
  })
  .partial();
