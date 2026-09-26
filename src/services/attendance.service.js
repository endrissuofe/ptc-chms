import { connectDB } from '@/lib/db';
import { toServiceDate, addDays } from '@/lib/dates';
import { Attendance } from '@/models';
import { requireActiveService } from './churchService.service';

/** Saves (or corrects) the headcount for one service. */
export async function recordAttendance(input, user) {
  await connectDB();
  await requireActiveService(input.service);
  const serviceDate = toServiceDate(input.serviceDate);
  const doc = await Attendance.findOneAndUpdate(
    { serviceDate, service: input.service },
    {
      men: input.men,
      women: input.women,
      teens: input.teens,
      children: input.children,
      note: input.note,
      recordedBy: user?.id,
    },
    { upsert: true, new: true, runValidators: true },
  );
  return doc.toJSON();
}

/**
 * Totals per service day for the dashboard chart, newest last.
 * byService is keyed by service key, e.g. { sunday: 180 } or { first: 120, second: 90 }.
 */
export async function attendanceTrend({ weeks = 8, today = new Date() } = {}) {
  await connectDB();
  const from = addDays(toServiceDate(today), -7 * weeks);
  const rows = await Attendance.aggregate([
    { $match: { serviceDate: { $gte: from } } },
    {
      $group: {
        _id: '$serviceDate',
        services: {
          $push: { k: '$service', v: { $add: ['$men', '$women', '$teens', '$children'] } },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    serviceDate: r._id,
    byService: Object.fromEntries(r.services.map((s) => [s.k, s.v])),
    total: r.services.reduce((sum, s) => sum + s.v, 0),
  }));
}

export async function getAttendanceFor(serviceDate) {
  await connectDB();
  const day = toServiceDate(serviceDate);
  const rows = await Attendance.find({ serviceDate: day });
  return rows.map((r) => r.toJSON());
}
