import { z } from 'zod';
import { serviceKey } from './churchService';
import { isValidPhone } from '../phone';
import { birthdayProblem } from '../birthday';

const cardFields = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  phone: z.string().refine(isValidPhone, 'Enter a valid Nigerian phone number'),
  email: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional(),
  birthDay: z.coerce.number().int().min(1).max(31).optional(),
  birthMonth: z.coerce.number().int().min(1).max(12).optional(),
  prayerRequest: z.string().trim().max(1000).optional(),
  smsConsent: z.boolean().default(false),
  cardUnclear: z.boolean().default(false),
  service: serviceKey,
  serviceDate: z.coerce.date(),
  // Usher confirmed this is a different person from everyone already on this phone number.
  newPersonConfirmed: z.boolean().default(false),
});

const checkBirthday = (v, ctx) => {
  const problem = birthdayProblem(v.birthDay, v.birthMonth);
  if (problem) ctx.addIssue({ code: 'custom', path: ['birthDay'], message: problem });
};

export const newcomerSchema = cardFields.superRefine(checkBirthday);

export const lookupSchema = z.object({
  phone: z.string().refine(isValidPhone, 'Enter a valid Nigerian phone number'),
});

/** The card the returning visitor filled in; used to add a new prayer request and fill blanks. */
export const returningVisitSchema = z.object({
  personId: z.string().min(1),
  service: serviceKey,
  serviceDate: z.coerce.date(),
  card: cardFields
    .pick({ email: true, birthDay: true, birthMonth: true, prayerRequest: true, smsConsent: true })
    .partial()
    .superRefine(checkBirthday)
    .optional(),
});
