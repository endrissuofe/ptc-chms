import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { returningVisitSchema } from '@/lib/validators/newcomer';
import { recordReturningVisit } from '@/services/newcomer.service';

/** Usher confirms "Yes, same person" on the returning-visitor screen. */
export const POST = handler(async (req) => {
  const user = await requireRole(ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN);
  const input = returningVisitSchema.parse(await req.json());
  const person = await recordReturningVisit(input, user);
  return NextResponse.json({
    id: String(person._id),
    stage: person.stage,
    visitCount: person.visitCount,
  });
});
