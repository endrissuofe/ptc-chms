import { describe, it, expect } from 'vitest';
import { canAccess, ROLES } from '@/lib/roles';

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

  it('keeps service settings to admins and pastors', () => {
    expect(canAccess('/services', ROLES.ADMIN)).toBe(true);
    expect(canAccess('/services', ROLES.PASTOR)).toBe(true);
    expect(canAccess('/services', ROLES.USHER)).toBe(false);
  });

  it('keeps ushers out of newcomer profiles', () => {
    expect(canAccess('/newcomers/abc123', ROLES.USHER)).toBe(false);
    expect(canAccess('/newcomers/abc123', ROLES.FOLLOWUP)).toBe(true);
  });
});
