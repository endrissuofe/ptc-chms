import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { memberMergeSchema } from '@/lib/validators/member';
import { mergeMembers } from '@/services/member.service';

/** Admins: the same person entered twice. { keep, remove } member ids. */
export const POST = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  const input = memberMergeSchema.parse(await req.json());
  return NextResponse.json(await mergeMembers(input));
});
