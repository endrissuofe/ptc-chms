import { describe, it, expect } from 'vitest';
import { canAccess, ROLES } from '@/lib/roles';
import { navFor } from '@/lib/nav';

describe('route access', () => {
  it('keeps prayer requests to the prayer team, pastors and admins', () => {
    expect(canAccess('/prayer-requests', ROLES.PRAYER)).toBe(true);
    expect(canAccess('/prayer-requests', ROLES.PASTOR)).toBe(true);
    expect(canAccess('/prayer-requests', ROLES.ADMIN)).toBe(true);
    expect(canAccess('/prayer-requests', ROLES.USHER)).toBe(false);
    expect(canAccess('/prayer-requests', ROLES.FOLLOWUP)).toBe(false);
    expect(canAccess('/today', ROLES.PRAYER)).toBe(false);
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

  it('shows the coming-soon screens only to the people they will be for', () => {
    for (const path of ['/departments', '/giving']) {
      expect(canAccess(path, ROLES.PASTOR)).toBe(true);
      expect(canAccess(path, ROLES.ADMIN)).toBe(true);
      expect(canAccess(path, ROLES.MEDIA)).toBe(false);
      expect(canAccess(path, ROLES.USHER)).toBe(false);
    }
    expect(canAccess('/media', ROLES.MEDIA)).toBe(true);
    expect(canAccess('/media', ROLES.ADMIN)).toBe(true);
    expect(canAccess('/media', ROLES.FOLLOWUP)).toBe(false);
  });
});

describe('menu', () => {
  it('tags coming-soon screens and gives each to the right roles', () => {
    const labels = (role) =>
      navFor(role)
        .rail.filter((i) => i.soon)
        .map((i) => i.label);
    expect(labels(ROLES.ADMIN)).toEqual(['Departments', 'Giving', 'Media']);
    expect(labels(ROLES.MEDIA)).toEqual(['Media']);
    expect(labels(ROLES.USHER)).toEqual([]);
  });
});
