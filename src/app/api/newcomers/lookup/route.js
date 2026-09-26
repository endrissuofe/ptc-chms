import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { lookupSchema } from '@/lib/validators/newcomer';
import { findByPhone } from '@/services/newcomer.service';

/**
 * Usher checks a phone number while typing a card. Returns everyone on that number
 * (family members may share a phone). POST so the number stays out of URLs and logs.
 */
export const POST = handler(async (req) => {
  await requireRole(ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN);
  const { phone } = lookupSchema.parse(await req.json());
  return NextResponse.json({ matches: await findByPhone(phone) });
});
