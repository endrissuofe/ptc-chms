import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import { formatServiceDate } from '@/lib/format';
import { isYouTubeUrl } from '@/lib/media';
import { listSermons } from '@/services/media.service';

export const metadata = { title: 'Sermons' };
export const dynamic = 'force-dynamic';

/** /media/sermons?q=: services with a theme, minister, Bible text or YouTube link, newest first. */
export default async function SermonsPage({ searchParams }) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 80) : '';
  const sermons = await listSermons({ q });

  return (
    <div className="flex max-w-5xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Media</p>
        <h1 className="of-h1">Sermons</h1>
        <p className="text-meta text-muted">
          Filled in from the Media list: what each service was about, and its YouTube video.
        </p>
      </header>

      <form role="search" className="flex flex-wrap gap-2" action="/media/sermons">
        <label className="sr-only" htmlFor="sermon-search">
          Search sermons
        </label>
        <input
          id="sermon-search"
          name="q"
          defaultValue={q}
          type="search"
          placeholder="Theme, minister or Bible text"
          className="input min-w-[12rem] flex-1 sm:max-w-sm"
        />
        <button type="submit" className="of-btn-quiet">
          <Icon name="search" size={18} />
          Search
        </button>
      </form>

      {sermons.length === 0 ? (
        <EmptyState
          card
          icon="menu_book"
          title={q ? `Nothing found for “${q}”` : 'No sermons yet'}
          action={
            q
              ? { href: '/media/sermons', label: 'Show all' }
              : { href: '/media', label: 'Open the Media list' }
          }
        >
          {q
            ? 'Try one word from the theme, the minister’s name or the Bible book.'
            : 'Add a theme, minister or YouTube link to a service on the Media list and it shows here.'}
        </EmptyState>
      ) : (
        <ul className="of-panel divide-y divide-line overflow-hidden">
          {sermons.map((s) => (
            <li
              key={`${s.service}-${s.date}`}
              className="flex flex-wrap items-center gap-3 p-4 sm:px-5"
            >
              <div className="min-w-[12rem] flex-1">
                <p className="break-words font-brand text-lg font-semibold">
                  {s.theme || s.serviceName}
                </p>
                <p className="text-meta text-muted">
                  {[s.theme && s.serviceName, formatServiceDate(s.date), s.preacher, s.bibleText]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {isYouTubeUrl(s.youtubeUrl) && (
                <a
                  href={s.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="of-btn-quiet min-h-[40px]"
                >
                  <Icon name="play_circle" size={18} />
                  Watch
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/media" className="of-btn-quiet self-start bg-transparent">
        <Icon name="arrow_back" size={18} />
        Back to the Media list
      </Link>
    </div>
  );
}
