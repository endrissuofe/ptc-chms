import { z } from 'zod';

const count = z.coerce.number().int().min(0).max(20000);

export const attendanceSchema = z.object({
  serviceDate: z.coerce.date(),
  service: z.enum(['first', 'second']),
  men: count,
  women: count,
  teens: count,
  children: count,
  note: z.string().trim().max(300).optional(),
});
