import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { nextMorning, sendFollowUpReport } from '@/services/alerts.service';

/** Admins: send tomorrow morning's report now (today's cards), e.g. to try it out. */
export const POST = handler(async () => {
  await requireRole(ROLES.ADMIN);
  return NextResponse.json(await sendFollowUpReport({ manual: true, today: nextMorning() }));
});
