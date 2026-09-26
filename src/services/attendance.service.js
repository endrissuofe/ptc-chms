import { connectDB } from '@/lib/db';
import { toServiceDate, addDays } from '@/lib/dates';
import { Attendance } from '@/models';

/** Saves (or corrects) the headcount for one service. */
export async function recordAttendance(input, user) {
  await connectDB();
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

/** Totals per Sunday for the dashboard chart, newest last. */
export async function attendanceTrend({ weeks = 8, today = new Date() } = {}) {
  await connectDB();
  const from = addDays(toServiceDate(today), -7 * weeks);
  const rows = await Attendance.aggregate([
    { $match: { serviceDate: { $gte: from } } },
    {
      $group: {
        _id: '$serviceDate',
        first: {
          $sum: {
            $cond: [
              { $eq: ['$service', 'first'] },
              { $add: ['$men', '$women', '$teens', '$children'] },
              0,
            ],
          },
        },
        second: {
          $sum: {
            $cond: [
              { $eq: ['$service', 'second'] },
              { $add: ['$men', '$women', '$teens', '$children'] },
              0,
            ],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    serviceDate: r._id,
    first: r.first,
    second: r.second,
    total: r.first + r.second,
  }));
}

export async function getAttendanceFor(serviceDate) {
  await connectDB();
  const day = toServiceDate(serviceDate);
  const rows = await Attendance.find({ serviceDate: day });
  return rows.map((r) => r.toJSON());
}
