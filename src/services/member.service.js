import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { normalizePhone } from '@/lib/phone';
import { searchFilter } from '@/lib/search';
import { HttpError } from '@/lib/api';
import { possibleDuplicates, readMemberCsv } from '@/lib/members';
import { Member, Person, SmsLog } from '@/models';

/** "Same person" for imports: same phone and same first and last name, ignoring case. */
const identity = (m) =>
  `${m.phone}|${m.firstName.trim().toLowerCase()}|${(m.lastName || '').trim().toLowerCase()}`;

/**
 * Checks an uploaded CSV without saving anything. Each row gets a status:
 * new, update (already a member — blanks like birthday will be filled), duplicate (appears
 * earlier in the same file) or invalid (with the reasons).
 */
export async function previewImport(csvText) {
  let rows;
  try {
    rows = readMemberCsv(csvText);
  } catch (err) {
    throw new HttpError(400, err.message);
  }
  await connectDB();
  const phones = [...new Set(rows.filter((r) => r.phone).map((r) => r.phone))];
  const existing = await Member.find({ phone: { $in: phones } }).lean();
  const known = new Map(existing.map((m) => [identity(m), m]));
  const seenInFile = new Set();

  const analysed = rows.map((r) => {
    if (r.problems.length) return { ...r, status: 'invalid' };
    const id = identity(r);
    if (seenInFile.has(id)) return { ...r, status: 'duplicate' };
    seenInFile.add(id);
    const match = known.get(id);
    return { ...r, status: match ? 'update' : 'new', memberId: match?._id };
  });

  const count = (s) => analysed.filter((r) => r.status === s).length;
  return {
    rows: analysed,
    summary: {
      total: analysed.length,
      new: count('new'),
      update: count('update'),
      duplicate: count('duplicate'),
      invalid: count('invalid'),
    },
  };
}

/** Saves the CSV: adds new members and fills blanks on existing ones. */
export async function importMembers(csvText, user) {
  const { rows, summary } = await previewImport(csvText);
  const toCreate = rows.filter((r) => r.status === 'new');
  const toUpdate = rows.filter((r) => r.status === 'update');

  if (toCreate.length) {
    await Member.insertMany(
      toCreate.map((r) => ({
        firstName: r.firstName,
        lastName: r.lastName,
        phone: r.phone,
        gender: r.gender,
        address: r.address,
        birthDay: r.birthDay,
        birthMonth: r.birthMonth,
        anniversaryDay: r.anniversaryDay,
        anniversaryMonth: r.anniversaryMonth,
        source: 'csv',
        createdBy: user?.id,
      })),
    );
  }
  for (const r of toUpdate) {
    const current = await Member.findById(r.memberId).lean();
    const fill = {};
    if (r.gender && !current.gender) fill.gender = r.gender;
    if (r.address && !current.address) fill.address = r.address;
    if (r.birthDay && !current.birthDay) {
      fill.birthDay = r.birthDay;
      fill.birthMonth = r.birthMonth;
    }
    if (r.anniversaryDay && !current.anniversaryDay) {
      fill.anniversaryDay = r.anniversaryDay;
      fill.anniversaryMonth = r.anniversaryMonth;
    }
    if (Object.keys(fill).length) await Member.updateOne({ _id: r.memberId }, fill);
  }
  return {
    added: toCreate.length,
    updated: toUpdate.length,
    skipped: summary.duplicate + summary.invalid,
  };
}

/** Member list for the Members screen: search by name or phone. */
export async function listMembers({ q, page = 1, limit = 50 } = {}) {
  await connectDB();
  const filter = { active: true };
  Object.assign(filter, searchFilter(q));
  const [items, total, all] = await Promise.all([
    Member.find(filter)
      .sort({ firstName: 1, lastName: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Member.countDocuments(filter),
    Member.countDocuments({ active: true }),
  ]);
  return { items, total, all, page, limit };
}

const MEMBER_FIELDS = [
  'firstName',
  'lastName',
  'gender',
  'address',
  'birthDay',
  'birthMonth',
  'anniversaryDay',
  'anniversaryMonth',
  'smsOptOut',
  'active',
];

/** Someone else with the same phone and name is the same person. */
async function assertNotDuplicate({ phone, firstName, lastName }, exceptId) {
  const same = await Member.find({ phone, _id: { $ne: exceptId } }).lean();
  const id = identity({ phone, firstName, lastName });
  if (same.some((m) => identity(m) === id)) {
    throw new HttpError(409, `${firstName} ${lastName} is already on the list with this number`);
  }
}

/** Admin adds one member by hand. */
export async function createMember(input, user) {
  await connectDB();
  const phone = normalizePhone(input.phone);
  await assertNotDuplicate({ ...input, phone });
  const member = await Member.create({
    ...Object.fromEntries(MEMBER_FIELDS.map((k) => [k, input[k] ?? undefined])),
    phone,
    source: 'manual',
    createdBy: user?.id,
  });
  return member.toObject();
}

/** Admin corrects a member (name, phone, gender, address, dates, messages, on the list). */
export async function updateMember(id, input) {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Member not found');
  const current = await Member.findById(id).lean();
  if (!current) throw new HttpError(404, 'Member not found');
  const update = {};
  for (const k of MEMBER_FIELDS) if (input[k] !== undefined) update[k] = input[k];
  if (input.phone !== undefined) update.phone = normalizePhone(input.phone);
  const next = { ...current, ...update };
  await assertNotDuplicate(next, id);
  return Member.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
}

/** Members on the list who share a phone and whose names look like one person. */
export async function listPossibleDuplicates() {
  await connectDB();
  const shared = await Member.aggregate([
    { $match: { active: true } },
    { $group: { _id: '$phone', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  const members = await Member.find({ active: true, phone: { $in: shared.map((s) => s._id) } })
    .sort({ createdAt: 1 })
    .lean();
  return possibleDuplicates(members);
}

async function activePair(keepId, removeId) {
  if (String(keepId) === String(removeId)) throw new HttpError(400, 'Pick two different members');
  if (![keepId, removeId].every((id) => mongoose.isValidObjectId(id))) {
    throw new HttpError(404, 'Member not found');
  }
  const [keep, remove] = await Promise.all([
    Member.findOne({ _id: keepId, active: true }).lean(),
    Member.findOne({ _id: removeId, active: true }).lean(),
  ]);
  if (!keep || !remove) throw new HttpError(404, 'Member not found, or already merged');
  return { keep, remove };
}

/**
 * The same person entered twice: `keep` stays, gets any details it's missing from `remove`,
 * and takes over its first-timer link and SMS history. `remove` comes off the list (kept,
 * marked mergedInto). If either had SMS switched off, it stays off.
 */
export async function mergeMembers({ keep: keepId, remove: removeId }) {
  await connectDB();
  const { keep, remove } = await activePair(keepId, removeId);
  const fill = {};
  if (!keep.gender && remove.gender) fill.gender = remove.gender;
  if (!keep.address && remove.address) fill.address = remove.address;
  if (!keep.birthDay && remove.birthDay) {
    fill.birthDay = remove.birthDay;
    fill.birthMonth = remove.birthMonth;
  }
  if (!keep.anniversaryDay && remove.anniversaryDay) {
    fill.anniversaryDay = remove.anniversaryDay;
    fill.anniversaryMonth = remove.anniversaryMonth;
  }
  if (!keep.person && remove.person) fill.person = remove.person;
  if (remove.smsOptOut) fill.smsOptOut = true;

  await Member.updateOne({ _id: keep._id }, fill);
  await Promise.all([
    Person.updateMany({ member: remove._id }, { member: keep._id }),
    SmsLog.updateMany({ member: remove._id }, { member: keep._id }),
  ]);
  await Member.updateOne({ _id: remove._id }, { active: false, mergedInto: keep._id });
  return Member.findById(keep._id).lean();
}

/** Two members sharing a phone are different people: stop suggesting them as duplicates. */
export async function markNotDuplicates({ a, b }) {
  await connectDB();
  await activePair(a, b);
  await Promise.all([
    Member.updateOne({ _id: a }, { $addToSet: { notDuplicates: b } }),
    Member.updateOne({ _id: b }, { $addToSet: { notDuplicates: a } }),
  ]);
}
