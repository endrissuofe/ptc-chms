import { connectDB } from '@/lib/db';
import { toServiceDate, lagosDateParts } from '@/lib/dates';
import { totalCount } from '@/lib/attendance';
import { Attendance, Visit } from '@/models';
import { nextServiceDay, servicesOn } from '@/lib/church';
import { listServices } from './churchService.service';

const headcount = totalCount;

/**
 * Everything the usher Today screen shows. Only counts and initials —
 * no phone numbers or prayer requests leave this function.
 */
export async function getUsherToday({ today = new Date() } = {}) {
  await connectDB();
  const day = toServiceDate(today);

  const [allServices, rows, previous, cardVisits, returning] = await Promise.all([
    listServices(),
    Attendance.find({ serviceDate: day }).lean(),
    Attendance.findOne({ serviceDate: { $lt: day } })
      .sort({ serviceDate: -1 })
      .lean(),
    Visit.find({ serviceDate: day, source: 'card' })
      .sort({ createdAt: -1 })
      .populate('person', 'firstName lastName')
      .lean(),
    Visit.countDocuments({ serviceDate: day, source: 'returning' }),
  ]);

  const services = servicesOn(allServices, day);
  const next = services.length ? null : nextServiceDay(allServices, day);

  const attendance = Object.fromEntries(
    services.map(({ key }) => {
      const row = rows.find((r) => r.service === key);
      return [key, row ? { recorded: true, total: headcount(row) } : { recorded: false }];
    }),
  );

  let lastServiceDay = null;
  if (previous) {
    const prevRows = await Attendance.find({ serviceDate: previous.serviceDate }).lean();
    lastServiceDay = {
      serviceDate: previous.serviceDate,
      total: prevRows.reduce((sum, r) => sum + headcount(r), 0),
    };
  }

  const cardsByService = Object.fromEntries(
    services.map(({ key }) => [key, cardVisits.filter((v) => v.service === key).length]),
  );

  return {
    serviceDate: day,
    services,
    nextServiceDay: next && {
      serviceDate: next.serviceDate,
      services: next.services.map(({ key, name, startTime }) => ({ key, name, startTime })),
    },
    isSunday: lagosDateParts(today).weekday === 'Sun',
    attendance,
    headcountToday: rows.reduce((sum, r) => sum + headcount(r), 0),
    lastServiceDay,
    firstTimers: cardVisits.length,
    cardsByService,
    returning,
    recentInitials: cardVisits
      .slice(0, 3)
      .filter((v) => v.person)
      .map((v) => `${v.person.firstName[0] || ''}${v.person.lastName[0] || ''}`.toUpperCase()),
    lastCardAt: cardVisits[0]?.createdAt ?? null,
  };
}
