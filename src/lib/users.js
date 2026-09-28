import { ROLES } from './roles';

/** What each role can do, as shown when choosing one. Keep in step with ROUTE_ACCESS. */
export const ROLE_INFO = {
  [ROLES.USHER]: {
    label: 'Usher',
    icon: 'badge',
    does: 'Records the count and types in first-timer cards',
  },
  [ROLES.FOLLOWUP]: {
    label: 'Follow-up team',
    icon: 'call',
    does: 'Calls newcomers and logs the calls (no prayer requests)',
  },
  [ROLES.PRAYER]: {
    label: 'Prayer team',
    icon: 'volunteer_activism',
    does: 'Sees prayer requests only',
  },
  [ROLES.MEDIA]: {
    label: 'Media team',
    icon: 'photo_camera',
    does: 'Sees birthdays and anniversaries to post on the church’s socials',
  },
  [ROLES.PASTOR]: {
    label: 'Pastor',
    icon: 'church',
    does: 'Everything except SMS, Members and logins',
  },
  [ROLES.ADMIN]: {
    label: 'Admin',
    icon: 'shield_person',
    does: 'Everything, including SMS, Members and logins',
  },
};

export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

/** Teams people can join with an invite link. Admin is never offered: admins add admins. */
export const JOINABLE_ROLES = [
  ROLES.USHER,
  ROLES.FOLLOWUP,
  ROLES.PRAYER,
  ROLES.MEDIA,
  ROLES.PASTOR,
];

/**
 * The emails a login can get, and which roles may get each. `on` is the starting choice for
 * a new login in that role; the admin (Alerts) and the person (My account) can change it.
 */
export const ALERTS = {
  followUp: {
    label: 'Morning follow-up email',
    icon: 'forward_to_inbox',
    roles: [ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN],
    on: [ROLES.FOLLOWUP, ROLES.PASTOR],
  },
  celebrations: {
    label: 'Birthdays and anniversaries email',
    icon: 'cake',
    roles: [ROLES.MEDIA, ROLES.PASTOR, ROLES.ADMIN],
    on: [ROLES.MEDIA, ROLES.ADMIN],
  },
};

export const defaultAlerts = (role) =>
  Object.fromEntries(Object.entries(ALERTS).map(([key, a]) => [key, a.on.includes(role)]));

export const canGetAlert = (role, key) => Boolean(ALERTS[key]?.roles.includes(role));
export const MIN_PASSWORD = 8;
