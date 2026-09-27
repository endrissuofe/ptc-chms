import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES, hasRole } from '@/lib/roles';
import { personUpdateSchema } from '@/lib/validators/newcomer';
import { getProfile, setMilestones, updateDetails } from '@/services/newcomer.service';

/** The follow-up team shares one list, so any follow-up worker may open any newcomer. */
export const GET = handler(async (_req, { params }) => {
  const user = await requireRole(ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN);
  const { id } = await params;
  // Prayer requests: pastors and admins here (never follow-up workers).
  const includePrayer = hasRole(user, ROLES.PASTOR, ROLES.ADMIN);
  return NextResponse.json(await getProfile(id, { includePrayer }));
});

/** Pastor/admin: correct details, or set Believers' Class / Member. */
export const PATCH = handler(async (req, { params }) => {
  await requireRole(ROLES.PASTOR, ROLES.ADMIN);
  const { id } = await params;
  const { inBelieversClass, isMember, sharedPhoneConfirmed, ...details } = personUpdateSchema.parse(
    await req.json(),
  );
  if (Object.keys(details).length) await updateDetails(id, { ...details, sharedPhoneConfirmed });
  const person = await setMilestones(id, { inBelieversClass, isMember });
  return NextResponse.json({ id, stage: person.stage });
});
