/**
 * Reading a member list uploaded as CSV: columns Name, Phone, Gender, Birthday, Anniversary,
 * Address (any order, any capitalisation; extra columns are ignored; only Name and Phone are
 * required). Imports carry ".js" so scripts/import-members.mjs can use this file in plain Node.
 */
import { normalizePhone } from './phone.js';
import { MONTHS, birthdayProblem } from './birthday.js';

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
  phone: [
    'phone',
    'phone number',
    'phone numbers',
    'mobile',
    'mobile number',
    'telephone',
    'tel',
    'number',
    'gsm',
  ],
  address: ['address', 'home address', 'house address', 'residential address'],
  gender: ['gender', 'sex'],
  birthday: ['birthday', 'birth date', 'date of birth', 'date of birthday', 'dob', 'birthdate'],
  anniversary: [
    'anniversary',
    'wedding anniversary',
    'wedding',
    'wedding date',
    'anniversary date',
    'marriage anniversary',
  ],
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

/** A name's words in any order: "Okafor Chinedu" and "chinedu  okafor" give the same key. */
export function nameKey(firstName = '', lastName = '') {
  return `${firstName} ${lastName}`.toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
}

const nameWords = (m) =>
  `${m.firstName ?? ''} ${m.lastName ?? ''}`
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const up = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return row[b.length];
}

/** "Bola"/"Bolanle" (short form), "Chinedu"/"Chinedo" (a slip or two in a long name). */
function wordsAlike(x, y) {
  if (x === y) return true;
  const short = Math.min(x.length, y.length);
  if (short >= 3 && (x.startsWith(y) || y.startsWith(x))) return true;
  return short >= 4 && editDistance(x, y) <= (Math.max(x.length, y.length) >= 7 ? 2 : 1);
}

/**
 * Why two names on the same phone look like one person, or null when they look like two
 * (family: "Ada Eze" and "Chuka Eze" share only the surname).
 */
export function sameNameReason(a, b) {
  const [short, long] = [nameWords(a), nameWords(b)].sort((x, y) => x.length - y.length);
  if (!short.length) return null;
  if (short.length === long.length && [...short].sort().join() === [...long].sort().join()) {
    return 'Same name';
  }
  const left = [...long];
  for (const w of short) {
    const i = left.findIndex((l) => wordsAlike(w, l));
    if (i === -1) return null;
    left.splice(i, 1);
  }
  if (short.length === 1) return 'One has only one name';
  if (short.every((w) => long.includes(w))) return 'Middle name more or less';
  return 'Spelled differently';
}

/**
 * Members sharing a phone whose names look like the same person, as pairs to check.
 * Pairs an admin marked "not the same person" (notDuplicates) are left out.
 * @returns {{ phone: string, pairs: { a: object, b: object, reason: string }[] }[]}
 */
export function possibleDuplicates(members) {
  const byPhone = new Map();
  for (const m of members) byPhone.set(m.phone, [...(byPhone.get(m.phone) ?? []), m]);
  const apart = (a, b) => (a.notDuplicates ?? []).some((id) => String(id) === String(b._id));
  const groups = [];
  for (const [phone, list] of byPhone) {
    const pairs = [];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const [a, b] = [list[i], list[j]];
        if (apart(a, b) || apart(b, a)) continue;
        const reason = sameNameReason(a, b);
        if (reason) pairs.push({ a, b, reason });
      }
    }
    if (pairs.length) groups.push({ phone, pairs });
  }
  return groups;
}

/** Is one name's words all inside the other's (at least two words), e.g. a middle name left out? */
function nameWithin(a, b) {
  const [short, long] = [a.split(' '), b.split(' ')].sort((x, y) => x.length - y.length);
  return short.length >= 2 && short.length < long.length && short.every((w) => long.includes(w));
}

/** Fields the row can fill in on the member without changing anything already there. */
function blanksToFill(member, row) {
  const set = {};
  if (row.gender && !member.gender) set.gender = row.gender;
  if (row.address && !member.address) set.address = row.address;
  if (row.birthDay && !member.birthDay) {
    set.birthDay = row.birthDay;
    set.birthMonth = row.birthMonth;
  }
  if (row.anniversaryDay && !member.anniversaryDay) {
    set.anniversaryDay = row.anniversaryDay;
    set.anniversaryMonth = row.anniversaryMonth;
  }
  return set;
}

/**
 * Plans merging a member list (rows from readMemberCsv) into the members already saved.
 * - A row with a phone matches a member with that phone and the same name (any word order).
 *   Unmatched, it's added, unless a member already has that name with another phone: those
 *   are listed for a person to check (new number, or a different person).
 * - A row without a usable phone matches by name alone, and only when exactly one member has
 *   that name (or, failing that, exactly one has it with a middle name more or less); it can
 *   then fill blanks but is never added (members need a phone).
 * Matched rows only fill blanks (gender, address, birthday, anniversary); nothing is overwritten.
 * Returns line numbers for everything left out, so reports never need names or numbers.
 */
export function planMemberMerge(rows, members) {
  const byPhoneName = new Map(
    members.map((m) => [`${m.phone}|${nameKey(m.firstName, m.lastName)}`, m]),
  );
  const byName = new Map();
  for (const m of members) {
    const key = nameKey(m.firstName, m.lastName);
    byName.set(key, [...(byName.get(key) ?? []), m]);
  }

  const plan = {
    add: [],
    fill: new Map(),
    already: [],
    repeated: [],
    noNameOrPhone: [],
    notFound: [],
    sameName: [],
    otherPhone: [],
  };
  // People added from earlier rows count as known, so a repeat of them in the file fills in
  // their blanks (or is held back when the phone differs) instead of being added twice.
  const addNew = (row, key) => {
    const entry = { ...row, pending: row };
    byPhoneName.set(`${row.phone}|${key}`, entry);
    byName.set(key, [...(byName.get(key) ?? []), entry]);
    plan.add.push(row);
  };
  const fillFrom = (member, row, how) => {
    if (member.pending) {
      Object.assign(member.pending, blanksToFill(member.pending, row));
      return plan.repeated.push(row.line);
    }
    const current = { ...member, ...(plan.fill.get(String(member._id))?.set ?? {}) };
    const set = blanksToFill(current, row);
    if (!Object.keys(set).length) return plan.already.push(row.line);
    const entry = plan.fill.get(String(member._id)) ?? {
      memberId: member._id,
      lines: [],
      how,
      set: {},
    };
    entry.lines.push(row.line);
    Object.assign(entry.set, set);
    plan.fill.set(String(member._id), entry);
  };

  for (const row of rows) {
    const key = nameKey(row.firstName, row.lastName);
    if (!row.firstName) {
      plan.noNameOrPhone.push(row.line);
      continue;
    }
    if (row.phone) {
      const id = `${row.phone}|${key}`;
      const member = byPhoneName.get(id);
      if (member) fillFrom(member, row, 'phone');
      else if (byName.has(key)) plan.otherPhone.push(row.line);
      else addNew(row, key);
      continue;
    }
    let matches = byName.get(key) ?? [];
    // "Ada Eze" and "Ada Grace Eze": one name inside the other (two words or more) also counts.
    if (!matches.length)
      matches = [...byName.entries()].filter(([k]) => nameWithin(k, key)).flatMap(([, m]) => m);
    if (matches.length === 1) fillFrom(matches[0], row, 'name');
    else if (matches.length > 1) plan.sameName.push(row.line);
    else plan.notFound.push(row.line);
  }
  return { ...plan, fill: [...plan.fill.values()] };
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
    const anniversaryRaw = cell(r, 'anniversary');
    const anniversary = parseBirthday(anniversaryRaw);
    return {
      line: i + 2,
      name,
      firstName,
      lastName,
      phone,
      phoneRaw,
      gender: parseGender(cell(r, 'gender')),
      address: cell(r, 'address').replace(/\s+/g, ' ').slice(0, 200) || undefined,
      ...birthday,
      birthdayUnread: Boolean(birthdayRaw) && !birthday.birthDay,
      anniversaryDay: anniversary.birthDay,
      anniversaryMonth: anniversary.birthMonth,
      anniversaryUnread: Boolean(anniversaryRaw) && !anniversary.birthDay,
      problems,
    };
  });
}
