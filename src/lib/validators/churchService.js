import { z } from 'zod';
import { START_TIME_RE } from '../church';

const name = z.string().trim().min(1, 'Name is required').max(40);
const startTime = z.string().regex(START_TIME_RE, 'Use a time like 08:00');
const days = z
  .array(z.number().int().min(0).max(6))
  .min(1, 'Choose at least one day')
  .transform((d) => [...new Set(d)].sort());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');

export const createServiceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('regular'), name, startTime, days }),
  z.object({ kind: z.literal('special'), name, startTime, date }),
]);

/** Days apply to regular services and date to special ones; the service layer checks which. */
export const updateServiceSchema = z
  .object({ name, startTime, active: z.boolean(), livestream: z.boolean(), days, date })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

/** A service key sent with attendance or a card. Checked against real services in the service layer. */
export const serviceKey = z.string().trim().min(1, 'Choose a service').max(40);
