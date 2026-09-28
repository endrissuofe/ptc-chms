import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { userUpdateSchema } from '@/lib/validators/user';
import { declineUser, updateUser } from '@/services/user.service';

/** Admins only: rename, change role, email or phone, set a new password, switch off/on. */
export const PATCH = handler(async (req, { params }) => {
  const admin = await requireRole(ROLES.ADMIN);
  const { id } = await params;
  const changes = userUpdateSchema.parse(await req.json());
  return NextResponse.json(await updateUser(id, changes, admin));
});

/** Admins only: decline a sign-up that is still waiting. Approved logins are switched off instead. */
export const DELETE = handler(async (req, { params }) => {
  await requireRole(ROLES.ADMIN);
  const { id } = await params;
  return NextResponse.json(await declineUser(id));
});
