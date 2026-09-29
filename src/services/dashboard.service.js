import { connectDB } from '@/lib/db';
import { toServiceDate, addDays } from '@/lib/dates';
import { MOVE_AFTER_DAYS } from '@/lib/followup';
import { STAGES } from '@/lib/stages';
import { Person, FollowUp } from '@/models';
import { attendanceTrend } from './attendance.service';
import { listServices } from './churchService.service';
import { listFollowUps } from './followup.service';
import { countNewPrayerRequests } from './prayer.service';
import { celebrantsOn } from './celebration.service';

const monthStartOf = (day) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));

/**
 * The newcomer journey as a funnel: each step counts everyone who got at least that far
 * (someone in Believers' Class also counts as having come back).
 */
async function journeyFunnel() {
  const [row] = await Person.aggregate([
    {
      $group: {
        _id: null,
        received: { $sum: 1 },
        cameBack: { $sum: { $cond: [{ $gte: ['$visitCount', 2] }, 1, 0] } },
        regular: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $gte: ['$visitCount', 3] },
                  { $in: ['$stage', [STAGES.BELIEVERS_CLASS, STAGES.MEMBER]] },
                ],
              },
              1,
              0,
            ],
          },
        },
        believersClass: {
          $sum: {
            $cond: [{ $or: ['$inBelieversClass', { $eq: ['$stage', STAGES.MEMBER] }] }, 1, 0],
          },
        },
        joined: {
          $sum: {
            $cond: [
              { $or: ['$isMember', { $ne: [{ $ifNull: ['$movedToMembersAt', null] }, null] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  return row
    ? {
        received: row.received,
        cameBack: row.cameBack,
        regular: row.regular,
        believersClass: row.believersClass,
        joined: row.joined,
      }
    : { received: 0, cameBack: 0, regular: 0, believersClass: 0, joined: 0 };
}

/** Everything the pastors' dashboard needs in one call. */
export async function getDashboard({ today = new Date() } = {}) {
  await connectDB();
  const day = toServiceDate(today);
  const monthStart = monthStartOf(day);
  const lastMonthStart = monthStartOf(addDays(monthStart, -1));

  const [trend, services, funnel, thisMonth, lastMonth, movedThisMonth, followUps, unclear] =
    await Promise.all([
      attendanceTrend({ weeks: 8, today }),
      listServices({ includeInactive: true }),
      journeyFunnel(),
      Person.countDocuments({ firstVisitDate: { $gte: monthStart } }),
      Person.countDocuments({ firstVisitDate: { $gte: lastMonthStart, $lt: monthStart } }),
      Person.countDocuments({ movedToMembersAt: { $gte: monthStart } }),
      listFollowUps({ today }),
      Person.countDocuments({ movedToMembersAt: null, cardUnclear: true }),
    ]);
  const [newPrayer, readyToMove, callsThisWeek, celebrants] = await Promise.all([
    countNewPrayerRequests(),
    Person.countDocuments({
      movedToMembersAt: null,
      firstVisitDate: { $lte: addDays(day, -MOVE_AFTER_DAYS) },
    }),
    FollowUp.countDocuments({ createdAt: { $gte: addDays(new Date(today), -7) } }),
    celebrantsOn(today),
  ]);

  const sundays = trend.filter(
    (t) => new Date(t.serviceDate).getUTCDay() === 0 && new Date(t.serviceDate) <= day,
  );
  return {
    // The headline is Sundays; the chart shows every service day (midweek and special too).
    lastSunday: sundays.at(-1) ?? null,
    previousSunday: sundays.at(-2) ?? null,
    trend,
    services: services.map((s) => ({ key: s.key, name: s.name })),
    firstTimersThisMonth: thisMonth,
    firstTimersLastMonth: lastMonth,
    // Of everyone who filled a card, the share who came back at least once.
    secondVisitRate: funnel.received
      ? Math.round((funnel.cameBack / funnel.received) * 1000) / 10
      : null,
    funnel,
    movedThisMonth,
    needsAttention: {
      overdue: followUps.stats.overdue,
      toCall: followUps.stats.toCall,
      unclear,
      newPrayer,
      readyToMove,
    },
    // The first few people waiting for a call (longest-waiting first), for the dashboard.
    toCall: followUps.toCall.slice(0, 5).map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      stage: p.stage,
      days: p.days,
      overdue: p.overdue,
      askedForCall: Boolean(p.askedForCall),
    })),
    callsThisWeek,
    celebrationsToday: celebrants.map((c) => ({
      kind: c.kind,
      name: `${c.firstName} ${c.lastName}`.trim(),
    })),
    reachRate: followUps.stats.reachRate,
  };
}
