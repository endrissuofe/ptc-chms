import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * Service tests against a throwaway in-memory MongoDB.
 * They cover the rules that matter most on a Sunday: duplicate phones,
 * returning visitors, and never sending the same SMS twice.
 */
let mongod;
let svc;
let sms;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_test');
  process.env.SMS_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  svc = await import('@/services/newcomer.service');
  sms = await import('@/services/sms.service');
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
  service: 'first',
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
      service: 'first',
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
