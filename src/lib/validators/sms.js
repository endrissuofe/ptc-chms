import { z } from 'zod';
import { AUDIENCES, MAX_WORDINGS } from '../sms/templates';

const body = z
  .string()
  .trim()
  .min(1, 'The message is empty')
  .max(459, 'Keep it to 3 pages or fewer');

/** One wording, or (Saturday invites) a list of wordings used in turn. */
export const smsTemplateSchema = z
  .object({
    body: body.optional(),
    bodies: z.array(body).min(1, 'Keep at least one wording').max(MAX_WORDINGS).optional(),
    enabled: z.boolean(),
  })
  .refine((v) => v.body || v.bodies, { message: 'The message is empty', path: ['body'] });

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
