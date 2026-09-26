import { connectDB } from '@/lib/db';
import { getSmsProvider, renderTemplate } from '@/lib/sms';
import { toServiceDate, addDays, isoDay } from '@/lib/dates';
import { STAGES } from '@/lib/stages';
import { logger } from '@/lib/logger';
import { Person, Visit, SmsTemplate, SmsLog } from '@/models';

export const DEFAULT_TEMPLATES = [
  {
    key: 'sunday_thanks',
    name: 'Sunday thank-you',
    body: 'Hi {FirstName}, thank you for worshipping with us at RCCG Peculiar Treasure Chapel today. You are welcome here, and we look forward to seeing you again. God bless you!',
  },
  {
    key: 'saturday_invite',
    name: 'Saturday invite',
    body: 'Hi {FirstName}, we would love to see you in church tomorrow! Service starts at 7:30 AM (1st) & 9:30 AM (2nd). See you there. PTC Chapel',
  },
];

export async function ensureTemplates() {
  await connectDB();
  for (const t of DEFAULT_TEMPLATES) {
    await SmsTemplate.updateOne({ key: t.key }, { $setOnInsert: t }, { upsert: true });
  }
}

/** Sunday: everyone whose first-timer card was entered for today's services. */
async function sundayRecipients(today) {
  const day = toServiceDate(today);
  const personIds = await Visit.distinct('person', { serviceDate: day, source: 'card' });
  return Person.find({ _id: { $in: personIds }, smsConsent: true }).lean();
}

/** Saturday: recent first and second timers who haven't become regulars yet. */
async function saturdayRecipients(today) {
  const since = addDays(toServiceDate(today), -28);
  return Person.find({
    smsConsent: true,
    stage: { $in: [STAGES.FIRST_TIMER, STAGES.SECOND_TIMER] },
    lastVisitDate: { $gte: since },
  }).lean();
}

const RECIPIENTS = { sunday_thanks: sundayRecipients, saturday_invite: saturdayRecipients };

/**
 * Sends one scheduled batch. Each person gets at most one message per template per day,
 * even if the job runs twice (the SmsLog runKey index enforces it).
 */
export async function runScheduledSend(templateKey, { today = new Date() } = {}) {
  await connectDB();
  await ensureTemplates();
  const template = await SmsTemplate.findOne({ key: templateKey }).lean();
  if (!template) throw new Error(`No template "${templateKey}"`);
  if (!template.enabled) return { templateKey, skipped: true, reason: 'Template turned off' };

  const provider = getSmsProvider();
  const from = process.env.SMS_SENDER_ID || 'PTCChapel';
  const runKey = `${templateKey}:${isoDay(toServiceDate(today))}`;
  const people = await RECIPIENTS[templateKey](today);

  const result = { templateKey, runKey, total: people.length, sent: 0, failed: 0, alreadySent: 0 };

  for (const person of people) {
    const already = await SmsLog.exists({ runKey, person: person._id });
    if (already) {
      result.alreadySent += 1;
      continue;
    }
    const body = renderTemplate(template.body, {
      FirstName: person.firstName,
      LastName: person.lastName,
    });
    const res = await provider.send({ to: person.phone, body, from });
    try {
      await SmsLog.create({
        person: person._id,
        template: templateKey,
        to: person.phone,
        body,
        provider: provider.name,
        status: res.ok ? 'sent' : 'failed',
        providerRef: res.providerRef,
        cost: res.cost,
        error: res.error,
        runKey: res.ok ? runKey : undefined,
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
    res.ok ? (result.sent += 1) : (result.failed += 1);
  }

  logger.info(result, 'Scheduled SMS run finished');
  return result;
}

export async function recentLogs(limit = 50) {
  await connectDB();
  return SmsLog.find().sort({ createdAt: -1 }).limit(limit).lean();
}
