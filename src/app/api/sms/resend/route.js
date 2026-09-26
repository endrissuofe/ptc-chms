import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { resendSchema } from '@/lib/validators/sms';
import { resendFailed } from '@/services/sms.service';

/** Admin retries the failed messages of one run: { run } */
export const POST = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  const { run } = resendSchema.parse(await req.json());
  return NextResponse.json(await resendFailed(run));
});
