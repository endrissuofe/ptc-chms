import { describe, it, expect } from 'vitest';
import {
  describeSchedule,
  describeServiceTimes,
  formatServiceTime,
  isHeldOn,
  nextServiceDay,
  recentServiceDays,
  serviceKeyFromName,
  servicesOn,
  sortServices,
  suggestedService,
} from '@/lib/church';

const regular = (key, startTime, days) => ({
  key,
  name: key,
  kind: 'regular',
  days,
  startTime,
  active: true,
});
const special = (key, startTime, date) => ({
  key,
  name: key,
  kind: 'special',
  date: new Date(`${date}T00:00:00Z`),
  startTime,
  active: true,
});
const day = (iso) => new Date(`${iso}T00:00:00Z`);

const sundayService = regular('sunday', '08:00', [0]);
const midweek = regular('midweek', '18:30', [3]);
const thanksgiving = special('thanksgiving', '10:00', '2026-09-26');
const all = [midweek, sundayService, thanksgiving];

describe('formatServiceTime', () => {
  it('turns 24-hour times into church-notice times', () => {
    expect(formatServiceTime('08:00')).toBe('8:00 AM');
    expect(formatServiceTime('00:15')).toBe('12:15 AM');
    expect(formatServiceTime('12:00')).toBe('12:00 PM');
    expect(formatServiceTime('18:30')).toBe('6:30 PM');
  });
});

describe('serviceKeyFromName', () => {
  it('makes a readable key that does not clash with existing ones', () => {
    expect(serviceKeyFromName('2nd Service')).toBe('2nd-service');
    expect(serviceKeyFromName('Sunday Service', ['sunday-service'])).toBe('sunday-service-2');
    expect(serviceKeyFromName('!!!')).toBe('service');
  });
});

describe('which services are held on a day', () => {
  it('matches regular services by weekday and special ones by date', () => {
    expect(isHeldOn(sundayService, day('2026-09-27'))).toBe(true);
    expect(isHeldOn(sundayService, day('2026-09-23'))).toBe(false);
    expect(isHeldOn(midweek, day('2026-09-23'))).toBe(true);
    expect(isHeldOn(thanksgiving, day('2026-09-26'))).toBe(true);
    expect(isHeldOn(thanksgiving, day('2026-10-03'))).toBe(false);
    expect(isHeldOn({ ...sundayService, active: false }, day('2026-09-27'))).toBe(false);
  });

  it('lists a day’s services in start-time order', () => {
    const second = regular('second', '10:00', [0]);
    const first = regular('first', '07:30', [0]);
    expect(servicesOn([second, midweek, first], day('2026-09-27')).map((s) => s.key)).toEqual([
      'first',
      'second',
    ]);
    expect(sortServices([second, first]).map((s) => s.key)).toEqual(['first', 'second']);
  });

  it('finds the service days in the past week, newest first', () => {
    expect(
      recentServiceDays(all, day('2026-09-27')).map((d) => d.toISOString().slice(0, 10)),
    ).toEqual(['2026-09-27', '2026-09-26', '2026-09-23', '2026-09-20']);
  });

  it('finds the next service day', () => {
    const next = nextServiceDay(all, day('2026-09-28'));
    expect(next.serviceDate.toISOString().slice(0, 10)).toBe('2026-09-30');
    expect(next.services.map((s) => s.key)).toEqual(['midweek']);
    expect(nextServiceDay([], day('2026-09-28'))).toBeNull();
  });
});

describe('describeSchedule', () => {
  it('says when a service is held', () => {
    expect(describeSchedule(sundayService)).toBe('Sundays · 8:00 AM');
    expect(describeSchedule(regular('x', '18:30', [3, 0]))).toBe(
      'Sundays and Wednesdays · 6:30 PM',
    );
    expect(describeSchedule(thanksgiving)).toBe('Sat, 26 Sept 2026 · 10:00 AM');
  });
});

describe('suggestedService', () => {
  const two = [regular('first', '07:30', [0]), regular('second', '09:30', [0])];

  it('picks the first service whose headcount is still missing', () => {
    expect(suggestedService(two, {})).toBe('first');
    expect(suggestedService(two, { first: true })).toBe('second');
    expect(suggestedService(two, { second: true })).toBe('first');
  });

  it('stays on the last service once all are recorded, and copes with one or none', () => {
    expect(suggestedService(two, { first: true, second: true })).toBe('second');
    expect(suggestedService([sundayService], { sunday: true })).toBe('sunday');
    expect(suggestedService([], {})).toBeNull();
  });
});

describe('describeServiceTimes', () => {
  it('writes one, two or more service times as a sentence', () => {
    expect(describeServiceTimes([sundayService])).toBe('Service starts at 8:00 AM.');
    expect(describeServiceTimes([regular('b', '09:30', [0]), regular('a', '07:30', [0])])).toBe(
      'Services start at 7:30 AM and 9:30 AM.',
    );
    expect(
      describeServiceTimes([
        regular('a', '07:00', [0]),
        regular('b', '09:00', [0]),
        regular('c', '11:00', [0]),
      ]),
    ).toBe('Services start at 7:00 AM, 9:00 AM and 11:00 AM.');
  });
});

describe('verseOfTheDay', () => {
  it('gives the same verse all day in Lagos and a different one the next day', async () => {
    const { verseOfTheDay } = await import('@/lib/verses');
    const morning = verseOfTheDay(new Date('2026-09-27T06:00:00Z'));
    const night = verseOfTheDay(new Date('2026-09-27T22:30:00Z')); // 11:30 PM Lagos
    const nextDay = verseOfTheDay(new Date('2026-09-27T23:30:00Z')); // 00:30 AM Lagos
    expect(night).toEqual(morning);
    expect(nextDay).not.toEqual(morning);
    expect(morning.reference).toMatch(/\d/);
  });
});
