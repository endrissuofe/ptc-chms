import { NextResponse } from 'next/server';
import { handler } from '@/lib/api';
import { joinSchema } from '@/lib/validators/user';
import { signUp } from '@/services/user.service';

/** Public: someone signs up with a team's invite link. The login waits for an admin. */
export const POST = handler(async (req) => {
  const input = joinSchema.parse(await req.json());
  return NextResponse.json(await signUp(input), { status: 201 });
});
