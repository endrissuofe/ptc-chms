/**
 * Reading a member list uploaded as CSV: columns Name, Phone, Gender, Birthday
 * (any order, any capitalisation; extra columns are ignored).
 */
import { normalizePhone } from './phone';
import { MONTHS, birthdayProblem } from './birthday';

/** Parses CSV text (commas or semicolons, quoted fields, Excel's BOM) into rows of strings. */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] || '';
  const sep =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const HEADERS = {
  name: ['name', 'full name', 'fullname', 'names'],
  phone: ['phone', 'phone number', 'mobile', 'telephone', 'tel', 'number', 'gsm'],
  gender: ['gender', 'sex'],
  birthday: ['birthday', 'birth date', 'date of birth', 'dob', 'birthdate'],
};

/** Which column holds what, from the header row. Missing columns are -1. */
export function mapHeaders(header) {
  const cells = header.map((h) => h.trim().toLowerCase());
  return Object.fromEntries(
    Object.entries(HEADERS).map(([key, names]) => [key, cells.findIndex((c) => names.includes(c))]),
  );
}

/** "Bro. Chinedu  Okafor" -> { firstName: "Chinedu", lastName: "Okafor" } */
export function splitName(full = '') {
  const parts = full
    .replace(
      /^(bro|sis|brother|sister|pastor|pst|rev|dr|mr|mrs|miss|ms|deacon|dcn|deaconess)\.?\s+/i,
      '',
    )
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function parseGender(value = '') {
  const v = value.trim().toLowerCase();
  if (['m', 'male', 'man', 'boy'].includes(v)) return 'male';
  if (['f', 'female', 'woman', 'girl'].includes(v)) return 'female';
  return undefined;
}

const monthIndex = (word) => {
  const w = word.toLowerCase().slice(0, 3);
  const i = MONTHS.findIndex((m) => m.toLowerCase().startsWith(w));
  return i === -1 ? null : i + 1;
};

/**
 * Day and month from the ways people write birthdays. Numbers are read day first
 * (Nigerian style): "14/10", "14-10-1990", "14 Oct", "October 14", "1990-10-14".
 * Returns { birthDay, birthMonth } or {} when it can't be read.
 */
export function parseBirthday(value = '') {
  const v = value.trim();
  if (!v) return {};
  let day;
  let month;
  let m;
  if ((m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    [, , month, day] = m.map(Number);
  } else if ((m = v.match(/^(\d{1,2})[-/.\s](\d{1,2})(?:[-/.\s](\d{2,4}))?$/))) {
    day = Number(m[1]);
    month = Number(m[2]);
  } else if ((m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+)\.?(?:[\s,-]+\d{2,4})?$/i))) {
    day = Number(m[1]);
    month = monthIndex(m[2]);
  } else if ((m = v.match(/^([a-z]+)\.?[\s-]+(\d{1,2})(?:st|nd|rd|th)?(?:[\s,-]+\d{2,4})?$/i))) {
    month = monthIndex(m[1]);
    day = Number(m[2]);
  }
  if (!day || !month || month > 12 || birthdayProblem(day, month)) return {};
  return { birthDay: day, birthMonth: month };
}

/**
 * Turns the CSV into rows ready to save, each with its problems.
 * Throws a readable message if the file has no Name or Phone column.
 */
export function readMemberCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('The file has no rows under the header');
  const cols = mapHeaders(rows[0]);
  if (cols.name === -1 || cols.phone === -1) {
    throw new Error('The first row must have Name and Phone columns');
  }
  const cell = (r, key) => (cols[key] === -1 ? '' : (r[cols[key]] ?? '').trim());

  return rows.slice(1).map((r, i) => {
    const name = cell(r, 'name');
    const phoneRaw = cell(r, 'phone');
    const birthdayRaw = cell(r, 'birthday');
    const { firstName, lastName } = splitName(name);
    const phone = normalizePhone(phoneRaw);
    const problems = [];
    if (!firstName) problems.push('No name');
    if (!phone) problems.push(phoneRaw ? 'Phone number not valid' : 'No phone number');
    const birthday = parseBirthday(birthdayRaw);
    return {
      line: i + 2,
      name,
      firstName,
      lastName,
      phone,
      phoneRaw,
      gender: parseGender(cell(r, 'gender')),
      ...birthday,
      birthdayUnread: Boolean(birthdayRaw) && !birthday.birthDay,
      problems,
    };
  });
}
