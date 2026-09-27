import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { memberUpdateSchema } from '@/lib/validators/member';
import { updateMember } from '@/services/member.service';

/** Admins: correct a member, or take them off the list (active: false). */
export const PATCH = handler(async (req, { params }) => {
  await requireRole(ROLES.ADMIN);
  const { id } = await params;
  const input = memberUpdateSchema.parse(await req.json());
  return NextResponse.json(await updateMember(id, input));
});
