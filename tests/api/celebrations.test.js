import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { celebratedOn } from '@/lib/celebrations';
import { readMemberCsv } from '@/lib/members';
import { memberCreateSchema } from '@/lib/validators/member';

/** Birthdays and anniversaries, against a throwaway in-memory MongoDB (mock SMS and email). */
let mongod;
let celebrations;
let members;
let alerts;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_celebrations_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.EMAIL_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  celebrations = await import('@/services/celebration.service');
  members = await import('@/services/member.service');
  alerts = await import('@/services/alerts.service');
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

// Monday 12 October 2026, 9 AM Lagos.
const MONDAY = new Date('2026-10-12T08:00:00Z');
const member = (overrides = {}) =>
  models.Member.create({
    firstName: 'Ada',
    lastName: 'Eze',
    phone: '+2348030000001',
    birthDay: 12,
    birthMonth: 10,
    ...overrides,
  });
const person = (overrides = {}) =>
  models.Person.create({
    firstName: 'Tolu',
    lastName: 'Ade',
    phone: '+2348030000002',
    birthDay: 12,
    birthMonth: 10,
    smsConsent: true,
    firstVisitDate: new Date('2026-09-20'),
    ...overrides,
  });

describe('which days count', () => {
  it('celebrates 29 February on the 28th in years without one', () => {
    expect(celebratedOn(new Date('2027-02-28T09:00:00Z'))).toEqual([
      { day: 28, month: 2 },
      { day: 29, month: 2 },
    ]);
    expect(celebratedOn(new Date('2028-02-28T09:00:00Z'))).toEqual([{ day: 28, month: 2 }]);
    expect(celebratedOn(new Date('2028-02-29T09:00:00Z'))).toEqual([{ day: 29, month: 2 }]);
  });
});

describe('who is celebrated', () => {
  it('finds members and first timers, once each, and leaves out removed and moved people', async () => {
    await member();
    await member({
      firstName: 'Bola',
      phone: '+2348030000003',
      anniversaryDay: 12,
      anniversaryMonth: 10,
      birthDay: 1,
      birthMonth: 1,
    });
    await member({ firstName: 'Gone', phone: '+2348030000004', active: false });
    await person();
    // Also on the Members list (same phone and name): wished once, as a member.
    await person({ firstName: 'Ada', lastName: 'Eze', phone: '+2348030000001' });
    await person({ firstName: 'Moved', phone: '+2348030000005', movedToMembersAt: new Date() });

    const list = await celebrations.celebrantsOn(MONDAY);
    expect(list.map((c) => [c.kind, c.who, c.firstName]).sort()).toEqual(
      [
        ['anniversary', 'member', 'Bola'],
        ['birthday', 'first_timer', 'Tolu'],
        ['birthday', 'member', 'Ada'],
      ].sort(),
    );
  });

  it('sends each wish once a day, only to people who can get SMS', async () => {
    await member();
    await member({ firstName: 'Quiet', phone: '+2348030000006', smsOptOut: true });
    await person({ smsConsent: false });
    await member({
      firstName: 'Bola',
      phone: '+2348030000003',
      birthDay: 1,
      birthMonth: 1,
      anniversaryDay: 12,
      anniversaryMonth: 10,
    });

    const first = await celebrations.sendCelebrationSms({ today: MONDAY });
    expect(first.birthday).toMatchObject({ total: 1, sent: 1 });
    expect(first.anniversary).toMatchObject({ total: 1, sent: 1 });
    const again = await celebrations.sendCelebrationSms({ today: MONDAY });
    expect(again.birthday).toMatchObject({ sent: 0, alreadySent: 1 });

    const log = await models.SmsLog.findOne({ template: 'birthday' }).lean();
    expect(log.body).toMatch(/^Happy birthday, Ada!/);

    await models.SmsTemplate.updateOne({ key: 'anniversary' }, { enabled: false });
    const off = await celebrations.sendCelebrationSms({ today: new Date('2027-10-12T08:00:00Z') });
    expect(off.anniversary).toEqual({ skipped: 'switched off' });
  });

  it('lists the rest of the week in Monday’s email, and says so on the Birthdays screen', async () => {
    await member();
    await member({ firstName: 'Wed', phone: '+2348030000007', birthDay: 14, birthMonth: 10 });
    await alerts.updateAlertSettings({ celebrationEmails: ['media@example.com'] });

    const email = await celebrations.buildCelebrationsEmail({ today: MONDAY });
    expect(email.subject).toBe(
      'Birthdays and anniversaries: 1 celebration today · 1 more this week',
    );
    expect(email.html).toContain('Happy birthday to Ada Eze!');
    expect(email.html).toContain('Wed Eze');

    const sent = await celebrations.sendCelebrationsEmail({ today: MONDAY });
    expect(sent).toMatchObject({ sent: true, to: 1 });
    expect(await celebrations.sendCelebrationsEmail({ today: MONDAY })).toEqual({
      skipped: 'already sent today',
    });

    // A Tuesday with nobody celebrating: no email.
    expect(
      await celebrations.buildCelebrationsEmail({ today: new Date('2026-10-13T08:00:00Z') }),
    ).toBeNull();

    const week = await celebrations.listCelebrations({ from: MONDAY, days: 7 });
    expect(week.map((d) => d.people.length)).toEqual([1, 0, 1, 0, 0, 0, 0]);
  });
});

describe('members by hand and by CSV', () => {
  it('adds and edits members, refusing a second copy of the same person', async () => {
    const m = await members.createMember(
      memberCreateSchema.parse({
        firstName: 'Kemi',
        lastName: 'Ade',
        phone: '0803 111 0000',
        anniversaryDay: 3,
        anniversaryMonth: 6,
      }),
    );
    expect(m).toMatchObject({ phone: '+2348031110000', source: 'manual', anniversaryDay: 3 });
    await expect(
      members.createMember(
        memberCreateSchema.parse({ firstName: 'kemi', lastName: 'ADE', phone: '0803 111 0000' }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    const edited = await members.updateMember(String(m._id), {
      birthDay: 9,
      birthMonth: 12,
      smsOptOut: true,
    });
    expect(edited).toMatchObject({ birthDay: 9, birthMonth: 12, smsOptOut: true });
    expect(() =>
      memberCreateSchema.parse({
        firstName: 'X',
        phone: '0803 111 0001',
        birthDay: 31,
        birthMonth: 2,
      }),
    ).toThrow();
  });

  it('reads an Anniversary column in the upload', () => {
    const rows = readMemberCsv(
      'Name,Phone,Birthday,Wedding Anniversary\nAda Eze,0803 000 0001,12 Oct,3/6\nBola Ade,0803 000 0002,,sometime',
    );
    expect(rows[0]).toMatchObject({ anniversaryDay: 3, anniversaryMonth: 6 });
    expect(rows[1]).toMatchObject({ anniversaryUnread: true });
  });
});
