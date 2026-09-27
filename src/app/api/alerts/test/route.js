import { NextResponse } from 'next/server';
import { handler, requireRole, HttpError } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { testEmailSchema } from '@/lib/validators/alerts';
import { sendTestEmail } from '@/services/alerts.service';

/** Admins: send a test email to one address. */
export const POST = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  const { to } = testEmailSchema.parse(await req.json());
  const res = await sendTestEmail(to);
  if (!res.ok) throw new HttpError(502, `The email didn’t go out: ${res.error}`);
  return NextResponse.json(res);
});
