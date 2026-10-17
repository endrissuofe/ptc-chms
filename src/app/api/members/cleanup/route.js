import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { previewCleanup, runCleanup } from '@/services/cleanup.service';

// Hundreds of merges take a while on a big list.
export const maxDuration = 300;

/** Admins: how many members and first timers were entered twice (nothing changes). */
export const GET = handler(async () => {
  await requireRole(ROLES.ADMIN);
  return NextResponse.json(await previewCleanup());
});

/** Admins: merge them all (same phone, clearly the same name). */
export const POST = handler(async () => {
  await requireRole(ROLES.ADMIN);
  return NextResponse.json(await runCleanup());
});
