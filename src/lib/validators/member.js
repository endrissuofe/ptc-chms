import { z } from 'zod';
import { isValidPhone } from '../phone';
import { birthdayProblem } from '../birthday';

const day = z.coerce.number().int().min(1).max(31).nullable();
const month = z.coerce.number().int().min(1).max(12).nullable();

const fields = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().max(60).default(''),
  phone: z.string().refine(isValidPhone, 'Enter a Nigerian mobile number'),
  gender: z.enum(['male', 'female']).nullable(),
  address: z.string().trim().max(200, 'Keep the address under 200 characters'),
  birthDay: day,
  birthMonth: month,
  anniversaryDay: day,
  anniversaryMonth: month,
  smsOptOut: z.boolean(),
  active: z.boolean(),
});

/** Both parts of a date or neither, and a day that exists in that month. */
function checkDates(v, ctx) {
  for (const [d, m] of [
    ['birthDay', 'birthMonth'],
    ['anniversaryDay', 'anniversaryMonth'],
  ]) {
    if (v[d] === undefined && v[m] === undefined) continue;
    const problem = birthdayProblem(v[d] ?? null, v[m] ?? null);
    if (problem) ctx.addIssue({ code: 'custom', path: [d], message: problem });
  }
}

export const memberCreateSchema = fields
  .partial({
    gender: true,
    address: true,
    birthDay: true,
    birthMonth: true,
    anniversaryDay: true,
    anniversaryMonth: true,
    smsOptOut: true,
    active: true,
  })
  .superRefine(checkDates);

export const memberUpdateSchema = fields.partial().superRefine(checkDates);

const memberId = z.string().regex(/^[a-f0-9]{24}$/, 'Member not found');

/** Merge a duplicate: `remove` goes into `keep`. */
export const memberMergeSchema = z.object({ keep: memberId, remove: memberId });

/** Two members sharing a phone who are different people. */
export const notDuplicatesSchema = z.object({ a: memberId, b: memberId });
