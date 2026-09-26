/**
 * Church services (e.g. "Sunday Service", or "1st Service" / "2nd Service" once the church
 * runs more than one). They are records managed by admins; see services/churchService.service.js.
 * Attendance and visits store the service `key`, which never changes after creation,
 * so renaming or retiming a service keeps its history.
 */

/** Created automatically when no services exist yet. */
export const DEFAULT_SERVICE = {
  key: 'sunday',
  name: 'Sunday Service',
  startTime: '08:00',
  order: 1,
  active: true,
};

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

/** Display order: admin-chosen order, then start time. */
export function sortServices(services) {
  return [...services].sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime));
}

/**
 * The service an usher most likely wants on the Today screen:
 * the first one whose headcount isn't recorded yet, otherwise the last one.
 * @param {{key: string}[]} services  active services, in display order
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
