import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { memberCreateSchema } from '@/lib/validators/member';
import { createMember, listMembers } from '@/services/member.service';

/** Member list: GET ?q=okafor&page=1 */
export const GET = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  const { searchParams } = new URL(req.url);
  return NextResponse.json(
    await listMembers({
      q: searchParams.get('q') || undefined,
      page: Math.max(Number(searchParams.get('page')) || 1, 1),
    }),
  );
});

/** Admins: add one member by hand. */
export const POST = handler(async (req) => {
  const user = await requireRole(ROLES.ADMIN);
  const input = memberCreateSchema.parse(await req.json());
  return NextResponse.json(await createMember(input, user), { status: 201 });
});
