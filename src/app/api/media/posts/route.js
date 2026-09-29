import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { MEDIA_EDITORS } from '@/lib/roles';
import { quickPostSchema } from '@/lib/validators/media';
import { createQuickPost, deleteQuickPost } from '@/services/media.service';

/** Media team / admin: add a quick post { date: "YYYY-MM-DD", title, details }. */
export const POST = handler(async (req) => {
  const user = await requireRole(...MEDIA_EDITORS);
  const input = quickPostSchema.parse(await req.json());
  return NextResponse.json(await createQuickPost(input, user), { status: 201 });
});

/** Media team / admin: remove a quick post. DELETE ?ref=post:<id> */
export const DELETE = handler(async (req) => {
  await requireRole(...MEDIA_EDITORS);
  const ref = new URL(req.url).searchParams.get('ref') ?? '';
  return NextResponse.json(await deleteQuickPost(ref));
});
