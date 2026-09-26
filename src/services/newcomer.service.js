import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { normalizePhone } from '@/lib/phone';
import { computeStage, STAGES } from '@/lib/stages';
import { toServiceDate } from '@/lib/dates';
import { Person, Visit, PrayerRequest, FollowUp } from '@/models';
import { requireActiveService } from './churchService.service';

/** Finds someone by phone number in any format. */
export async function findByPhone(phone) {
  await connectDB();
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return Person.findOne({ phone: normalized }).lean();
}

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
 * Saves a first-timer card. If the phone number already exists, nothing is saved and
 * a 409 comes back with the existing person so the usher can confirm a returning visit.
 */
export async function createFromCard(input, user) {
  await connectDB();
  await requireActiveService(input.service);
  const phone = normalizePhone(input.phone);
  const serviceDate = toServiceDate(input.serviceDate);

  const existing = await Person.findOne({ phone }).lean();
  if (existing) {
    throw new HttpError(409, 'Phone number already registered', {
      match: {
        id: String(existing._id),
        firstName: existing.firstName,
        lastName: existing.lastName,
        stage: existing.stage,
        firstVisitDate: existing.firstVisitDate,
        visitCount: existing.visitCount,
      },
    });
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

/** Records that a known person came back. Safe to call twice for the same service. */
export async function recordReturningVisit({ personId, service, serviceDate }, user) {
  await connectDB();
  await requireActiveService(service);
  const day = toServiceDate(serviceDate);
  await Visit.updateOne(
    { person: personId, serviceDate: day, service },
    { $setOnInsert: { source: 'returning', recordedBy: user?.id } },
    { upsert: true },
  );
  const person = await recomputeStage(personId);
  return person.toObject();
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
