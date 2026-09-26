import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { testSmsSchema } from '@/lib/validators/sms';
import { sendTest } from '@/services/sms.service';

/** Admin sends one message to their own phone: { templateKey, phone, body? } */
export const POST = handler(async (req) => {
  const user = await requireRole(ROLES.ADMIN);
  const input = testSmsSchema.parse(await req.json());
  return NextResponse.json(await sendTest(input, user));
});
