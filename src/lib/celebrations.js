import { addDays, toServiceDate } from './dates';

/**
 * Birthdays and wedding anniversaries: day + month, no year. Dates are Lagos days.
 * 29 February is celebrated on 28 February in years without a 29th.
 */
export const CELEBRATIONS = {
  birthday: { label: 'Birthday', icon: 'cake', chip: 'chip-coral', template: 'birthday' },
  anniversary: {
    label: 'Wedding anniversary',
    icon: 'favorite',
    chip: 'chip-violet',
    template: 'anniversary',
  },
};

const isLeap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** The { day, month } pairs celebrated on this Lagos day (two on 28 Feb in common years). */
export function celebratedOn(date) {
  const d = toServiceDate(date);
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const pairs = [{ day, month }];
  if (month === 2 && day === 28 && !isLeap(d.getUTCFullYear())) pairs.push({ day: 29, month: 2 });
  return pairs;
}

/** Each Lagos day from `from` for `days` days, with the pairs celebrated on it. */
export function celebrationDays(from, days) {
  const start = toServiceDate(from);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    return { date, pairs: celebratedOn(date) };
  });
}

/** A ready-to-post line for WhatsApp, Instagram or Facebook. */
export function socialsText(kind, name) {
  return kind === 'anniversary'
    ? `Happy wedding anniversary to ${name}! The RCCG Peculiar Treasure Chapel family celebrates with you and prays God keeps your home in love and joy. 💍`
    : `Happy birthday to ${name}! The RCCG Peculiar Treasure Chapel family celebrates you today. May this new year be filled with God's favour. 🎉`;
}
