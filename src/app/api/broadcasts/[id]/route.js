import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { BROADCASTERS } from '@/lib/roles';
import { sendBroadcastBatch } from '@/services/broadcast.service';

// A batch sends several SMS one after another; allow time for a slow provider.
export const maxDuration = 60;

/** Sends the next batch of a broadcast and reports progress. Call until { done: true }. */
export const POST = handler(async (_req, { params }) => {
  await requireRole(...BROADCASTERS);
  const { id } = await params;
  return NextResponse.json(await sendBroadcastBatch(id));
});
