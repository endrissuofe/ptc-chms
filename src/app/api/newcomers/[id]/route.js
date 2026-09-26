import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler, requireRole, HttpError } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { getProfile, assignWorker, setMilestones } from '@/services/newcomer.service';

export const GET = handler(async (_req, { params }) => {
  const user = await requireRole(ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN);
  const { id } = await params;
  const profile = await getProfile(id);
  if (user.role === ROLES.FOLLOWUP && String(profile.person.assignedTo?._id) !== user.id) {
    throw new HttpError(403, 'This newcomer is assigned to someone else');
  }
  return NextResponse.json(profile);
});

const patchSchema = z.object({
  assignedTo: z.string().optional(),
  inBelieversClass: z.boolean().optional(),
  isMember: z.boolean().optional(),
});

/** Pastor/admin: assign a follow-up worker or set Believers' Class / Member. */
export const PATCH = handler(async (req, { params }) => {
  await requireRole(ROLES.PASTOR, ROLES.ADMIN);
  const { id } = await params;
  const body = patchSchema.parse(await req.json());
  if (body.assignedTo) await assignWorker(id, body.assignedTo);
  const person = await setMilestones(id, body);
  return NextResponse.json({ id, stage: person.stage });
});
