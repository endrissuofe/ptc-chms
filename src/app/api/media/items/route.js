import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { MEDIA_EDITORS } from '@/lib/roles';
import { itemStatusSchema } from '@/lib/validators/media';
import { setItemStatus } from '@/services/media.service';

/** Media team / admin: { ref, status: "todo" | "ready" | "posted" } */
export const PATCH = handler(async (req) => {
  const user = await requireRole(...MEDIA_EDITORS);
  const input = itemStatusSchema.parse(await req.json());
  return NextResponse.json(await setItemStatus(input, user));
});
