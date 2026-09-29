import { ROLES } from './roles';

const { USHER, FOLLOWUP, PASTOR, ADMIN, PRAYER, MEDIA } = ROLES;

/** Menu sections, in order. A heading shows only when the role has more than one section. */
export const NAV_GROUPS = [
  { key: 'people', label: 'People' },
  { key: 'ushering', label: 'Ushering' },
  { key: 'church', label: 'Church' },
  { key: 'settings', label: 'Settings' },
];

/**
 * The app's menu, in order within each section. The desktop rail shows every item the role
 * can open. `soon`: the screen isn't built yet; the menu tags it "Soon" and the page says so.
 */
export const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home', group: 'people', roles: [PASTOR, ADMIN] },
  {
    href: '/my-newcomers',
    label: 'Follow-up',
    icon: 'call',
    group: 'people',
    roles: [FOLLOWUP, PASTOR, ADMIN],
  },
  {
    href: '/first-timers',
    label: 'First timers',
    icon: 'groups',
    group: 'people',
    roles: [PASTOR, ADMIN],
  },
  {
    href: '/prayer-requests',
    label: 'Prayer',
    icon: 'volunteer_activism',
    group: 'people',
    roles: [PRAYER, PASTOR, ADMIN],
  },
  {
    href: '/birthdays',
    label: 'Birthdays',
    icon: 'cake',
    group: 'people',
    roles: [MEDIA, PASTOR, ADMIN],
  },
  { href: '/members', label: 'Members', icon: 'contacts', group: 'people', roles: [ADMIN] },
  {
    href: '/today',
    label: 'Today',
    icon: 'dashboard',
    group: 'ushering',
    roles: [USHER, PASTOR, ADMIN],
  },
  {
    href: '/attendance',
    label: 'Attendance',
    icon: 'pin',
    group: 'ushering',
    roles: [USHER, PASTOR, ADMIN],
  },
  {
    href: '/newcomers/new',
    label: 'Cards',
    icon: 'person_add',
    group: 'ushering',
    roles: [USHER, PASTOR, ADMIN],
  },
  { href: '/services', label: 'Services', icon: 'event', group: 'church', roles: [PASTOR, ADMIN] },
  {
    href: '/departments',
    label: 'Departments',
    icon: 'diversity_3',
    group: 'church',
    roles: [PASTOR, ADMIN],
    soon: true,
  },
  {
    href: '/giving',
    label: 'Giving',
    icon: 'account_balance_wallet',
    group: 'church',
    roles: [PASTOR, ADMIN],
    soon: true,
  },
  {
    href: '/media',
    label: 'Media',
    icon: 'photo_library',
    group: 'church',
    roles: [MEDIA, PASTOR, ADMIN],
    soon: true,
  },
  { href: '/sms', label: 'SMS', icon: 'sms', group: 'settings', roles: [ADMIN] },
  { href: '/alerts', label: 'Alerts', icon: 'mail', group: 'settings', roles: [ADMIN] },
  {
    href: '/users',
    label: 'Logins',
    icon: 'supervisor_account',
    group: 'settings',
    roles: [ADMIN],
  },
];

/**
 * Items split into their sections, empty sections left out. With a single section the heading
 * is dropped (label null): a short menu doesn't need one.
 */
export function groupNav(items) {
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: items.filter((i) => i.group === g.key),
  })).filter((g) => g.items.length);
  return groups.length > 1 ? groups : groups.map((g) => ({ ...g, label: null }));
}

/**
 * Phone tab bar: the screens each role uses most, in tab order. Anything else the role can open goes
 * under a "More" tab, so every screen is reachable on a phone.
 */
const PHONE_TABS = {
  [USHER]: ['/today', '/attendance', '/newcomers/new'],
  [PASTOR]: ['/dashboard', '/my-newcomers', '/first-timers', '/prayer-requests'],
  [ADMIN]: ['/dashboard', '/newcomers/new', '/my-newcomers', '/first-timers'],
};

export const ROLE_LABELS = {
  [USHER]: 'Usher',
  [FOLLOWUP]: 'Follow-up team',
  [PASTOR]: 'Pastor',
  [PRAYER]: 'Prayer team',
  [MEDIA]: 'Media team',
  [ADMIN]: 'Admin',
};

export function navFor(role) {
  const items = NAV.filter((i) => i.roles.includes(role));
  const wanted = PHONE_TABS[role];
  // Tabs in the order listed above (not menu order), so the tab bar stays put.
  const tabs = wanted
    ? wanted.map((href) => items.find((i) => i.href === href)).filter(Boolean)
    : items.slice(0, 5);
  const more = items.filter((i) => !tabs.includes(i));
  return { rail: items, tabs, more };
}
