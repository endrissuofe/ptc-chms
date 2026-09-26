import { MONTHS } from './birthday';

/**
 * Dates for display. Service dates (visits, first visit) are midnight UTC of the Lagos day, so
 * they are read in UTC; moments (calls, SMS) are shown in Lagos time.
 */
const serviceDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const serviceDayYear = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const moment = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "Sun 27 Sept" */
export const formatServiceDay = (d) => (d ? serviceDay.format(new Date(d)) : '—');
/** "27 Sept 2026" */
export const formatServiceDate = (d) => (d ? serviceDayYear.format(new Date(d)) : '—');
/** "27 Sept, 6:04 pm" */
export const formatMoment = (d) => (d ? moment.format(new Date(d)) : '—');

/** "14 October", or null */
export const formatBirthday = (day, month) => (day && month ? `${day} ${MONTHS[month - 1]}` : null);

/** "today", "yesterday", "5 days ago" */
export function daysAgo(days) {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
