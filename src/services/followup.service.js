import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { addDays } from '@/lib/dates';
import { followUpState, waiting } from '@/lib/followup';
import { STAGES } from '@/lib/stages';
import { Person, FollowUp } from '@/models';
import { markLostPeople } from './newcomer.service';

/** The list is for recent newcomers; older ones are offered for the Members list. */
const LIST_LIMIT = 500;

/**
 * The follow-up team's shared list: everyone not yet moved to Members.
 *   toCall  nobody has got through since their latest visit (lost people excluded)
 *   called  reached, or the number turned out to be wrong
 */
export async function listFollowUps({ today = new Date() } = {}) {
  await connectDB();
  await markLostPeople(today);
  const weekAgo = addDays(new Date(today), -7);
  const monthAgo = addDays(new Date(today), -30);

  const [people, reachedThisWeek, attempts] = await Promise.all([
    Person.find({ movedToMembersAt: null, stage: { $ne: STAGES.MEMBER } })
      .sort({ lastVisitDate: -1, createdAt: -1 })
      .limit(LIST_LIMIT)
      .select('-assignedTo -createdBy')
      .lean(),
    FollowUp.distinct('person', { outcome: 'reached', createdAt: { $gte: weekAgo } }),
    FollowUp.aggregate([
      { $match: { createdAt: { $gte: monthAgo } } },
      { $group: { _id: '$person', reached: { $max: { $eq: ['$outcome', 'reached'] } } } },
    ]),
  ]);

  const items = people.map((p) => {
    const { state, tried, lastOutcome } = followUpState(p);
    return {
      id: String(p._id),
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      address: p.address ?? null,
      stage: p.stage,
      firstVisitDate: p.firstVisitDate,
      lastVisitDate: p.lastVisitDate,
      visitCount: p.visitCount,
      lastContactAt: p.lastContactAt ?? null,
      lastAttemptAt: p.lastAttemptAt ?? null,
      cardUnclear: p.cardUnclear,
      state,
      tried,
      lastOutcome: lastOutcome ?? p.lastOutcome ?? null,
      toCall: state === 'to_call' && p.stage !== STAGES.LOST,
      ...waiting(p, today),
    };
  });

  // To call: longest-waiting first, so nobody sits at the bottom of the list.
  const toCall = items.filter((i) => i.toCall).sort((a, b) => b.days - a.days);
  const called = items.filter((i) => i.state !== 'to_call');
  const reachedPeople = attempts.filter((a) => a.reached).length;

  return {
    toCall,
    called,
    all: items,
    stats: {
      toCall: toCall.length,
      overdue: toCall.filter((i) => i.overdue).length,
      reachedThisWeek: reachedThisWeek.length,
      // Of the people anyone tried in the last 30 days, how many were reached.
      reachRate: attempts.length ? Math.round((reachedPeople / attempts.length) * 100) : null,
    },
  };
}

/** Logs a call or visit. Reaching someone takes them off the "to call" list until they visit again. */
export async function logFollowUp(input, user, now = new Date()) {
  await connectDB();
  const person = await Person.findById(input.personId);
  if (!person) throw new HttpError(404, 'Person not found');

  const entry = await FollowUp.create({
    person: person._id,
    worker: user.id,
    outcome: input.outcome,
    channel: input.channel,
    note: input.note || undefined,
    // A personal login is one person: their name, not whatever was typed on a shared phone.
    callerName: (user.personal ? user.name : input.callerName) || undefined,
  });

  person.lastAttemptAt = now;
  person.lastOutcome = input.outcome;
  if (input.outcome === 'reached') person.lastContactAt = now;
  await person.save();
  return entry.toObject();
}
