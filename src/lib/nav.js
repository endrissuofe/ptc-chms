import { ROLES } from './roles';

const { USHER, FOLLOWUP, PASTOR, ADMIN, PRAYER } = ROLES;

/**
 * The app's menu, in order. The desktop rail shows every item the role can open
 * (unbuilt ones marked Soon); the phone tab bar shows up to five built ones.
 */
export const NAV = [
  { href: '/dashboard', label: 'Home', icon: 'home', roles: [PASTOR, ADMIN] },
  { href: '/today', label: 'Today', icon: 'dashboard', roles: [USHER, PASTOR, ADMIN] },
  { href: '/attendance', label: 'Attendance', icon: 'pin', roles: [USHER, PASTOR, ADMIN] },
  { href: '/newcomers/new', label: 'Cards', icon: 'person_add', roles: [USHER, PASTOR, ADMIN] },
  {
    href: '/my-newcomers',
    label: 'Follow-up',
    icon: 'call',
    roles: [FOLLOWUP, PASTOR, ADMIN],
  },
  {
    href: '/first-timers',
    label: 'First timers',
    icon: 'groups',
    roles: [PASTOR, ADMIN],
  },
  {
    href: '/prayer-requests',
    label: 'Prayer',
    icon: 'volunteer_activism',
    roles: [PRAYER, PASTOR, ADMIN],
  },
  { href: '/sms', label: 'SMS', icon: 'sms', roles: [ADMIN] },
  { href: '/members', label: 'Members', icon: 'contacts', roles: [ADMIN] },
  { href: '/services', label: 'Services', icon: 'event', roles: [PASTOR, ADMIN] },
  { href: '/users', label: 'Logins', icon: 'supervisor_account', roles: [ADMIN] },
  { href: '/modules', label: 'Later', icon: 'extension', roles: [PASTOR, ADMIN] },
];

export const ROLE_LABELS = {
  [USHER]: 'Usher',
  [FOLLOWUP]: 'Follow-up team',
  [PASTOR]: 'Pastor',
  [PRAYER]: 'Prayer team',
  [ADMIN]: 'Admin',
};

export function navFor(role) {
  const items = NAV.filter((i) => i.roles.includes(role));
  const built = items.filter((i) => !i.soon && i.href !== '/modules');
  const tabs = (built.length ? built : items).slice(0, 5);
  // Phones only show the tab bar; everything else goes in the account menu.
  const more = built.filter((i) => !tabs.includes(i));
  return { rail: items, tabs, more };
}
