import { z } from 'zod';
import { TEMPLATE_KEYS } from '../sms/templates';
import { isValidPhone } from '../phone';

const body = z
  .string()
  .trim()
  .min(1, 'The message is empty')
  .max(459, 'Keep it to 3 pages or fewer');

export const smsTemplateSchema = z.object({ body, enabled: z.boolean() });

export const testSmsSchema = z.object({
  templateKey: z.enum(TEMPLATE_KEYS),
  phone: z.string().refine(isValidPhone, 'Enter a Nigerian mobile number'),
  body: body.optional(),
});

export const missedThanksSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body,
});
