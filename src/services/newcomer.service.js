import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { normalizePhone } from '@/lib/phone';
import { searchFilter } from '@/lib/search';
import { computeStage, STAGES, LOST_AFTER_DAYS } from '@/lib/stages';
import { MOVE_AFTER_DAYS } from '@/lib/followup';
import { addDays, toServiceDate } from '@/lib/dates';
import { Person, Visit, PrayerRequest, FollowUp, Member, SmsLog } from '@/models';
import { getServiceDay, requireActiveService } from './churchService.service';

/**
 * What an usher sees about someone already on a phone number: enough to recognise them,
 * nothing private (no prayer requests, no contact details beyond the number they typed).
 */
function toMatch(person) {
  return {
    id: String(person._id),
    firstName: person.firstName,
    lastName: person.lastName,
    stage: person.stage,
    firstVisitDate: person.firstVisitDate,
    lastVisitDate: person.lastVisitDate,
    visitCount: person.visitCount,
    assignedTo: person.assignedTo?.displayName ?? null,
  };
}

/** Everyone on a phone number (any format). Family members may share one phone. */
export async function findByPhone(phone) {
  await connectDB();
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const people = await Person.find({ phone: normalized })
    .sort({ firstVisitDate: 1 })
    .populate('assignedTo', 'displayName')
    .lean();
  return people.map(toMatch);
}

const sameName = (a, b) =>
  a.firstName.trim().toLowerCase() === b.firstName.trim().toLowerCase() &&
  a.lastName.trim().toLowerCase() === b.lastName.trim().toLowerCase();

/** Re-reads a person's visits and saves their correct stage and visit summary. */
export async function recomputeStage(personId, today = new Date()) {
  const person = await Person.findById(personId);
  if (!person) throw new HttpError(404, 'Person not found');
  const visits = await Visit.find({ person: personId }).sort({ serviceDate: 1 }).lean();
  const visitDates = visits.map((v) => v.serviceDate);

  person.visitCount = visits.length;
  person.lastVisitDate = visitDates[visitDates.length - 1] || person.firstVisitDate;
  person.stage = computeStage({
    visitDates,
    inBelieversClass: person.inBelieversClass,
    isMember: person.isMember,
    today,
  });
  await person.save();
  return person;
}

/**
 * Saves a first-timer card.
 * If people already use this phone number, nothing is saved and a 409 comes back with them
 * (details.matches) so the usher can pick the returning visitor. The usher can instead confirm
 * it's a different person (newPersonConfirmed) — unless someone with the same name is already
 * on the number, which is almost always the same card entered twice.
 */
export async function createFromCard(input, user) {
  await connectDB();
  await requireActiveService(input.service, input.serviceDate, user);
  const phone = normalizePhone(input.phone);
  const serviceDate = toServiceDate(input.serviceDate);

  const matches = await findByPhone(phone);
  if (matches.length && (!input.newPersonConfirmed || matches.some((m) => sameName(m, input)))) {
    throw new HttpError(409, 'Someone already uses this phone number', { matches });
  }

  const person = await Person.create({
    firstName: input.firstName,
    lastName: input.lastName,
    phone,
    address: input.address || undefined,
    email: input.email || undefined,
    birthDay: input.birthDay,
    birthMonth: input.birthMonth,
    smsConsent: input.smsConsent,
    cardUnclear: input.cardUnclear,
    stage: STAGES.FIRST_TIMER,
    firstVisitDate: serviceDate,
    lastVisitDate: serviceDate,
    visitCount: 1,
    createdBy: user?.id,
  });

  await Visit.create({
    person: person._id,
    serviceDate,
    service: input.service,
    source: 'card',
    recordedBy: user?.id,
  });

  if (input.prayerRequest) {
    await PrayerRequest.create({ person: person._id, text: input.prayerRequest, serviceDate });
  }
  return person.toObject();
}

/**
 * Records that a known person came back. Safe to call twice for the same service.
 * `card` is what they wrote on today's card: a new prayer request is saved for the pastors,
 * email and birthday only fill in blanks, a newly written address replaces the old one (people
 * move), and SMS consent can be given but not withdrawn here.
 */
export async function recordReturningVisit({ personId, service, serviceDate, card = {} }, user) {
  await connectDB();
  await requireActiveService(service, serviceDate, user);
  const day = toServiceDate(serviceDate);
  const existing = await Person.findById(personId).lean();
  if (!existing) throw new HttpError(404, 'Person not found');

  await Visit.updateOne(
    { person: personId, serviceDate: day, service },
    { $setOnInsert: { source: 'returning', recordedBy: user?.id } },
    { upsert: true },
  );

  const fill = {};
  if (card.email && !existing.email) fill.email = card.email;
  if (card.address && card.address !== existing.address) fill.address = card.address;
  if (card.birthDay && card.birthMonth && !existing.birthDay) {
    fill.birthDay = card.birthDay;
    fill.birthMonth = card.birthMonth;
  }
  if (card.smsConsent && !existing.smsConsent) fill.smsConsent = true;
  if (Object.keys(fill).length) await Person.updateOne({ _id: personId }, fill);

  if (card.prayerRequest) {
    await PrayerRequest.updateOne(
      { person: personId, serviceDate: day, text: card.prayerRequest },
      { $setOnInsert: { status: 'new' } },
      { upsert: true },
    );
  }

  const person = await recomputeStage(personId);
  return person.toObject();
}

/**
 * What the card entry screen needs: the service day (with day picker options) and how many
 * cards have been entered for each of that day's services.
 */
export async function getCardEntry({ serviceDate, today = new Date() } = {}) {
  await connectDB();
  const day = await getServiceDay({ serviceDate, today });
  const counts = await Visit.aggregate([
    { $match: { serviceDate: day.serviceDate, source: 'card' } },
    { $group: { _id: '$service', count: { $sum: 1 } } },
  ]);
  const cardsByService = Object.fromEntries(day.services.map((s) => [s.key, 0]));
  for (const c of counts) if (c._id in cardsByService) cardsByService[c._id] = c.count;
  return { ...day, cardsByService };
}

/**
 * Stages only change when someone visits, so people who stopped coming still show their old
 * stage. This marks them Lost once their last visit is LOST_AFTER_DAYS behind (cheap, indexed).
 */
export async function markLostPeople(today = new Date()) {
  await connectDB();
  await Person.updateMany(
    {
      stage: { $in: [STAGES.FIRST_TIMER, STAGES.SECOND_TIMER, STAGES.REGULAR] },
      lastVisitDate: { $lt: addDays(toServiceDate(today), -LOST_AFTER_DAYS) },
    },
    { stage: STAGES.LOST },
  );
}

/**
 * The views on the First timers screen. Everything except "moved" leaves out people already
 * moved into the Members list.
 */
export const PEOPLE_VIEWS = {
  all: {},
  ...Object.fromEntries(Object.values(STAGES).map((s) => [s, { stage: s }])),
  unclear: { cardUnclear: true },
  moved: { movedToMembersAt: { $ne: null } },
};

const viewQuery = (view, q) => ({
  ...(view === 'moved' ? {} : { movedToMembersAt: null }),
  ...(PEOPLE_VIEWS[view] ?? {}),
  ...searchFilter(q),
});

/** First timers table: search, a view (stage, unclear cards, moved), a page, and view counts. */
export async function listPeople({
  view = 'all',
  q,
  page = 1,
  limit = 25,
  today = new Date(),
} = {}) {
  await connectDB();
  await markLostPeople(today);
  const filter = viewQuery(view, q);

  const search = searchFilter(q);
  const [items, total, byStage, unclear, moved] = await Promise.all([
    Person.find(filter)
      .sort({ firstVisitDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-assignedTo -createdBy')
      .lean(),
    Person.countDocuments(filter),
    Person.aggregate([
      { $match: { movedToMembersAt: null, ...search } },
      { $group: { _id: '$stage', count: { $sum: 1 } } },
    ]),
    Person.countDocuments({ movedToMembersAt: null, cardUnclear: true, ...search }),
    Person.countDocuments({ movedToMembersAt: { $ne: null }, ...search }),
  ]);

  const counts = Object.fromEntries(byStage.map((s) => [s._id, s.count]));
  counts.all = byStage.reduce((sum, s) => sum + s.count, 0);
  counts.unclear = unclear;
  counts.moved = moved;
  return { items, total, page, limit, counts };
}

/** Everyone matching a view and search, for the spreadsheet export. */
export async function exportPeople({ view = 'all', q, today = new Date() } = {}) {
  await connectDB();
  await markLostPeople(today);
  return Person.find(viewQuery(view, q))
    .sort({ firstVisitDate: -1 })
    .select('-assignedTo -createdBy')
    .lean();
}

/**
 * Everything about one newcomer. Prayer requests only when asked for — the caller decides
 * from the viewer's role (prayer team, pastors, admins).
 */
export async function getProfile(personId, { includePrayer = false } = {}) {
  await connectDB();
  if (!mongoose.isValidObjectId(personId)) throw new HttpError(404, 'Person not found');
  const person = await Person.findById(personId).select('-assignedTo').lean();
  if (!person) throw new HttpError(404, 'Person not found');
  const [visits, followUps, sms, prayerRequests] = await Promise.all([
    Visit.find({ person: personId }).sort({ serviceDate: -1 }).lean(),
    FollowUp.find({ person: personId })
      .sort({ createdAt: -1 })
      .populate('worker', 'displayName')
      .lean(),
    SmsLog.find({ person: personId, status: { $ne: 'skipped' } })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('template run body status error createdAt')
      .lean(),
    includePrayer
      ? PrayerRequest.find({ person: personId }).sort({ createdAt: -1 }).lean()
      : Promise.resolve(null),
  ]);
  return { person, visits, followUps, sms, prayerRequests };
}

/** Pastor/admin: correct what was typed from the card (e.g. a card that was hard to read). */
export async function updateDetails(personId, input) {
  await connectDB();
  const update = {};
  for (const key of ['firstName', 'lastName', 'smsConsent', 'cardUnclear']) {
    if (input[key] !== undefined) update[key] = input[key];
  }
  if (input.phone !== undefined) {
    update.phone = normalizePhone(input.phone);
    const others = (await findByPhone(update.phone)).filter((m) => m.id !== String(personId));
    if (others.length && !input.sharedPhoneConfirmed) {
      throw new HttpError(409, 'Someone else already uses this phone number', { matches: others });
    }
  }
  if (input.email !== undefined) update.email = input.email || null;
  if (input.address !== undefined) update.address = input.address || null;
  if (input.birthDay !== undefined || input.birthMonth !== undefined) {
    update.birthDay = input.birthDay ?? null;
    update.birthMonth = input.birthMonth ?? null;
  }
  const person = await Person.findByIdAndUpdate(personId, update, {
    new: true,
    runValidators: true,
  }).lean();
  if (!person) throw new HttpError(404, 'Person not found');
  return person;
}

/** Pastor/admin milestones that visits alone can't tell us. */
export async function setMilestones(personId, { inBelieversClass, isMember }) {
  await connectDB();
  const update = {};
  if (typeof inBelieversClass === 'boolean') update.inBelieversClass = inBelieversClass;
  if (typeof isMember === 'boolean') update.isMember = isMember;
  await Person.updateOne({ _id: personId }, update);
  return (await recomputeStage(personId)).toObject();
}

/** Not moved yet, and first came at least MOVE_AFTER_DAYS ago. */
export async function readyToMove({ today = new Date() } = {}) {
  await connectDB();
  return Person.find({
    movedToMembersAt: null,
    firstVisitDate: { $lte: addDays(toServiceDate(today), -MOVE_AFTER_DAYS) },
  })
    .sort({ firstVisitDate: 1 })
    .select('firstName lastName phone stage firstVisitDate lastVisitDate visitCount')
    .lean();
}

const lower = (s) => (s || '').trim().toLowerCase();

/**
 * Moves first timers into the Members list. They stop being followed up as first timers; the
 * member record links back to them, so their visits and calls stay visible and the church can
 * count how many first timers joined. Someone already on the list (same phone and name) is
 * linked rather than added twice. Safe to run twice.
 */
export async function moveToMembers(personIds, user, now = new Date()) {
  await connectDB();
  const people = await Person.find({ _id: { $in: personIds }, movedToMembersAt: null }).lean();
  let added = 0;
  let linked = 0;

  for (const p of people) {
    const sameNumber = await Member.find({ phone: p.phone }).lean();
    let member = sameNumber.find(
      (m) => lower(m.firstName) === lower(p.firstName) && lower(m.lastName) === lower(p.lastName),
    );
    if (member) {
      linked += 1;
      const fill = { person: member.person ?? p._id, active: true };
      if (!member.birthDay && p.birthDay) {
        fill.birthDay = p.birthDay;
        fill.birthMonth = p.birthMonth;
      }
      await Member.updateOne({ _id: member._id }, fill);
    } else {
      added += 1;
      member = await Member.create({
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        birthDay: p.birthDay,
        birthMonth: p.birthMonth,
        source: 'first_timer',
        person: p._id,
        smsOptOut: !p.smsConsent,
        createdBy: user?.id,
      });
    }
    await Person.updateOne({ _id: p._id }, { movedToMembersAt: now, member: member._id });
  }
  return { moved: people.length, added, linked };
}
