import { connectDB } from '@/lib/db';
import { toServiceDate, addDays } from '@/lib/dates';
import { STAGES } from '@/lib/stages';
import { Person, FollowUp } from '@/models';
import { attendanceTrend } from './attendance.service';

/** Everything the admin dashboard needs in one call. */
export async function getDashboard({ today = new Date() } = {}) {
  await connectDB();
  const day = toServiceDate(today);
  const monthStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const threeDaysAgo = addDays(day, -3);

  const [trend, stageCounts, firstTimersThisMonth, unassigned, overdue, unclear] =
    await Promise.all([
      attendanceTrend({ weeks: 8, today }),
      Person.aggregate([{ $group: { _id: '$stage', count: { $sum: 1 } } }]),
      Person.countDocuments({ firstVisitDate: { $gte: monthStart } }),
      Person.countDocuments({
        assignedTo: null,
        stage: { $in: [STAGES.FIRST_TIMER, STAGES.SECOND_TIMER] },
      }),
      Person.countDocuments({
        stage: { $in: [STAGES.FIRST_TIMER, STAGES.SECOND_TIMER] },
        firstVisitDate: { $lte: threeDaysAgo },
        $or: [{ lastContactAt: null }, { $expr: { $lt: ['$lastContactAt', '$lastVisitDate'] } }],
      }),
      Person.countDocuments({ cardUnclear: true }),
    ]);

  const byStage = Object.fromEntries(stageCounts.map((s) => [s._id, s.count]));
  const everyone = Object.values(byStage).reduce((a, b) => a + b, 0);
  const cameBack = everyone - (byStage[STAGES.FIRST_TIMER] || 0) - (byStage[STAGES.LOST] || 0);

  return {
    // Midweek and special services are in the trend too; this headline is Sundays only.
    lastSunday: trend.findLast((t) => new Date(t.serviceDate).getUTCDay() === 0) || null,
    trend,
    firstTimersThisMonth,
    secondVisitRate: everyone ? Math.round((cameBack / everyone) * 1000) / 10 : 0,
    members: byStage[STAGES.MEMBER] || 0,
    funnel: byStage,
    needsAttention: { unassigned, overdue, unclear },
    followUpsLogged: await FollowUp.countDocuments({ createdAt: { $gte: monthStart } }),
  };
}
