import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { possibleDuplicates } from '@/lib/members';
import { logger } from '@/lib/logger';
import { CheckIn, FollowUp, Member, Person, PrayerRequest, SmsLog, Visit } from '@/models';
import { mergeMembers } from './member.service';
import { recomputeStage } from './newcomer.service';

/**
 * Clearing out people entered twice: same phone and clearly the same name. Look-alike names
 * ("Daniel" / "Danielle" could be siblings) are left on the Possible duplicates screen for a
 * person to decide. Different people sharing a phone stay; messages reach the number once.
 */
const SURE = new Set(['Same name', 'Middle name more or less']);

/** How much a record holds, to keep the fullest one of a group. */
const filled = (r) =>
  [
    'lastName',
    'gender',
    'address',
    'email',
    'birthDay',
    'anniversaryDay',
    'person',
    'member',
  ].filter((k) => r[k]).length;

/**
 * Groups of records that are one person (same phone, sure-match names), each as
 * { keep, remove: [...] }: the fullest record stays, oldest first on a tie.
 */
export function sameRecordGroups(records) {
  const parent = new Map(records.map((r) => [String(r._id), String(r._id)]));
  const root = (id) => {
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r);
    return r;
  };
  for (const { pairs } of possibleDuplicates(records)) {
    for (const p of pairs) {
      if (SURE.has(p.reason)) parent.set(root(String(p.a._id)), root(String(p.b._id)));
    }
  }
  const groups = new Map();
  for (const r of records) {
    const id = root(String(r._id));
    groups.set(id, [...(groups.get(id) ?? []), r]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const [keep, ...remove] = [...g].sort(
        (a, b) => filled(b) - filled(a) || new Date(a.createdAt) - new Date(b.createdAt),
      );
      return { keep, remove };
    });
}

async function sharedPhoneRecords(Model, filter = {}) {
  const shared = await Model.aggregate([
    { $match: filter },
    { $group: { _id: '$phone', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  if (!shared.length) return [];
  return Model.find({ ...filter, phone: { $in: shared.map((s) => s._id) } })
    .sort({ createdAt: 1 })
    .lean();
}

/** What the clean-up would do, without changing anything. */
export async function previewCleanup() {
  await connectDB();
  const [members, people] = await Promise.all([
    sharedPhoneRecords(Member, { active: true }),
    sharedPhoneRecords(Person),
  ]);
  const m = sameRecordGroups(members);
  const p = sameRecordGroups(people);
  const count = (groups) => groups.reduce((n, g) => n + g.remove.length, 0);
  return {
    members: { groups: m.length, toMerge: count(m) },
    firstTimers: { groups: p.length, toMerge: count(p) },
  };
}

const later = (a, b) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b);
const earlier = (a, b) => (!a ? b : !b ? a : new Date(a) < new Date(b) ? a : b);

/**
 * One first timer entered twice: everything about `remove` (visits, calls, prayer requests,
 * check-in, messages, a member link) moves to `keep`, blanks are filled, the stage is worked
 * out again from all the visits, and `remove` is copied to the mergedpeople collection (so it
 * can be looked up later) before it is deleted.
 */
export async function mergePeople(keepId, removeId) {
  const [keep, remove] = await Promise.all([
    Person.findById(keepId).lean(),
    Person.findById(removeId).lean(),
  ]);
  if (!keep || !remove || String(keep._id) === String(remove._id)) return null;

  // Visits: the same service day on both records is one visit.
  const have = new Set(
    (await Visit.find({ person: keep._id }).lean()).map(
      (v) => `${new Date(v.serviceDate).toISOString()}|${v.service}`,
    ),
  );
  for (const v of await Visit.find({ person: remove._id }).lean()) {
    const key = `${new Date(v.serviceDate).toISOString()}|${v.service}`;
    if (have.has(key)) await Visit.deleteOne({ _id: v._id });
    else await Visit.updateOne({ _id: v._id }, { person: keep._id });
  }

  // A person has one check-in: keep theirs if they have one.
  const [keepCheckIn, removeCheckIn] = await Promise.all([
    CheckIn.findOne({ person: keep._id }).lean(),
    CheckIn.findOne({ person: remove._id }).lean(),
  ]);
  if (removeCheckIn && !keepCheckIn) {
    await CheckIn.updateOne({ _id: removeCheckIn._id }, { person: keep._id });
  } else if (removeCheckIn) {
    await CheckIn.deleteOne({ _id: removeCheckIn._id });
  }

  await Promise.all([
    FollowUp.updateMany({ person: remove._id }, { person: keep._id }),
    PrayerRequest.updateMany({ person: remove._id }, { person: keep._id }),
    SmsLog.updateMany({ person: remove._id }, { person: keep._id }),
    Member.updateMany({ person: remove._id }, { person: keep._id }),
  ]);

  const newer = new Date(remove.createdAt) > new Date(keep.createdAt) ? remove : keep;
  const fill = {
    firstVisitDate: earlier(keep.firstVisitDate, remove.firstVisitDate),
    lastContactAt: later(keep.lastContactAt, remove.lastContactAt),
    lastAttemptAt: later(keep.lastAttemptAt, remove.lastAttemptAt),
    callRequestedAt: later(keep.callRequestedAt, remove.callRequestedAt),
    movedToMembersAt: earlier(keep.movedToMembersAt, remove.movedToMembersAt),
    inBelieversClass: Boolean(keep.inBelieversClass || remove.inBelieversClass),
    isMember: Boolean(keep.isMember || remove.isMember),
    // The latest card says what they agreed to.
    smsConsent: Boolean(newer.smsConsent),
  };
  if (later(remove.lastAttemptAt, keep.lastAttemptAt) === remove.lastAttemptAt) {
    fill.lastOutcome = remove.lastOutcome ?? keep.lastOutcome;
  }
  for (const k of ['email', 'address', 'member']) if (!keep[k] && remove[k]) fill[k] = remove[k];
  if (!keep.birthDay && remove.birthDay) {
    fill.birthDay = remove.birthDay;
    fill.birthMonth = remove.birthMonth;
  }
  await Person.updateOne(
    { _id: keep._id },
    Object.fromEntries(Object.entries(fill).filter(([, v]) => v !== undefined && v !== null)),
  );

  await mongoose.connection.db.collection('mergedpeople').insertOne({
    ...remove,
    checkIn: keepCheckIn && removeCheckIn ? removeCheckIn : undefined,
    mergedInto: keep._id,
    mergedAt: new Date(),
  });
  await Person.deleteOne({ _id: remove._id });
  return recomputeStage(keep._id);
}

/** Merges every group the preview found, members and first timers. */
export async function runCleanup() {
  await connectDB();
  const [members, people] = await Promise.all([
    sharedPhoneRecords(Member, { active: true }),
    sharedPhoneRecords(Person),
  ]);
  const result = { members: 0, firstTimers: 0 };
  for (const { keep, remove } of sameRecordGroups(members)) {
    for (const r of remove) {
      await mergeMembers({ keep: String(keep._id), remove: String(r._id) });
      result.members += 1;
    }
  }
  for (const { keep, remove } of sameRecordGroups(people)) {
    for (const r of remove) {
      await mergePeople(keep._id, r._id);
      result.firstTimers += 1;
    }
  }
  logger.info(result, 'Duplicate clean-up finished');
  return result;
}
