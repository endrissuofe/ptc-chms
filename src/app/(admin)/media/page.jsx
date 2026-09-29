import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import { getSession } from '@/lib/auth';
import { isoDay, toServiceDate } from '@/lib/dates';
import { MEDIA_EDITORS, SERVICE_DETAIL_EDITORS } from '@/lib/roles';
import { brandKitEmpty, getMediaWeek } from '@/services/media.service';
import MediaItemCard from './MediaItemCard';

export const metadata = { title: 'Media' };
export const dynamic = 'force-dynamic';

const WEEKS = {
  this: { label: 'This week', href: '/media' },
  next: { label: 'Next week', href: '/media?week=next' },
};

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const shortDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** /media?week=this|next: the media team's list for the week, Monday to Sunday. */
export default async function MediaPage({ searchParams }) {
  const sp = await searchParams;
  const week = sp.week === 'next' ? 'next' : 'this';
  const [session, data] = await Promise.all([getSession(), getMediaWeek({ week })]);
  const role = session?.user?.role;
  const canEdit = MEDIA_EDITORS.includes(role);
  const canEditDetails = SERVICE_DETAIL_EDITORS.includes(role);
  const today = isoDay(toServiceDate());
  const left = data.counts.todo + data.counts.ready;
  const days = data.days.filter((d) => d.items.length);
  const sunday = data.days[6].date;

  return (
    <div className="flex max-w-5xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Media</p>
        <h1 className="of-h1">
          {data.total === 0
            ? `Nothing to post ${week === 'this' ? 'this' : 'next'} week`
            : left === 0
              ? `All posted ${week === 'this' ? 'this' : 'next'} week`
              : `${left} to post ${week === 'this' ? 'this' : 'next'} week`}
        </h1>
        <p className="flex flex-wrap gap-x-2 text-meta text-muted">
          <span>
            {shortDay.format(new Date(data.monday))} – {shortDay.format(new Date(sunday))}
          </span>
          {data.counts.posted > 0 && (
            <span>
              <span aria-hidden="true">· </span>
              {data.counts.posted} posted
            </span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {canEdit && (
            <Link
              href={`/media/new?date=${week === 'this' ? today : data.monday}`}
              className="of-btn"
            >
              <Icon name="add" size={18} />
              Quick post
            </Link>
          )}
          <Link href="/media/sermons" className="of-btn-quiet">
            <Icon name="menu_book" size={18} />
            Sermons
          </Link>
          <Link href="/media/brand" className="of-btn-quiet">
            <Icon name="palette" size={18} />
            Brand kit
          </Link>
        </div>
      </header>

      {canEdit && brandKitEmpty(data.brand) && (
        <p className="alert alert-info flex-wrap">
          <Icon name="info" size={19} />
          <span className="min-w-0 flex-1">
            Add the church’s address and social accounts to the brand kit, and every post below will
            include them.
          </span>
          <Link href="/media/brand" className="btn btn-sm btn-soft">
            Fill in brand kit
          </Link>
        </p>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="week-list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="week-list" className="of-h2">
            {WEEKS[week].label}
          </h2>
          <nav aria-label="Week" className="of-tabs">
            {Object.entries(WEEKS).map(([key, w]) => (
              <Link
                key={key}
                href={w.href}
                aria-current={week === key ? 'page' : undefined}
                className={`of-tab ${week === key ? 'bg-of-accent-soft text-of-accent-ink' : ''}`}
              >
                {w.label}
              </Link>
            ))}
          </nav>
        </div>

        {days.length === 0 ? (
          <EmptyState
            card
            icon="event_available"
            title="Nothing on the list"
            action={canEdit ? { href: '/media/new', label: 'Add a quick post', icon: 'add' } : null}
          >
            Services, birthdays and quick posts show up here in the week they are due.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            {days.map((d) => (
              <section
                key={d.date}
                aria-labelledby={`day-${d.date}`}
                className="flex flex-col gap-3"
              >
                <h3 id={`day-${d.date}`} className="of-eyebrow flex items-center gap-2">
                  {dayLabel.format(new Date(d.date))}
                  {d.date === today && <span className="chip chip-primary">Today</span>}
                </h3>
                {d.items.map((item) => (
                  <MediaItemCard
                    key={item.ref}
                    item={item}
                    canEdit={canEdit}
                    canEditDetails={canEditDetails}
                    overdue={d.date < today && item.status !== 'posted'}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
