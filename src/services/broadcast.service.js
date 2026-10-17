import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { toServiceDate, addDays } from '@/lib/dates';
import { STAGES } from '@/lib/stages';
import { renderTemplate, unknownTags } from '@/lib/sms/templates';
import { smsSegments } from '@/lib/sms/segments';
import { logger } from '@/lib/logger';
import { Broadcast, Member, Person, SmsLog } from '@/models';
import { deliver, memberRecipient, personRecipient, requireLiveSms } from './sms.service';

/** How many messages one request sends; small enough to finish well within hosting time limits. */
export const BATCH_SIZE = 10;
/** A sweep that hasn't finished in this long (its function was stopped) can be taken over. */
const SWEEP_LOCK_MS = 90000;

/** The people a broadcast goes to, as send-loop recipients. */
export async function audienceRecipients(audience, today = new Date()) {
  await connectDB();
  const members = async () =>
    (await Member.find({ active: true, smsOptOut: { $ne: true } }).lean()).map(memberRecipient);
  const firstTimers = async () =>
    (
      await Person.find({
        smsConsent: true,
        movedToMembersAt: null,
        stage: { $in: [STAGES.FIRST_TIMER, STAGES.SECOND_TIMER] },
        lastVisitDate: { $gte: addDays(toServiceDate(today), -90) },
      }).lean()
    ).map(personRecipient);

  // One message per phone number: family members sharing a phone, or someone who is both a
  // member and a first timer, get it once.
  const onePerPhone = (list) => {
    const seen = new Set();
    return list.filter((r) => !seen.has(r.phone) && seen.add(r.phone));
  };
  if (audience === 'members') return onePerPhone(await members());
  if (audience === 'first_timers') return onePerPhone(await firstTimers());
  if (audience === 'everyone') return onePerPhone([...(await members()), ...(await firstTimers())]);
  throw new HttpError(400, 'Choose who to send to');
}

function checkBody(body) {
  const bad = unknownTags('broadcast', body);
  if (bad.length) throw new HttpError(400, `This message can't use {${bad[0]}}`);
}

/** Counts per audience, for the choice buttons. */
export async function audienceCounts() {
  const [members, firstTimers, everyone] = await Promise.all([
    audienceRecipients('members'),
    audienceRecipients('first_timers'),
    audienceRecipients('everyone'),
  ]);
  return { members: members.length, first_timers: firstTimers.length, everyone: everyone.length };
}

/**
 * What a broadcast would cost before sending: how many people, and SMS pages per message
 * (worked out from the longest name, so the estimate is never too low).
 */
export async function previewBroadcast({ audience, body }) {
  checkBody(body);
  const recipients = await audienceRecipients(audience);
  const longest = recipients.reduce(
    (a, r) => ((r.firstName + r.lastName).length > (a.firstName + a.lastName).length ? r : a),
    { firstName: 'Friend', lastName: '' },
  );
  const sample = renderTemplate(body, {
    FirstName: longest.firstName,
    LastName: longest.lastName,
    ChurchName: process.env.CHURCH_NAME || 'Ptchapel',
  });
  const { pages } = smsSegments(sample);
  return { count: recipients.length, pages, units: recipients.length * pages, sample };
}

/** Freezes the recipient list and starts a broadcast; the screen then sends it in batches. */
export async function createBroadcast({ audience, body }, user) {
  requireLiveSms();
  checkBody(body);
  const recipients = await audienceRecipients(audience);
  if (!recipients.length) throw new HttpError(400, 'Nobody to send to');
  const b = await Broadcast.create({
    audience,
    body,
    recipients: recipients.map(({ key, firstName, lastName, phone }) => ({
      key,
      firstName,
      lastName,
      phone,
    })),
    total: recipients.length,
    createdBy: user?.id,
  });
  return { id: String(b._id), total: b.total };
}

/**
 * Sends the next batch. The batch is claimed by moving the cursor first, so two screens
 * pressing Send at once never send the same slice twice. Once every batch is claimed, a last
 * check (sweepMissed) finds anyone a cut-off batch never reached; only then is it done.
 */
export async function sendBroadcastBatch(id) {
  requireLiveSms();
  await connectDB();
  const current = await Broadcast.findById(id).select('cursor total status').lean();
  if (!current) throw new HttpError(404, 'Broadcast not found');
  if (current.status === 'done') return progress(id);
  if (current.cursor >= current.total) {
    await sweepMissed(id);
    return progress(id);
  }

  const claimed = await Broadcast.findOneAndUpdate(
    { _id: id, cursor: current.cursor },
    { $inc: { cursor: BATCH_SIZE } },
    { new: false, projection: { recipients: { $slice: [current.cursor, BATCH_SIZE] }, body: 1 } },
  ).lean();
  if (!claimed) return progress(id); // someone else took this batch

  await sendTo(id, claimed.recipients, claimed.body);
  return progress(id);
}

async function sendTo(id, list, body) {
  const recipients = list.map((r) => ({
    ...r,
    [r.key.startsWith('m:') ? 'member' : 'person']: r.key.slice(2),
  }));
  const result = await deliver({
    recipients,
    text: body,
    run: `broadcast:${id}`,
    template: 'broadcast',
  });
  await Broadcast.updateOne(
    { _id: id },
    { $inc: { sent: result.sent, failed: result.failed + result.notReached } },
  );
  logger.info({ broadcast: id, ...result }, 'Broadcast batch sent');
}

/**
 * Anyone with no message at all logged for this broadcast (their batch was cut off before it
 * reached them) is sent to now, a batch at a time. With nobody left, the broadcast is done.
 * One sweep at a time: a second screen waits for the first.
 */
async function sweepMissed(id) {
  const now = new Date();
  const mine = await Broadcast.findOneAndUpdate(
    {
      _id: id,
      status: 'sending',
      $or: [{ sweepAt: null }, { sweepAt: { $lt: new Date(now - SWEEP_LOCK_MS) } }],
    },
    { sweepAt: now },
    { projection: { recipients: 1, body: 1 } },
  ).lean();
  if (!mine) return;
  const run = `broadcast:${id}`;
  const [keys, phones] = await Promise.all([
    SmsLog.distinct('recipientKey', { run }),
    SmsLog.distinct('to', { run }),
  ]);
  const logged = new Set(keys);
  const reached = new Set(phones);
  const missed = mine.recipients
    .filter((r) => !logged.has(r.key) && !reached.has(r.phone))
    .slice(0, BATCH_SIZE);
  if (missed.length) await sendTo(id, missed, mine.body);
  await Broadcast.updateOne(
    { _id: id },
    missed.length ? { sweepAt: null } : { status: 'done', finishedAt: new Date(), sweepAt: null },
  );
}

async function progress(id) {
  const b = await Broadcast.findById(id).select('cursor total sent failed status').lean();
  return {
    id,
    total: b.total,
    processed: Math.min(b.cursor, b.total),
    sent: b.sent,
    failed: b.failed,
    done: b.status === 'done',
  };
}
