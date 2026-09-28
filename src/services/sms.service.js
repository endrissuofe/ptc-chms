import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { getSmsProvider } from '@/lib/sms';
import { renderTemplate, unknownTags } from '@/lib/sms/templates';
import { formatPhone } from '@/lib/phone';
import { toServiceDate, addDays, isoDay } from '@/lib/dates';
import { STAGES } from '@/lib/stages';
import { describeServiceTimes } from '@/lib/church';
import { logger } from '@/lib/logger';
import { Person, SmsTemplate, SmsLog, Broadcast } from '@/models';
import { listServices } from './churchService.service';

const CHURCH_NAME = () => process.env.CHURCH_NAME || 'RCCG Peculiar Treasure Chapel';

export const DEFAULT_TEMPLATES = [
  {
    key: 'sunday_thanks',
    name: 'First-timer thank-you',
    body: 'Hi {FirstName}, thank you for worshipping with us at RCCG Peculiar Treasure Chapel. You are welcome here, and we look forward to seeing you again. God bless you!',
  },
  {
    key: 'welcome_back',
    name: 'Welcome back',
    body: 'Hi {FirstName}, welcome back to RCCG Peculiar Treasure Chapel! We are glad you worshipped with us again. God bless you!',
  },
  {
    key: 'saturday_invite',
    name: 'Saturday invite',
    body: 'Hi {FirstName}, we would love to see you in church tomorrow! {ServiceTimes} See you there. PTC Chapel',
  },
  {
    key: 'birthday',
    name: 'Birthday',
    body: "Happy birthday, {FirstName}! Everyone at RCCG Peculiar Treasure Chapel celebrates you today. May this new year be full of God's favour and joy.",
  },
  {
    key: 'anniversary',
    name: 'Wedding anniversary',
    body: 'Happy wedding anniversary, {FirstName}! RCCG Peculiar Treasure Chapel celebrates with you today. May God keep your home in love, peace and joy.',
  },
];

export async function ensureTemplates() {
  await connectDB();
  for (const t of DEFAULT_TEMPLATES) {
    await SmsTemplate.updateOne({ key: t.key }, { $setOnInsert: t }, { upsert: true });
  }
}

/** Is SMS really going out? Set in the hosting settings, never shown in the app. */
export function smsStatus() {
  const provider = process.env.SMS_PROVIDER || 'mock';
  return {
    provider,
    live: provider !== 'mock',
    senderId: process.env.SMS_SENDER_ID || 'PTCChapel',
  };
}

/**
 * On the live site, refuse to "send" with the mock provider: nobody would get anything, yet
 * everyone would be recorded as messaged. Local development can use the mock freely.
 */
export function requireLiveSms() {
  if (!smsStatus().live && process.env.NODE_ENV === 'production') {
    throw new HttpError(409, 'SMS sending isn’t switched on yet');
  }
}

/** A recipient as the send loop needs it, from a Person (first timer) or Member. */
export const personRecipient = (p) => ({
  key: `p:${p._id}`,
  person: p._id,
  firstName: p.firstName,
  lastName: p.lastName,
  phone: p.phone,
});
export const memberRecipient = (m) => ({
  key: `m:${m._id}`,
  member: m._id,
  firstName: m.firstName,
  lastName: m.lastName,
  phone: m.phone,
});

/**
 * Sends `text` to each recipient, recording every attempt. Anyone already sent this `run`
 * successfully is skipped, so a run can safely be retried or resumed.
 */
export async function deliver({ recipients, text, run, template, extraTags = {} }) {
  await connectDB();
  const provider = getSmsProvider();
  const from = smsStatus().senderId;
  const result = { total: recipients.length, sent: 0, failed: 0, alreadySent: 0 };

  for (const r of recipients) {
    if (await SmsLog.exists({ runKey: run, recipientKey: r.key })) {
      result.alreadySent += 1;
      continue;
    }
    const message = renderTemplate(text, {
      FirstName: r.firstName,
      LastName: r.lastName,
      ChurchName: CHURCH_NAME(),
      ...extraTags,
    });
    const res = await provider.send({ to: r.phone, body: message, from });
    try {
      await SmsLog.create({
        person: r.person,
        member: r.member,
        recipientKey: r.key,
        name: `${r.firstName} ${r.lastName || ''}`.trim(),
        template,
        run,
        to: r.phone,
        body: message,
        provider: provider.name,
        status: res.ok ? 'sent' : 'failed',
        providerRef: res.providerRef,
        cost: res.cost,
        error: res.error,
        runKey: res.ok ? run : undefined,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      // Someone else recorded this person's message for this run in the meantime.
      result.alreadySent += 1;
      continue;
    }
    res.ok ? (result.sent += 1) : (result.failed += 1);
  }
  return result;
}

/**
 * The instant message after a card: thank-you for a first timer, welcome back for a
 * returning visitor. At most once per person per template per service day. Never throws —
 * it runs after the usher's save has already succeeded.
 */
export async function sendCardMessage({ personId, templateKey, serviceDate }) {
  try {
    await ensureTemplates();
    const [template, person] = await Promise.all([
      SmsTemplate.findOne({ key: templateKey }).lean(),
      Person.findById(personId).lean(),
    ]);
    if (!template?.enabled || !person?.smsConsent) return { skipped: true };
    if (!smsStatus().live && process.env.NODE_ENV === 'production') return { skipped: true };
    const result = await deliver({
      recipients: [personRecipient(person)],
      text: template.body,
      run: `${templateKey}:${isoDay(toServiceDate(serviceDate))}`,
      template: templateKey,
    });
    logger.info({ templateKey, ...result }, 'Card SMS sent');
    return result;
  } catch (err) {
    logger.error({ err: err.message, templateKey }, 'Card SMS failed');
    return { error: err.message };
  }
}

/**
 * Saturday invite: recent first and second timers who aren't regulars yet (and haven't been
 * moved into the Members list).
 */
async function inviteRecipients(day) {
  const people = await Person.find({
    movedToMembersAt: null,
    stage: { $in: [STAGES.FIRST_TIMER, STAGES.SECOND_TIMER] },
    lastVisitDate: { $gte: addDays(day, -28) },
  }).lean();
  return people;
}

/** Tomorrow's service times, e.g. "Service starts at 8:00 AM." */
async function serviceTimesAfter(day) {
  return describeServiceTimes(await listServices({ on: addDays(day, 1) }));
}

/** The scheduled Saturday invite (cron). Safe to run twice. */
export async function runScheduledSend(templateKey, { today = new Date() } = {}) {
  if (templateKey !== 'saturday_invite') throw new Error(`No schedule for "${templateKey}"`);
  await ensureTemplates();
  const template = await SmsTemplate.findOne({ key: templateKey }).lean();
  if (!template.enabled) return { templateKey, skipped: true, reason: 'Template turned off' };

  const day = toServiceDate(today);
  const people = (await inviteRecipients(day)).filter((p) => p.smsConsent);
  const run = `${templateKey}:${isoDay(day)}`;
  const result = await deliver({
    recipients: people.map(personRecipient),
    text: template.body,
    run,
    template: templateKey,
    extraTags: { ServiceTimes: await serviceTimesAfter(day) },
  });
  logger.info({ templateKey, run, ...result }, 'Scheduled SMS run finished');
  return { templateKey, runKey: run, ...result };
}

/** Who the next Saturday invite would reach. */
export async function previewInvite(saturday) {
  await connectDB();
  const day = toServiceDate(saturday);
  const people = await inviteRecipients(day);
  const consented = people.filter((p) => p.smsConsent);
  return {
    serviceDate: day,
    total: people.length,
    toSend: consented.length,
    noConsent: people.length - consented.length,
  };
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

/**
 * Tries again for everyone in `run` whose message failed and who hasn't been sent it since,
 * using the exact message they should have got.
 */
export async function resendFailed(run) {
  requireLiveSms();
  await connectDB();
  const failed = await SmsLog.find({ run, status: 'failed' }).sort({ createdAt: -1 }).lean();
  const seen = new Set();
  const provider = getSmsProvider();
  const from = smsStatus().senderId;
  const result = { retried: 0, sent: 0, failed: 0 };

  for (const log of failed) {
    const key = log.recipientKey || `to:${log.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (
      log.recipientKey &&
      (await SmsLog.exists({ runKey: run, recipientKey: log.recipientKey }))
    ) {
      continue;
    }
    result.retried += 1;
    const res = await provider.send({ to: log.to, body: log.body, from });
    await SmsLog.create({
      person: log.person,
      member: log.member,
      recipientKey: log.recipientKey,
      name: log.name,
      template: log.template,
      run,
      to: log.to,
      body: log.body,
      provider: provider.name,
      status: res.ok ? 'sent' : 'failed',
      providerRef: res.providerRef,
      cost: res.cost,
      error: res.error,
      runKey: res.ok && log.recipientKey ? run : undefined,
    }).catch((err) => {
      if (err?.code !== 11000) throw err;
    });
    res.ok ? (result.sent += 1) : (result.failed += 1);
  }
  return result;
}

/**
 * Sends grouped for the history table, newest first. A person counts once per run: a
 * failure that was later resent successfully shows as sent.
 */
export async function recentRuns(limit = 20) {
  await connectDB();
  const rows = await SmsLog.aggregate([
    { $match: { run: { $type: 'string' } } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: { run: '$run', who: { $ifNull: ['$recipientKey', { $toString: '$_id' }] } },
        template: { $first: '$template' },
        provider: { $last: '$provider' },
        status: { $last: '$status' },
        cost: { $sum: { $ifNull: ['$cost', 0] } },
        lastAt: { $max: '$createdAt' },
      },
    },
    {
      $group: {
        _id: '$_id.run',
        template: { $first: '$template' },
        provider: { $last: '$provider' },
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        cost: { $sum: '$cost' },
        lastAt: { $max: '$lastAt' },
      },
    },
    { $sort: { lastAt: -1 } },
    { $limit: limit },
  ]);

  const broadcastIds = rows
    .filter((r) => r._id.startsWith('broadcast:'))
    .map((r) => r._id.slice('broadcast:'.length));
  const broadcasts = broadcastIds.length
    ? await Broadcast.find({ _id: { $in: broadcastIds } })
        .select('body audience')
        .lean()
    : [];
  const preview = Object.fromEntries(broadcasts.map((b) => [`broadcast:${b._id}`, b]));

  return rows.map(({ _id, ...r }) => ({
    run: _id,
    test: _id.startsWith('test:'),
    broadcast: preview[_id]
      ? { audience: preview[_id].audience, body: preview[_id].body.slice(0, 80) }
      : null,
    ...r,
  }));
}

/** Everyone in one run, for the history table's details (latest attempt per person). */
export async function runDetails(run) {
  await connectDB();
  const logs = await SmsLog.find({ run })
    .sort({ createdAt: 1 })
    .populate('person', 'firstName lastName')
    .lean();
  const latest = new Map();
  for (const l of logs) latest.set(l.recipientKey || String(l._id), l);
  return [...latest.values()].map((l) => ({
    name: l.name || (l.person ? `${l.person.firstName} ${l.person.lastName}` : 'Test message'),
    to: formatPhone(l.to),
    status: l.status,
    error: l.error ?? null,
    at: l.createdAt,
  }));
}

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

  const nextSaturday = addDays(day, (6 - day.getUTCDay() + 7) % 7);
  const order = Object.fromEntries(DEFAULT_TEMPLATES.map((t, i) => [t.key, i]));
  const [templates, invite, runs] = await Promise.all([
    SmsTemplate.find({ key: { $in: DEFAULT_TEMPLATES.map((t) => t.key) } }).lean(),
    previewInvite(nextSaturday),
    recentRuns(20),
  ]);

  return {
    senderId: status.senderId,
    live: status.live,
    balance,
    templates: templates
      .sort((a, b) => order[a.key] - order[b.key])
      .map(({ key, name, body, enabled, updatedAt }) => ({ key, name, body, enabled, updatedAt })),
    invite,
    runs,
  };
}

export async function recentLogs(limit = 50) {
  await connectDB();
  return SmsLog.find().sort({ createdAt: -1 }).limit(limit).lean();
}
