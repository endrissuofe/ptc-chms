import { describe, it, expect } from 'vitest';
import { followUpState, waiting, whatsAppLink, telLink } from '@/lib/followup';
import { csvCell, peopleCsv } from '@/lib/export';

const visit = new Date('2026-09-20T00:00:00Z');

describe('follow-up state', () => {
  it('needs a call until someone gets through after the latest visit', () => {
    expect(followUpState({ lastVisitDate: visit })).toEqual({
      state: 'to_call',
      tried: false,
      lastOutcome: null,
    });
    expect(
      followUpState({
        lastVisitDate: visit,
        lastAttemptAt: new Date('2026-09-21T10:00:00Z'),
        lastOutcome: 'no_answer',
      }),
    ).toEqual({ state: 'to_call', tried: true, lastOutcome: 'no_answer' });
    expect(
      followUpState({ lastVisitDate: visit, lastContactAt: new Date('2026-09-21T10:00:00Z') }),
    ).toMatchObject({ state: 'reached' });
  });

  it('starts a new round on every visit', () => {
    const reachedBefore = {
      lastVisitDate: visit,
      lastContactAt: new Date('2026-09-15T10:00:00Z'),
      lastAttemptAt: new Date('2026-09-15T10:00:00Z'),
      lastOutcome: 'reached',
    };
    expect(followUpState(reachedBefore)).toEqual({
      state: 'to_call',
      tried: false,
      lastOutcome: null,
    });
  });

  it('flags a wrong number', () => {
    expect(
      followUpState({
        lastVisitDate: visit,
        lastAttemptAt: new Date('2026-09-21T10:00:00Z'),
        lastOutcome: 'wrong_number',
      }).state,
    ).toBe('wrong_number');
  });

  it('counts waiting days in Lagos days, overdue after 3', () => {
    expect(waiting({ lastVisitDate: visit }, new Date('2026-09-23T23:30:00Z'))).toEqual({
      days: 4, // 23:30 UTC is 00:30 on the 24th in Lagos
      overdue: true,
    });
    expect(waiting({ lastVisitDate: visit }, new Date('2026-09-22T10:00:00Z')).overdue).toBe(false);
  });

  it('builds call and WhatsApp links', () => {
    expect(telLink('+2348031234567')).toBe('tel:+2348031234567');
    expect(whatsAppLink('+2348031234567')).toBe('https://wa.me/2348031234567');
  });
});

describe('spreadsheet export', () => {
  it('quotes cells and keeps formulas as text', () => {
    expect(csvCell('Ada, Eze')).toBe('"Ada, Eze"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(null)).toBe('');
  });

  it('exports people without prayer requests, phones with the leading 0', () => {
    const csv = peopleCsv([
      {
        firstName: 'Kemi',
        lastName: 'Adebayo',
        phone: '+2348060000101',
        firstVisitDate: visit,
        lastVisitDate: visit,
        visitCount: 1,
        stage: 'first_timer',
        smsConsent: true,
        prayerRequest: 'private',
      },
    ]);
    const [header, row] = csv.replace('﻿', '').trim().split('\r\n');
    expect(header.split(',')).toContain('Phone');
    expect(row).toContain('0806 000 0101');
    expect(row).toContain('First Timer');
    expect(csv).not.toContain('private');
  });
});
