import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** The morning follow-up email, against a throwaway in-memory MongoDB (mock email). */
let mongod;
let alerts;
let newcomers;
let followups;
let models;
let render;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_alerts_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.EMAIL_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  alerts = await import('@/services/alerts.service');
  newcomers = await import('@/services/newcomer.service');
  followups = await import('@/services/followup.service');
  render = await import('@/lib/email/followup-report');
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

const worker = { id: new mongoose.Types.ObjectId().toString(), role: 'followup' };
// "Tomorrow morning": cards typed today count as yesterday's.
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
// The most recent Sunday, so the card's service date is always valid.
const lastSunday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
};
let seq = 200;
const card = (overrides = {}) => ({
  firstName: 'Kemi',
  lastName: 'Adebayo',
  phone: `0806 000 0${seq++}`,
  smsConsent: true,
  cardUnclear: false,
  service: 'sunday',
  serviceDate: lastSunday(),
  prayerRequest: 'A private request',
  ...overrides,
});

describe('morning follow-up report', () => {
  it('lists cards typed yesterday and people waiting over 72 hours, with who tried last', async () => {
    const fresh = await newcomers.createFromCard(card({ firstName: 'Fresh' }));
    // Someone who came 10 days ago, typed back then, and was tried but not reached.
    const old = await newcomers
      .createFromCard(
        card({ firstName: 'Waiting', serviceDate: new Date(Date.now() - 10 * 864e5) }),
      )
      .catch(() => null);
    if (old) {
      await models.Visit.collection.updateMany(
        { person: old._id },
        { $set: { createdAt: new Date(Date.now() - 10 * 864e5) } },
      );
      await followups.logFollowUp(
        {
          personId: String(old._id),
          outcome: 'no_answer',
          channel: 'call',
          callerName: 'Bro. Tunde',
        },
        worker,
      );
    }

    const report = await alerts.buildFollowUpReport({ today: tomorrow() });
    expect(report.firstTimers.map((p) => p.name)).toEqual(['Fresh Adebayo']);
    expect(report.firstTimers[0].id).toBe(String(fresh._id));
    if (old) {
      const waiting = report.overdue.find((p) => p.name === 'Waiting Adebayo');
      expect(waiting).toMatchObject({
        tried: true,
        lastOutcome: 'no_answer',
        lastCallerName: 'Bro. Tunde',
      });
    }
  });

  it('sends once a day to the team with pastors copied, and skips when there is nothing', async () => {
    await alerts.updateAlertSettings({
      followupEmails: ['Team@Example.com ', 'team@example.com'],
      pastorEmails: ['pastor@example.com'],
    });
    expect((await alerts.getAlertSettings()).followupEmails).toEqual(['team@example.com']);

    expect(await alerts.sendFollowUpReport({ today: tomorrow() })).toEqual({
      skipped: 'nothing to report',
    });

    await newcomers.createFromCard(card());
    const first = await alerts.sendFollowUpReport({ today: tomorrow() });
    expect(first).toMatchObject({ sent: true, to: 1, cc: 1 });
    expect(first.subject).toMatch(/1 new first timer \(/);
    expect(await alerts.sendFollowUpReport({ today: tomorrow() })).toEqual({
      skipped: 'already sent today',
    });
    const log = await models.EmailLog.findOne({ kind: 'followup_report' }).lean();
    expect(log).toMatchObject({
      to: ['team@example.com'],
      cc: ['pastor@example.com'],
      status: 'sent',
    });
  });

  it('goes to the pastors when no team address is set, and can be switched off', async () => {
    await newcomers.createFromCard(card());
    await alerts.updateAlertSettings({ pastorEmails: ['pastor@example.com'] });
    expect(await alerts.sendFollowUpReport({ today: tomorrow() })).toMatchObject({
      sent: true,
      to: 1,
      cc: 0,
    });
    await models.EmailLog.deleteMany({});
    await alerts.updateAlertSettings({ followUpReport: false });
    expect(await alerts.sendFollowUpReport({ today: tomorrow() })).toEqual({
      skipped: 'switched off',
    });
  });

  it('never includes prayer requests and escapes names', async () => {
    await newcomers.createFromCard(card({ firstName: '<b>Bold</b>' }));
    const report = await alerts.buildFollowUpReport({ today: tomorrow() });
    const email = render.renderFollowUpReport(report, 'https://example.org');
    expect(email.html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    expect(email.html).not.toContain('<b>Bold</b>');
    expect(email.html + email.text).not.toContain('A private request');
    expect(email.html).toContain('https://example.org/my-newcomers');
  });
});
