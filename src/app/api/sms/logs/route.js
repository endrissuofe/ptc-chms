import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { recentLogs, runDetails } from '@/services/sms.service';

/** GET ?run=sunday_thanks:2026-09-27 — who was in one run. Without ?run, the latest messages. */
export const GET = handler(async (req) => {
  await requireRole(ROLES.ADMIN, ROLES.PASTOR);
  const run = new URL(req.url).searchParams.get('run');
  if (run) return NextResponse.json({ items: await runDetails(run) });
  return NextResponse.json({ items: await recentLogs(100) });
});
