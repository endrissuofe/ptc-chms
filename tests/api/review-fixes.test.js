import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** Rules added after the launch review, against a throwaway in-memory MongoDB. */
let mongod;
let newcomers;
let attendance;
let church;
let members;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_review_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  newcomers = await import('@/services/newcomer.service');
  attendance = await import('@/services/attendance.service');
  church = await import('@/services/churchService.service');
  members = await import('@/services/member.service');
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

const admin = { id: new mongoose.Types.ObjectId().toString(), role: 'admin' };
const card = (overrides = {}) => ({
  firstName: 'Tunde',
  lastName: 'Bakare',
  phone: '0803 000 0101',
  smsConsent: true,
  cardUnclear: false,
  service: 'sunday',
  serviceDate: new Date('2026-09-20T09:00:00Z'),
  ...overrides,
});

describe('search', () => {
  it('finds a full name, a single name or part of a phone number', async () => {
    await newcomers.createFromCard(card());
    await newcomers.createFromCard(
      card({ firstName: 'Ada', lastName: 'Eze', phone: '0806 111 2222' }),
    );
    const find = async (q) =>
      (await newcomers.listPeople({ q, today: new Date('2026-09-22') })).items.map(
        (p) => p.firstName,
      );
    expect(await find('Tunde Bakare')).toEqual(['Tunde']);
    expect(await find('bakare tunde')).toEqual(['Tunde']);
    expect(await find('eze')).toEqual(['Ada']);
    expect(await find('0806 111')).toEqual(['Ada']);
    expect(await find('Tunde Eze')).toEqual([]);
  });

  it('works the same on the Members list', async () => {
    await models.Member.create({ firstName: 'Tunde', lastName: 'Bakare', phone: '+2348030000101' });
    expect((await members.listMembers({ q: 'Tunde Bakare' })).items).toHaveLength(1);
  });

  it('filter counts follow the search', async () => {
    await newcomers.createFromCard(card());
    await newcomers.createFromCard(
      card({ firstName: 'Ada', lastName: 'Eze', phone: '0806 111 2222' }),
    );
    const { counts } = await newcomers.listPeople({ q: 'ada', today: new Date('2026-09-22') });
    expect(counts.all).toBe(1);
  });
});

describe('correcting a phone number', () => {
  it('asks before putting someone on a number another person already uses', async () => {
    await newcomers.createFromCard(card());
    const ada = await newcomers.createFromCard(
      card({ firstName: 'Ada', lastName: 'Eze', phone: '0806 111 2222' }),
    );
    await expect(
      newcomers.updateDetails(String(ada._id), { phone: '0803 000 0101' }),
    ).rejects.toMatchObject({ status: 409, details: { matches: [{ firstName: 'Tunde' }] } });
    const shared = await newcomers.updateDetails(String(ada._id), {
      phone: '0803 000 0101',
      sharedPhoneConfirmed: true,
    });
    expect(shared.phone).toBe('+2348030000101');
  });
});

describe('attendance', () => {
  it('can take back a count saved by mistake', async () => {
    // The most recent Sunday (today if it's Sunday): always within the 7-day window.
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - day.getUTCDay());
    const input = {
      service: 'sunday',
      serviceDate: day,
      men: 3,
      women: 4,
      teens: 0,
      children: 1,
    };
    await attendance.recordAttendance(input, admin);
    expect(await models.Attendance.countDocuments()).toBe(1);
    expect(await attendance.removeAttendance(input, admin)).toEqual({ removed: 1 });
    expect(await models.Attendance.countDocuments()).toBe(0);
  });
});

describe('special services', () => {
  const iso = (daysFromToday) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysFromToday);
    return d.toISOString().slice(0, 10);
  };

  it('can be dated from a week ago onwards, not earlier', async () => {
    const recent = await church.createService(
      { kind: 'special', name: 'Vigil', startTime: '22:00', date: iso(-3) },
      admin,
    );
    expect(recent.key).toBeTruthy();
    await expect(
      church.createService(
        { kind: 'special', name: 'Old', startTime: '10:00', date: iso(-30) },
        admin,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(church.updateService(recent.key, { date: iso(-30) }, admin)).rejects.toMatchObject(
      {
        status: 400,
      },
    );
  });
});
