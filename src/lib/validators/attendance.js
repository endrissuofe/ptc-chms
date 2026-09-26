import { z } from 'zod';
import { serviceKey } from './churchService';

const count = z.coerce.number().int().min(0).max(20000);

export const attendanceSchema = z.object({
  serviceDate: z.coerce.date(),
  service: serviceKey,
  men: count,
  women: count,
  teens: count,
  children: count,
  note: z.string().trim().max(300).optional(),
});
