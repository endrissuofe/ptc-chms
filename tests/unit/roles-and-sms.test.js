import { describe, it, expect } from 'vitest';
import { canAccess, ROLES } from '@/lib/roles';
import { renderTemplate } from '@/lib/sms';

describe('route access', () => {
  it('keeps prayer requests to pastors', () => {
    expect(canAccess('/prayer-requests', ROLES.PASTOR)).toBe(true);
    expect(canAccess('/prayer-requests', ROLES.ADMIN)).toBe(false);
    expect(canAccess('/prayer-requests', ROLES.USHER)).toBe(false);
  });

  it('lets ushers enter cards but not see the dashboard', () => {
    expect(canAccess('/newcomers/new', ROLES.USHER)).toBe(true);
    expect(canAccess('/dashboard', ROLES.USHER)).toBe(false);
  });

  it('keeps ushers out of newcomer profiles', () => {
    expect(canAccess('/newcomers/abc123', ROLES.USHER)).toBe(false);
    expect(canAccess('/newcomers/abc123', ROLES.FOLLOWUP)).toBe(true);
  });
});

describe('SMS templates', () => {
  it('fills known tags and leaves unknown ones', () => {
    expect(renderTemplate('Hi {FirstName}, see you {Day}', { FirstName: 'Kemi' })).toBe(
      'Hi Kemi, see you {Day}',
    );
  });
});
