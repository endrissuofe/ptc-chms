/** Birthdays are day + month only (the card doesn't ask for the year). */
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Longest month length, allowing 29 February since the year is unknown. */
export function daysInMonth(month) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}

/** Problem with a day/month pair, or null when it's fine. Both or neither must be given. */
export function birthdayProblem(day, month) {
  if (!day && !month) return null;
  if (!day || !month) return 'Choose both the day and the month';
  if (day > daysInMonth(month)) return `${MONTHS[month - 1]} has only ${daysInMonth(month)} days`;
  return null;
}
