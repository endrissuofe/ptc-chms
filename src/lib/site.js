/** What the app is, in one line: sign-in page, page descriptions, manifest and link previews. */
export const SITE_NAME = 'Ptchapel';
export const ONE_LINER =
  'Attendance, first-timer cards, follow-up and prayer — in one place for the Ptchapel team.';
export const SITE_DESCRIPTION =
  'Staff app for Ptchapel (Peculiar Treasure Chapel, RCCG Youth Province 2): attendance, first-timer cards, follow-up calls and prayer requests.';

/** The live site's address, for links in emails. */
export const appUrl = () =>
  (process.env.APP_URL || process.env.NEXTAUTH_URL || 'https://ptc-chms.vercel.app').replace(
    /\/+$/,
    '',
  );
