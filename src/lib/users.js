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
export const MIN_PASSWORD = 8;
