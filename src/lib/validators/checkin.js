import { z } from 'zod';

/** Answers to the one-month check-in survey (public page). */
export const checkInAnswerSchema = z.object({
  token: z.string().min(6).max(40),
  rating: z.coerce.number().int().min(1, 'Choose an answer').max(5),
  wantsCall: z.boolean().default(false),
  comment: z.string().trim().max(500, 'Keep it under 500 characters').optional(),
});
