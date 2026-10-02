import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { BROADCASTERS } from '@/lib/roles';
import { broadcastSchema } from '@/lib/validators/sms';
import { createBroadcast, previewBroadcast } from '@/services/broadcast.service';

/**
 * Broadcast (admins and pastors): { audience, body }. With ?preview=1 nothing is sent — it returns how many
 * people and SMS pages. Otherwise it creates the broadcast; send it with POST /api/broadcasts/:id.
 */
export const POST = handler(async (req) => {
  const user = await requireRole(...BROADCASTERS);
  const input = broadcastSchema.parse(await req.json());
  if (new URL(req.url).searchParams.get('preview') === '1') {
    return NextResponse.json(await previewBroadcast(input));
  }
  return NextResponse.json(await createBroadcast(input, user), { status: 201 });
});
