import { describe, it, expect } from 'vitest';
import { smsSegments, unicodeCharacters } from '@/lib/sms/segments';
import { renderTemplate, unknownTags } from '@/lib/sms/templates';

describe('smsSegments', () => {
  it('fits 160 plain characters on one page and splits longer ones into 153s', () => {
    expect(smsSegments('a'.repeat(160))).toMatchObject({ encoding: 'gsm', pages: 1 });
    expect(smsSegments('a'.repeat(161))).toMatchObject({ pages: 2, perPage: 153 });
    expect(smsSegments('a'.repeat(307))).toMatchObject({ pages: 3 });
  });

  it('counts { } [ ] and similar as two characters', () => {
    expect(smsSegments('{'.repeat(80)).pages).toBe(1);
    expect(smsSegments('{'.repeat(81)).pages).toBe(2);
  });

  it('switches to 70-character pages when the message has ₦, curly quotes or emoji', () => {
    expect(smsSegments('Offering ₦500')).toMatchObject({ encoding: 'unicode', pages: 1 });
    expect(smsSegments(`We’re glad ${'a'.repeat(60)}`)).toMatchObject({ pages: 2, perPage: 67 });
    expect(unicodeCharacters('We’re glad 🙏')).toEqual(['’', '🙏']);
  });
});

describe('template tags', () => {
  it('fills known tags and leaves unknown ones', () => {
    expect(renderTemplate('Hi {FirstName}, see you {Day}', { FirstName: 'Kemi' })).toBe(
      'Hi Kemi, see you {Day}',
    );
  });

  it('spots tags a template cannot fill', () => {
    expect(unknownTags('sunday_thanks', 'Hi {FirstName} {ServiceTimes}')).toEqual(['ServiceTimes']);
    expect(unknownTags('saturday_invite', 'Hi {FirstName} {ServiceTimes}')).toEqual([]);
    expect(unknownTags('sunday_thanks', 'Hi {Firstname}')).toEqual(['Firstname']);
  });
});
