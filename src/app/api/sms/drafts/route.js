import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { smsDraftSchema } from '@/lib/validators/sms';
import { saveDraft } from '@/services/sms-draft.service';

/** Admins: change this week's (or next week's) wording of an automatic SMS. */
export const PATCH = handler(async (req) => {
  const user = await requireRole(ROLES.ADMIN);
  const input = smsDraftSchema.parse(await req.json());
  return NextResponse.json(await saveDraft(input, user));
});
