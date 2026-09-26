import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { recentLogs } from '@/services/sms.service';

export const GET = handler(async () => {
  await requireRole(ROLES.ADMIN, ROLES.PASTOR);
  return NextResponse.json({ items: await recentLogs(100) });
});
