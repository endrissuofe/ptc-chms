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
let memberSvc;
let broadcastSvc;
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
  memberSvc = await import('@/services/member.service');
  broadcastSvc = await import('@/services/broadcast.service');
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
      details: { matches: [{ firstName: 'Kemi', lastName: 'Adebayo', visitCount: 1 }] },
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

describe('shared phone numbers and returning cards', () => {
  it('saves a second person on a shared phone only after the usher confirms', async () => {
    await svc.createFromCard(card({ firstName: 'Chinedu', lastName: 'Okafor' }));
    const wife = card({ firstName: 'Ngozi', lastName: 'Okafor' });
    await expect(svc.createFromCard(wife)).rejects.toMatchObject({ status: 409 });

    const saved = await svc.createFromCard({ ...wife, newPersonConfirmed: true });
    expect(saved.firstName).toBe('Ngozi');
    const matches = await svc.findByPhone('0806 000 0101');
    expect(matches.map((m) => m.firstName)).toEqual(['Chinedu', 'Ngozi']);
  });

  it('treats the same name on the same phone as a duplicate even when confirmed', async () => {
    await svc.createFromCard(card());
    await expect(
      svc.createFromCard(card({ firstName: ' kemi ', newPersonConfirmed: true })),
    ).rejects.toMatchObject({ status: 409 });
    expect(await models.Person.countDocuments()).toBe(1);
  });

  it("uses a returning visitor's card without overwriting what we know", async () => {
    const p = await svc.createFromCard(
      card({ email: 'kemi@example.com', smsConsent: false, serviceDate: new Date('2026-09-20') }),
    );
    const visit = {
      personId: String(p._id),
      service: 'sunday',
      serviceDate: new Date('2026-09-27T09:00:00Z'),
      card: {
        email: 'other@example.com',
        birthDay: 14,
        birthMonth: 10,
        smsConsent: true,
        prayerRequest: 'New job',
      },
    };
    await svc.recordReturningVisit(visit);
    await svc.recordReturningVisit(visit); // a double tap changes nothing

    const person = await models.Person.findById(p._id).lean();
    expect(person).toMatchObject({
      email: 'kemi@example.com',
      birthDay: 14,
      birthMonth: 10,
      smsConsent: true,
      stage: 'second_timer',
      visitCount: 2,
    });
    expect(await models.PrayerRequest.countDocuments({ person: p._id })).toBe(1);
  });

  it('counts cards per service for the card entry screen', async () => {
    const today = new Date('2026-09-27T12:00:00Z');
    await svc.createFromCard(card());
    await svc.createFromCard(card({ phone: '0901 000 0102', firstName: 'Tunde' }));
    const entry = await svc.getCardEntry({ today });
    expect(entry.services.map((s) => s.key)).toEqual(['sunday']);
    expect(entry.cardsByService).toEqual({ sunday: 2 });
  });
});

describe('SMS', () => {
  const sunday = new Date('2026-09-20T09:00:00Z');

  it('thanks a first timer straight after the card, once, and only if they agreed', async () => {
    const kemi = await svc.createFromCard(card({ serviceDate: sunday }));
    const tunde = await svc.createFromCard(
      card({ phone: '0901 000 0102', firstName: 'Tunde', smsConsent: false, serviceDate: sunday }),
    );
    const first = await sms.sendCardMessage({
      personId: kemi._id,
      templateKey: 'sunday_thanks',
      serviceDate: sunday,
    });
    expect(first).toMatchObject({ sent: 1 });
    const again = await sms.sendCardMessage({
      personId: kemi._id,
      templateKey: 'sunday_thanks',
      serviceDate: sunday,
    });
    expect(again).toMatchObject({ sent: 0, alreadySent: 1 });
    expect(
      await sms.sendCardMessage({
        personId: tunde._id,
        templateKey: 'sunday_thanks',
        serviceDate: sunday,
      }),
    ).toMatchObject({ skipped: true });

    const log = await models.SmsLog.findOne().lean();
    expect(log.body).toBe(
      'Hi Kemi, thank you for worshipping with us at RCCG Peculiar Treasure Chapel. You are welcome here, and we look forward to seeing you again. God bless you!',
    );
    expect(log).toMatchObject({ recipientKey: `p:${kemi._id}`, name: 'Kemi Adebayo' });
  });

  it('welcomes a returning visitor back, and respects the template switch', async () => {
    const p = await svc.createFromCard(card({ serviceDate: sunday }));
    await sms.updateTemplate('welcome_back', { body: 'Welcome back {FirstName}!', enabled: true });
    const res = await sms.sendCardMessage({
      personId: p._id,
      templateKey: 'welcome_back',
      serviceDate: new Date('2026-09-27T09:00:00Z'),
    });
    expect(res.sent).toBe(1);
    expect((await models.SmsLog.findOne({ template: 'welcome_back' }).lean()).body).toBe(
      'Welcome back Kemi!',
    );

    await sms.updateTemplate('welcome_back', { body: 'Welcome back {FirstName}!', enabled: false });
    const off = await sms.sendCardMessage({
      personId: p._id,
      templateKey: 'welcome_back',
      serviceDate: new Date('2026-10-04T09:00:00Z'),
    });
    expect(off).toMatchObject({ skipped: true });
  });

  it('refuses template wording with tags it cannot fill', async () => {
    await expect(
      sms.updateTemplate('sunday_thanks', { body: 'Hi {Firstname}', enabled: true }),
    ).rejects.toMatchObject({ status: 400 });
    const saved = await sms.updateTemplate('sunday_thanks', {
      body: 'Hi {FirstName}, welcome!',
      enabled: false,
    });
    expect(saved).toMatchObject({ body: 'Hi {FirstName}, welcome!', enabled: false });
  });

  it('shows the automatic messages and the next Saturday invite', async () => {
    await svc.createFromCard(card({ serviceDate: sunday }));
    const overview = await sms.getSmsOverview({ today: new Date('2026-09-22T12:00:00Z') });
    expect(overview.templates.map((t) => t.key)).toEqual([
      'sunday_thanks',
      'welcome_back',
      'saturday_invite',
      'birthday',
      'anniversary',
    ]);
    expect(overview.invite).toMatchObject({ toSend: 1 });
    expect(overview.live).toBe(false);
  });
});

describe('members', () => {
  const csv =
    'Name,Phone,Gender,Birthday\n' +
    'Chinedu Okafor,0803 000 0001,M,14/10\n' +
    'Ngozi Okafor,0803 000 0001,F,\n' +
    'Chinedu Okafor,08030000001,M,14/10\n' +
    'Nobody,123,,\n';

  it('previews an import without saving, then saves new members only once', async () => {
    const svcM = memberSvc;
    const preview = await svcM.previewImport(csv);
    expect(preview.summary).toEqual({ total: 4, new: 2, update: 0, duplicate: 1, invalid: 1 });
    expect(await models.Member.countDocuments()).toBe(0);

    expect(await svcM.importMembers(csv)).toEqual({ added: 2, updated: 0, skipped: 2 });
    const again = await svcM.previewImport(csv);
    expect(again.summary).toMatchObject({ new: 0, update: 2 });
    expect(await svcM.importMembers(csv)).toMatchObject({ added: 0, updated: 2 });
    expect(await models.Member.countDocuments()).toBe(2);
  });

  it('fills a missing birthday on re-import but never overwrites one', async () => {
    const svcM = memberSvc;
    await svcM.importMembers('Name,Phone,Birthday\nAda Obi,0805 000 0111,\n');
    await svcM.importMembers('Name,Phone,Birthday\nAda Obi,0805 000 0111,3 March\n');
    await svcM.importMembers('Name,Phone,Birthday\nAda Obi,0805 000 0111,9 May\n');
    expect(await models.Member.findOne().lean()).toMatchObject({ birthDay: 3, birthMonth: 3 });
  });

  it('finds members by name or phone', async () => {
    const svcM = memberSvc;
    await svcM.importMembers(csv);
    expect((await svcM.listMembers({ q: 'ngozi' })).items.map((m) => m.firstName)).toEqual([
      'Ngozi',
    ]);
    expect((await svcM.listMembers({ q: '0803 000' })).total).toBe(2);
  });
});

describe('broadcasts', () => {
  const memberCsv =
    'Name,Phone\nChinedu Okafor,0803 000 0001\nNgozi Okafor,0803 000 0001\nAda Obi,0805 000 0111\n';

  async function withMembers() {
    await memberSvc.importMembers(memberCsv);
  }

  it('previews people and SMS pages before anything is sent', async () => {
    await withMembers();
    const b = broadcastSvc;
    const preview = await b.previewBroadcast({
      audience: 'members',
      body: 'Hi {FirstName}, see you Sunday!',
    });
    expect(preview).toMatchObject({ count: 3, pages: 1, units: 3 });
    expect(preview.sample).toMatch(/^Hi (Chinedu|Ngozi), see you Sunday!$/);
    expect(await models.SmsLog.countDocuments()).toBe(0);
  });

  it('sends in batches until done, and never twice to the same person', async () => {
    await withMembers();
    const b = broadcastSvc;
    const { id, total } = await b.createBroadcast({ audience: 'members', body: 'Hi {FirstName}!' });
    expect(total).toBe(3);
    let p;
    do p = await b.sendBroadcastBatch(id);
    while (!p.done);
    expect(p).toMatchObject({ total: 3, processed: 3, sent: 3, failed: 0, done: true });
    expect(await b.sendBroadcastBatch(id)).toMatchObject({ sent: 3, done: true });
    expect(await models.SmsLog.countDocuments({ run: `broadcast:${id}` })).toBe(3);
    const [run] = await sms.recentRuns();
    expect(run).toMatchObject({
      run: `broadcast:${id}`,
      sent: 3,
      broadcast: { audience: 'members' },
    });
  });

  it('can reach everyone without doubling someone who is a member and a first timer', async () => {
    await withMembers();
    await svc.createFromCard(card({ firstName: 'Ada', lastName: 'Obi', phone: '0805 000 0111' }));
    await svc.createFromCard(
      card({ phone: '0901 000 0102', firstName: 'Tunde', lastName: 'Bello' }),
    );
    const b = broadcastSvc;
    expect(await b.audienceCounts()).toEqual({ members: 3, first_timers: 2, everyone: 4 });
  });

  it('refuses tags a broadcast cannot fill', async () => {
    const b = broadcastSvc;
    await expect(
      b.previewBroadcast({ audience: 'members', body: 'Hi {ServiceTimes}' }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
