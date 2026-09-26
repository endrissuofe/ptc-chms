import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { User } from '@/models';

/** What the Logins screen shows. Never the password hash. */
const toView = (u) => ({
  id: String(u._id),
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  active: u.active,
  lastSignInAt: u.lastSignInAt ?? null,
  createdAt: u.createdAt ?? null,
});

export async function listUsers() {
  await connectDB();
  const users = await User.find()
    .select('-passwordHash')
    .sort({ active: -1, role: 1, displayName: 1 })
    .lean();
  return users.map(toView);
}

export async function createUser(input, by) {
  await connectDB();
  if (await User.exists({ username: input.username })) {
    throw new HttpError(409, `The username “${input.username}” is already taken`);
  }
  const user = await User.create({
    username: input.username,
    displayName: input.displayName,
    role: input.role,
    passwordHash: await bcrypt.hash(input.password, 10),
    createdBy: by?.id,
  });
  return toView(user.toObject());
}

/**
 * Change a login's name, role, password, or switch it off/on.
 * Admins can't switch off or demote themselves, and there is always at least one active admin,
 * so nobody gets locked out of this screen.
 */
export async function updateUser(id, changes, by) {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Login not found');
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, 'Login not found');

  const self = String(user._id) === String(by?.id);
  const losesAdmin =
    user.role === ROLES.ADMIN &&
    user.active &&
    (changes.active === false || (changes.role && changes.role !== ROLES.ADMIN));
  if (self && losesAdmin) {
    throw new HttpError(400, 'You can’t switch off or change your own admin login');
  }
  if (losesAdmin) {
    const admins = await User.countDocuments({ role: ROLES.ADMIN, active: true });
    if (admins <= 1) throw new HttpError(400, 'There must always be at least one active admin');
  }

  if (changes.displayName !== undefined) user.displayName = changes.displayName;
  if (changes.role !== undefined) user.role = changes.role;
  if (changes.active !== undefined) user.active = changes.active;
  if (changes.password) user.passwordHash = await bcrypt.hash(changes.password, 10);
  await user.save();
  return toView(user.toObject());
}
