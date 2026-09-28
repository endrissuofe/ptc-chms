import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/** The Logins screen's rules, against a throwaway in-memory MongoDB. */
let mongod;
let users;
let validators;
let User;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('ptc_users_test');
  process.env.LOG_LEVEL = 'silent';
  users = await import('@/services/user.service');
  validators = await import('@/lib/validators/user');
  ({ User } = await import('@/models'));
  await mongoose.connect(process.env.MONGODB_URI);
  await User.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

const add = (overrides = {}) =>
  users.createUser(
    validators.newUserSchema.parse({
      username: 'ushers',
      displayName: 'Ushering Team',
      role: 'usher',
      password: 'faith-4821-dove',
      ...overrides,
    }),
  );

describe('logins', () => {
  it('adds a login with a hashed password and never returns the hash', async () => {
    const u = await add({ username: '  Ushers ' });
    expect(u).toMatchObject({ username: 'ushers', role: 'usher', active: true });
    expect(u).not.toHaveProperty('passwordHash');
    const stored = await User.findOne({ username: 'ushers' }).lean();
    expect(await bcrypt.compare('faith-4821-dove', stored.passwordHash)).toBe(true);
    expect((await users.listUsers()).users[0]).not.toHaveProperty('passwordHash');
  });

  it('refuses a taken username, a bad username and a short password', async () => {
    await add();
    await expect(add()).rejects.toMatchObject({ status: 409 });
    expect(() => validators.newUserSchema.parse({ ...base(), username: 'a b' })).toThrow();
    expect(() => validators.newUserSchema.parse({ ...base(), password: 'short' })).toThrow();
  });

  it('changes role, name and password, and switches a login off', async () => {
    const admin = await add({ username: 'pastor.ade', role: 'admin', displayName: 'Pst Ade' });
    const u = await add();
    const changed = await users.updateUser(
      u.id,
      { role: 'followup', displayName: 'Follow-up Team', password: 'new-password-1' },
      admin,
    );
    expect(changed).toMatchObject({ role: 'followup', displayName: 'Follow-up Team' });
    const stored = await User.findById(u.id).lean();
    expect(await bcrypt.compare('new-password-1', stored.passwordHash)).toBe(true);

    expect((await users.updateUser(u.id, { active: false }, admin)).active).toBe(false);
  });

  it('never locks out the last admin, or lets admins demote themselves', async () => {
    const me = await add({ username: 'admin1', role: 'admin', displayName: 'Admin One' });
    await expect(users.updateUser(me.id, { active: false }, me)).rejects.toMatchObject({
      status: 400,
    });
    await expect(users.updateUser(me.id, { role: 'pastor' }, me)).rejects.toMatchObject({
      status: 400,
    });

    const other = await add({ username: 'admin2', role: 'admin', displayName: 'Admin Two' });
    const pastor = { id: new mongoose.Types.ObjectId().toString() };
    // With two admins, one may be switched off...
    await users.updateUser(other.id, { active: false }, me);
    // ...but not the last one, whoever asks.
    await expect(users.updateUser(me.id, { active: false }, pastor)).rejects.toMatchObject({
      status: 400,
    });
  });
});

function base() {
  return { username: 'ushers', displayName: 'Ushers', role: 'usher', password: 'long-enough-1' };
}
