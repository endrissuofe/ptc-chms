import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** Finding and merging members entered twice, against a throwaway in-memory MongoDB. */
let mongod;
let members;
let cleanup;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_member_duplicates_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.EMAIL_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  members = await import('@/services/member.service');
  cleanup = await import('@/services/cleanup.service');
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

const member = (firstName, lastName, extra = {}) =>
  models.Member.create({ firstName, lastName, phone: '+2348030000001', ...extra });

describe('member duplicates', () => {
  it('lists look-alike names on one phone, not family', async () => {
    await member('Chinedu', 'Okafor');
    await member('Chinedo', 'Okafor');
    await member('Ngozi', 'Okafor');
    await member('Chinedu', 'Okafor', { phone: '+2348030000002' });
    const groups = await members.listPossibleDuplicates();
    expect(groups).toHaveLength(1);
    expect(groups[0].pairs.map((p) => [p.a.firstName, p.b.firstName])).toEqual([
      ['Chinedu', 'Chinedo'],
    ]);
  });

  it('merges: fills blanks, moves links and SMS history, keeps SMS off, takes the other off', async () => {
    const keep = await member('Chinedu', 'Okafor', { address: '1 Kept Street' });
    const person = await models.Person.create({
      firstName: 'Chinedo',
      lastName: 'Okafor',
      phone: '+2348030000001',
      firstVisitDate: new Date('2026-09-06T00:00:00Z'),
    });
    const remove = await member('Chinedo', 'Okafor', {
      address: '2 Other Street',
      birthDay: 14,
      birthMonth: 10,
      smsOptOut: true,
      person: person._id,
    });
    await models.Person.updateOne({ _id: person._id }, { member: remove._id });
    await models.SmsLog.create({
      member: remove._id,
      to: '+2348030000001',
      body: 'Happy birthday',
      provider: 'mock',
      status: 'sent',
    });

    const kept = await members.mergeMembers({ keep: String(keep._id), remove: String(remove._id) });
    expect(kept).toMatchObject({
      address: '1 Kept Street',
      birthDay: 14,
      birthMonth: 10,
      smsOptOut: true,
      active: true,
    });
    expect(String(kept.person)).toBe(String(person._id));
    expect(String((await models.Person.findById(person._id)).member)).toBe(String(keep._id));
    expect(await models.SmsLog.countDocuments({ member: keep._id })).toBe(1);

    const gone = await models.Member.findById(remove._id).lean();
    expect(gone).toMatchObject({ active: false });
    expect(String(gone.mergedInto)).toBe(String(keep._id));
    expect(await members.listPossibleDuplicates()).toEqual([]);
    await expect(
      members.mergeMembers({ keep: String(keep._id), remove: String(remove._id) }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('remembers two people who are not the same', async () => {
    const a = await member('Chinedu', 'Okafor');
    const b = await member('Chinedo', 'Okafor');
    await members.markNotDuplicates({ a: String(a._id), b: String(b._id) });
    expect(await members.listPossibleDuplicates()).toEqual([]);
    await expect(
      members.mergeMembers({ keep: String(a._id), remove: String(a._id) }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('clean-up of records entered twice', () => {
  const person = (firstName, lastName, extra = {}) =>
    models.Person.create({
      firstName,
      lastName,
      phone: '+2348030000001',
      firstVisitDate: new Date('2026-09-06T00:00:00Z'),
      ...extra,
    });

  it('merges plainly the same person, but not look-alikes or family', async () => {
    await member('Chinedu', 'Okafor', { createdAt: new Date('2026-01-01') });
    await member('Okafor', 'Chinedu', { birthDay: 3, birthMonth: 5 });
    await member('Chinedu Paul', 'Okafor');
    await member('Chinedo', 'Okafor'); // spelling slip: left for a person to check
    await member('Ngozi', 'Okafor'); // family on the same phone
    expect(await cleanup.previewCleanup()).toEqual({
      members: { groups: 1, toMerge: 2 },
      firstTimers: { groups: 0, toMerge: 0 },
    });
    expect(await cleanup.runCleanup()).toEqual({ members: 2, firstTimers: 0 });
    const left = await models.Member.find({ active: true }).lean();
    expect(left.map((m) => m.firstName).sort()).toEqual(['Chinedo', 'Ngozi', 'Okafor']);
    // The fullest record (with the birthday) is the one kept.
    expect(left.find((m) => m.firstName === 'Okafor')).toMatchObject({ birthDay: 3 });
    expect((await cleanup.previewCleanup()).members.toMerge).toBe(0);
  });

  it('merges a first timer entered twice, keeping every visit, call and message', async () => {
    const keep = await person('Ada', 'Eze', { createdAt: new Date('2026-09-06'), address: 'Yaba' });
    const remove = await person('Eze', 'Ada', {
      createdAt: new Date('2026-09-13'),
      firstVisitDate: new Date('2026-09-13T00:00:00Z'),
      smsConsent: true,
      birthDay: 9,
      birthMonth: 9,
    });
    const day = (d) => new Date(`2026-09-${d}T00:00:00Z`);
    await models.Visit.create([
      { person: keep._id, serviceDate: day('06'), service: 'sunday' },
      { person: remove._id, serviceDate: day('06'), service: 'sunday' }, // same visit twice
      { person: remove._id, serviceDate: day('13'), service: 'sunday' },
    ]);
    const worker = new mongoose.Types.ObjectId();
    await models.FollowUp.create({ person: remove._id, worker, outcome: 'reached' });
    await models.PrayerRequest.create({ person: remove._id, text: 'Job' });
    await models.CheckIn.create({ person: remove._id, token: 'tok123456' });

    expect(await cleanup.runCleanup()).toEqual({ members: 0, firstTimers: 1 });
    expect(await models.Person.countDocuments()).toBe(1);
    const kept = await models.Person.findById(keep._id).lean();
    expect(kept).toMatchObject({
      address: 'Yaba',
      birthDay: 9,
      smsConsent: true,
      visitCount: 2,
      stage: 'second_timer',
    });
    expect(await models.Visit.countDocuments({ person: keep._id })).toBe(2);
    expect(await models.FollowUp.countDocuments({ person: keep._id })).toBe(1);
    expect(await models.PrayerRequest.countDocuments({ person: keep._id })).toBe(1);
    expect(await models.CheckIn.countDocuments({ person: keep._id })).toBe(1);
    const backup = await mongoose.connection.db.collection('mergedpeople').findOne();
    expect(String(backup.mergedInto)).toBe(String(keep._id));
    expect(String(backup._id)).toBe(String(remove._id));
  });
});
