import { connectDB } from '@/lib/db';
import { searchFilter } from '@/lib/search';
import { HttpError } from '@/lib/api';
import { readMemberCsv } from '@/lib/members';
import { Member } from '@/models';

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
        birthDay: r.birthDay,
        birthMonth: r.birthMonth,
        source: 'csv',
        createdBy: user?.id,
      })),
    );
  }
  for (const r of toUpdate) {
    const current = await Member.findById(r.memberId).lean();
    const fill = {};
    if (r.gender && !current.gender) fill.gender = r.gender;
    if (r.birthDay && !current.birthDay) {
      fill.birthDay = r.birthDay;
      fill.birthMonth = r.birthMonth;
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
