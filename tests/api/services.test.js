import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * Service tests against a throwaway in-memory MongoDB.
 * They cover the rules that matter most on a Sunday: duplicate phones,
 * returning visitors, never sending the same SMS twice, and the church's services.
 */
let mongod;
let svc;
let sms;
let todaySvc;
let churchSvc;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  svc = await import('@/services/newcomer.service');
  sms = await import('@/services/sms.service');
  todaySvc = await import('@/services/today.service');
  churchSvc = await import('@/services/churchService.service');
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

const card = (overrides = {}) => ({
  firstName: 'Kemi',
  lastName: 'Adebayo',
  phone: '0806 000 0101',
  smsConsent: true,
  cardUnclear: false,
  service: 'sunday',
  serviceDate: new Date('2026-09-27T09:00:00Z'),
  ...overrides,
});

describe('first-timer cards', () => {
  it('saves a card with a first visit and a private prayer request', async () => {
    const p = await svc.createFromCard(card({ prayerRequest: 'For my job interview' }));
    expect(p.phone).toBe('+2348060000101');
    expect(p.stage).toBe('first_timer');
    expect(await models.Visit.countDocuments({ person: p._id })).toBe(1);
    expect(await models.PrayerRequest.countDocuments({ person: p._id })).toBe(1);
  });

  it('refuses a duplicate phone written differently and returns the match', async () => {
    await svc.createFromCard(card());
    await expect(
      svc.createFromCard(card({ phone: '+234 806 000 0101', firstName: 'K' })),
    ).rejects.toMatchObject({
      status: 409,
      details: { match: { firstName: 'Kemi' } },
    });
  });

  it('moves a returning visitor to second timer, and a repeat tap changes nothing', async () => {
    const p = await svc.createFromCard(card({ serviceDate: new Date('2026-09-20T09:00:00Z') }));
    const args = {
      personId: String(p._id),
      service: 'sunday',
      serviceDate: new Date('2026-09-27T09:00:00Z'),
    };
    const after = await svc.recordReturningVisit(args);
    expect(after.stage).toBe('second_timer');
    const again = await svc.recordReturningVisit(args);
    expect(again.visitCount).toBe(2);
  });
});

describe('scheduled SMS', () => {
  it('thanks only consenting first timers, and a second run sends nothing new', async () => {
    const today = new Date('2026-09-27T17:00:00Z');
    await svc.createFromCard(card());
    await svc.createFromCard(
      card({ phone: '0901 000 0102', firstName: 'Blessing', smsConsent: false }),
    );

    const first = await sms.runScheduledSend('sunday_thanks', { today });
    expect(first.sent).toBe(1);

    const second = await sms.runScheduledSend('sunday_thanks', { today });
    expect(second.sent).toBe(0);
    expect(second.alreadySent).toBe(1);
  });
});

describe('church services', () => {
  it('starts with one Sunday Service at 08:00', async () => {
    expect(await churchSvc.listServices()).toEqual([
      { key: 'sunday', name: 'Sunday Service', startTime: '08:00', order: 1, active: true },
    ]);
  });

  it('adds services with unique keys that survive renaming', async () => {
    await churchSvc.listServices();
    const added = await churchSvc.createService({ name: 'Sunday Service', startTime: '10:00' });
    expect(added).toMatchObject({ key: 'sunday-service', order: 2, active: true });
    const renamed = await churchSvc.updateService('sunday-service', { name: '2nd Service' });
    expect(renamed).toMatchObject({ key: 'sunday-service', name: '2nd Service' });
  });

  it('refuses to switch off the last active service, and hides switched-off ones', async () => {
    await churchSvc.listServices();
    await expect(churchSvc.updateService('sunday', { active: false })).rejects.toMatchObject({
      status: 400,
    });
    await churchSvc.createService({ name: '2nd Service', startTime: '10:00' });
    await churchSvc.updateService('sunday', { active: false });
    expect((await churchSvc.listServices()).map((s) => s.key)).toEqual(['2nd-service']);
    expect(await churchSvc.listServices({ includeInactive: true })).toHaveLength(2);
  });

  it('reorders only when every service is listed once', async () => {
    await churchSvc.listServices();
    await churchSvc.createService({ name: '2nd Service', startTime: '06:00' });
    await expect(churchSvc.reorderServices(['sunday'])).rejects.toMatchObject({ status: 400 });
    const items = await churchSvc.reorderServices(['2nd-service', 'sunday']);
    expect(items.map((s) => s.key)).toEqual(['2nd-service', 'sunday']);
  });

  it('rejects attendance and cards for unknown or switched-off services', async () => {
    const att = await import('@/services/attendance.service');
    const counts = { men: 1, women: 1, teens: 0, children: 0, serviceDate: new Date() };
    await expect(att.recordAttendance({ ...counts, service: 'first' })).rejects.toMatchObject({
      status: 400,
    });
    await churchSvc.createService({ name: 'Evening', startTime: '17:00' });
    await churchSvc.updateService('evening', { active: false });
    await expect(svc.createFromCard(card({ service: 'evening' }))).rejects.toMatchObject({
      status: 400,
    });
  });

  it('puts the service times into the Saturday invite', async () => {
    await svc.createFromCard(card({ serviceDate: new Date('2026-09-20T09:00:00Z') }));
    const saturday = new Date('2026-09-26T10:00:00Z');
    await sms.runScheduledSend('saturday_invite', { today: saturday });
    let log = await models.SmsLog.findOne().lean();
    expect(log.body).toContain('Service starts at 8:00 AM.');

    await churchSvc.createService({ name: '2nd Service', startTime: '10:00' });
    await models.SmsLog.deleteMany({});
    await sms.runScheduledSend('saturday_invite', { today: saturday });
    log = await models.SmsLog.findOne().lean();
    expect(log.body).toContain('Services start at 8:00 AM and 10:00 AM.');
  });
});

describe('usher Today screen', () => {
  const sunday = new Date('2026-09-27T10:00:00Z');
  const count = (overrides) => ({ men: 40, women: 60, teens: 10, children: 20, ...overrides });

  it('starts with the one default service and nothing recorded', async () => {
    const t = await todaySvc.getUsherToday({ today: sunday });
    expect(t.isSunday).toBe(true);
    expect(t.services.map((s) => s.key)).toEqual(['sunday']);
    expect(t.attendance).toEqual({ sunday: { recorded: false } });
    expect(t.firstTimers).toBe(0);
    expect(t.lastServiceDay).toBeNull();
  });

  it("adds up today's headcount, cards and returning visitors across services", async () => {
    const { Attendance } = models;
    await churchSvc.createService({ name: '2nd Service', startTime: '10:00' });
    await Attendance.create({ serviceDate: new Date('2026-09-20'), service: 'sunday', ...count() });
    await Attendance.create({ serviceDate: new Date('2026-09-27'), service: 'sunday', ...count() });

    await svc.createFromCard(card({ firstName: 'Kemi', lastName: 'Adebayo' }));
    await svc.createFromCard(
      card({
        phone: '0901 000 0102',
        firstName: 'Tunde',
        lastName: 'Bello',
        service: '2nd-service',
      }),
    );
    const earlier = await svc.createFromCard(
      card({ phone: '0705 000 0103', serviceDate: new Date('2026-09-20T09:00:00Z') }),
    );
    await svc.recordReturningVisit({
      personId: String(earlier._id),
      service: 'sunday',
      serviceDate: sunday,
    });

    const t = await todaySvc.getUsherToday({ today: sunday });
    expect(t.attendance).toEqual({
      sunday: { recorded: true, total: 130 },
      '2nd-service': { recorded: false },
    });
    expect(t.headcountToday).toBe(130);
    expect(t.lastServiceDay.total).toBe(130);
    expect(t.firstTimers).toBe(2);
    expect(t.cardsByService).toEqual({ sunday: 1, '2nd-service': 1 });
    expect(t.returning).toBe(1);
    expect(t.recentInitials).toEqual(['TB', 'KA']);
    expect(JSON.stringify(t)).not.toContain('+234');
  });
});
