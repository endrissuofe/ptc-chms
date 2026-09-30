/**
 * Merges a spreadsheet (.xlsx) or CSV into the Members list (rules: planMemberMerge in
 * src/lib/members.js). New people with a phone are added; existing members only get blanks
 * filled in (birthday, anniversary, gender, address), matched by phone and name, or by name
 * alone when no phone is given and exactly one member has that name. Nothing is overwritten.
 * Columns are read like the Members screen's upload: Name and Phone, plus any of Address,
 * Gender, Birthday, Anniversary.
 *
 *   npm run members:import -- "C:\path\file.xlsx"            -> shows what would change
 *   npm run members:import -- "C:\path\file.xlsx" --confirm  -> saves it
 *   add --review="C:\path\review.csv" to save the rows left out, with names, to check by hand
 *
 * Reads MONGODB_URI from .env, or from the environment (PowerShell: $env:MONGODB_URI = "...").
 * Prints counts and line numbers only, never names or phone numbers.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { nameKey, planMemberMerge, readMemberCsv } from '../src/lib/members.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const file = args.find((a) => !a.startsWith('--'));
// --review=C:\path\review.csv writes the rows left out, and new people sharing a member's phone,
// with names and reasons, for a person to check. It's written on this computer only; keep it out of the project folder.
const review = args.find((a) => a.startsWith('--review='))?.slice('--review='.length);

/** A cell's text, whatever Excel stored (numbers, dates, rich text, links, formulas). */
function cellText(value) {
  if (value == null) return '';
  if (value instanceof Date) {
    return `${value.getUTCDate()} ${value.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
  }
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map((t) => t.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return cellText(value.result);
    return '';
  }
  return String(value);
}

const quote = (s) => `"${String(s).replace(/"/g, '""')}"`;

async function readAsCsv(filePath) {
  if (!/\.xlsx$/i.test(filePath)) return fs.readFileSync(filePath, 'utf8');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  const lines = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    for (let c = 1; c <= ws.actualColumnCount; c += 1) cells.push(cellText(row.getCell(c).value));
    lines.push(cells.map(quote).join(','));
  });
  return lines.join('\n');
}

async function main() {
  if (!file || !fs.existsSync(file)) {
    console.error(
      'Give the file path, e.g. npm run members:import -- "C:\\Downloads\\members.xlsx"',
    );
    process.exitCode = 1;
    return;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exitCode = 1;
    return;
  }

  let rows;
  try {
    rows = readMemberCsv(await readAsCsv(file));
  } catch (err) {
    console.error(`Couldn’t read ${path.basename(file)}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const host = uri
    .replace(/^mongodb(\+srv)?:\/\//, '')
    .replace(/^.*@/, '')
    .replace(/[/?].*$/, '');
  const members = db.collection('members');

  const all = await members
    .find(
      { mergedInto: { $exists: false } },
      {
        projection: {
          firstName: 1,
          lastName: 1,
          phone: 1,
          gender: 1,
          address: 1,
          birthDay: 1,
          birthMonth: 1,
          anniversaryDay: 1,
          anniversaryMonth: 1,
        },
      },
    )
    .toArray();
  const plan = planMemberMerge(rows, all);
  const unreadable = rows.filter((r) => r.phoneRaw && !r.phone).map((r) => r.line);
  const knownPhones = new Set(all.map((m) => m.phone));
  const firstTimerKeys = new Set(
    (
      await db
        .collection('people')
        .find({ phone: { $in: plan.add.map((r) => r.phone) } })
        .toArray()
    ).map((p) => `${p.phone}|${nameKey(p.firstName, p.lastName)}`),
  );
  const count = (fields) => plan.fill.filter((f) => fields.some((k) => k in f.set)).length;
  const lines = (list) =>
    list.length > 12 ? `${list.slice(0, 12).join(', ')}, …` : list.join(', ');
  const show = (label, list, note = '') =>
    list.length &&
    console.log(
      `  ${label.padEnd(34)}${String(list.length).padStart(4)}${note}   lines ${lines(list)}`,
    );

  console.log(`Database: ${host}`);
  console.log(`File: ${path.basename(file)} (${rows.length} rows)
`);
  console.log(`  To add (new, with a phone):       ${String(plan.add.length).padStart(4)}`);
  console.log(
    `    with a birthday:                ${String(plan.add.filter((r) => r.birthDay).length).padStart(4)}`,
  );
  const shared = plan.add.filter((r) => knownPhones.has(r.phone)).length;
  if (shared)
    console.log(
      `    sharing a member's phone:       ${String(shared).padStart(4)} (family; different name)`,
    );
  const alsoFt = plan.add.filter((r) =>
    firstTimerKeys.has(`${r.phone}|${nameKey(r.firstName, r.lastName)}`),
  ).length;
  if (alsoFt) console.log(`    also on First timers:           ${String(alsoFt).padStart(4)}`);
  console.log(`  Members to fill in:               ${String(plan.fill.length).padStart(4)}`);
  console.log(
    `    matched by phone and name:      ${String(plan.fill.filter((f) => f.how === 'phone').length).padStart(4)}`,
  );
  console.log(
    `    matched by name only:           ${String(plan.fill.filter((f) => f.how === 'name').length).padStart(4)}`,
  );
  console.log(`    getting a birthday:             ${String(count(['birthDay'])).padStart(4)}`);
  console.log(
    `    getting an anniversary:         ${String(count(['anniversaryDay'])).padStart(4)}`,
  );
  console.log(
    `    getting a gender or address:    ${String(count(['gender', 'address'])).padStart(4)}`,
  );
  console.log(`  Already complete, nothing to do:  ${String(plan.already.length).padStart(4)}`);
  console.log('\nLeft out (check these lines in your file):');
  show('No name', plan.noNameOrPhone);
  show('No phone, not a member yet', plan.notFound);
  show('No phone, 2+ members share name', plan.sameName);
  show('Known name on a different phone', plan.otherPhone);
  show('Repeated in the file', plan.repeated);
  show('Phone number not readable', unreadable, ' (matched by name instead)');
  const unread = rows.filter((r) => r.birthdayUnread).map((r) => r.line);
  show('Birthday not understood', unread, ' (row still used without it)');

  if (review) {
    const reasons = [
      ['No name', plan.noNameOrPhone],
      ['No phone, not a member yet', plan.notFound],
      ['No phone, 2 or more members share this name', plan.sameName],
      ['A member has this name with a different phone', plan.otherPhone],
      ['Birthday not understood', unread],
      [
        'Will be added: shares a member’s phone (family, or the same person spelled differently?)',
        plan.add.filter((r) => knownPhones.has(r.phone)).map((r) => r.line),
      ],
    ];
    const byLine = new Map(rows.map((r) => [r.line, r]));
    const out = [['Line', 'Name', 'Phone as written', 'Reason']];
    for (const [reason, list] of reasons) {
      for (const line of list) {
        const r = byLine.get(line);
        out.push([line, r.name, r.phoneRaw, reason]);
      }
    }
    fs.writeFileSync(review, `﻿${out.map((r) => r.map(quote).join(',')).join('\r\n')}`);
    console.log(`\nReview list (${out.length - 1} rows) saved to ${review}`);
  }

  if (!confirm) {
    console.log('\nNothing was changed. Run again with --confirm to save.');
  } else {
    const now = new Date();
    if (plan.add.length) {
      await members.insertMany(
        plan.add.map((r) => ({
          firstName: r.firstName,
          lastName: r.lastName,
          phone: r.phone,
          ...(r.gender && { gender: r.gender }),
          ...(r.address && { address: r.address }),
          ...(r.birthDay && { birthDay: r.birthDay, birthMonth: r.birthMonth }),
          ...(r.anniversaryDay && {
            anniversaryDay: r.anniversaryDay,
            anniversaryMonth: r.anniversaryMonth,
          }),
          source: 'csv',
          smsOptOut: false,
          active: true,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
    for (const f of plan.fill) {
      await members.updateOne({ _id: f.memberId }, { $set: { ...f.set, updatedAt: now } });
    }
    console.log(`\nAdded ${plan.add.length} members and filled in ${plan.fill.length}.`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
