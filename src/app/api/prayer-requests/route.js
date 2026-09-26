import { NextResponse } from 'next/server';
import { handler, requireRole, HttpError } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { prayerStatusSchema } from '@/lib/validators/followup';
import { listPrayerRequests, setPrayerStatus } from '@/services/prayer.service';

const PRAYER_ACCESS = [ROLES.PRAYER, ROLES.PASTOR, ROLES.ADMIN];

/** Prayer team, pastors and admins only — never ushers or follow-up. GET ?status=new|all */
export const GET = handler(async (req) => {
  await requireRole(...PRAYER_ACCESS);
  const status = new URL(req.url).searchParams.get('status') || 'new';
  return NextResponse.json(await listPrayerRequests({ status }));
});

/** PATCH ?id=... { status } */
export const PATCH = handler(async (req) => {
  const user = await requireRole(...PRAYER_ACCESS);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) throw new HttpError(400, 'id is required');
  const { status } = prayerStatusSchema.parse(await req.json());
  return NextResponse.json(await setPrayerStatus(id, status, user));
});
