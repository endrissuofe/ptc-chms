import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** Finding and merging members entered twice, against a throwaway in-memory MongoDB. */
let mongod;
let members;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_member_duplicates_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.EMAIL_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
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
