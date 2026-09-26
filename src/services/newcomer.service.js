import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { normalizePhone } from '@/lib/phone';
import { computeStage, STAGES } from '@/lib/stages';
import { toServiceDate } from '@/lib/dates';
import { Person, Visit, PrayerRequest, FollowUp } from '@/models';
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
 * email and birthday only fill in blanks, and SMS consent can be given but not withdrawn here.
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

/** First timers list for the admin table, with optional stage filter and search. */
export async function listPeople({ stage, q, page = 1, limit = 20 } = {}) {
  await connectDB();
  const filter = {};
  if (stage) filter.stage = stage;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    Person.find(filter)
      .sort({ firstVisitDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('assignedTo', 'displayName')
      .lean(),
    Person.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

/** A follow-up worker's own newcomers. */
export async function listForWorker(workerId) {
  await connectDB();
  return Person.find({ assignedTo: workerId, stage: { $nin: [STAGES.MEMBER] } })
    .sort({ lastVisitDate: -1 })
    .lean();
}

export async function getProfile(personId) {
  await connectDB();
  const person = await Person.findById(personId).populate('assignedTo', 'displayName').lean();
  if (!person) throw new HttpError(404, 'Person not found');
  const [visits, followUps] = await Promise.all([
    Visit.find({ person: personId }).sort({ serviceDate: -1 }).lean(),
    FollowUp.find({ person: personId })
      .sort({ createdAt: -1 })
      .populate('worker', 'displayName')
      .lean(),
  ]);
  return { person, visits, followUps };
}

export async function assignWorker(personId, workerId) {
  await connectDB();
  const person = await Person.findByIdAndUpdate(
    personId,
    { assignedTo: workerId },
    { new: true },
  ).lean();
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
