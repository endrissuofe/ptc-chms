import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { getSmsProvider } from '@/lib/sms';
import { renderTemplate, unknownTags } from '@/lib/sms/templates';
import { normalizePhone, formatPhone } from '@/lib/phone';
import { toServiceDate, addDays, isoDay, daysBetween } from '@/lib/dates';
import { STAGES } from '@/lib/stages';
import { describeServiceTimes } from '@/lib/church';
import { logger } from '@/lib/logger';
import { Person, Visit, SmsTemplate, SmsLog } from '@/models';
import { listServices } from './churchService.service';

export const DEFAULT_TEMPLATES = [
  {
    key: 'sunday_thanks',
    name: 'Sunday thank-you',
    body: 'Hi {FirstName}, thank you for worshipping with us at RCCG Peculiar Treasure Chapel today. You are welcome here, and we look forward to seeing you again. God bless you!',
  },
  {
    key: 'saturday_invite',
    name: 'Saturday invite',
    body: 'Hi {FirstName}, we would love to see you in church tomorrow! {ServiceTimes} See you there. PTC Chapel',
  },
];

/** How far back an admin can send a missed Sunday thank-you. */
export const CATCH_UP_DAYS = 14;

export async function ensureTemplates() {
  await connectDB();
  for (const t of DEFAULT_TEMPLATES) {
    await SmsTemplate.updateOne({ key: t.key }, { $setOnInsert: t }, { upsert: true });
  }
}

/** Is SMS really going out, and does the schedule run? Both are set in the hosting settings. */
export function smsStatus() {
  const provider = process.env.SMS_PROVIDER || 'mock';
  return {
    provider,
    live: provider !== 'mock',
    scheduled: Boolean(process.env.CRON_SECRET),
    senderId: process.env.SMS_SENDER_ID || 'PTCChapel',
  };
}

/**
 * Who a run is for, before checking consent (so the screen can say how many didn't agree).
 * Sunday: first timers whose cards were entered that day.
 * Saturday: recent first and second timers who haven't become regulars yet.
 */
const CANDIDATES = {
  async sunday_thanks(day) {
    const personIds = await Visit.distinct('person', { serviceDate: day, source: 'card' });
    return Person.find({ _id: { $in: personIds } }).lean();
  },
  async saturday_invite(day) {
    return Person.find({
      stage: { $in: [STAGES.FIRST_TIMER, STAGES.SECOND_TIMER] },
      lastVisitDate: { $gte: addDays(day, -28) },
    }).lean();
  },
};

const runLabel = (templateKey, day) => `${templateKey}:${isoDay(day)}`;

/** Values for the template tags. ServiceTimes are the next day's services (for the invite). */
async function tagValues(day) {
  const serviceTimes = describeServiceTimes(await listServices({ on: addDays(day, 1) }));
  return (person) => ({
    FirstName: person.firstName,
    LastName: person.lastName,
    ChurchName: process.env.CHURCH_NAME || 'RCCG Peculiar Treasure Chapel',
    ServiceTimes: serviceTimes,
  });
}

/**
 * Sends one batch. Each person gets at most one message per template per day, even if the
 * job runs twice or a catch-up is sent later (the SmsLog runKey index enforces it).
 * @param {object} opts
 * @param {Date} [opts.today]  the day the run is for
 * @param {string} [opts.body]  wording to use instead of the template (catch-up sends)
 * @param {boolean} [opts.manual]  sent by an admin: runs even if the template is switched off
 */
export async function runScheduledSend(
  templateKey,
  { today = new Date(), body, manual = false } = {},
) {
  await connectDB();
  await ensureTemplates();
  const template = await SmsTemplate.findOne({ key: templateKey }).lean();
  if (!template) throw new Error(`No template "${templateKey}"`);
  if (!template.enabled && !manual) {
    return { templateKey, skipped: true, reason: 'Template turned off' };
  }

  const provider = getSmsProvider();
  const from = smsStatus().senderId;
  const day = toServiceDate(today);
  const run = runLabel(templateKey, day);
  const people = (await CANDIDATES[templateKey](day)).filter((p) => p.smsConsent);
  const valuesFor = await tagValues(day);
  const text = body ?? template.body;

  const result = {
    templateKey,
    runKey: run,
    total: people.length,
    sent: 0,
    failed: 0,
    alreadySent: 0,
  };

  for (const person of people) {
    if (await SmsLog.exists({ runKey: run, person: person._id })) {
      result.alreadySent += 1;
      continue;
    }
    const message = renderTemplate(text, valuesFor(person));
    const res = await provider.send({ to: person.phone, body: message, from });
    try {
      await SmsLog.create({
        person: person._id,
        template: templateKey,
        run,
        to: person.phone,
        body: message,
        provider: provider.name,
        status: res.ok ? 'sent' : 'failed',
        providerRef: res.providerRef,
        cost: res.cost,
        error: res.error,
        // Only successful sends block a resend, so failures can be retried.
        runKey: res.ok ? run : undefined,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
    res.ok ? (result.sent += 1) : (result.failed += 1);
  }

  logger.info(result, 'SMS run finished');
  return result;
}

/** How many a run for `serviceDate` would reach, how many didn't agree, and who's done already. */
export async function previewRun(templateKey, serviceDate) {
  await connectDB();
  const day = toServiceDate(serviceDate);
  const people = await CANDIDATES[templateKey](day);
  const consented = people.filter((p) => p.smsConsent);
  const alreadySent = await SmsLog.countDocuments({
    runKey: runLabel(templateKey, day),
    person: { $in: consented.map((p) => p._id) },
  });
  return {
    serviceDate: day,
    total: people.length,
    consented: consented.length,
    noConsent: people.length - consented.length,
    alreadySent,
    toSend: consented.length - alreadySent,
  };
}

/**
 * Admin sends a Sunday's thank-you after the day (e.g. SMS was off that Sunday).
 * Uses belated wording and counts as that Sunday's run, so nobody is thanked twice.
 */
export async function sendMissedThanks({ serviceDate, body }, today = new Date()) {
  const day = toServiceDate(serviceDate);
  const age = daysBetween(day, toServiceDate(today));
  if (day.getUTCDay() !== 0) throw new HttpError(400, 'Choose a Sunday');
  if (age < 1 || age > CATCH_UP_DAYS) {
    throw new HttpError(400, `Choose a Sunday from the last ${CATCH_UP_DAYS} days`);
  }
  const bad = unknownTags('sunday_thanks', body);
  if (bad.length) throw new HttpError(400, `Unknown tag {${bad[0]}}`);
  return runScheduledSend('sunday_thanks', { today: day, body, manual: true });
}

/** Sends one message to the admin's own phone so they can see how it looks. */
export async function sendTest({ templateKey, phone, body }, user) {
  await ensureTemplates();
  const to = normalizePhone(phone);
  if (!to) throw new HttpError(400, 'Enter a Nigerian mobile number');
  const template = await SmsTemplate.findOne({ key: templateKey }).lean();
  if (!template) throw new HttpError(404, 'Template not found');
  const text = body ?? template.body;
  const bad = unknownTags(templateKey, text);
  if (bad.length) throw new HttpError(400, `Unknown tag {${bad[0]}}`);

  const day = toServiceDate();
  // Invites describe the services on the day after they go out; preview with this Sunday's.
  const previewDay = addDays(day, (6 - day.getUTCDay() + 7) % 7);
  const valuesFor = await tagValues(templateKey === 'saturday_invite' ? previewDay : day);
  const [firstName = 'Friend', ...rest] = (user?.name || 'Friend').split(' ');
  const message = renderTemplate(text, valuesFor({ firstName, lastName: rest.join(' ') }));

  const provider = getSmsProvider();
  const res = await provider.send({ to, body: message, from: smsStatus().senderId });
  await SmsLog.create({
    template: templateKey,
    run: `test:${isoDay(day)}`,
    to,
    body: message,
    provider: provider.name,
    status: res.ok ? 'sent' : 'failed',
    providerRef: res.providerRef,
    cost: res.cost,
    error: res.error,
  });
  if (!res.ok) throw new HttpError(502, `The SMS provider refused it: ${res.error}`);
  return { ok: true, body: message, live: smsStatus().live };
}

export async function updateTemplate(key, { body, enabled }, user) {
  await ensureTemplates();
  const bad = unknownTags(key, body);
  if (bad.length) throw new HttpError(400, `This message can't use {${bad[0]}}`);
  const doc = await SmsTemplate.findOneAndUpdate(
    { key },
    { body, enabled, updatedBy: user?.id },
    { new: true },
  ).lean();
  if (!doc) throw new HttpError(404, 'Template not found');
  return doc;
}

/** Runs grouped for the history table, newest first. */
export async function recentRuns(limit = 20) {
  await connectDB();
  const rows = await SmsLog.aggregate([
    { $match: { run: { $type: 'string' } } },
    {
      $group: {
        _id: '$run',
        template: { $first: '$template' },
        provider: { $last: '$provider' },
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        cost: { $sum: { $ifNull: ['$cost', 0] } },
        lastAt: { $max: '$createdAt' },
      },
    },
    { $sort: { lastAt: -1 } },
    { $limit: limit },
  ]);
  return rows.map(({ _id, ...r }) => ({ run: _id, test: _id.startsWith('test:'), ...r }));
}

/** Everyone in one run, for the history table's details. */
export async function runDetails(run) {
  await connectDB();
  const logs = await SmsLog.find({ run })
    .sort({ createdAt: 1 })
    .populate('person', 'firstName lastName')
    .lean();
  return logs.map((l) => ({
    name: l.person ? `${l.person.firstName} ${l.person.lastName}` : 'Test message',
    to: formatPhone(l.to),
    status: l.status,
    error: l.error ?? null,
    at: l.createdAt,
  }));
}

const nextWeekday = (day, weekday) => addDays(day, (weekday - day.getUTCDay() + 7) % 7);

/** Everything the SMS screen shows. */
export async function getSmsOverview({ today = new Date() } = {}) {
  await ensureTemplates();
  const day = toServiceDate(today);
  const status = smsStatus();

  let balance = null;
  if (status.live) {
    try {
      const data = await getSmsProvider().balance?.();
      const amount = Number(data?.total_balance ?? data?.sms_wallet ?? data?.balance);
      balance = Number.isFinite(amount) ? { amount, currency: data?.currency || 'NGN' } : null;
    } catch (err) {
      balance = { error: err.message };
    }
  }

  const nextSunday = nextWeekday(day, 0);
  const nextSaturday = nextWeekday(day, 6);
  const pastSundays = [7, 14]
    .map((n) => addDays(nextWeekday(day, 0), -n))
    .filter((d) => daysBetween(d, day) >= 1 && daysBetween(d, day) <= CATCH_UP_DAYS);

  const [templates, thanks, invite, missed, runs] = await Promise.all([
    SmsTemplate.find().sort({ key: -1 }).lean(),
    previewRun('sunday_thanks', nextSunday),
    previewRun('saturday_invite', nextSaturday),
    Promise.all(pastSundays.map((d) => previewRun('sunday_thanks', d))),
    recentRuns(20),
  ]);

  return {
    status,
    balance,
    templates: templates.map(({ key, name, body, enabled, updatedAt }) => ({
      key,
      name,
      body,
      enabled,
      updatedAt,
    })),
    upcoming: { sunday_thanks: thanks, saturday_invite: invite },
    missedThanks: missed.filter((m) => m.toSend > 0),
    runs,
  };
}

export async function recentLogs(limit = 50) {
  await connectDB();
  return SmsLog.find().sort({ createdAt: -1 }).limit(limit).lean();
}
