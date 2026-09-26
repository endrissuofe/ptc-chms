import { NextResponse, after } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { newcomerSchema } from '@/lib/validators/newcomer';
import { createFromCard, listPeople } from '@/services/newcomer.service';
import { sendCardMessage } from '@/services/sms.service';

/** Admin table. GET ?view=first_timer&q=okafor&page=1 (views: see PEOPLE_VIEWS) */
export const GET = handler(async (req) => {
  await requireRole(ROLES.PASTOR, ROLES.ADMIN);
  const { searchParams } = new URL(req.url);
  const result = await listPeople({
    view: searchParams.get('view') || 'all',
    q: searchParams.get('q') || undefined,
    page: Math.max(Number(searchParams.get('page')) || 1, 1),
  });
  return NextResponse.json(result);
});

/**
 * Usher saves a first-timer card. 409 means people already use this phone (details.matches);
 * resend with newPersonConfirmed: true once the usher confirms it is someone else.
 */
export const POST = handler(async (req) => {
  const user = await requireRole(ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN);
  const input = newcomerSchema.parse(await req.json());
  const person = await createFromCard(input, user);
  // Thank-you SMS goes out straight away, after the usher has their answer.
  after(() =>
    sendCardMessage({
      personId: person._id,
      templateKey: 'sunday_thanks',
      serviceDate: input.serviceDate,
    }),
  );
  return NextResponse.json({ id: String(person._id), stage: person.stage }, { status: 201 });
});
