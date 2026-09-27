import { describe, it, expect } from 'vitest';
import { safeCallbackUrl } from '@/lib/safe-url';
import { personUpdateSchema } from '@/lib/validators/newcomer';

const ORIGIN = 'https://ptc-chms.vercel.app';

describe('after sign-in redirect', () => {
  it('keeps pages on this site', () => {
    expect(safeCallbackUrl('/first-timers?view=lost', ORIGIN)).toBe('/first-timers?view=lost');
    expect(safeCallbackUrl(`${ORIGIN}/sms#broadcast`, ORIGIN)).toBe('/sms#broadcast');
  });

  it('never sends people to another site', () => {
    expect(safeCallbackUrl('https://example.org/phish', ORIGIN)).toBe('/');
    expect(safeCallbackUrl('//example.org/phish', ORIGIN)).toBe('/');
    expect(safeCallbackUrl('javascript:alert(1)', ORIGIN)).toBe('/');
    expect(safeCallbackUrl('/login?callbackUrl=/x', ORIGIN)).toBe('/');
    expect(safeCallbackUrl(null, ORIGIN)).toBe('/');
  });
});

describe('correcting a first timer', () => {
  it('leaves SMS consent alone unless it is being changed', () => {
    expect(personUpdateSchema.parse({ inBelieversClass: true })).toEqual({
      inBelieversClass: true,
    });
    expect(personUpdateSchema.parse({ lastName: 'Eze' })).not.toHaveProperty('smsConsent');
    expect(personUpdateSchema.parse({ smsConsent: false })).toEqual({ smsConsent: false });
  });
});
