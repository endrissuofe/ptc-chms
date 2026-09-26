import { NextResponse } from 'next/server';
import { handler, requireRole, HttpError } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { dayFromIso } from '@/lib/dates';
import { missedThanksSchema } from '@/lib/validators/sms';
import { previewRun, sendMissedThanks, smsStatus } from '@/services/sms.service';

/** GET ?date=YYYY-MM-DD — who a missed Sunday thank-you would reach. */
export const GET = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  const date = new URL(req.url).searchParams.get('date') || '';
  const { serviceDate } = missedThanksSchema
    .pick({ serviceDate: true })
    .parse({ serviceDate: date });
  return NextResponse.json(await previewRun('sunday_thanks', dayFromIso(serviceDate)));
});

/** Admin sends a Sunday's thank-you after the day: { serviceDate, body } */
export const POST = handler(async (req) => {
  await requireRole(ROLES.ADMIN);
  // Sending with the mock provider would mark people as thanked without reaching them.
  if (!smsStatus().live) throw new HttpError(409, 'Switch SMS on before sending missed thank-yous');
  const { serviceDate, body } = missedThanksSchema.parse(await req.json());
  return NextResponse.json(await sendMissedThanks({ serviceDate: dayFromIso(serviceDate), body }));
});
