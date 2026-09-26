import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { lookupSchema } from '@/lib/validators/newcomer';
import { findByPhone } from '@/services/newcomer.service';

/** Usher checks a phone number before or while typing a card. POST so the number stays out of URLs and logs. */
export const POST = handler(async (req) => {
  await requireRole(ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN);
  const { phone } = lookupSchema.parse(await req.json());
  const person = await findByPhone(phone);
  if (!person) return NextResponse.json({ match: null });
  return NextResponse.json({
    match: {
      id: String(person._id),
      firstName: person.firstName,
      lastName: person.lastName,
      stage: person.stage,
      firstVisitDate: person.firstVisitDate,
      visitCount: person.visitCount,
    },
  });
});
