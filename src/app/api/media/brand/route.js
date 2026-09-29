import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { MEDIA_EDITORS, SERVICE_DETAIL_EDITORS } from '@/lib/roles';
import { brandKitSchema } from '@/lib/validators/media';
import { getBrandKit, updateBrandKit } from '@/services/media.service';

/** The brand kit. Everyone on the Media screen can read it. */
export const GET = handler(async () => {
  await requireRole(...SERVICE_DETAIL_EDITORS);
  return NextResponse.json(await getBrandKit());
});

/** Media team / admin: { address?, facebook?, instagram?, youtube?, hashtags?, signoff? } */
export const PATCH = handler(async (req) => {
  const user = await requireRole(...MEDIA_EDITORS);
  const changes = brandKitSchema.parse(await req.json());
  return NextResponse.json(await updateBrandKit(changes, user));
});
