import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { newcomerSchema } from '@/lib/validators/newcomer';
import { createFromCard, listPeople } from '@/services/newcomer.service';

/** Admin table. GET ?stage=first_timer&q=okafor&page=1 */
export const GET = handler(async (req) => {
  await requireRole(ROLES.PASTOR, ROLES.ADMIN);
  const { searchParams } = new URL(req.url);
  const result = await listPeople({
    stage: searchParams.get('stage') || undefined,
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
  return NextResponse.json({ id: String(person._id), stage: person.stage }, { status: 201 });
});
