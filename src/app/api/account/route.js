import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { accountSchema } from '@/lib/validators/user';
import { getAccount, updateAccount } from '@/services/user.service';

/** Anyone signed in: their own name, email, phone, emails they get and password. */
export const GET = handler(async () => {
  const user = await requireRole();
  return NextResponse.json(await getAccount(user.id));
});

export const PATCH = handler(async (req) => {
  const user = await requireRole();
  const input = accountSchema.parse(await req.json());
  return NextResponse.json(await updateAccount(user.id, input));
});
