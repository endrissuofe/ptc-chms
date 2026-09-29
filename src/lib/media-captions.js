/**
 * Ready-to-post text for the media team: a WhatsApp group message, a Facebook post and an
 * Instagram caption, and a YouTube live title and description. Built from the service, what it
 * is about (theme, preacher, Bible text) and the church's brand kit, so no church is written in.
 *
 * brand: { address, facebook, instagram, youtube, hashtags: [], signoff } (all optional)
 * church: { name }
 */
import { MONTHS } from './birthday';
import { formatServiceTime, isStreamed } from './church';

/** YouTube refuses longer titles. */
export const YOUTUBE_TITLE_MAX = 100;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Service dates (midnight UTC of the Lagos day) spelt out by hand, so every server and browser
 * writes them the same way. "Sunday 4 October"; with the year: "Sunday 4 October 2026";
 * short: "4 Oct 2026"; weekday: "Sun 4 Oct".
 */
export function spellDate(serviceDate, { year = false, short = false, weekday = false } = {}) {
  const d = new Date(serviceDate);
  const month = MONTHS[d.getUTCMonth()];
  if (short) return `${d.getUTCDate()} ${month.slice(0, 3)} ${d.getUTCFullYear()}`;
  if (weekday) {
    return `${DAY_NAMES[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${month.slice(0, 3)}`;
  }
  const day = `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${month}`;
  return year ? `${day} ${d.getUTCFullYear()}` : day;
}

/** "ptchapel, #RCCG #SundayService" -> ["ptchapel", "RCCG", "SundayService"]. At most 15. */
export function parseHashtags(text = '') {
  const tags = String(text)
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 15);
}

/** ["ptchapel", "RCCG"] -> "#ptchapel #RCCG" */
export const hashtagLine = (tags = []) => tags.map((t) => `#${t}`).join(' ');

/** "@ptchapel" or "ptchapel" -> "ptchapel" */
export const cleanHandle = (handle = '') =>
  String(handle)
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._]/g, '');

/** Blocks of lines, leaving out empty lines and empty blocks. */
function compose(...blocks) {
  return blocks
    .map((lines) => lines.filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}

/** Theme, preacher and Bible text lines, as far as they are filled in. */
function aboutLines({ theme, preacher, bibleText } = {}, { themeStyle = (t) => t } = {}) {
  return [
    theme && `Theme: ${themeStyle(theme)}`,
    preacher && `Minister: ${preacher}`,
    bibleText && `Bible text: ${bibleText}`,
  ];
}

/**
 * Announcement of a service: { whatsapp, facebook, instagram }.
 * @param {object} args
 * @param {object} args.service  { name, startTime, kind, days, livestream }
 * @param {Date} args.serviceDate
 * @param {object} [args.about]  { theme, preacher, bibleText }
 */
export function serviceTexts({ service, serviceDate, about = {}, brand = {}, church }) {
  const when = `${spellDate(serviceDate)} · ${formatServiceTime(service.startTime)}`;
  const live = isStreamed(service);
  const tags = hashtagLine(brand.hashtags);

  const whatsapp = compose(
    [`*${service.name}*`, when, brand.address && `📍 ${brand.address}`],
    aboutLines(about, { themeStyle: (t) => `*${t}*` }),
    [live && brand.youtube && `📺 Watch live on YouTube: ${brand.youtube}`],
    ['Come and worship with us!', brand.signoff || `— ${church.name}`],
  );

  const facebook = compose(
    [`${service.name} · ${when}`],
    aboutLines(about, { themeStyle: (t) => `“${t}”` }),
    [
      brand.address ? `Join us at ${brand.address}.` : 'Come and worship with us!',
      live &&
        (brand.youtube
          ? `📺 We’ll be live on YouTube: ${brand.youtube}`
          : 'We’ll be live on YouTube.'),
    ],
    [tags],
  );

  const instagram = compose(
    [
      `${service.name} ✨`,
      when,
      about.theme && `“${about.theme}”`,
      about.preacher && `Minister: ${about.preacher}`,
    ],
    [brand.address && `📍 ${brand.address}`, live && '📺 Live on YouTube'],
    [tags],
  );

  return { whatsapp, facebook, instagram };
}

/** YouTube won't take < or > in a title or description. */
const forYouTube = (text) => text.replace(/[<>]/g, '');

/** "Sunday Service · Walking in Favour · 4 Oct 2026", at most 100 characters. */
export function youtubeTitle({ service, serviceDate, about = {} }) {
  const name = forYouTube(service.name);
  const date = spellDate(serviceDate, { short: true });
  const theme = forYouTube(about.theme || '');
  const full = [name, theme, date].filter(Boolean).join(' · ');
  if (full.length <= YOUTUBE_TITLE_MAX) return full;

  const room = YOUTUBE_TITLE_MAX - `${name} ·  · ${date}`.length;
  if (theme && room >= 10) return `${name} · ${theme.slice(0, room - 1).trimEnd()}… · ${date}`;
  return `${name} · ${date}`.slice(0, YOUTUBE_TITLE_MAX);
}

/** YouTube live title and description: { title, description }. */
export function youtubeTexts({ service, serviceDate, about = {}, brand = {}, church }) {
  const handle = cleanHandle(brand.instagram);
  const description = compose(
    [`${service.name} at ${church.name}, ${spellDate(serviceDate, { year: true })}.`],
    aboutLines(about),
    [
      brand.address && `📍 ${brand.address}`,
      brand.facebook && `Facebook: ${brand.facebook}`,
      handle && `Instagram: https://www.instagram.com/${handle}`,
    ],
    [hashtagLine(brand.hashtags)],
  );
  return {
    title: youtubeTitle({ service, serviceDate, about }),
    description: forYouTube(description),
  };
}

/** A quick post: the team's own title and words, with the church's ending. */
export function postTexts({ title, details = '', brand = {}, church }) {
  const tags = hashtagLine(brand.hashtags);
  return {
    whatsapp: compose([`*${title}*`], [details], [brand.signoff || `— ${church.name}`]),
    facebook: compose([title], [details], [tags]),
    instagram: compose([title], [details], [tags]),
  };
}

/** The platforms each kind of item has text for, in the order they are shown. */
export const PLATFORMS = {
  whatsapp: { label: 'WhatsApp group', icon: 'chat' },
  facebook: { label: 'Facebook', icon: 'public' },
  instagram: { label: 'Instagram', icon: 'photo_camera' },
  title: { label: 'YouTube title', icon: 'title' },
  description: { label: 'YouTube description', icon: 'description' },
};
