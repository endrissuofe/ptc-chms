import { z } from 'zod';
import { serviceKey } from './churchService';
import { isValidPhone } from '../phone';

export const newcomerSchema = z.object({
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
});

export const lookupSchema = z.object({
  phone: z.string().refine(isValidPhone, 'Enter a valid Nigerian phone number'),
});

export const returningVisitSchema = z.object({
  personId: z.string().min(1),
  service: serviceKey,
  serviceDate: z.coerce.date(),
});
