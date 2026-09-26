import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { getDashboard } from '@/services/dashboard.service';

export const GET = handler(async () => {
  await requireRole(ROLES.PASTOR, ROLES.ADMIN);
  return NextResponse.json(await getDashboard());
});
