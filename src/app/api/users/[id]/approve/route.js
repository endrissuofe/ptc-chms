import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { approveSchema } from '@/lib/validators/user';
import { approveUser } from '@/services/user.service';

/** Admins: let a sign-up in, on the team they asked for or another. { role } */
export const POST = handler(async (req, { params }) => {
  const admin = await requireRole(ROLES.ADMIN);
  const { id } = await params;
  const input = approveSchema.parse(await req.json());
  return NextResponse.json(await approveUser(id, input, admin));
});
