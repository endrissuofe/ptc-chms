import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { notDuplicatesSchema } from '@/lib/validators/member';
import { markNotDuplicates } from '@/services/member.service';

/** Admins: two members sharing a phone are different people. { a, b } member ids. */
export const POST = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  const input = notDuplicatesSchema.parse(await req.json());
  await markNotDuplicates(input);
  return NextResponse.json({ ok: true });
});
