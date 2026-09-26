import { describe, it, expect } from 'vitest';
import { birthdayProblem, daysInMonth } from '@/lib/birthday';
import { newcomerSchema } from '@/lib/validators/newcomer';

describe('birthdays (day and month only)', () => {
  it('knows month lengths, allowing 29 February', () => {
    expect(daysInMonth(2)).toBe(29);
    expect(daysInMonth(4)).toBe(30);
    expect(daysInMonth(12)).toBe(31);
  });

  it('needs both parts or neither, and a day that exists', () => {
    expect(birthdayProblem(undefined, undefined)).toBeNull();
    expect(birthdayProblem(29, 2)).toBeNull();
    expect(birthdayProblem(14, undefined)).toBe('Choose both the day and the month');
    expect(birthdayProblem(31, 4)).toBe('April has only 30 days');
  });

  it('is checked when a card is saved', () => {
    const base = {
      firstName: 'Kemi',
      lastName: 'Adebayo',
      phone: '0806 000 0101',
      service: 'sunday',
      serviceDate: '2026-09-27',
    };
    expect(newcomerSchema.safeParse({ ...base, birthDay: 14, birthMonth: 10 }).success).toBe(true);
    const bad = newcomerSchema.safeParse({ ...base, birthDay: 31, birthMonth: 4 });
    expect(bad.success).toBe(false);
    expect(bad.error.issues[0].message).toBe('April has only 30 days');
  });
});
