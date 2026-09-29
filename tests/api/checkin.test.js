import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** The one-month check-in survey, against a throwaway in-memory MongoDB (mock SMS). */
let mongod;
let checkins;
let followups;
let alerts;
let validators;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_checkin_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.EMAIL_PROVIDER = 'mock';
  process.env.APP_URL = 'https://church.example';
  process.env.LOG_LEVEL = 'silent';
  checkins = await import('@/services/checkin.service');
  followups = await import('@/services/followup.service');
  alerts = await import('@/services/alerts.service');
  validators = await import('@/lib/validators/checkin');
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
});

// Monday 12 October 2026, 7 AM Lagos.
const TODAY = new Date('2026-10-12T06:00:00Z');
const daysAgo = (n) => new Date(Date.UTC(2026, 9, 12 - n));
let seq = 10;
const person = (overrides = {}) =>
  models.Person.create({
    firstName: 'Kemi',
    lastName: 'Ade',
    phone: `+23480300000${seq++}`,
    smsConsent: true,
    firstVisitDate: daysAgo(30),
    lastVisitDate: daysAgo(30),
    ...overrides,
  });

describe('who gets the check-in', () => {
  it('asks each first timer once, a month after their first visit, if they agreed', async () => {
    const due = await person();
    await person({ firstName: 'Late', firstVisitDate: daysAgo(36), lastVisitDate: daysAgo(36) });
    await person({ firstName: 'Early', firstVisitDate: daysAgo(29), lastVisitDate: daysAgo(29) });
    await person({ firstName: 'TooOld', firstVisitDate: daysAgo(40), lastVisitDate: daysAgo(40) });
    await person({ firstName: 'NoSms', smsConsent: false });
    await person({ firstName: 'Moved', movedToMembersAt: new Date() });

    const first = await checkins.sendCheckIns({ today: TODAY });
    expect(first).toMatchObject({ total: 2, sent: 2 });
    const log = await models.SmsLog.findOne({ person: due._id }).lean();
    const doc = await models.CheckIn.findOne({ person: due._id }).lean();
    expect(log.body).toBe(
      `Hi Kemi, it's been a month since your first visit to Ptchapel. How has it been? Tell us here: https://church.example/c/${doc.token}`,
    );
    expect(log.body.length).toBeLessThanOrEqual(160);

    // The next day only the person who reaches a month that day is asked; nobody twice.
    expect(await checkins.sendCheckIns({ today: new Date('2026-10-13T06:00:00Z') })).toMatchObject({
      total: 1,
      sent: 1,
    });
    expect(await models.SmsLog.countDocuments({ template: 'checkin' })).toBe(3);
  });

  it('can be switched off on the SMS page', async () => {
    await person();
    await checkins.sendCheckIns({ today: new Date('2026-01-01T06:00:00Z') }); // makes the templates
    await models.SmsTemplate.updateOne({ key: 'checkin' }, { enabled: false });
    expect(await checkins.sendCheckIns({ today: TODAY })).toEqual({ skipped: 'switched off' });
  });
});

describe('answers', () => {
  it('saves the answers, and a request for a call puts them back on the list', async () => {
    const p = await person();
    // Reached after their visit: off the call list.
    await models.Person.updateOne(
      { _id: p._id },
      { lastContactAt: daysAgo(28), lastAttemptAt: daysAgo(28), lastOutcome: 'reached' },
    );
    await checkins.sendCheckIns({ today: TODAY });
    const { token } = await models.CheckIn.findOne({ person: p._id }).lean();

    expect(await checkins.findCheckIn(token)).toEqual({ firstName: 'Kemi', answered: false });
    expect(await checkins.findCheckIn('wrong-token')).toBeNull();
    expect(() => validators.checkInAnswerSchema.parse({ token, rating: 0 })).toThrow();

    let list = await followups.listFollowUps({ today: TODAY });
    expect(list.toCall.map((i) => i.id)).not.toContain(String(p._id));

    await checkins.answerCheckIn(
      validators.checkInAnswerSchema.parse({
        token,
        rating: 4,
        wantsCall: true,
        comment: 'Lovely',
      }),
    );
    expect(await checkins.findCheckIn(token)).toMatchObject({ answered: true });
    list = await followups.listFollowUps({ today: new Date() });
    const item = list.toCall.find((i) => i.id === String(p._id));
    expect(item).toMatchObject({ askedForCall: true, days: 0 });

    // The morning email the next day includes the answer.
    const report = await alerts.buildFollowUpReport({ today: new Date(Date.now() + 864e5) });
    expect(report.checkIns).toEqual([
      expect.objectContaining({ name: 'Kemi Ade', rating: 4, wantsCall: true, comment: 'Lovely' }),
    ]);
    expect(await checkins.checkInSummary({ today: new Date() })).toEqual({
      sent: 1,
      answered: 1,
      average: 4,
    });
  });

  it('a happy answer without a request leaves the list alone', async () => {
    const p = await person();
    await checkins.sendCheckIns({ today: TODAY });
    const { token } = await models.CheckIn.findOne({ person: p._id }).lean();
    await checkins.answerCheckIn({ token, rating: 5, wantsCall: false });
    expect((await models.Person.findById(p._id).lean()).callRequestedAt).toBeUndefined();
    await checkins.answerCheckIn({ token, rating: 2, wantsCall: false });
    expect((await models.Person.findById(p._id).lean()).callRequestedAt).toBeInstanceOf(Date);
  });
});
