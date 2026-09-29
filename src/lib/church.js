/**
 * Church services. Admins manage them on the Services screen (pastors can add special ones).
 * - regular: repeats on weekdays, e.g. Sunday Service on Sundays at 08:00.
 * - special: happens once, on `date`, e.g. a Thanksgiving Service.
 * Attendance and visits store the service `key`, which never changes after creation,
 * so renaming or retiming a service keeps its history.
 * Service dates are midnight UTC of the Lagos calendar day (see lib/dates.js).
 */

import { addDays } from './dates';

export const SERVICE_KINDS = ['regular', 'special'];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_PLURALS = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

/** Created automatically when no services exist yet. */
export const DEFAULT_SERVICES = [
  {
    key: 'sunday',
    name: 'Sunday Service',
    kind: 'regular',
    days: [0],
    startTime: '08:00',
    active: true,
    livestream: true,
  },
  {
    key: 'midweek',
    name: 'Midweek Service',
    kind: 'regular',
    days: [3],
    startTime: '18:30',
    active: true,
    livestream: false,
  },
];

/**
 * Is this service streamed live on YouTube? Admins switch it on the Services screen; until then
 * special services and Sunday services are, others (e.g. midweek) are not.
 */
export function isStreamed(service) {
  if (typeof service.livestream === 'boolean') return service.livestream;
  return service.kind === 'special' || (service.days || []).includes(0);
}

/** How far back ushers may record attendance and cards. */
export const USHER_BACKDATE_DAYS = 7;

/** 24-hour "HH:mm", Lagos time. */
export const START_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "08:00" -> "8:00 AM", "13:30" -> "1:30 PM". */
export function formatServiceTime(startTime) {
  const [h, m] = startTime.split(':').map(Number);
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Stable key from a name, unique among `taken`: "2nd Service" -> "2nd-service". */
export function serviceKeyFromName(name, taken = []) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'service';
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}-${n}`;
  return key;
}

/** Services on the same day are shown in start-time order. */
export function sortServices(services) {
  return [...services].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name),
  );
}

const sameDay = (a, b) => new Date(a).getTime() === new Date(b).getTime();

/** Is this service held on `serviceDate`? */
export function isHeldOn(service, serviceDate) {
  if (!service.active) return false;
  if (service.kind === 'special')
    return Boolean(service.date) && sameDay(service.date, serviceDate);
  return (service.days || []).includes(new Date(serviceDate).getUTCDay());
}

/** Active services held on `serviceDate`, in start-time order. */
export function servicesOn(services, serviceDate) {
  return sortServices(services.filter((s) => isHeldOn(s, serviceDate)));
}

/** "Sundays · 8:00 AM", "Sundays and Wednesdays · 6:30 PM", "Sat 14 Nov 2026 · 10:00 AM". */
export function describeSchedule(service) {
  const time = formatServiceTime(service.startTime);
  if (service.kind === 'special') {
    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(service.date));
    return `${date} · ${time}`;
  }
  const days = [...(service.days || [])].sort().map((d) => WEEKDAY_PLURALS[d]);
  const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days.at(-1)}` : days[0];
  return `${list} · ${time}`;
}

/**
 * The service an usher most likely wants: the first one whose headcount isn't recorded yet,
 * otherwise the last one.
 * @param {{key: string}[]} services  services held that day, in display order
 * @param {Record<string, boolean>} recorded  e.g. { sunday: true }
 */
export function suggestedService(services, recorded = {}) {
  if (!services.length) return null;
  return (services.find((s) => !recorded[s.key]) ?? services[services.length - 1]).key;
}

/** Sentence for the Saturday invite SMS, e.g. "Service starts at 8:00 AM." */
export function describeServiceTimes(services) {
  const times = sortServices(services).map((s) => formatServiceTime(s.startTime));
  if (!times.length) return '';
  if (times.length === 1) return `Service starts at ${times[0]}.`;
  return `Services start at ${times.slice(0, -1).join(', ')} and ${times[times.length - 1]}.`;
}

/** Days from `today` back `daysBack` days (newest first) that have at least one service. */
export function recentServiceDays(services, today, daysBack = USHER_BACKDATE_DAYS) {
  const days = [];
  for (let i = 0; i <= daysBack; i += 1) {
    const day = addDays(today, -i);
    if (servicesOn(services, day).length) days.push(day);
  }
  return days;
}

/** The next day after `today` (within two weeks) with a service, and its services. */
export function nextServiceDay(services, today) {
  for (let i = 1; i <= 14; i += 1) {
    const day = addDays(today, i);
    const held = servicesOn(services, day);
    if (held.length) return { serviceDate: day, services: held };
  }
  return null;
}
