import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { addDays, isoDay, lagosDayStart, toServiceDate } from '@/lib/dates';
import { emailStatus, sendEmail } from '@/lib/email';
import { renderFollowUpReport } from '@/lib/email/followup-report';
import { logger } from '@/lib/logger';
import { AlertSettings, EmailLog, FollowUp, Person, Visit } from '@/models';
import { listServices } from './churchService.service';
import { listFollowUps } from './followup.service';

/** Where names in emails link to. */
export const baseUrl = () =>
  (process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://ptc-chms.vercel.app').replace(
    /\/+$/,
    '',
  );

export async function getAlertSettings() {
  await connectDB();
  const doc = await AlertSettings.findOneAndUpdate(
    { key: 'alerts' },
    { $setOnInsert: { key: 'alerts' } },
    { upsert: true, new: true },
  ).lean();
  return {
    followupEmails: doc.followupEmails ?? [],
    pastorEmails: doc.pastorEmails ?? [],
    followUpReport: doc.followUpReport !== false,
    celebrationEmails: doc.celebrationEmails ?? [],
    celebrationReport: doc.celebrationReport !== false,
  };
}

export async function updateAlertSettings(input, user) {
  await connectDB();
  const clean = (list) => [...new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const update = { updatedBy: user?.id };
  if (input.followupEmails) update.followupEmails = clean(input.followupEmails);
  if (input.pastorEmails) update.pastorEmails = clean(input.pastorEmails);
  if (typeof input.followUpReport === 'boolean') update.followUpReport = input.followUpReport;
  if (input.celebrationEmails) update.celebrationEmails = clean(input.celebrationEmails);
  if (typeof input.celebrationReport === 'boolean') {
    update.celebrationReport = input.celebrationReport;
  }
  await AlertSettings.updateOne({ key: 'alerts' }, update, { upsert: true });
  return getAlertSettings();
}

/**
 * The morning report for `today` (a Lagos day):
 *   firstTimers  cards entered the day before (by when they were typed, so late entries count)
 *   returning    returning visitors recorded that day
 *   overdue      not reached, last visit over 3 days (72 hours) ago
 */
export async function buildFollowUpReport({ today = new Date() } = {}) {
  await connectDB();
  const todayKey = toServiceDate(today);
  const yesterday = addDays(todayKey, -1);
  const from = lagosDayStart(yesterday);
  const to = lagosDayStart(todayKey);

  const [visits, services, followUps] = await Promise.all([
    Visit.find({ createdAt: { $gte: from, $lt: to } }).lean(),
    listServices({ includeInactive: true }),
    listFollowUps({ today }),
  ]);
  const serviceName = Object.fromEntries(services.map((s) => [s.key, s.name]));
  const people = await Person.find({ _id: { $in: visits.map((v) => v.person) } })
    .select('firstName lastName phone stage visitCount')
    .lean();
  const byId = Object.fromEntries(people.map((p) => [String(p._id), p]));

  const seen = new Set();
  const entry = (v) => {
    const p = byId[String(v.person)];
    if (!p || seen.has(String(p._id))) return null;
    seen.add(String(p._id));
    return {
      id: String(p._id),
      name: `${p.firstName} ${p.lastName}`,
      phone: p.phone,
      stage: p.stage,
      visitCount: p.visitCount,
      service: serviceName[v.service] || v.service,
    };
  };
  const firstTimers = visits
    .filter((v) => v.source === 'card')
    .map(entry)
    .filter(Boolean);
  const returning = visits
    .filter((v) => v.source === 'returning')
    .map(entry)
    .filter(Boolean);

  const waiting = followUps.toCall.filter((p) => p.overdue);
  // Who tried last, so pastors can see effort as well as results.
  const lastCalls = await FollowUp.aggregate([
    { $match: { person: { $in: waiting.map((p) => new mongoose.Types.ObjectId(p.id)) } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$person', callerName: { $first: '$callerName' } } },
  ]);
  const caller = Object.fromEntries(lastCalls.map((c) => [String(c._id), c.callerName]));
  const overdue = waiting.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    phone: p.phone,
    stage: p.stage,
    days: p.days,
    tried: p.tried,
    lastOutcome: p.lastOutcome,
    lastAttemptAt: p.lastAttemptAt,
    lastCallerName: caller[p.id] ?? null,
  }));

  return {
    day: isoDay(yesterday),
    firstTimers,
    returning,
    overdue,
    empty: !firstTimers.length && !returning.length && !overdue.length,
  };
}

/** Tomorrow, i.e. the report that goes out next morning covers today's cards. */
export const nextMorning = (now = new Date()) => new Date(now.getTime() + 24 * 60 * 60 * 1000);

/** The report as it would be emailed: settings, recipients, subject and body. */
export async function previewFollowUpReport({ today = nextMorning() } = {}) {
  const [settings, report] = await Promise.all([
    getAlertSettings(),
    buildFollowUpReport({ today }),
  ]);
  return { settings, report, email: report.empty ? null : renderFollowUpReport(report, baseUrl()) };
}

export async function logEmail(entry) {
  try {
    await EmailLog.create(entry);
  } catch (err) {
    // Another run already sent this one (unique runKey).
    if (err?.code === 11000) return 'duplicate';
    throw err;
  }
  return 'logged';
}

/**
 * Sends the morning report. Safe to run twice: a day's report goes out once. Skips when
 * switched off, when there's nobody to send to, or when nothing needs attention.
 */
export async function sendFollowUpReport({ today = new Date() } = {}) {
  const { settings, report, email } = await previewFollowUpReport({ today });
  const runKey = `followup_report:${isoDay(toServiceDate(today))}`;
  if (!settings.followUpReport) return { skipped: 'switched off' };
  if (!email) return { skipped: 'nothing to report' };
  const to = settings.followupEmails.length ? settings.followupEmails : settings.pastorEmails;
  const cc = settings.followupEmails.length ? settings.pastorEmails : [];
  if (!to.length) return { skipped: 'no recipients set' };
  if (await EmailLog.exists({ runKey })) return { skipped: 'already sent today' };

  const res = await sendEmail({ to, cc, ...email });
  const logged = await logEmail({
    kind: 'followup_report',
    to,
    cc,
    subject: email.subject,
    status: res.ok ? 'sent' : 'failed',
    provider: emailStatus().provider,
    error: res.error,
    runKey: res.ok ? runKey : undefined,
  });
  if (logged === 'duplicate') return { skipped: 'already sent today' };
  logger.info({ ok: res.ok, to: to.length, cc: cc.length }, 'Follow-up report');
  return res.ok
    ? { sent: true, to: to.length, cc: cc.length, subject: email.subject }
    : { sent: false, error: res.error };
}

export async function recentEmails(limit = 10) {
  await connectDB();
  return EmailLog.find().sort({ createdAt: -1 }).limit(limit).lean();
}
