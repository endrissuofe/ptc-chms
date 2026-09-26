import { connectDB } from '@/lib/db';
import { toServiceDate, addDays } from '@/lib/dates';
import { COUNT_FIELDS, totalCount } from '@/lib/attendance';
import { Attendance } from '@/models';
import { recentServiceDays, servicesOn } from '@/lib/church';
import { listServices, requireActiveService } from './churchService.service';

/** Saves (or corrects) the headcount for one service. */
export async function recordAttendance(input, user) {
  await connectDB();
  await requireActiveService(input.service, input.serviceDate, user);
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

/**
 * What the Record Attendance screen needs for one service day:
 * - serviceDays: recent days (last week) that had a service, for the day picker
 * - services held on the chosen day, each with the count already saved (so an usher can
 *   correct it) and the same service's previous total.
 * `serviceDate` must be one of serviceDays; otherwise (or when missing) the most recent
 * service day is used — today when there is a service today.
 */
export async function getAttendanceForm({ serviceDate, today = new Date() } = {}) {
  await connectDB();
  const allServices = await listServices();
  const serviceDays = recentServiceDays(allServices, toServiceDate(today));
  const requested = serviceDate && toServiceDate(serviceDate).getTime();
  const day =
    serviceDays.find((d) => d.getTime() === requested) ?? serviceDays[0] ?? toServiceDate(today);
  const services = servicesOn(allServices, day);

  const byService = Object.fromEntries(
    await Promise.all(
      services.map(async ({ key }) => {
        const [saved, previous] = await Promise.all([
          Attendance.findOne({ serviceDate: day, service: key }).lean(),
          Attendance.findOne({ service: key, serviceDate: { $lt: day } })
            .sort({ serviceDate: -1 })
            .lean(),
        ]);
        return [
          key,
          {
            saved: saved
              ? {
                  ...Object.fromEntries(COUNT_FIELDS.map((f) => [f, saved[f]])),
                  note: saved.note || '',
                  savedAt: saved.updatedAt,
                }
              : null,
            previous: previous
              ? { serviceDate: previous.serviceDate, total: totalCount(previous) }
              : null,
          },
        ];
      }),
    ),
  );

  return { serviceDate: day, serviceDays, services, byService };
}

export async function getAttendanceFor(serviceDate) {
  await connectDB();
  const day = toServiceDate(serviceDate);
  const rows = await Attendance.find({ serviceDate: day });
  return rows.map((r) => r.toJSON());
}
