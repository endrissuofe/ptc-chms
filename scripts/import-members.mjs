/**
 * Adds members from a spreadsheet (.xlsx) or CSV to the Members list. Only people not already
 * on the list are added (same phone and same name = already there); nobody is changed.
 * Columns are read like the Members screen's upload: Name and Phone, plus any of Address,
 * Gender, Birthday, Anniversary.
 *
 *   npm run members:import -- "C:\path\file.xlsx"            -> shows what would be added
 *   npm run members:import -- "C:\path\file.xlsx" --confirm  -> adds them
 *
 * Reads MONGODB_URI from .env, or from the environment (PowerShell: $env:MONGODB_URI = "...").
 * Prints counts and line numbers only, never names or phone numbers.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { readMemberCsv } from '../src/lib/members.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const file = args.find((a) => !a.startsWith('--'));

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

const identity = (m) =>
  `${m.phone}|${m.firstName.trim().toLowerCase()}|${(m.lastName || '').trim().toLowerCase()}`;

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

  const phones = [...new Set(rows.filter((r) => r.phone).map((r) => r.phone))];
  const existing = await members.find({ phone: { $in: phones } }).toArray();
  const known = new Set(existing.map(identity));
  const knownPhones = new Set(existing.map((m) => m.phone));
  const firstTimers = new Set(
    (
      await db
        .collection('people')
        .find({ phone: { $in: phones } })
        .toArray()
    ).map(identity),
  );

  const seen = new Set();
  const add = [];
  const invalid = [];
  let already = 0;
  let repeated = 0;
  let sharedPhone = 0;
  let alsoFirstTimer = 0;
  for (const r of rows) {
    if (r.problems.length) {
      invalid.push(`  line ${r.line}: ${r.problems.join(', ')}`);
      continue;
    }
    const id = identity(r);
    if (known.has(id)) {
      already += 1;
      continue;
    }
    if (seen.has(id)) {
      repeated += 1;
      continue;
    }
    seen.add(id);
    if (knownPhones.has(r.phone)) sharedPhone += 1;
    if (firstTimers.has(id)) alsoFirstTimer += 1;
    add.push(r);
  }

  console.log(`Database: ${host}`);
  console.log(`File: ${path.basename(file)} (${rows.length} rows)\n`);
  console.log(`  To add:                     ${add.length}`);
  console.log(`    with an address:          ${add.filter((r) => r.address).length}`);
  console.log(`    with a birthday:          ${add.filter((r) => r.birthDay).length}`);
  if (sharedPhone)
    console.log(`    sharing a member’s phone: ${sharedPhone} (family; different name)`);
  if (alsoFirstTimer) console.log(`    also on First timers:     ${alsoFirstTimer}`);
  console.log(`  Already on the list:        ${already}`);
  if (repeated) console.log(`  Repeated in the file:       ${repeated}`);
  console.log(`  Can’t be added:             ${invalid.length}`);
  if (invalid.length) console.log(invalid.join('\n'));
  const unread = rows.filter((r) => r.birthdayUnread).length;
  if (unread) console.log(`  Birthdays not understood:   ${unread} (added without a birthday)`);

  if (!confirm) {
    console.log('\nNothing was changed. Run again with --confirm to add them.');
  } else if (add.length) {
    const now = new Date();
    await members.insertMany(
      add.map((r) => ({
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
    console.log(`\nAdded ${add.length} members.`);
  } else {
    console.log('\nNothing new to add.');
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
