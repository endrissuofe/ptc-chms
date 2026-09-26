import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { moveToMembersSchema } from '@/lib/validators/newcomer';
import { moveToMembers } from '@/services/newcomer.service';

/** Pastor/admin: move first timers into the Members list. { ids: [...] } */
export const POST = handler(async (req) => {
  const user = await requireRole(ROLES.PASTOR, ROLES.ADMIN);
  const { ids } = moveToMembersSchema.parse(await req.json());
  return NextResponse.json(await moveToMembers(ids, user));
});
