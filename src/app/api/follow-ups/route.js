import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { followUpSchema } from '@/lib/validators/followup';
import { logFollowUp } from '@/services/followup.service';
import { listForWorker } from '@/services/newcomer.service';

/** The signed-in worker's newcomers. */
export const GET = handler(async () => {
  const user = await requireRole(ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN);
  return NextResponse.json({ items: await listForWorker(user.id) });
});

export const POST = handler(async (req) => {
  const user = await requireRole(ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN);
  const input = followUpSchema.parse(await req.json());
  const entry = await logFollowUp(input, user);
  return NextResponse.json(entry, { status: 201 });
});
