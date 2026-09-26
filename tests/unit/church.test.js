import { describe, it, expect } from 'vitest';
import {
  formatServiceTime,
  serviceKeyFromName,
  sortServices,
  suggestedService,
  describeServiceTimes,
} from '@/lib/church';

const svc = (key, startTime, order) => ({ key, name: key, startTime, order, active: true });

describe('formatServiceTime', () => {
  it('turns 24-hour times into church-notice times', () => {
    expect(formatServiceTime('08:00')).toBe('8:00 AM');
    expect(formatServiceTime('00:15')).toBe('12:15 AM');
    expect(formatServiceTime('12:00')).toBe('12:00 PM');
    expect(formatServiceTime('17:30')).toBe('5:30 PM');
  });
});

describe('serviceKeyFromName', () => {
  it('makes a readable key that does not clash with existing ones', () => {
    expect(serviceKeyFromName('2nd Service')).toBe('2nd-service');
    expect(serviceKeyFromName('Sunday Service', ['sunday-service'])).toBe('sunday-service-2');
    expect(serviceKeyFromName('!!!')).toBe('service');
  });
});

describe('sortServices', () => {
  it('orders by the admin order, then start time', () => {
    const list = [svc('b', '10:00', 2), svc('c', '07:00', 2), svc('a', '09:00', 1)];
    expect(sortServices(list).map((s) => s.key)).toEqual(['a', 'c', 'b']);
  });
});

describe('suggestedService', () => {
  const two = [svc('first', '07:30', 1), svc('second', '09:30', 2)];

  it('picks the first service whose headcount is still missing', () => {
    expect(suggestedService(two, {})).toBe('first');
    expect(suggestedService(two, { first: true })).toBe('second');
    expect(suggestedService(two, { second: true })).toBe('first');
  });

  it('stays on the last service once all are recorded, and copes with one or none', () => {
    expect(suggestedService(two, { first: true, second: true })).toBe('second');
    expect(suggestedService([svc('sunday', '08:00', 1)], { sunday: true })).toBe('sunday');
    expect(suggestedService([], {})).toBeNull();
  });
});

describe('describeServiceTimes', () => {
  it('writes one, two or more service times as a sentence', () => {
    expect(describeServiceTimes([svc('sunday', '08:00', 1)])).toBe('Service starts at 8:00 AM.');
    expect(describeServiceTimes([svc('b', '09:30', 2), svc('a', '07:30', 1)])).toBe(
      'Services start at 7:30 AM and 9:30 AM.',
    );
    expect(
      describeServiceTimes([svc('a', '07:00', 1), svc('b', '09:00', 2), svc('c', '11:00', 3)]),
    ).toBe('Services start at 7:00 AM, 9:00 AM and 11:00 AM.');
  });
});
