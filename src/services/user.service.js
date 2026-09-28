import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { ROLES } from '@/lib/roles';
import { normalizePhone } from '@/lib/phone';
import { appUrl } from '@/lib/site';
import { ALERTS, JOINABLE_ROLES, ROLE_INFO, canGetAlert, defaultAlerts } from '@/lib/users';
import { emailStatus, sendEmail } from '@/lib/email';
import { renderApproved, renderSignupNotice } from '@/lib/email/account-emails';
import { logger } from '@/lib/logger';
import { JoinLink, User } from '@/models';
import { logEmail } from './alerts.service';

/** At most this many sign-ups can wait at once, so a leaked link can't flood the list. */
const MAX_PENDING = 25;

/** What the Logins screen shows. Never the password hash. */
const toView = (u) => ({
  id: String(u._id),
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  email: u.email ?? null,
  phone: u.phone ?? null,
  active: u.active,
  pending: Boolean(u.pending),
  personal: Boolean(u.personal),
  alerts: { followUp: Boolean(u.alerts?.followUp), celebrations: Boolean(u.alerts?.celebrations) },
  lastSignInAt: u.lastSignInAt ?? null,
  createdAt: u.createdAt ?? null,
});

const teamLabel = (role) => ROLE_INFO[role]?.label ?? role;

/** Only alerts the role may get; the rest are off. */
const allowedAlerts = (role, alerts) =>
  Object.fromEntries(
    Object.keys(ALERTS).map((k) => [k, canGetAlert(role, k) && Boolean(alerts[k])]),
  );

async function assertEmailFree(email, exceptId) {
  if (!email) return;
  if (await User.exists({ email, _id: { $ne: exceptId } })) {
    const message = 'Another login already uses this email address';
    throw new HttpError(409, message, [{ path: ['email'], message }]);
  }
}

/** Everyone approved (active or switched off) and, separately, sign-ups waiting. */
export async function listUsers() {
  await connectDB();
  const users = await User.find()
    .select('-passwordHash')
    .sort({ active: -1, role: 1, displayName: 1 })
    .lean();
  return {
    users: users.filter((u) => !u.pending).map(toView),
    pending: users
      .filter((u) => u.pending)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(toView),
  };
}

export const countPending = async () => {
  await connectDB();
  return User.countDocuments({ pending: true });
};

export async function createUser(input, by) {
  await connectDB();
  if (await User.exists({ username: input.username })) {
    throw new HttpError(409, `The username “${input.username}” is already taken`);
  }
  await assertEmailFree(input.email);
  const user = await User.create({
    username: input.username,
    displayName: input.displayName,
    role: input.role,
    email: input.email || undefined,
    alerts: defaultAlerts(input.role),
    passwordHash: await bcrypt.hash(input.password, 10),
    createdBy: by?.id,
  });
  return toView(user.toObject());
}

/**
 * Change a login's name, role, email, phone, emails it gets, password, or switch it off/on.
 * Admins can't switch off or demote themselves, and there is always at least one active admin,
 * so nobody gets locked out of this screen. A new role starts with that role's usual emails.
 */
export async function updateUser(id, changes, by) {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Login not found');
  const user = await User.findById(id);
  if (!user || user.pending) throw new HttpError(404, 'Login not found');

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
  if (changes.email) await assertEmailFree(changes.email, user._id);

  if (changes.displayName !== undefined) user.displayName = changes.displayName;
  if (changes.role !== undefined && changes.role !== user.role) {
    user.role = changes.role;
    user.alerts = defaultAlerts(changes.role);
  }
  if (changes.alerts) {
    user.alerts = allowedAlerts(user.role, { ...user.alerts.toObject?.(), ...changes.alerts });
  }
  if (changes.email !== undefined) user.email = changes.email || undefined;
  if (changes.phone !== undefined)
    user.phone = changes.phone ? normalizePhone(changes.phone) : undefined;
  if (changes.active !== undefined) user.active = changes.active;
  if (changes.password) user.passwordHash = await bcrypt.hash(changes.password, 10);
  await user.save();
  return toView(user.toObject());
}

/* ---------- Invite links ---------- */

const newToken = () => crypto.randomBytes(18).toString('base64url');

/** One link per team, made the first time it's needed. */
export async function listJoinLinks() {
  await connectDB();
  const links = await JoinLink.find({ role: { $in: JOINABLE_ROLES } }).lean();
  const byRole = Object.fromEntries(links.map((l) => [l.role, l]));
  const missing = JOINABLE_ROLES.filter((r) => !byRole[r]);
  if (missing.length) {
    await Promise.all(
      missing.map((role) =>
        JoinLink.updateOne(
          { role },
          { $setOnInsert: { role, token: newToken() } },
          { upsert: true },
        ),
      ),
    );
    return listJoinLinks();
  }
  return JOINABLE_ROLES.map((role) => ({
    role,
    label: teamLabel(role),
    url: `${appUrl()}/join/${byRole[role].token}`,
    uses: byRole[role].uses ?? 0,
  }));
}

/** A new token for a team's link: the old link stops working at once. */
export async function resetJoinLink(role, by) {
  await connectDB();
  await JoinLink.updateOne(
    { role },
    { $set: { token: newToken(), uses: 0, resetBy: by?.id } },
    { upsert: true },
  );
  return (await listJoinLinks()).find((l) => l.role === role);
}

/** The team a link is for, or null when the link is wrong or was reset. */
export async function findJoinLink(token) {
  if (!token || token.length < 10) return null;
  await connectDB();
  const link = await JoinLink.findOne({ token }).lean();
  if (!link || !JOINABLE_ROLES.includes(link.role)) return null;
  return { role: link.role, label: teamLabel(link.role) };
}

/** A username from the email, e.g. "grace.okafor", made unique with a number if needed. */
async function freeUsername(email) {
  const base =
    email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 24) || 'member';
  const padded = base.length < 3 ? `${base}000`.slice(0, 3) : base;
  for (let n = 0; n < 50; n += 1) {
    const candidate = n ? `${padded}${n + 1}` : padded;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${padded}${crypto.randomInt(1000, 9999)}`;
}

async function notify(kind, to, email) {
  if (!to.length) return;
  const res = await sendEmail({ to, ...email });
  await logEmail({
    kind,
    to,
    subject: email.subject,
    status: res.ok ? 'sent' : 'failed',
    provider: emailStatus().provider,
    error: res.error,
  });
  if (!res.ok) logger.warn({ kind, err: res.error }, 'Account email not sent');
}

/**
 * Someone signs up with a team's invite link. Their login waits (switched off) until an admin
 * approves it; the admins get an email. Returns the team's name for the thank-you screen.
 */
export async function signUp(input) {
  await connectDB();
  const link = await findJoinLink(input.token);
  if (!link)
    throw new HttpError(404, 'This invite link has expired. Ask the church admin for a new one.');
  // Filled in only by bots: pretend it worked.
  if (input.website) return { team: link.label };

  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    const message = existing.pending
      ? 'You’ve already signed up with this email. An admin will approve you soon.'
      : 'There’s already a login with this email. Sign in instead.';
    throw new HttpError(409, message, [{ path: ['email'], message }]);
  }
  if ((await User.countDocuments({ pending: true })) >= MAX_PENDING) {
    throw new HttpError(
      429,
      'Too many sign-ups are waiting. Ask the church admin to approve them first.',
    );
  }

  const user = await User.create({
    username: await freeUsername(email),
    displayName: input.displayName,
    role: link.role,
    email,
    phone: normalizePhone(input.phone),
    passwordHash: await bcrypt.hash(input.password, 10),
    active: false,
    pending: true,
    personal: true,
    alerts: defaultAlerts(link.role),
  });
  await JoinLink.updateOne({ token: input.token }, { $inc: { uses: 1 } });

  const admins = await User.find({ role: ROLES.ADMIN, active: true, email: { $type: 'string' } })
    .select('email')
    .lean();
  await notify(
    'signup',
    admins.map((a) => a.email),
    renderSignupNotice(
      { name: user.displayName, teamLabel: link.label, email, phone: input.phone },
      appUrl(),
    ),
  );
  return { team: link.label };
}

/** Admin lets a sign-up in, on the team they asked for or another one. */
export async function approveUser(id, { role }, by) {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Sign-up not found');
  const user = await User.findOne({ _id: id, pending: true });
  if (!user) throw new HttpError(404, 'Sign-up not found (already approved or declined?)');
  if (role !== user.role) {
    user.role = role;
    user.alerts = defaultAlerts(role);
  }
  user.pending = false;
  user.active = true;
  user.approvedAt = new Date();
  user.approvedBy = by?.id;
  await user.save();
  await notify(
    'approved',
    [user.email],
    renderApproved({ name: user.displayName, teamLabel: teamLabel(role) }, appUrl()),
  );
  return toView(user.toObject());
}

/** Admin turns a sign-up away: it is removed, and the email can sign up again later. */
export async function declineUser(id) {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Sign-up not found');
  const res = await User.deleteOne({ _id: id, pending: true });
  if (!res.deletedCount)
    throw new HttpError(404, 'Sign-up not found (already approved or declined?)');
  return { declined: true };
}

/* ---------- My account ---------- */

export async function getAccount(id) {
  await connectDB();
  const user = await User.findById(id).select('-passwordHash').lean();
  if (!user) throw new HttpError(404, 'Login not found');
  return toView(user);
}

/** Anyone changes their own name, email, phone, emails they get, or password. */
export async function updateAccount(id, input) {
  await connectDB();
  const user = await User.findById(id);
  if (!user?.active) throw new HttpError(404, 'Login not found');
  if (input.newPassword) {
    const ok = await bcrypt.compare(input.currentPassword || '', user.passwordHash);
    if (!ok) {
      const message = 'That isn’t your current password';
      throw new HttpError(400, message, [{ path: ['currentPassword'], message }]);
    }
    user.passwordHash = await bcrypt.hash(input.newPassword, 10);
  }
  if (input.email) await assertEmailFree(input.email, user._id);
  if (input.displayName !== undefined) user.displayName = input.displayName;
  if (input.email !== undefined) user.email = input.email || undefined;
  if (input.phone !== undefined) user.phone = input.phone ? normalizePhone(input.phone) : undefined;
  if (input.alerts) {
    user.alerts = allowedAlerts(user.role, { ...user.alerts.toObject?.(), ...input.alerts });
  }
  await user.save();
  return toView(user.toObject());
}
