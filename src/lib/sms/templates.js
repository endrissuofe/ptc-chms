/**
 * The church's SMS: automatic messages and broadcasts, and the tags each may use.
 * Safe to import in the browser (no provider code), so the SMS screen can preview messages.
 */

export const TEMPLATE_INFO = {
  // Key kept as "sunday_thanks" so existing wording and send history carry over.
  sunday_thanks: {
    title: 'First-timer thank-you',
    schedule: 'Straight after a first-timer card is saved',
    recipients: 'First timers who agreed to messages',
    tags: ['FirstName', 'LastName', 'ChurchName'],
  },
  welcome_back: {
    title: 'Welcome back',
    schedule: 'Straight after an usher confirms a returning visitor',
    recipients: 'Returning visitors who agreed to messages',
    tags: ['FirstName', 'LastName', 'ChurchName'],
  },
  saturday_invite: {
    title: 'Saturday invite',
    schedule: 'Saturdays at 12 noon',
    recipients:
      'First and second timers from the past 4 weeks who agreed to messages and aren’t regulars yet',
    tags: ['FirstName', 'LastName', 'ChurchName', 'ServiceTimes'],
  },
  birthday: {
    title: 'Birthday',
    schedule: 'Every morning at 7 AM, on their birthday',
    recipients:
      'Members, and first timers who agreed to messages and gave a birthday on their card',
    tags: ['FirstName', 'LastName', 'ChurchName'],
  },
  anniversary: {
    title: 'Wedding anniversary',
    schedule: 'Every morning at 7 AM, on their anniversary',
    recipients: 'Members with a wedding anniversary on the Members list',
    tags: ['FirstName', 'LastName', 'ChurchName'],
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_INFO);

/** Who a broadcast can go to. */
export const AUDIENCES = {
  members: { label: 'All members', hint: 'Everyone on the member list' },
  first_timers: {
    label: 'First timers',
    hint: 'First and second timers from the past 3 months who agreed to messages',
  },
  everyone: { label: 'Everyone', hint: 'Members and first timers (each phone and name once)' },
};

export const BROADCAST_TAGS = ['FirstName', 'LastName', 'ChurchName'];

/** Fills {FirstName}-style tags in a template. Unknown tags are left as-is. */
export function renderTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    values[key] != null ? String(values[key]) : match,
  );
}

/** Tags in `body` that this message can't fill, e.g. a typo like {Firstname}. */
export function unknownTags(templateKey, body) {
  const allowed =
    templateKey === 'broadcast' ? BROADCAST_TAGS : (TEMPLATE_INFO[templateKey]?.tags ?? []);
  return [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((t) => !allowed.includes(t));
}
