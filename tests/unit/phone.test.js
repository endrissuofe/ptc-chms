import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone, formatPhone } from '@/lib/phone';

describe('phone numbers', () => {
  it.each([
    ['0803 456 7890', '+2348034567890'],
    ['08034567890', '+2348034567890'],
    ['+234 803 456 7890', '+2348034567890'],
    ['2348034567890', '+2348034567890'],
    ['803-456-7890', '+2348034567890'],
    ['0901 000 0102', '+2349010000102'],
    ['0706 214 3375', '+2347062143375'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['12345', '0803 456 789', '0603 456 7890', '', null])('rejects %s', (input) => {
    expect(isValidPhone(input)).toBe(false);
  });

  it('formats for display', () => {
    expect(formatPhone('+2348034567890')).toBe('0803 456 7890');
  });
});
