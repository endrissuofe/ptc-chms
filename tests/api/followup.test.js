import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * The follow-up list, the First timers screen, moving people into Members, prayer requests and
 * the dashboard, against a throwaway in-memory MongoDB.
 */
let mongod;
let newcomers;
let followups;
let prayer;
let dashboard;
let broadcasts;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_followup_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  newcomers = await import('@/services/newcomer.service');
  followups = await import('@/services/followup.service');
  prayer = await import('@/services/prayer.service');
  dashboard = await import('@/services/dashboard.service');
  broadcasts = await import('@/services/broadcast.service');
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
const sunday = (d) => new Date(`2026-${d}T09:00:00Z`);
const TUESDAY = new Date('2026-09-22T12:00:00Z');

let phoneSeq = 100;
const card = (overrides = {}) => ({
  firstName: 'Kemi',
  lastName: 'Adebayo',
  phone: `0806 000 0${phoneSeq++}`,
  smsConsent: true,
  cardUnclear: false,
  service: 'sunday',
  serviceDate: sunday('09-20'),
  ...overrides,
});
const log = (person, outcome, at) =>
  followups.logFollowUp(
    { personId: String(person._id), outcome, channel: 'call', callerName: 'Sis. Deborah' },
    worker,
    at,
  );

describe('follow-up list', () => {
  it('lists who still needs a call, longest waiting first, and moves them once reached', async () => {
    const recent = await newcomers.createFromCard(card({ firstName: 'Recent' }));
    const older = await newcomers.createFromCard(
      card({ firstName: 'Older', serviceDate: sunday('09-13') }),
    );

    let list = await followups.listFollowUps({ today: TUESDAY });
    expect(list.toCall.map((p) => p.firstName)).toEqual(['Older', 'Recent']);
    expect(list.toCall[0]).toMatchObject({ days: 9, overdue: true, tried: false });
    expect(list.toCall[1]).toMatchObject({ days: 2, overdue: false });
    expect(list.stats).toMatchObject({ toCall: 2, overdue: 1 });

    await log(older, 'reached', new Date('2026-09-21T10:00:00Z'));
    await log(recent, 'no_answer', new Date('2026-09-21T11:00:00Z'));

    list = await followups.listFollowUps({ today: TUESDAY });
    expect(list.toCall.map((p) => p.firstName)).toEqual(['Recent']);
    expect(list.toCall[0]).toMatchObject({ tried: true, lastOutcome: 'no_answer' });
    expect(list.called.map((p) => [p.firstName, p.state])).toEqual([['Older', 'reached']]);

    const entry = await models.FollowUp.findOne({ person: older._id }).lean();
    expect(entry.callerName).toBe('Sis. Deborah');
  });

  it('puts someone back on the list when they visit again after being reached', async () => {
    const p = await newcomers.createFromCard(card({ serviceDate: sunday('09-13') }));
    await log(p, 'reached', new Date('2026-09-15T10:00:00Z'));
    await newcomers.recordReturningVisit({
      personId: String(p._id),
      service: 'sunday',
      serviceDate: sunday('09-20'),
    });
    const list = await followups.listFollowUps({ today: TUESDAY });
    expect(list.toCall.map((i) => [i.firstName, i.stage])).toEqual([['Kemi', 'second_timer']]);
  });

  it('keeps a wrong number off the "to call" list', async () => {
    const p = await newcomers.createFromCard(card());
    await log(p, 'wrong_number', new Date('2026-09-21T10:00:00Z'));
    const list = await followups.listFollowUps({ today: TUESDAY });
    expect(list.toCall).toHaveLength(0);
    expect(list.called[0].state).toBe('wrong_number');
  });

  it('marks people Lost after six weeks away and stops asking for a call', async () => {
    await newcomers.createFromCard(card({ serviceDate: sunday('08-02') }));
    const list = await followups.listFollowUps({ today: TUESDAY });
    expect(list.toCall).toHaveLength(0);
    expect(list.all[0].stage).toBe('lost');
  });
});

describe('moving first timers into Members', () => {
  it('offers people who first came over a month ago', async () => {
    await newcomers.createFromCard(card({ firstName: 'Old', serviceDate: sunday('08-16') }));
    await newcomers.createFromCard(card({ firstName: 'New', serviceDate: sunday('09-20') }));
    const ready = await newcomers.readyToMove({ today: TUESDAY });
    expect(ready.map((p) => p.firstName)).toEqual(['Old']);
  });

  it('adds them to Members, links anyone already there, and takes them out of follow-up', async () => {
    const fresh = await newcomers.createFromCard(
      card({ firstName: 'Tolu', birthDay: 14, birthMonth: 10 }),
    );
    const known = await newcomers.createFromCard(card({ firstName: 'Ada', lastName: 'Eze' }));
    const existing = await models.Member.create({
      firstName: 'ada',
      lastName: 'EZE',
      phone: known.phone,
      source: 'csv',
    });

    const result = await newcomers.moveToMembers([fresh._id, known._id].map(String), worker);
    expect(result).toEqual({ moved: 2, added: 1, linked: 1 });
    expect(await models.Member.countDocuments()).toBe(2);

    const tolu = await models.Member.findOne({ firstName: 'Tolu' }).lean();
    expect(tolu).toMatchObject({ source: 'first_timer', birthDay: 14, birthMonth: 10 });
    expect(String(tolu.person)).toBe(String(fresh._id));
    const ada = await models.Member.findById(existing._id).lean();
    expect(String(ada.person)).toBe(String(known._id));

    // Out of follow-up, the default table and first-timer messages; still findable.
    expect((await followups.listFollowUps({ today: TUESDAY })).all).toHaveLength(0);
    const table = await newcomers.listPeople({ today: TUESDAY });
    expect(table.items).toHaveLength(0);
    expect(table.counts).toMatchObject({ all: 0, moved: 2 });
    const moved = await newcomers.listPeople({ view: 'moved', today: TUESDAY });
    expect(moved.items).toHaveLength(2);
    expect(await broadcasts.audienceRecipients('first_timers', TUESDAY)).toHaveLength(0);

    // Running it again changes nothing.
    expect(await newcomers.moveToMembers([String(fresh._id)], worker)).toEqual({
      moved: 0,
      added: 0,
      linked: 0,
    });
  });
});

describe('First timers screen', () => {
  it('filters by stage, search and unclear cards, with counts', async () => {
    const kemi = await newcomers.createFromCard(card());
    await newcomers.recordReturningVisit({
      personId: String(kemi._id),
      service: 'sunday',
      serviceDate: sunday('09-27'),
    });
    await newcomers.createFromCard(card({ firstName: 'Bayo', lastName: 'Ola', cardUnclear: true }));

    const all = await newcomers.listPeople({ today: TUESDAY });
    expect(all.counts).toMatchObject({ all: 2, first_timer: 1, second_timer: 1, unclear: 1 });
    expect((await newcomers.listPeople({ view: 'second_timer', today: TUESDAY })).items).toEqual([
      expect.objectContaining({ firstName: 'Kemi' }),
    ]);
    expect((await newcomers.listPeople({ view: 'unclear', today: TUESDAY })).items).toEqual([
      expect.objectContaining({ firstName: 'Bayo' }),
    ]);
    expect((await newcomers.listPeople({ q: 'ola', today: TUESDAY })).total).toBe(1);
  });

  it('corrects a card’s details', async () => {
    const p = await newcomers.createFromCard(
      card({ cardUnclear: true, birthDay: 3, birthMonth: 4 }),
    );
    const fixed = await newcomers.updateDetails(String(p._id), {
      lastName: 'Adebayo-Smith',
      phone: '0803 111 2222',
      birthDay: null,
      birthMonth: null,
      cardUnclear: false,
    });
    expect(fixed).toMatchObject({
      lastName: 'Adebayo-Smith',
      phone: '+2348031112222',
      birthDay: null,
      cardUnclear: false,
    });
  });

  it('shows prayer requests on a profile only when asked for', async () => {
    const p = await newcomers.createFromCard(card({ prayerRequest: 'For my family' }));
    expect((await newcomers.getProfile(String(p._id))).prayerRequests).toBeNull();
    const pastorView = await newcomers.getProfile(String(p._id), { includePrayer: true });
    expect(pastorView.prayerRequests.map((r) => r.text)).toEqual(['For my family']);
    await expect(newcomers.getProfile('not-an-id')).rejects.toMatchObject({ status: 404 });
  });
});

describe('prayer requests', () => {
  it('counts each tab and changes status', async () => {
    await newcomers.createFromCard(card({ prayerRequest: 'Healing' }));
    await newcomers.createFromCard(card({ firstName: 'Ada', prayerRequest: 'A job' }));
    let list = await prayer.listPrayerRequests();
    expect(list.counts).toEqual({ new: 2, prayed: 0, needs_visit: 0, all: 2 });
    expect(list.items[0].person.firstName).toBeDefined();

    await prayer.setPrayerStatus(String(list.items[0]._id), 'prayed', worker);
    list = await prayer.listPrayerRequests({ status: 'prayed' });
    expect(list.items).toHaveLength(1);
    expect(list.counts).toMatchObject({ new: 1, prayed: 1 });
  });
});

describe('dashboard', () => {
  it('shows the newcomer journey and what needs attention', async () => {
    const back = await newcomers.createFromCard(card({ serviceDate: sunday('08-16') }));
    await newcomers.recordReturningVisit({
      personId: String(back._id),
      service: 'sunday',
      serviceDate: sunday('09-20'),
    });
    await newcomers.createFromCard(card({ firstName: 'Ada', prayerRequest: 'Peace' }));
    await newcomers.createFromCard(card({ firstName: 'Bayo', cardUnclear: true }));
    await newcomers.moveToMembers([String(back._id)], worker, new Date('2026-09-21T10:00:00Z'));

    const d = await dashboard.getDashboard({ today: TUESDAY });
    expect(d.funnel).toEqual({
      received: 3,
      cameBack: 1,
      regular: 0,
      believersClass: 0,
      joined: 1,
    });
    expect(d.secondVisitRate).toBe(33.3);
    expect(d.firstTimersThisMonth).toBe(2);
    expect(d.movedThisMonth).toBe(1);
    expect(d.needsAttention).toMatchObject({ unclear: 1, newPrayer: 1, toCall: 2, readyToMove: 0 });
  });
});
