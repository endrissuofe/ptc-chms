import { describe, it, expect } from 'vitest';
import { canAccess, ROLES } from '@/lib/roles';
import { groupNav, navFor } from '@/lib/nav';

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

describe('menu sections', () => {
  it('puts Dashboard on its own, then People, Ushering, Church and Settings for admins', () => {
    const { top, groups } = groupNav(navFor(ROLES.ADMIN).rail);
    expect(top.map((i) => i.label)).toEqual(['Dashboard']);
    expect(groups.map((g) => g.label)).toEqual(['People', 'Ushering', 'Church', 'Settings']);
    expect(groups.flatMap((g) => g.items)).toHaveLength(15);
  });

  it('keeps short menus as a plain list', () => {
    for (const role of [ROLES.USHER, ROLES.FOLLOWUP, ROLES.PRAYER, ROLES.MEDIA]) {
      const { top, groups } = groupNav(navFor(role).rail);
      expect(groups).toEqual([]);
      expect(top).toEqual(navFor(role).rail);
    }
  });

  it('keeps the phone tabs in their usual order', () => {
    const tabs = (role) => navFor(role).tabs.map((i) => i.label);
    expect(tabs(ROLES.ADMIN)).toEqual(['Dashboard', 'Cards', 'Follow-up', 'First timers']);
    expect(tabs(ROLES.PASTOR)).toEqual(['Dashboard', 'Follow-up', 'First timers', 'Prayer']);
    expect(tabs(ROLES.USHER)).toEqual(['Today', 'Attendance', 'Cards']);
  });
});
