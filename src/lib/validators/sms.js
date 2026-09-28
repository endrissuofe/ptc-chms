import { z } from 'zod';
import { AUDIENCES } from '../sms/templates';

const body = z
  .string()
  .trim()
  .min(1, 'The message is empty')
  .max(459, 'Keep it to 3 pages or fewer');

export const smsTemplateSchema = z.object({ body, enabled: z.boolean() });

export const broadcastSchema = z.object({
  audience: z.enum(Object.keys(AUDIENCES)),
  body,
});

export const resendSchema = z.object({ run: z.string().min(3).max(80) });

/** A CSV file's text (about 5 MB at most — tens of thousands of members). */
export const memberImportSchema = z.object({
  csv: z.string().min(1, 'The file is empty').max(5_000_000, 'The file is too big'),
  commit: z.boolean().default(false),
});
