import { describe, it, expect } from 'vitest';
import { isStreamed } from '@/lib/church';
import { dayFromIso, isoDay } from '@/lib/dates';
import { announceOn, isYouTubeUrl, parseRef, plannedItems, weekStart } from '@/lib/media';
import {
  YOUTUBE_TITLE_MAX,
  hashtagLine,
  parseHashtags,
  postTexts,
  serviceTexts,
  youtubeTexts,
  youtubeTitle,
} from '@/lib/media-captions';

const sunday = {
  key: 'sunday',
  name: 'Sunday Service',
  kind: 'regular',
  days: [0],
  startTime: '08:00',
  active: true,
  livestream: true,
};
const midweek = {
  key: 'midweek',
  name: 'Midweek Service',
  kind: 'regular',
  days: [3],
  startTime: '18:30',
  active: true,
  livestream: false,
};
const thanksgiving = {
  key: 'thanksgiving',
  name: 'Thanksgiving Service',
  kind: 'special',
  date: dayFromIso('2026-10-10'),
  startTime: '10:00',
  active: true,
  livestream: true,
};
const church = { name: 'Grace Chapel' };
const brand = {
  address: '12 Palm Avenue, Ikeja',
  facebook: 'https://facebook.com/gracechapel',
  instagram: 'gracechapel',
  youtube: 'https://youtube.com/@gracechapel',
  hashtags: ['GraceChapel', 'SundayService'],
  signoff: '',
};

describe('media week', () => {
  it('starts weeks on Monday, Lagos time', () => {
    expect(isoDay(weekStart(new Date('2026-10-04T10:00:00Z')))).toBe('2026-09-28'); // Sunday
    expect(isoDay(weekStart(new Date('2026-09-28T00:30:00Z')))).toBe('2026-09-28'); // Monday
    expect(isoDay(weekStart(new Date('2026-09-27T23:30:00Z')))).toBe('2026-09-28'); // 00:30 Mon in Lagos
  });

  it('streams Sunday and special services unless an admin says otherwise', () => {
    expect(isStreamed({ ...sunday, livestream: undefined })).toBe(true);
    expect(isStreamed({ ...midweek, livestream: undefined })).toBe(false);
    expect(isStreamed({ ...thanksgiving, livestream: undefined })).toBe(true);
    expect(isStreamed({ ...sunday, livestream: false })).toBe(false);
  });

  it('lists announcements the day before, or 7 days before a special service, and YouTube lives on the day', () => {
    const items = plannedItems([sunday, midweek, thanksgiving], dayFromIso('2026-09-28'));
    expect(items.map((i) => [i.ref, isoDay(i.date)])).toEqual([
      ['announcement:midweek:2026-09-30', '2026-09-29'],
      ['announcement:sunday:2026-10-04', '2026-10-03'],
      ['announcement:thanksgiving:2026-10-10', '2026-10-03'],
      ['livestream:sunday:2026-10-04', '2026-10-04'],
    ]);
    // Next week: the thanksgiving live, but no second announcement.
    const next = plannedItems([sunday, midweek, thanksgiving], dayFromIso('2026-10-05'));
    expect(next.filter((i) => i.service.key === 'thanksgiving').map((i) => i.ref)).toEqual([
      'livestream:thanksgiving:2026-10-10',
    ]);
  });

  it('announces a special service added at short notice from the day it was added', () => {
    const late = { ...thanksgiving, createdAt: new Date('2026-10-07T12:00:00Z') };
    expect(isoDay(announceOn(late, late.date))).toBe('2026-10-07');
    const sameDay = { ...thanksgiving, createdAt: new Date('2026-10-12T12:00:00Z') };
    expect(isoDay(announceOn(sameDay, sameDay.date))).toBe('2026-10-10');
  });

  it('reads item refs and refuses anything else', () => {
    expect(parseRef('announcement:sunday:2026-10-04')).toMatchObject({
      kind: 'announcement',
      service: 'sunday',
    });
    expect(parseRef('celebrations:2026-10-04')).toMatchObject({ kind: 'celebrations' });
    expect(parseRef('post:0123456789abcdef01234567')).toEqual({
      kind: 'post',
      id: '0123456789abcdef01234567',
    });
    expect(parseRef('post:nope')).toBeNull();
    expect(parseRef('announcement:$where:2026-10-04')).toBeNull();
  });

  it('accepts only real YouTube links', () => {
    expect(isYouTubeUrl('https://youtu.be/abc123')).toBe(true);
    expect(isYouTubeUrl('https://www.youtube.com/live/abc123')).toBe(true);
    expect(isYouTubeUrl('http://youtu.be/abc123')).toBe(false);
    expect(isYouTubeUrl('https://youtube.com.evil.example/x')).toBe(false);
    expect(isYouTubeUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('media captions', () => {
  const serviceDate = dayFromIso('2026-10-04');
  const about = { theme: 'Walking in Favour', preacher: 'Pastor Ade', bibleText: 'Psalm 5:12' };

  it('writes a WhatsApp message with bold title and the brand kit', () => {
    const { whatsapp } = serviceTexts({ service: sunday, serviceDate, about, brand, church });
    expect(whatsapp).toBe(
      [
        '*Sunday Service*\nSunday 4 October · 8:00 AM\n📍 12 Palm Avenue, Ikeja',
        'Theme: *Walking in Favour*\nMinister: Pastor Ade\nBible text: Psalm 5:12',
        '📺 Watch live on YouTube: https://youtube.com/@gracechapel',
        'Come and worship with us!\n— Grace Chapel',
      ].join('\n\n'),
    );
  });

  it('leaves out what isn’t filled in, and YouTube for services not streamed', () => {
    const { whatsapp, facebook, instagram } = serviceTexts({
      service: midweek,
      serviceDate: dayFromIso('2026-09-30'),
      brand: {},
      church,
    });
    expect(whatsapp).toBe(
      '*Midweek Service*\nWednesday 30 September · 6:30 PM\n\nCome and worship with us!\n— Grace Chapel',
    );
    expect(facebook).not.toMatch(/YouTube|#/);
    expect(instagram).toBe('Midweek Service ✨\nWednesday 30 September · 6:30 PM');
  });

  it('ends Facebook and Instagram posts with the hashtags', () => {
    const { facebook, instagram } = serviceTexts({
      service: sunday,
      serviceDate,
      about,
      brand,
      church,
    });
    expect(facebook.endsWith('#GraceChapel #SundayService')).toBe(true);
    expect(instagram.endsWith('#GraceChapel #SundayService')).toBe(true);
    expect(facebook).toContain('Theme: “Walking in Favour”');
  });

  it('keeps YouTube titles within 100 characters, shortening the theme', () => {
    expect(youtubeTitle({ service: sunday, serviceDate, about })).toBe(
      'Sunday Service · Walking in Favour · 4 Oct 2026',
    );
    expect(youtubeTitle({ service: sunday, serviceDate })).toBe('Sunday Service · 4 Oct 2026');
    const long = youtubeTitle({ service: sunday, serviceDate, about: { theme: 'x'.repeat(200) } });
    expect(long.length).toBeLessThanOrEqual(YOUTUBE_TITLE_MAX);
    expect(long).toMatch(/^Sunday Service · x+… · 4 Oct 2026$/);
    expect(youtubeTitle({ service: sunday, serviceDate, about: { theme: '<b>Joy</b>' } })).toBe(
      'Sunday Service · bJoy/b · 4 Oct 2026',
    );
  });

  it('writes a YouTube description with the church’s links', () => {
    const { description } = youtubeTexts({ service: sunday, serviceDate, about, brand, church });
    expect(description).toContain('Sunday Service at Grace Chapel, Sunday 4 October 2026.');
    expect(description).toContain('Instagram: https://www.instagram.com/gracechapel');
    expect(description).toContain('Facebook: https://facebook.com/gracechapel');
  });

  it('writes quick posts with the team’s words and the church’s ending', () => {
    const t = postTexts({
      title: 'Choir rehearsal moved',
      details: 'Rehearsal is on Friday at 5 PM this week.',
      brand: { ...brand, signoff: 'God bless you! 🙏' },
      church,
    });
    expect(t.whatsapp).toBe(
      '*Choir rehearsal moved*\n\nRehearsal is on Friday at 5 PM this week.\n\nGod bless you! 🙏',
    );
    expect(t.instagram.endsWith('#GraceChapel #SundayService')).toBe(true);
  });

  it('tidies hashtags however they are typed', () => {
    expect(parseHashtags('#GraceChapel, sunday-service  #GraceChapel ##Faith')).toEqual([
      'GraceChapel',
      'sundayservice',
      'Faith',
    ]);
    expect(hashtagLine(['a', 'b'])).toBe('#a #b');
  });
});
