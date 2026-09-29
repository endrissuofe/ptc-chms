import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { SERVICE_DETAIL_EDITORS } from '@/lib/roles';
import { serviceDaySchema } from '@/lib/validators/media';
import { saveServiceDay } from '@/services/media.service';

/**
 * What a service is about on one date. Media team, pastors and admins.
 * { service, date: "YYYY-MM-DD", theme?, preacher?, bibleText?, youtubeUrl? }
 */
export const PUT = handler(async (req) => {
  const user = await requireRole(...SERVICE_DETAIL_EDITORS);
  const input = serviceDaySchema.parse(await req.json());
  return NextResponse.json(await saveServiceDay(input, user));
});
