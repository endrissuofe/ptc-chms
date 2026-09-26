import { connectDB } from '@/lib/db';
import { toServiceDate, lagosDateParts } from '@/lib/dates';
import { Attendance, Visit } from '@/models';
import { listServices } from './churchService.service';

const headcount = (a) => a.men + a.women + a.teens + a.children;

/**
 * Everything the usher Today screen shows. Only counts and initials —
 * no phone numbers or prayer requests leave this function.
 */
export async function getUsherToday({ today = new Date() } = {}) {
  await connectDB();
  const day = toServiceDate(today);

  const [services, rows, previous, cardVisits, returning] = await Promise.all([
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
