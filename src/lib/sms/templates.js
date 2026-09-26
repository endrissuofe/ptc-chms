/**
 * The automatic SMS the church sends, and the tags each may use.
 * Safe to import in the browser (no provider code), so the SMS screen can preview messages.
 */

export const TEMPLATE_INFO = {
  sunday_thanks: {
    title: 'Sunday thank-you',
    schedule: 'Sundays at 6:00 PM',
    recipients: 'First timers whose cards were entered that Sunday and who agreed to messages',
    tags: ['FirstName', 'LastName', 'ChurchName'],
  },
  saturday_invite: {
    title: 'Saturday invite',
    schedule: 'Saturdays at 10:00 AM',
    recipients:
      'First and second timers from the past 4 weeks who agreed to messages and aren’t regulars yet',
    tags: ['FirstName', 'LastName', 'ChurchName', 'ServiceTimes'],
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_INFO);

/** Wording for a thank-you sent after the day ("today" would be wrong). */
export const BELATED_THANKS =
  'Hi {FirstName}, thank you for worshipping with us at RCCG Peculiar Treasure Chapel on Sunday. You are welcome here, and we look forward to seeing you again. God bless you!';

/** Fills {FirstName}-style tags in a template. Unknown tags are left as-is. */
export function renderTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    values[key] != null ? String(values[key]) : match,
  );
}

/** Tags in `body` that this template can't fill, e.g. a typo like {Firstname}. */
export function unknownTags(templateKey, body) {
  const allowed = TEMPLATE_INFO[templateKey]?.tags ?? [];
  return [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((t) => !allowed.includes(t));
}
