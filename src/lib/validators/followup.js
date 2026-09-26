import { z } from 'zod';

export const followUpSchema = z.object({
  personId: z.string().min(1),
  outcome: z.enum(['reached', 'no_answer', 'call_back', 'wrong_number']),
  channel: z.enum(['call', 'whatsapp', 'in_person']),
  note: z.string().trim().max(1000).optional(),
});

export const prayerStatusSchema = z.object({
  status: z.enum(['new', 'prayed', 'needs_visit']),
});

export const smsTemplateSchema = z.object({
  body: z.string().trim().min(1).max(459),
  enabled: z.boolean(),
});
