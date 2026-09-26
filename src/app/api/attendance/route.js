import { NextResponse } from 'next/server';
import { handler, requireRole } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { attendanceSchema } from '@/lib/validators/attendance';
import { recordAttendance, getAttendanceFor, attendanceTrend } from '@/services/attendance.service';

const RECORDERS = [ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN];

/** GET ?date=2026-09-27 -> that day's services. GET ?trend=8 -> last 8 Sundays. */
export const GET = handler(async (req) => {
  await requireRole(...RECORDERS);
  const { searchParams } = new URL(req.url);
  if (searchParams.get('trend')) {
    const weeks = Math.min(Number(searchParams.get('trend')) || 8, 52);
    return NextResponse.json({ trend: await attendanceTrend({ weeks }) });
  }
  const date = searchParams.get('date') || new Date().toISOString();
  return NextResponse.json({ services: await getAttendanceFor(date) });
});

export const POST = handler(async (req) => {
  const user = await requireRole(...RECORDERS);
  const input = attendanceSchema.parse(await req.json());
  const saved = await recordAttendance(input, user);
  return NextResponse.json(saved, { status: 201 });
});
