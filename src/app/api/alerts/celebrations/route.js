import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { sendCelebrationsEmail } from '@/services/celebration.service';

/** Admins: send today's birthdays and anniversaries email now. */
export const POST = handler(async () => {
  await requireRole(ROLES.ADMIN);
  return NextResponse.json(await sendCelebrationsEmail({ manual: true }));
});
