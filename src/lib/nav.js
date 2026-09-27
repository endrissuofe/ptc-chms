import { ROLES } from './roles';

const { USHER, FOLLOWUP, PASTOR, ADMIN, PRAYER } = ROLES;

/** The app's menu, in order. The desktop rail shows every item the role can open. */
export const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home', roles: [PASTOR, ADMIN] },
  { href: '/today', label: 'Today', icon: 'dashboard', roles: [USHER, PASTOR, ADMIN] },
  { href: '/attendance', label: 'Attendance', icon: 'pin', roles: [USHER, PASTOR, ADMIN] },
  { href: '/newcomers/new', label: 'Cards', icon: 'person_add', roles: [USHER, PASTOR, ADMIN] },
  { href: '/my-newcomers', label: 'Follow-up', icon: 'call', roles: [FOLLOWUP, PASTOR, ADMIN] },
  { href: '/first-timers', label: 'First timers', icon: 'groups', roles: [PASTOR, ADMIN] },
  {
    href: '/prayer-requests',
    label: 'Prayer',
    icon: 'volunteer_activism',
    roles: [PRAYER, PASTOR, ADMIN],
  },
  { href: '/sms', label: 'SMS', icon: 'sms', roles: [ADMIN] },
  { href: '/members', label: 'Members', icon: 'contacts', roles: [ADMIN] },
  { href: '/services', label: 'Services', icon: 'event', roles: [PASTOR, ADMIN] },
  { href: '/alerts', label: 'Alerts', icon: 'mail', roles: [ADMIN] },
  { href: '/users', label: 'Logins', icon: 'supervisor_account', roles: [ADMIN] },
];

/**
 * Phone tab bar: the screens each role uses most. Anything else the role can open goes
 * under a "More" tab, so every screen is reachable on a phone.
 */
const PHONE_TABS = {
  [USHER]: ['/today', '/attendance', '/newcomers/new'],
  [PASTOR]: ['/dashboard', '/first-timers', '/my-newcomers', '/prayer-requests'],
  [ADMIN]: ['/dashboard', '/first-timers', '/my-newcomers', '/newcomers/new'],
};

export const ROLE_LABELS = {
  [USHER]: 'Usher',
  [FOLLOWUP]: 'Follow-up team',
  [PASTOR]: 'Pastor',
  [PRAYER]: 'Prayer team',
  [ADMIN]: 'Admin',
};

export function navFor(role) {
  const items = NAV.filter((i) => i.roles.includes(role));
  const wanted = PHONE_TABS[role];
  const tabs = wanted ? items.filter((i) => wanted.includes(i.href)) : items.slice(0, 5);
  const more = items.filter((i) => !tabs.includes(i));
  return { rail: items, tabs, more };
}
