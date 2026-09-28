import { connectDB } from '@/lib/db';
import { isoDay, toServiceDate } from '@/lib/dates';
import { celebratedOn, celebrationDays } from '@/lib/celebrations';
import { logger } from '@/lib/logger';
import { emailStatus, sendEmail } from '@/lib/email';
import { renderCelebrations } from '@/lib/email/celebrations-report';
import { EmailLog, Member, Person, SmsLog, SmsTemplate } from '@/models';
import { baseUrl, getAlertSettings, logEmail } from './alerts.service';
import { deliver, ensureTemplates, memberRecipient, personRecipient } from './sms.service';

/**
 * Birthdays and wedding anniversaries. Members come from the Members list; first timers
 * (not yet moved into Members) from their cards, birthdays only (cards don't ask about
 * weddings).
 */
const identity = (p) =>
  `${p.phone}|${p.firstName.trim().toLowerCase()}|${(p.lastName || '').trim().toLowerCase()}`;

const dateQuery = (dayField, monthField, pairs) => ({
  $or: pairs.map(({ day, month }) => ({ [dayField]: day, [monthField]: month })),
});

/** Everyone celebrating on one Lagos day: [{ kind, who, id, name, phone, canSms, recipient }]. */
export async function celebrantsOn(date) {
  await connectDB();
  const pairs = celebratedOn(date);
  const [birthdayMembers, anniversaryMembers, birthdayPeople] = await Promise.all([
    Member.find({ active: true, ...dateQuery('birthDay', 'birthMonth', pairs) }).lean(),
    Member.find({ active: true, ...dateQuery('anniversaryDay', 'anniversaryMonth', pairs) }).lean(),
    Person.find({ movedToMembersAt: null, ...dateQuery('birthDay', 'birthMonth', pairs) }).lean(),
  ]);

  const memberIds = new Set(birthdayMembers.map(identity));
  const fromMember = (kind) => (m) => ({
    kind,
    who: 'member',
    id: String(m._id),
    firstName: m.firstName,
    lastName: m.lastName || '',
    phone: m.phone,
    canSms: !m.smsOptOut,
    recipient: memberRecipient(m),
  });
  return [
    ...birthdayMembers.map(fromMember('birthday')),
    // A first timer who is also on the Members list is wished once, as a member.
    ...birthdayPeople
      .filter((p) => !memberIds.has(identity(p)))
      .map((p) => ({
        kind: 'birthday',
        who: 'first_timer',
        id: String(p._id),
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        canSms: Boolean(p.smsConsent),
        recipient: personRecipient(p),
      })),
    ...anniversaryMembers.map(fromMember('anniversary')),
  ];
}

/** Celebrations for `days` days from `from`, grouped by day, with today's SMS status. */
export async function listCelebrations({ from = new Date(), days = 7 } = {}) {
  await connectDB();
  const today = isoDay(toServiceDate());
  const out = [];
  for (const { date } of celebrationDays(from, days)) {
    const people = await celebrantsOn(date);
    let sent = new Set();
    if (isoDay(date) === today && people.length) {
      const logs = await SmsLog.find({
        runKey: { $in: [`birthday:${today}`, `anniversary:${today}`] },
      })
        .select('runKey recipientKey')
        .lean();
      sent = new Set(logs.map((l) => `${l.runKey.split(':')[0]}|${l.recipientKey}`));
    }
    out.push({
      date: isoDay(date),
      people: people.map(({ recipient, ...p }) => ({
        ...p,
        name: `${p.firstName} ${p.lastName}`.trim(),
        smsSent: sent.has(`${p.kind}|${recipient.key}`),
      })),
    });
  }
  return out;
}

/**
 * The 7 AM birthday and anniversary SMS. Safe to run twice (nobody gets the same wish twice
 * in a day). Skips a message the admin switched off on the SMS page.
 */
export async function sendCelebrationSms({ today = new Date() } = {}) {
  await ensureTemplates();
  const day = isoDay(toServiceDate(today));
  const people = await celebrantsOn(today);
  const results = {};
  for (const kind of ['birthday', 'anniversary']) {
    const template = await SmsTemplate.findOne({ key: kind }).lean();
    if (!template?.enabled) {
      results[kind] = { skipped: 'switched off' };
      continue;
    }
    const recipients = people.filter((p) => p.kind === kind && p.canSms).map((p) => p.recipient);
    results[kind] = recipients.length
      ? await deliver({ recipients, text: template.body, run: `${kind}:${day}`, template: kind })
      : { total: 0 };
  }
  logger.info({ day, ...results }, 'Birthday and anniversary SMS');
  return results;
}

/**
 * The celebrations email for a day: today's celebrants, and on Mondays the rest of the week.
 * null when there is nothing to say.
 */
export async function buildCelebrationsEmail({ today = new Date() } = {}) {
  const [first, ...rest] = await listCelebrations({
    from: today,
    days: toServiceDate(today).getUTCDay() === 1 ? 7 : 1,
  });
  const week = rest.filter((d) => d.people.length);
  if (!first.people.length && !week.length) return null;
  return renderCelebrations({ date: first.date, today: first.people, week }, baseUrl());
}

/** Sends the celebrations email once a day. */
export async function sendCelebrationsEmail({ today = new Date() } = {}) {
  const settings = await getAlertSettings();
  if (!settings.celebrationReport) return { skipped: 'switched off' };
  const to = settings.celebrationEmails;
  if (!to.length) return { skipped: 'no recipients set' };
  const email = await buildCelebrationsEmail({ today });
  if (!email) return { skipped: 'nothing to report' };
  const runKey = `celebrations:${isoDay(toServiceDate(today))}`;
  if (await EmailLog.exists({ runKey })) return { skipped: 'already sent today' };

  const res = await sendEmail({ to, ...email });
  const logged = await logEmail({
    kind: 'celebrations',
    to,
    subject: email.subject,
    status: res.ok ? 'sent' : 'failed',
    provider: emailStatus().provider,
    error: res.error,
    runKey: res.ok ? runKey : undefined,
  });
  if (logged === 'duplicate') return { skipped: 'already sent today' };
  return res.ok
    ? { sent: true, to: to.length, subject: email.subject }
    : { sent: false, error: res.error };
}
