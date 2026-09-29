import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { getSession } from '@/lib/auth';
import { formatServiceTime } from '@/lib/church';
import { verseOfTheDay } from '@/lib/verses';
import { getUsherToday } from '@/services/today.service';
import ServicePanel from './ServicePanel';

export const metadata = { title: 'Today' };

const TZ = 'Africa/Lagos';
const longDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const lagosHour = () =>
  Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', hour12: false }).format(
      new Date(),
    ),
  );
// Service dates are stored as midnight UTC of the Lagos day, so read them back in UTC.
const shortWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' });
const serviceDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

function greeting() {
  const h = lagosHour();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** The headline says what is left to do today. */
function headline({ services, attendance, firstTimers }) {
  if (!services.length) return 'No service today';
  const pending = services.filter((s) => !attendance[s.key]?.recorded);
  if (pending.length === 1) return `Record the ${pending[0].name} count`;
  if (pending.length > 1) return `${pending.length} counts to record`;
  if (firstTimers === 0)
    return `${services.length > 1 ? 'Counts' : 'Count'} saved · ready for cards`;
  return firstTimers === 1 ? '1 card entered today' : `${firstTimers} cards entered today`;
}

export default async function TodayPage() {
  const [session, today] = await Promise.all([getSession(), getUsherToday()]);
  const name = session?.user?.name;
  const services = today.services;
  const verse = verseOfTheDay();

  const facts = services.length
    ? [
        services.map((s) => `${s.name} ${formatServiceTime(s.startTime)}`).join(', '),
        `${today.headcountToday} counted today`,
        today.lastServiceDay
          ? `Last ${shortWeekday.format(today.lastServiceDay.serviceDate)}: ${today.lastServiceDay.total}`
          : null,
        today.firstTimers === 1 ? '1 first timer' : `${today.firstTimers} first timers`,
        `${today.returning} came back`,
      ]
    : [
        today.nextServiceDay
          ? `Next: ${serviceDay.format(new Date(today.nextServiceDay.serviceDate))}, ${today.nextServiceDay.services
              .map((s) => `${s.name} ${formatServiceTime(s.startTime)}`)
              .join(', ')}`
          : 'No service in the next two weeks',
        today.lastServiceDay
          ? `Last ${shortWeekday.format(today.lastServiceDay.serviceDate)}: ${today.lastServiceDay.total}`
          : null,
      ];

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-7">
      <header className="of-hero flex flex-col gap-2">
        <p className="of-eyebrow">
          {greeting()}
          {name ? `, ${name}` : ''} · {longDate.format(new Date())}
        </p>
        <h1 className="of-h1 break-words">{headline(today)}</h1>
        <p className="flex flex-wrap gap-x-2 text-meta text-muted">
          {facts.filter(Boolean).map((f, i) => (
            <span key={f} className="tabular-nums">
              {i > 0 && <span aria-hidden="true">· </span>}
              {f}
            </span>
          ))}
        </p>
      </header>

      {services.length ? (
        <ServicePanel
          services={services}
          attendance={today.attendance}
          firstTimers={today.firstTimers}
          recentInitials={today.recentInitials}
          lastCardTime={today.lastCardAt ? clock.format(today.lastCardAt) : null}
        />
      ) : (
        <NoServiceToday />
      )}

      <p className="flex max-w-[60ch] gap-2 text-meta text-muted">
        <Icon name="format_quote" size={18} className="mt-px text-of-accent-ink" />
        <span>
          “{verse.text}” <cite className="font-semibold not-italic">— {verse.reference}</cite>
        </span>
      </p>
    </div>
  );
}

/** No service today: point to late entry for recent services. */
function NoServiceToday() {
  return (
    <section className="of-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="min-w-0 flex-1">
        <h2 className="of-h2">Catching up?</h2>
        <p className="mt-1 text-meta text-muted">
          Missed a count or some cards? You can still enter them for any service in the past week.
        </p>
      </div>
      <div className="grid gap-2 sm:flex sm:shrink-0">
        <Link href="/attendance" className="of-btn min-h-[52px] text-base sm:min-h-[44px]">
          <Icon name="pin" size={18} />
          Record attendance
        </Link>
        <Link href="/newcomers/new" className="of-btn-quiet min-h-[52px] sm:min-h-[44px]">
          <Icon name="person_add" size={18} />
          Enter cards
        </Link>
      </div>
    </section>
  );
}
