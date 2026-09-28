import crypto from 'node:crypto';
import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { addDays, isoDay, toServiceDate } from '@/lib/dates';
import { CHECKIN_AFTER_DAYS, CHECKIN_WINDOW_DAYS, needsCall } from '@/lib/checkin';
import { STAGES } from '@/lib/stages';
import { appUrl } from '@/lib/site';
import { logger } from '@/lib/logger';
import { CheckIn, Person, SmsTemplate } from '@/models';
import { deliver, ensureTemplates, personRecipient, wordingForSend } from './sms.service';

/** 8 random characters: short enough for one SMS page, too many to guess. */
const newToken = () => crypto.randomBytes(6).toString('base64url');
export const checkInUrl = (token) => `${appUrl()}/c/${token}`;

/**
 * First timers due their check-in on `today`: first visit 30 days ago (or up to a week more,
 * in case a day was missed), agreed to messages, still being followed up, and not asked yet.
 */
export async function dueForCheckIn(today = new Date()) {
  await connectDB();
  const day = toServiceDate(today);
  const latest = addDays(day, -CHECKIN_AFTER_DAYS);
  const earliest = addDays(latest, -CHECKIN_WINDOW_DAYS);
  const people = await Person.find({
    smsConsent: true,
    movedToMembersAt: null,
    stage: { $ne: STAGES.MEMBER },
    lastOutcome: { $ne: 'wrong_number' },
    firstVisitDate: { $gte: earliest, $lte: latest },
  }).lean();
  const asked = new Set(
    (await CheckIn.find({ person: { $in: people.map((p) => p._id) } }).distinct('person')).map(
      String,
    ),
  );
  return people.filter((p) => !asked.has(String(p._id)));
}

/** The 7 AM check-in SMS, each with its own survey link. Safe to run twice. */
export async function sendCheckIns({ today = new Date() } = {}) {
  await ensureTemplates();
  const template = await SmsTemplate.findOne({ key: 'checkin' }).lean();
  if (!template?.enabled) return { skipped: 'switched off' };
  const people = await dueForCheckIn(today);
  if (!people.length) return { total: 0 };

  const recipients = [];
  for (const p of people) {
    // One check-in per person (unique): a second run finds the first one's link.
    const doc = await CheckIn.findOneAndUpdate(
      { person: p._id },
      { $setOnInsert: { person: p._id, token: newToken() } },
      { upsert: true, new: true },
    ).lean();
    recipients.push({ ...personRecipient(p), tags: { Link: checkInUrl(doc.token) } });
  }
  const result = await deliver({
    recipients,
    text: await wordingForSend(template, today),
    run: `checkin:${isoDay(toServiceDate(today))}`,
    template: 'checkin',
  });
  logger.info(result, 'Check-in SMS');
  return result;
}

/** For the survey page: whose check-in this is (first name only) and whether it's answered. */
export async function findCheckIn(token) {
  if (!token || token.length < 6 || token.length > 40) return null;
  await connectDB();
  const doc = await CheckIn.findOne({ token }).populate('person', 'firstName').lean();
  if (!doc?.person) return null;
  return { firstName: doc.person.firstName, answered: Boolean(doc.answeredAt) };
}

/**
 * Saves the answers. A low score or "please call me" puts them back on the follow-up list.
 * Answering again replaces the earlier answer.
 */
export async function answerCheckIn({ token, rating, wantsCall, comment }) {
  await connectDB();
  const doc = await CheckIn.findOne({ token });
  if (!doc) throw new HttpError(404, 'This link doesn’t work any more');
  const now = new Date();
  doc.set({ rating, wantsCall, comment: comment || undefined, answeredAt: now });
  await doc.save();
  if (needsCall(doc)) await Person.updateOne({ _id: doc.person }, { callRequestedAt: now });
  return { saved: true };
}

/** The latest answers, for the profile page and the morning email. */
export async function checkInFor(personId) {
  await connectDB();
  return CheckIn.findOne({ person: personId }).select('-token').lean();
}

export async function checkInsAnswered(from, to) {
  await connectDB();
  return CheckIn.find({ answeredAt: { $gte: from, $lt: to } })
    .sort({ answeredAt: 1 })
    .populate('person', 'firstName lastName phone')
    .lean();
}

/** For the dashboard: how many were asked and answered in the last `days`, and the average. */
export async function checkInSummary({ days = 90, today = new Date() } = {}) {
  await connectDB();
  const since = addDays(new Date(today), -days);
  const [sent, answered] = await Promise.all([
    CheckIn.countDocuments({ createdAt: { $gte: since } }),
    CheckIn.find({ createdAt: { $gte: since }, answeredAt: { $ne: null } })
      .select('rating')
      .lean(),
  ]);
  const rated = answered.filter((a) => a.rating);
  const average = rated.length
    ? Math.round((rated.reduce((n, a) => n + a.rating, 0) / rated.length) * 10) / 10
    : null;
  return { sent, answered: answered.length, average };
}
