import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/** Invite links, sign-ups, approval, My account and who gets the emails (mock email). */
let mongod;
let users;
let alerts;
let followups;
let validators;
let models;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_signup_test');
  process.env.EMAIL_PROVIDER = 'mock';
  process.env.SMS_PROVIDER = 'mock';
  process.env.LOG_LEVEL = 'silent';
  users = await import('@/services/user.service');
  alerts = await import('@/services/alerts.service');
  followups = await import('@/services/followup.service');
  validators = await import('@/lib/validators/user');
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

const admin = () =>
  users.createUser(
    validators.newUserSchema.parse({
      username: 'admin',
      displayName: 'Church Admin',
      role: 'admin',
      password: 'faith-4821-dove',
      email: 'Admin@Example.com',
    }),
  );

const tokenFor = async (role) => {
  const link = (await users.listJoinLinks()).find((l) => l.role === role);
  return link.url.split('/join/')[1];
};

const join = async (overrides = {}) =>
  users.signUp(
    validators.joinSchema.parse({
      token: await tokenFor('followup'),
      displayName: 'Grace Okafor',
      phone: '0803 111 2222',
      email: 'grace.okafor@example.com',
      password: 'hope-1234-light',
      ...overrides,
    }),
  );

describe('invite links and sign-ups', () => {
  it('gives each team one link (never admin), and a new link stops the old one', async () => {
    const links = await users.listJoinLinks();
    expect(links.map((l) => l.role)).toEqual(['usher', 'followup', 'prayer', 'media', 'pastor']);
    const old = await tokenFor('usher');
    expect(await users.findJoinLink(old)).toMatchObject({ role: 'usher' });
    await users.resetJoinLink('usher');
    expect(await users.findJoinLink(old)).toBeNull();
    expect(await users.findJoinLink(await tokenFor('usher'))).toMatchObject({ role: 'usher' });
  });

  it('keeps a sign-up waiting until approved, and emails the admins', async () => {
    await admin();
    expect(await join()).toEqual({ team: 'Follow-up team' });

    const { users: approved, pending } = await users.listUsers();
    expect(approved).toHaveLength(1);
    expect(pending).toHaveLength(1);
    const p = pending[0];
    expect(p).toMatchObject({
      username: 'grace.okafor',
      email: 'grace.okafor@example.com',
      phone: '+2348031112222',
      role: 'followup',
      active: false,
      personal: true,
      alerts: { followUp: true, celebrations: false },
    });
    const note = await models.EmailLog.findOne({ kind: 'signup' }).lean();
    expect(note.to).toEqual(['admin@example.com']);
    expect(await users.countPending()).toBe(1);
  });

  it('refuses a wrong link or a used email, and quietly ignores bots', async () => {
    await expect(join({ token: 'not-a-real-token-at-all' })).rejects.toMatchObject({
      status: 404,
    });
    await join();
    await expect(join({ displayName: 'Someone Else' })).rejects.toMatchObject({ status: 409 });
    expect(await join({ email: 'bot@example.com', website: 'http://spam' })).toEqual({
      team: 'Follow-up team',
    });
    expect(await models.User.countDocuments()).toBe(1);
  });

  it('approves on another team with that team’s emails, or declines', async () => {
    const me = await admin();
    await join();
    await join({ email: 'tunde@example.com', displayName: 'Tunde Ade', phone: '0803 111 3333' });
    const [grace, tunde] = (await users.listUsers()).pending;

    const ok = await users.approveUser(grace.id, { role: 'media' }, me);
    expect(ok).toMatchObject({
      role: 'media',
      active: true,
      pending: false,
      alerts: { followUp: false, celebrations: true },
    });
    expect(await models.EmailLog.findOne({ kind: 'approved' }).lean()).toMatchObject({
      to: ['grace.okafor@example.com'],
    });

    await users.declineUser(tunde.id);
    expect(await models.User.exists({ _id: tunde.id })).toBeNull();
    await expect(users.declineUser(grace.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('who gets the emails', () => {
  it('sends the follow-up email to the team, copies pastors, and adds other addresses', async () => {
    const a = await admin();
    const add = (username, role, email) =>
      users.createUser(
        validators.newUserSchema.parse({
          username,
          displayName: username,
          role,
          email,
          password: 'faith-4821-dove',
        }),
      );
    await add('caller', 'followup', 'caller@example.com');
    const pastor = await add('pastor', 'pastor', 'pastor@example.com');
    await add('usher', 'usher', 'usher@example.com');
    await add('noemail', 'followup', '');
    await alerts.updateAlertSettings({
      followupEmails: ['inbox@example.com'],
      celebrationEmails: ['media@example.com'],
    });
    const settings = await alerts.getAlertSettings();

    expect(await alerts.alertRecipients('followUp', settings)).toEqual({
      to: ['caller@example.com', 'inbox@example.com'],
      cc: ['pastor@example.com'],
    });
    expect((await alerts.alertRecipients('celebrations', settings)).to).toEqual([
      'admin@example.com',
      'media@example.com',
    ]);

    // The admin switches the pastor off; an usher can never get it.
    await users.updateUser(pastor.id, { alerts: { followUp: false } }, a);
    const usher = (await users.listUsers()).users.find((u) => u.role === 'usher');
    await users.updateUser(usher.id, { alerts: { followUp: true } }, a);
    expect((await alerts.alertRecipients('followUp', settings)).cc).toEqual([]);
    expect((await alerts.alertRecipients('followUp', settings)).to).not.toContain(
      'usher@example.com',
    );
  });
});

describe('my account', () => {
  it('changes details and emails, and a new password needs the current one', async () => {
    const me = await admin();
    expect(() => validators.accountSchema.parse({ newPassword: 'grace-2222-hope' })).toThrow();
    await expect(
      users.updateAccount(me.id, { currentPassword: 'wrong', newPassword: 'grace-2222-hope' }),
    ).rejects.toMatchObject({ status: 400 });

    const saved = await users.updateAccount(me.id, {
      displayName: 'Pastor Admin',
      phone: '0803 999 0000',
      alerts: { followUp: true },
      currentPassword: 'faith-4821-dove',
      newPassword: 'grace-2222-hope',
    });
    expect(saved).toMatchObject({
      displayName: 'Pastor Admin',
      phone: '+2348039990000',
      alerts: { followUp: true, celebrations: true },
    });
    const stored = await models.User.findById(me.id).lean();
    expect(await bcrypt.compare('grace-2222-hope', stored.passwordHash)).toBe(true);

    await users.createUser(
      validators.newUserSchema.parse({
        username: 'other',
        displayName: 'Other',
        role: 'usher',
        password: 'faith-4821-dove',
        email: 'taken@example.com',
      }),
    );
    await expect(users.updateAccount(me.id, { email: 'taken@example.com' })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe('call log names', () => {
  it('uses a personal login’s own name, and the typed name on a shared login', async () => {
    const person = await models.Person.create({
      firstName: 'Kemi',
      lastName: 'Ade',
      phone: '+2348060000001',
      firstVisitDate: new Date(),
    });
    const input = { personId: String(person._id), outcome: 'reached', channel: 'call' };
    const own = await followups.logFollowUp(
      { ...input, callerName: 'Typed Name' },
      { id: new mongoose.Types.ObjectId().toString(), name: 'Grace Okafor', personal: true },
    );
    expect(own.callerName).toBe('Grace Okafor');
    const shared = await followups.logFollowUp(
      { ...input, callerName: 'Bro. Tunde' },
      { id: new mongoose.Types.ObjectId().toString(), name: 'Follow-up Team' },
    );
    expect(shared.callerName).toBe('Bro. Tunde');
  });
});
