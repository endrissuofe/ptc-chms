import { NextResponse } from 'next/server';
import { handler, requireRole, HttpError } from '@/lib/api';
import { connectDB } from '@/lib/db';
import { ROLES } from '@/lib/roles';
import { prayerStatusSchema } from '@/lib/validators/followup';
import { PrayerRequest } from '@/models';

const PRAYER_ACCESS = [ROLES.PRAYER, ROLES.PASTOR, ROLES.ADMIN];

/** Prayer team, pastors and admins only — never ushers or follow-up. GET ?status=new */
export const GET = handler(async (req) => {
  await requireRole(...PRAYER_ACCESS);
  await connectDB();
  const status = new URL(req.url).searchParams.get('status');
  const filter = status ? { status } : {};
  const items = await PrayerRequest.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('person', 'firstName lastName stage phone')
    .lean();
  return NextResponse.json({ items });
});

/** PATCH ?id=... { status } */
export const PATCH = handler(async (req) => {
  const user = await requireRole(...PRAYER_ACCESS);
  await connectDB();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) throw new HttpError(400, 'id is required');
  const { status } = prayerStatusSchema.parse(await req.json());
  const doc = await PrayerRequest.findByIdAndUpdate(
    id,
    { status, updatedBy: user.id },
    { new: true },
  ).lean();
  if (!doc) throw new HttpError(404, 'Prayer request not found');
  return NextResponse.json(doc);
});
