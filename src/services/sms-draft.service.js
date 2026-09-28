import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { addDays, isoDay } from '@/lib/dates';
import { aiStatus, askJson } from '@/lib/ai';
import { logger } from '@/lib/logger';
import { TEMPLATE_INFO } from '@/lib/sms/templates';
import { DRAFT_BRIEFS, DRAFT_KEYS, SIGNATURE, draftProblems, plainSms } from '@/lib/sms/drafts';
import { SmsDraft, SmsTemplate } from '@/models';
import { ensureTemplates, serviceTimesAfter, weekOf, wordingForSend } from './sms.service';

/**
 * The AI writer: every Friday it drafts the coming week's wording for each automatic SMS.
 * Admins see (and may edit) the drafts on the SMS page; the AI itself is never shown there.
 * Prompts carry no names or numbers, only {FirstName}-style tags filled in when sending.
 */

const SYSTEM = `You write SMS messages for RCCG Peculiar Treasure Chapel (PTC Chapel), a church in Lagos, Nigeria.
Style: friendly, warm and personal, like a caring church family member. Simple English.
Rules:
- One SMS page: keep the whole message under 110 characters before the tags are filled in.
- Use plain keyboard characters only: no emoji, no curly quotes, no long dashes.
- Keep the tags exactly as given, with their curly braces, e.g. {FirstName}. Add no other tags.
- End the message with the sign-off "${SIGNATURE}".
- Return JSON: {"message": "..."}`;

const SCHEMA = {
  type: 'OBJECT',
  properties: { message: { type: 'STRING' } },
  required: ['message'],
};

/** About one message in three gets a short Bible reference, spread evenly over the weeks. */
function wantsVerse(key, saturday) {
  const n = [...`${key}${isoDay(saturday)}`].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return n % 3 === 0;
}

function prompt(key, saturday, recent, retry) {
  const brief = DRAFT_BRIEFS[key];
  const lines = [
    `Message: ${TEMPLATE_INFO[key].title}.`,
    `Purpose: ${brief.purpose}`,
    `Tags to include: ${brief.required.map((t) => `{${t}}`).join(' ')}.`,
    brief.required.includes('ServiceTimes')
      ? '{ServiceTimes} becomes a sentence like "Service starts at 8:00 AM." Place it where that reads naturally.'
      : null,
    brief.required.includes('Link') ? '{Link} becomes a web link; put it near the end.' : null,
    wantsVerse(key, saturday)
      ? 'Include one very short Bible verse or reference (e.g. "Ps 118:24").'
      : 'Do not include a Bible verse this time.',
    recent.length
      ? `Say it differently from these recent messages:\n${recent.map((r) => `- ${r}`).join('\n')}`
      : null,
    retry ? `Your last try had problems: ${retry}. Fix them.` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

/** Asks the AI for one message, checking it; up to 3 tries. Returns the text or throws. */
async function writeOne(key, saturday, serviceTimes) {
  const recent = (
    await SmsDraft.find({ template: key, weekOf: { $lt: saturday } })
      .sort({ weekOf: -1 })
      .limit(4)
      .lean()
  ).map((d) => d.body);
  let problems = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const answer = await askJson({
      system: SYSTEM,
      prompt: prompt(key, saturday, recent, problems?.join('; ')),
      schema: SCHEMA,
    });
    const text = plainSms(answer?.message);
    const found = draftProblems(key, text, { serviceTimes });
    if (!found.length) return text;
    problems = found;
  }
  throw new Error(`Draft kept failing checks: ${problems.join('; ')}`);
}

/**
 * Drafts the week starting \`saturday\` for every automatic message that has no draft yet.
 * Safe to run again (e.g. Saturday morning if Friday's run failed): it only fills gaps.
 */
export async function draftWeek({ saturday = weekOf(addDays(new Date(), 1)) } = {}) {
  const status = aiStatus();
  if (!status.on) return { skipped: 'AI is off' };
  await ensureTemplates();
  const week = weekOf(saturday);
  const have = new Set(await SmsDraft.find({ weekOf: week }).distinct('template'));
  const serviceTimes = await serviceTimesAfter(week);
  const result = { weekOf: isoDay(week), written: [], failed: {} };

  for (const key of DRAFT_KEYS) {
    if (have.has(key)) continue;
    try {
      const body = await writeOne(key, week, serviceTimes);
      await SmsDraft.updateOne(
        { template: key, weekOf: week },
        { $setOnInsert: { body, source: 'ai', model: status.model } },
        { upsert: true },
      );
      result.written.push(key);
    } catch (err) {
      result.failed[key] = err.message;
    }
  }
  logger.info(result, 'SMS drafts');
  return result;
}

/** For the SMS page: this week's wording per message, and next week's once it's drafted. */
export async function listDrafts({ today = new Date() } = {}) {
  await ensureTemplates();
  await connectDB();
  const thisWeek = weekOf(today);
  const nextWeek = addDays(thisWeek, 7);
  const [templates, drafts] = await Promise.all([
    SmsTemplate.find({ key: { $in: DRAFT_KEYS } }).lean(),
    SmsDraft.find({ weekOf: { $in: [thisWeek, nextWeek] } }).lean(),
  ]);
  const find = (key, week) => drafts.find((d) => d.template === key && +d.weekOf === +week) ?? null;
  const view = (d) => (d ? { body: d.body, source: d.source, updatedAt: d.updatedAt } : null);

  const out = {};
  for (const t of templates) {
    const current = find(t.key, thisWeek);
    out[t.key] = {
      thisWeek: {
        weekOf: isoDay(thisWeek),
        draft: view(current),
        // What goes out if nobody drafts or edits it (the backup wording).
        body: current?.body ?? (await wordingForSend(t, today)),
      },
      nextWeek: find(t.key, nextWeek)
        ? { weekOf: isoDay(nextWeek), draft: view(find(t.key, nextWeek)) }
        : null,
    };
  }
  return { ai: aiStatus().on, drafts: out };
}

/** An admin edits a week's wording (this week or next). */
export async function saveDraft(
  { template, weekOf: week, body },
  user,
  { today = new Date() } = {},
) {
  await connectDB();
  if (!DRAFT_BRIEFS[template]) throw new HttpError(404, 'Message not found');
  const saturday = weekOf(new Date(week));
  const thisWeek = weekOf(today);
  if (+saturday !== +thisWeek && +saturday !== +addDays(thisWeek, 7)) {
    throw new HttpError(400, 'Only this week’s and next week’s messages can be edited');
  }
  const text = plainSms(body);
  const problems = draftProblems(template, text, {
    serviceTimes: await serviceTimesAfter(saturday),
  });
  if (problems.length) {
    throw new HttpError(400, problems[0], [{ path: ['body'], message: problems[0] }]);
  }
  const doc = await SmsDraft.findOneAndUpdate(
    { template, weekOf: saturday },
    { body: text, source: 'edited', editedBy: user?.id },
    { upsert: true, new: true },
  ).lean();
  return { body: doc.body, source: doc.source, updatedAt: doc.updatedAt };
}
