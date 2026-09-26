import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { toServiceDate, addDays } from '@/lib/dates';
import { STAGES } from '@/lib/stages';
import { renderTemplate, unknownTags } from '@/lib/sms/templates';
import { smsSegments } from '@/lib/sms/segments';
import { logger } from '@/lib/logger';
import { Broadcast, Member, Person } from '@/models';
import { deliver, memberRecipient, personRecipient, requireLiveSms } from './sms.service';

/** How many messages one request sends; small enough to finish well within hosting time limits. */
export const BATCH_SIZE = 10;

const sameName = (r) =>
  `${r.phone}|${r.firstName.trim().toLowerCase()}|${(r.lastName || '').trim().toLowerCase()}`;

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

  if (audience === 'members') return members();
  if (audience === 'first_timers') return firstTimers();
  if (audience === 'everyone') {
    const seen = new Set();
    return [...(await members()), ...(await firstTimers())].filter((r) => {
      const id = sameName(r);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
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
    ChurchName: process.env.CHURCH_NAME || 'RCCG Peculiar Treasure Chapel',
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
 * pressing Send at once never send the same slice twice.
 */
export async function sendBroadcastBatch(id) {
  requireLiveSms();
  await connectDB();
  const current = await Broadcast.findById(id).select('cursor total status').lean();
  if (!current) throw new HttpError(404, 'Broadcast not found');
  if (current.status === 'done' || current.cursor >= current.total) return progress(id);

  const claimed = await Broadcast.findOneAndUpdate(
    { _id: id, cursor: current.cursor },
    { $inc: { cursor: BATCH_SIZE } },
    { new: false, projection: { recipients: { $slice: [current.cursor, BATCH_SIZE] }, body: 1 } },
  ).lean();
  if (!claimed) return progress(id); // someone else took this batch

  const recipients = claimed.recipients.map((r) => ({
    ...r,
    [r.key.startsWith('m:') ? 'member' : 'person']: r.key.slice(2),
  }));
  const result = await deliver({
    recipients,
    text: claimed.body,
    run: `broadcast:${id}`,
    template: 'broadcast',
  });
  await Broadcast.updateOne({ _id: id }, { $inc: { sent: result.sent, failed: result.failed } });
  await Broadcast.updateOne(
    { _id: id, status: 'sending', $expr: { $gte: ['$cursor', '$total'] } },
    { status: 'done', finishedAt: new Date() },
  );
  logger.info({ broadcast: id, ...result }, 'Broadcast batch sent');
  return progress(id);
}

async function progress(id) {
  const b = await Broadcast.findById(id).select('cursor total sent failed status').lean();
  return {
    id,
    total: b.total,
    processed: Math.min(b.cursor, b.total),
    sent: b.sent,
    failed: b.failed,
    done: b.status === 'done' || b.cursor >= b.total,
  };
}
