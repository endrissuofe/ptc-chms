import { z } from 'zod';
import { isYouTubeUrl } from '../media';
import { cleanHandle, parseHashtags } from '../media-captions';
import { serviceKey } from './churchService';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');
const text = (max) => z.string().trim().max(max, `Up to ${max} characters`);
const webLink = z
  .string()
  .trim()
  .max(200)
  .refine((v) => !v || /^https:\/\/\S+$/.test(v), 'Paste the full link, starting https://');

/** Status of an item on the list. */
export const itemStatusSchema = z.object({
  ref: z.string().trim().min(1).max(80),
  status: z.enum(['todo', 'ready', 'posted']),
});

/** A quick post: the day it's for, a title and the words. */
export const quickPostSchema = z.object({
  date,
  title: text(80).min(1, 'Give it a title'),
  details: text(1500).min(1, 'Write what the post says'),
});

/** What a service was about on one date. Empty text clears a field. */
export const serviceDaySchema = z
  .object({
    service: serviceKey,
    date,
    theme: text(120),
    preacher: text(80),
    bibleText: text(80),
    youtubeUrl: z
      .string()
      .trim()
      .max(200)
      .refine((v) => !v || isYouTubeUrl(v), 'Paste the YouTube link, e.g. https://youtu.be/…'),
  })
  .partial({ theme: true, preacher: true, bibleText: true, youtubeUrl: true });

/** The brand kit. Hashtags may come as "#a #b, c" or a list. */
export const brandKitSchema = z
  .object({
    address: text(160),
    facebook: webLink,
    instagram: text(40).transform(cleanHandle),
    youtube: webLink,
    hashtags: z
      .union([z.string().max(400), z.array(z.string().max(60)).max(30)])
      .transform((v) => parseHashtags(Array.isArray(v) ? v.join(' ') : v)),
    signoff: text(120),
  })
  .partial();
