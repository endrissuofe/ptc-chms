import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** The AI writer's weekly drafts, against a throwaway in-memory MongoDB (mock AI and SMS). */
let mongod;
let drafts;
let sms;
let rules;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_drafts_test');
  process.env.LOG_LEVEL = 'silent';
  drafts = await import('@/services/sms-draft.service');
  sms = await import('@/services/sms.service');
  rules = await import('@/lib/sms/drafts');
  models = await import('@/models');
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all(Object.values(models).map((m) => m.deleteMany({})));
  process.env.AI_PROVIDER = 'mock';
});

// Friday 2 October 2026; the week it drafts starts Saturday 3 October.
const FRIDAY = new Date('2026-10-02T06:00:00Z');
const SATURDAY = new Date('2026-10-03T00:00:00Z');

describe('rules every draft must pass', () => {
  it('needs its tags, one plain SMS page and the sign-off', () => {
    expect(
      rules.draftProblems('saturday_invite', 'Hi {FirstName}, come tomorrow! PTChapel'),
    ).toEqual(['It must include {ServiceTimes}']);
    expect(rules.draftProblems('birthday', 'Happy birthday {FirstName}!')).toEqual([
      'It must be signed PTChapel',
    ]);
    expect(rules.draftProblems('birthday', 'Happy birthday {Firstname}! PTChapel')).toContain(
      "It can't use {Firstname}",
    );
    expect(
      rules.draftProblems('birthday', `Happy birthday {FirstName}! ${'x'.repeat(140)} PTChapel`)[0],
    ).toMatch(/too long for one SMS page/);
    expect(rules.plainSms('It’s “great” — see you…')).toBe('It\'s "great" - see you...');
  });

  it('knows which week a day belongs to (Saturday to Friday)', () => {
    expect(sms.weekOf(new Date('2026-10-03T08:00:00Z'))).toEqual(SATURDAY);
    expect(sms.weekOf(new Date('2026-10-09T20:00:00Z'))).toEqual(SATURDAY);
    expect(sms.weekOf(new Date('2026-10-10T08:00:00Z'))).toEqual(new Date('2026-10-10'));
  });
});

describe('weekly drafts', () => {
  it('drafts every automatic message for the coming week, once', async () => {
    const first = await drafts.draftWeek({ saturday: SATURDAY });
    expect(first.written.sort()).toEqual([...rules.DRAFT_KEYS].sort());
    expect(first.failed).toEqual({});
    const again = await drafts.draftWeek({ saturday: SATURDAY });
    expect(again.written).toEqual([]);

    const invite = await models.SmsDraft.findOne({ template: 'saturday_invite' }).lean();
    expect(invite.body).toContain('{ServiceTimes}');
    expect(invite.source).toBe('ai');
  });

  it('is skipped when the AI is off, and a bad answer falls back to the backup wording', async () => {
    process.env.AI_PROVIDER = 'off';
    expect(await drafts.draftWeek({ saturday: SATURDAY })).toEqual({ skipped: 'AI is off' });

    process.env.AI_PROVIDER = 'mock';
    const ai = await import('@/lib/ai');
    const spy = vi.spyOn(ai, 'askJson').mockResolvedValue({ message: 'Too short, no tags' });
    const res = await drafts.draftWeek({ saturday: SATURDAY });
    spy.mockRestore();
    expect(Object.keys(res.failed).length).toBeGreaterThan(0);

    await sms.ensureTemplates();
    const t = await models.SmsTemplate.findOne({ key: 'birthday' }).lean();
    expect(await sms.wordingForSend(t, new Date('2026-10-05T06:00:00Z'))).toBe(t.body);
  });

  it('sends the week’s draft, and an admin’s edit replaces it', async () => {
    await drafts.draftWeek({ saturday: SATURDAY });
    await models.Member.create({ firstName: 'Ada', lastName: 'Eze', phone: '+2348030000601' });
    const results = await sms.runSaturdayInvites({ today: new Date('2026-10-03T11:00:00Z') });
    expect(results.member_invite).toMatchObject({ sent: 1 });
    const draft = await models.SmsDraft.findOne({ template: 'member_invite' }).lean();
    const log = await models.SmsLog.findOne({ template: 'member_invite' }).lean();
    expect(log.body).toBe(
      draft.body
        .replace('{FirstName}', 'Ada')
        .replace('{ServiceTimes}', 'Service starts at 8:00 AM.'),
    );

    // Editing: checked, cleaned, and only for this week or next.
    await expect(
      drafts.saveDraft(
        { template: 'birthday', weekOf: '2026-10-03', body: 'Happy birthday {FirstName}!' },
        null,
        { today: FRIDAY },
      ),
    ).rejects.toMatchObject({ status: 400 });
    const saved = await drafts.saveDraft(
      {
        template: 'birthday',
        weekOf: '2026-10-03',
        body: 'Happy birthday, {FirstName}! God’s joy be yours. PTChapel',
      },
      null,
      { today: FRIDAY },
    );
    expect(saved).toMatchObject({
      body: "Happy birthday, {FirstName}! God's joy be yours. PTChapel",
      source: 'edited',
    });
    await expect(
      drafts.saveDraft({ template: 'birthday', weekOf: '2026-11-07', body: saved.body }, null, {
        today: FRIDAY,
      }),
    ).rejects.toMatchObject({ status: 400 });

    const view = await drafts.listDrafts({ today: FRIDAY });
    expect(view.drafts.birthday.nextWeek.draft).toMatchObject({ source: 'edited' });
    expect(view.drafts.birthday.thisWeek.draft).toBeNull();
  });
});
