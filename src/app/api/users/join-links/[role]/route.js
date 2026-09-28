import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { joinRoleSchema } from '@/lib/validators/user';
import { resetJoinLink } from '@/services/user.service';

/** Admins: give a team's invite link a new address; the old one stops working. */
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole(ROLES.ADMIN);
  const role = joinRoleSchema.parse((await params).role);
  return NextResponse.json(await resetJoinLink(role, admin));
});
