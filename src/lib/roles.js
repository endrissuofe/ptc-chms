/** Who can do what. Keep every permission rule in this one file. */
export const ROLES = {
  USHER: 'usher',
  FOLLOWUP: 'followup',
  PASTOR: 'pastor',
  PRAYER: 'prayer', // prayer department: sees prayer requests only
  MEDIA: 'media', // media team: birthdays, anniversaries and the church's posts (Media screen)
  ADMIN: 'admin',
};

export const ALL_ROLES = Object.values(ROLES);

/** Route prefixes and the roles allowed to open them (used by middleware). */
export const ROUTE_ACCESS = [
  { prefix: '/today', roles: [ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/attendance', roles: [ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/newcomers/new', roles: [ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/my-newcomers', roles: [ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/newcomers', roles: [ROLES.FOLLOWUP, ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/dashboard', roles: [ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/first-timers', roles: [ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/prayer-requests', roles: [ROLES.PRAYER, ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/sms', roles: [ROLES.ADMIN] },
  { prefix: '/services', roles: [ROLES.ADMIN, ROLES.PASTOR] },
  { prefix: '/members', roles: [ROLES.ADMIN] },
  { prefix: '/users', roles: [ROLES.ADMIN] },
  { prefix: '/alerts', roles: [ROLES.ADMIN] },
  { prefix: '/birthdays', roles: [ROLES.MEDIA, ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/media', roles: [ROLES.MEDIA, ROLES.PASTOR, ROLES.ADMIN] },
  // Coming soon: the screens exist and only say so for now.
  { prefix: '/departments', roles: [ROLES.PASTOR, ROLES.ADMIN] },
  { prefix: '/giving', roles: [ROLES.PASTOR, ROLES.ADMIN] },
];

/**
 * Media screen. The media team and admins run the list (statuses, quick posts, brand kit);
 * pastors see it all and can also fill in what a service is about (theme, preacher, Bible text,
 * YouTube link).
 */
export const MEDIA_EDITORS = [ROLES.MEDIA, ROLES.ADMIN];
export const SERVICE_DETAIL_EDITORS = [ROLES.MEDIA, ROLES.PASTOR, ROLES.ADMIN];

/** Home screen after sign-in, by role. */
export const HOME_BY_ROLE = {
  [ROLES.USHER]: '/today',
  [ROLES.FOLLOWUP]: '/my-newcomers',
  [ROLES.PASTOR]: '/dashboard',
  [ROLES.PRAYER]: '/prayer-requests',
  [ROLES.MEDIA]: '/media',
  [ROLES.ADMIN]: '/dashboard',
};

export function canAccess(pathname, role) {
  const rule = ROUTE_ACCESS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  if (!rule) return true;
  return rule.roles.includes(role);
}

export function hasRole(user, ...roles) {
  return Boolean(user && roles.includes(user.role));
}
