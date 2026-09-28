import { renderTemplate, unknownTags } from './templates';
import { smsSegments } from './segments';

/**
 * What the AI writer is asked for, per automatic message, and the checks every draft must
 * pass before it can go out. Safe to import in the browser.
 */

/** How messages are signed off (the registered sender name). */
export const SIGNATURE = 'PTChapel';

/** Each message: what it's for (for the prompt) and the tags it must keep. */
export const DRAFT_BRIEFS = {
  sunday_thanks: {
    purpose:
      'Thank a first-time visitor for worshipping with us today, make them feel welcome and say we hope to see them again.',
    required: ['FirstName'],
  },
  welcome_back: {
    purpose: 'Welcome back someone who has come to church again after their first visit.',
    required: ['FirstName'],
  },
  saturday_invite: {
    purpose:
      'Invite a recent first-time visitor to church tomorrow (Sunday), warmly and without pressure.',
    required: ['FirstName', 'ServiceTimes'],
  },
  member_invite: {
    purpose: 'Invite a church member to service tomorrow (Sunday); encourage them to come.',
    required: ['FirstName', 'ServiceTimes'],
  },
  birthday: {
    purpose: 'Wish a church member or visitor a happy birthday with a short blessing.',
    required: ['FirstName'],
  },
  anniversary: {
    purpose: 'Wish a married church member a happy wedding anniversary with a short blessing.',
    required: ['FirstName'],
  },
  checkin: {
    purpose:
      'A month after their first visit, ask how their time with the church has been and invite them to answer a short survey at the link.',
    required: ['FirstName', 'Link'],
  },
};

export const DRAFT_KEYS = Object.keys(DRAFT_BRIEFS);

/** Swaps the characters that make an SMS cost double (curly quotes, long dashes…) for plain ones. */
export function plainSms(text) {
  return String(text ?? '')
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Longest likely values, so a draft that passes fits one page for (nearly) everyone. */
export const WORST_CASE = {
  FirstName: 'Oluwaseyifunmi',
  LastName: 'Adebayo-Williams',
  ChurchName: 'RCCG Peculiar Treasure Chapel',
  Link: 'https://ptc-chms.vercel.app/c/Ab3dE9xY',
};

/**
 * Problems with a draft (empty when it can go out): tags missing or unknown, not one plain
 * SMS page once filled in, or not signed off. `serviceTimes` is that week's real text.
 */
export function draftProblems(key, text, { serviceTimes = 'Service starts at 8:00 AM.' } = {}) {
  const problems = [];
  const brief = DRAFT_BRIEFS[key];
  if (!text?.trim()) return ['The message is empty'];
  for (const tag of brief?.required ?? []) {
    if (!text.includes(`{${tag}}`)) problems.push(`It must include {${tag}}`);
  }
  const bad = unknownTags(key, text);
  if (bad.length) problems.push(`It can't use {${bad[0]}}`);
  const filled = renderTemplate(text, { ...WORST_CASE, ServiceTimes: serviceTimes });
  const seg = smsSegments(filled);
  if (seg.encoding !== 'gsm') problems.push('It has special characters (use plain letters)');
  else if (seg.pages > 1) {
    problems.push(`It's too long for one SMS page (${seg.length} of 160 characters)`);
  }
  if (!text.toLowerCase().includes(SIGNATURE.toLowerCase())) {
    problems.push(`It must be signed ${SIGNATURE}`);
  }
  return problems;
}
