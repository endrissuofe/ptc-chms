import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { newUserSchema } from '@/lib/validators/user';
import { createUser, listUsers } from '@/services/user.service';

/** Admins only: every login and every sign-up waiting (never password hashes). */
export const GET = handler(async () => {
  await requireRole(ROLES.ADMIN);
  return NextResponse.json(await listUsers());
});

export const POST = handler(async (req) => {
  const admin = await requireRole(ROLES.ADMIN);
  const input = newUserSchema.parse(await req.json());
  return NextResponse.json(await createUser(input, admin), { status: 201 });
});
