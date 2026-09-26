/**
 * Service dates are stored as midnight UTC of the Lagos calendar date,
 * so "Sunday 27 Sept" is the same key everywhere regardless of the server's time zone.
 */
const TZ = process.env.TZ_CHURCH || 'Africa/Lagos';

export function lagosDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday'),
  };
}

export function toServiceDate(date = new Date()) {
  const { year, month, day } = lagosDateParts(new Date(date));
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function isoDay(date) {
  return new Date(date).toISOString().slice(0, 10);
}
