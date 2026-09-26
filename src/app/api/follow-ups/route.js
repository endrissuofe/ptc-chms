import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { followUpSchema } from '@/lib/validators/followup';
import { listFollowUps, logFollowUp } from '@/services/followup.service';

/** The follow-up team's shared list. */
export const GET = handler(async () => {
  await requireRole(ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN);
  return NextResponse.json(await listFollowUps());
});

export const POST = handler(async (req) => {
  const user = await requireRole(ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN);
  const input = followUpSchema.parse(await req.json());
  const entry = await logFollowUp(input, user);
  return NextResponse.json(entry, { status: 201 });
});
