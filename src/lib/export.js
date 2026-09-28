import { formatPhone } from './phone';
import { STAGE_LABELS } from './stages';
import { OUTCOMES } from './followup';
import { formatBirthday, formatMoment, formatServiceDate } from './format';

/**
 * One CSV cell. Quotes when needed, and neutralises text that Excel would run as a formula
 * (a name typed as "=HYPERLINK(...)" must stay text).
 */
export function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows) => `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

/** The First timers export. Prayer requests are never included. */
export function peopleCsv(people) {
  return toCsv([
    [
      'First name',
      'Last name',
      'Phone',
      'Address',
      'Email',
      'Birthday',
      'First visit',
      'Last visit',
      'Visits',
      'Stage',
      'Last call',
      'Last reached',
      'SMS consent',
      'Card hard to read',
      'Moved to members',
    ],
    ...people.map((p) => [
      p.firstName,
      p.lastName,
      formatPhone(p.phone),
      p.address || '',
      p.email || '',
      formatBirthday(p.birthDay, p.birthMonth) || '',
      formatServiceDate(p.firstVisitDate),
      formatServiceDate(p.lastVisitDate),
      p.visitCount ?? '',
      STAGE_LABELS[p.stage] || p.stage,
      p.lastOutcome ? `${OUTCOMES[p.lastOutcome]?.label} (${formatMoment(p.lastAttemptAt)})` : '',
      p.lastContactAt ? formatMoment(p.lastContactAt) : '',
      p.smsConsent ? 'Yes' : 'No',
      p.cardUnclear ? 'Yes' : '',
      p.movedToMembersAt ? formatMoment(p.movedToMembersAt) : '',
    ]),
  ]);
}
