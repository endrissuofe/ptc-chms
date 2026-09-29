/**
 * The media team's weekly list: what to post, and when. Weeks run Monday to Sunday (Lagos days).
 * Items the app lists by itself come from the church's services:
 * - announcement: the day before a regular service, 7 days before a special one
 * - livestream: on the day, for services streamed on YouTube (title, description, then the link)
 * Birthdays (from the Birthdays screen) and quick posts are added by the media service.
 *
 * Each item has a `ref` that never changes, e.g. "announcement:sunday:2026-10-04", so its status
 * can be saved the first time someone changes it.
 */
import { addDays, dayFromIso, isoDay, toServiceDate } from './dates';
import { isStreamed, servicesOn } from './church';

export const MEDIA_STATUSES = {
  todo: { label: 'To do', icon: 'radio_button_unchecked', chip: 'chip-warning' },
  ready: { label: 'Ready', icon: 'pending', chip: 'chip-violet' },
  posted: { label: 'Posted', icon: 'check_circle', chip: 'chip-success' },
};

export const MEDIA_KINDS = {
  announcement: { label: 'Announcement', icon: 'campaign', tone: 'tone-primary' },
  livestream: { label: 'YouTube live', icon: 'live_tv', tone: 'tone-danger' },
  celebrations: { label: 'Birthdays', icon: 'cake', tone: 'tone-coral' },
  post: { label: 'Quick post', icon: 'edit_note', tone: 'tone-teal' },
};

/** Days before a service its announcement goes on the list. */
export const ANNOUNCE_DAYS_BEFORE = { regular: 1, special: 7 };

/** The Monday of the week `date` falls in, as a service date. */
export function weekStart(date = new Date()) {
  const day = toServiceDate(date);
  return addDays(day, -((day.getUTCDay() + 6) % 7));
}

export const itemRef = {
  announcement: (service, date) => `announcement:${service}:${isoDay(date)}`,
  livestream: (service, date) => `livestream:${service}:${isoDay(date)}`,
  celebrations: (date) => `celebrations:${isoDay(date)}`,
  post: (id) => `post:${id}`,
};

const REF_RE =
  /^(?:(announcement|livestream):([a-z0-9-]{1,40}):(\d{4}-\d{2}-\d{2})|(celebrations):(\d{4}-\d{2}-\d{2})|(post):([a-f0-9]{24}))$/;

/** "announcement:sunday:2026-10-04" -> { kind, service, serviceDate }; null if not a real ref. */
export function parseRef(ref) {
  const m = REF_RE.exec(String(ref));
  if (!m) return null;
  if (m[1]) return { kind: m[1], service: m[2], serviceDate: dayFromIso(m[3]) };
  if (m[4]) return { kind: m[4], date: dayFromIso(m[5]) };
  return { kind: m[6], id: m[7] };
}

/** The day a service's announcement goes on the list. */
export function announceOn(service, serviceDate) {
  let day = addDays(serviceDate, -ANNOUNCE_DAYS_BEFORE[service.kind]);
  // A special service added at short notice is announced from the day it was added.
  if (service.kind === 'special' && service.createdAt) {
    const added = toServiceDate(service.createdAt);
    if (added > day) day = added > serviceDate ? serviceDate : added;
  }
  return day;
}

/**
 * Announcements and YouTube lives on the list for the week starting `monday`, in date order.
 * @returns {{ ref, kind, date: Date, service: object, serviceDate: Date }[]}
 */
export function plannedItems(services, monday) {
  const end = addDays(monday, 7);
  const inWeek = (d) => d >= monday && d < end;
  const items = [];
  // Special services are announced up to 7 days ahead, so look two weeks on.
  for (let i = 0; i < 7 + ANNOUNCE_DAYS_BEFORE.special; i += 1) {
    const serviceDate = addDays(monday, i);
    for (const service of servicesOn(services, serviceDate)) {
      const on = announceOn(service, serviceDate);
      if (inWeek(on)) {
        items.push({
          ref: itemRef.announcement(service.key, serviceDate),
          kind: 'announcement',
          date: on,
          service,
          serviceDate,
        });
      }
      if (inWeek(serviceDate) && isStreamed(service)) {
        items.push({
          ref: itemRef.livestream(service.key, serviceDate),
          kind: 'livestream',
          date: serviceDate,
          service,
          serviceDate,
        });
      }
    }
  }
  return items.sort((a, b) => a.date - b.date);
}

/** Only real YouTube links (https, youtube.com or youtu.be) are saved and shown as links. */
export function isYouTubeUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      /^(www\.|m\.)?(youtube\.com|youtu\.be)$/.test(u.hostname) &&
      u.pathname.length > 1
    );
  } catch {
    return false;
  }
}
