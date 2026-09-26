import { z } from 'zod';
import { START_TIME_RE } from '../church';

const name = z.string().trim().min(1, 'Name is required').max(40);
const startTime = z.string().regex(START_TIME_RE, 'Use a time like 08:00');

export const createServiceSchema = z.object({ name, startTime });

export const updateServiceSchema = z
  .object({ name, startTime, active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

/** Full list of service keys in the new display order. */
export const reorderServicesSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

/** A service key sent with attendance or a card. Checked against real services in the service layer. */
export const serviceKey = z.string().trim().min(1, 'Choose a service').max(40);
