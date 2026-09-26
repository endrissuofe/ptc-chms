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
  const admin = { id: undefined, role: 'admin' };
  const pastor = { id: undefined, role: 'pastor' };
  const usher = { id: undefined, role: 'usher' };
  const sunday = new Date('2026-09-27T10:00:00Z');
  const wednesday = new Date('2026-09-23T18:00:00Z');

  it('starts with Sunday Service at 08:00 and Midweek Service on Wednesdays', async () => {
    const all = await churchSvc.listServices();
    expect(all.map((s) => [s.key, s.days, s.startTime])).toEqual([
      ['sunday', [0], '08:00'],
      ['midweek', [3], '18:30'],
    ]);
    expect((await churchSvc.listServices({ on: sunday })).map((s) => s.key)).toEqual(['sunday']);
    expect((await churchSvc.listServices({ on: wednesday })).map((s) => s.key)).toEqual([
      'midweek',
    ]);
  });

  it('adds regular services with unique keys that survive renaming', async () => {
    const added = await churchSvc.createService(
      { kind: 'regular', name: 'Sunday Service', startTime: '10:00', days: [0] },
      admin,
    );
    expect(added).toMatchObject({ key: 'sunday-service', kind: 'regular', active: true });
    const renamed = await churchSvc.updateService('sunday-service', { name: '2nd Service' }, admin);
    expect(renamed).toMatchObject({ key: 'sunday-service', name: '2nd Service' });
    expect((await churchSvc.listServices({ on: sunday })).map((s) => s.key)).toEqual([
      'sunday',
      'sunday-service',
    ]);
  });

  it('holds a special service only on its date', async () => {
    const special = await churchSvc.createService(
      { kind: 'special', name: 'Thanksgiving Service', startTime: '10:00', date: '2026-09-26' },
      pastor,
    );
    expect(special).toMatchObject({ key: 'thanksgiving-service', kind: 'special' });
    const saturday = new Date('2026-09-26T12:00:00Z');
    expect((await churchSvc.listServices({ on: saturday })).map((s) => s.key)).toEqual([
      'thanksgiving-service',
    ]);
    expect((await churchSvc.listServices({ on: sunday })).map((s) => s.key)).toEqual(['sunday']);
  });

  it('lets pastors manage special services but not regular ones', async () => {
    await expect(
      churchSvc.createService(
        { kind: 'regular', name: 'Friday Vigil', startTime: '22:00', days: [5] },
        pastor,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      churchSvc.updateService('sunday', { startTime: '07:00' }, pastor),
    ).rejects.toMatchObject({ status: 403 });
    await churchSvc.createService(
      { kind: 'special', name: 'Crusade', startTime: '17:00', date: '2026-10-10' },
      pastor,
    );
    const moved = await churchSvc.updateService('crusade', { date: '2026-10-11' }, pastor);
    expect(new Date(moved.date).toISOString()).toBe('2026-10-11T00:00:00.000Z');
    await expect(churchSvc.updateService('crusade', { days: [0] }, pastor)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('keeps at least one regular service active', async () => {
    await churchSvc.updateService('midweek', { active: false }, admin);
    await expect(churchSvc.updateService('sunday', { active: false }, admin)).rejects.toMatchObject(
      { status: 400 },
    );
    expect((await churchSvc.listServices()).map((s) => s.key)).toEqual(['sunday']);
    expect(await churchSvc.listServices({ includeInactive: true })).toHaveLength(2);
  });

  it('limits ushers to services held that day, within the last week', async () => {
    const check = (key, date) => churchSvc.requireActiveService(key, date, usher, sunday);
    await expect(check('sunday', sunday)).resolves.toMatchObject({ key: 'sunday' });
    await expect(check('midweek', wednesday)).resolves.toMatchObject({ key: 'midweek' });
    await expect(check('midweek', sunday)).rejects.toMatchObject({ status: 400 });
    await expect(check('sunday', new Date('2026-09-13T10:00:00Z'))).rejects.toMatchObject({
      status: 400,
    });
    await expect(check('sunday', new Date('2026-10-04T10:00:00Z'))).rejects.toMatchObject({
      status: 400,
    });
    // Pastors and admins can correct older records.
    await expect(
      churchSvc.requireActiveService('sunday', new Date('2026-09-13'), admin, sunday),
    ).resolves.toBeTruthy();
  });

  it('rejects attendance and cards for unknown or switched-off services', async () => {
    const att = await import('@/services/attendance.service');
    const counts = { men: 1, women: 1, teens: 0, children: 0, serviceDate: sunday };
    await expect(att.recordAttendance({ ...counts, service: 'first' })).rejects.toMatchObject({
      status: 400,
    });
    await churchSvc.createService(
      { kind: 'regular', name: 'Evening', startTime: '17:00', days: [0] },
      admin,
    );
    await churchSvc.updateService('evening', { active: false }, admin);
    await expect(svc.createFromCard(card({ service: 'evening' }))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("puts only tomorrow's service times into the Saturday invite", async () => {
    await svc.createFromCard(card({ serviceDate: new Date('2026-09-20T09:00:00Z') }));
    const saturday = new Date('2026-09-26T10:00:00Z');
    await sms.runScheduledSend('saturday_invite', { today: saturday });
    let log = await models.SmsLog.findOne().lean();
    expect(log.body).toContain('Service starts at 8:00 AM.');
    expect(log.body).not.toContain('6:30 PM');

    await churchSvc.createService(
      { kind: 'regular', name: '2nd Service', startTime: '10:00', days: [0] },
      admin,
    );
    await models.SmsLog.deleteMany({});
    await sms.runScheduledSend('saturday_invite', { today: saturday });
    log = await models.SmsLog.findOne().lean();
    expect(log.body).toContain('Services start at 8:00 AM and 10:00 AM.');
  });
});

describe('usher Today screen', () => {
  const sunday = new Date('2026-09-27T10:00:00Z');
  const count = (overrides) => ({ men: 40, women: 60, teens: 10, children: 20, ...overrides });

  it("shows only Sunday's service on a Sunday, with nothing recorded", async () => {
    const t = await todaySvc.getUsherToday({ today: sunday });
    expect(t.isSunday).toBe(true);
    expect(t.services.map((s) => s.key)).toEqual(['sunday']);
    expect(t.attendance).toEqual({ sunday: { recorded: false } });
    expect(t.firstTimers).toBe(0);
    expect(t.lastServiceDay).toBeNull();
  });

  it("adds up today's headcount, cards and returning visitors across services", async () => {
    const { Attendance } = models;
    await churchSvc.createService({
      kind: 'regular',
      name: '2nd Service',
      startTime: '10:00',
      days: [0],
    });
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

describe('Record Attendance screen', () => {
  const sunday = new Date('2026-09-27T10:00:00Z');
  const counts = { men: 40, women: 60, teens: 10, children: 20 };

  it('pre-fills a saved count and shows the same service last time', async () => {
    const att = await import('@/services/attendance.service');
    await att.recordAttendance({
      ...counts,
      service: 'sunday',
      serviceDate: new Date('2026-09-20T10:00:00Z'),
    });
    await att.recordAttendance({ ...counts, men: 50, service: 'sunday', serviceDate: sunday });

    const form = await att.getAttendanceForm({ today: sunday });
    expect(form.services.map((s) => s.key)).toEqual(['sunday']);
    expect(form.byService.sunday.saved).toMatchObject({ men: 50, women: 60, note: '' });
    expect(form.byService.sunday.previous).toMatchObject({ total: 130 });
  });

  it('replaces the count when an usher saves a correction', async () => {
    const att = await import('@/services/attendance.service');
    await att.recordAttendance({ ...counts, service: 'sunday', serviceDate: sunday });
    await att.recordAttendance({
      ...counts,
      women: 61,
      note: 'Recounted',
      service: 'sunday',
      serviceDate: sunday,
    });

    expect(await models.Attendance.countDocuments()).toBe(1);
    const form = await att.getAttendanceForm({ today: sunday });
    expect(form.byService.sunday.saved).toMatchObject({ women: 61, note: 'Recounted' });
    expect(form.byService.sunday.previous).toBeNull();
  });
});

describe('services on different days', () => {
  it('shows no service on a Monday, and when the next one is', async () => {
    const t = await todaySvc.getUsherToday({ today: new Date('2026-09-28T09:00:00Z') });
    expect(t.services).toEqual([]);
    expect(new Date(t.nextServiceDay.serviceDate).toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(t.nextServiceDay.services.map((s) => s.key)).toEqual(['midweek']);
  });

  it('offers the last week of service days for late attendance entry', async () => {
    const att = await import('@/services/attendance.service');
    const today = new Date('2026-09-27T12:00:00Z');
    const form = await att.getAttendanceForm({ today });
    expect(form.serviceDays.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-09-27',
      '2026-09-23',
      '2026-09-20',
    ]);
    expect(form.services.map((s) => s.key)).toEqual(['sunday']);

    const wed = await att.getAttendanceForm({ today, serviceDate: new Date('2026-09-23') });
    expect(wed.services.map((s) => s.key)).toEqual(['midweek']);

    const tooOld = await att.getAttendanceForm({ today, serviceDate: new Date('2026-09-13') });
    expect(tooOld.serviceDate.toISOString().slice(0, 10)).toBe('2026-09-27');
  });
});
