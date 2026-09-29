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

export default async function TodayPage() {
  const [session, today] = await Promise.all([getSession(), getUsherToday()]);
  const name = session?.user?.name;
  const services = today.services;
  const firstService = services[0];

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <Hero
        greeting={greeting()}
        name={name}
        stats={[
          firstService
            ? {
                icon: 'schedule',
                label: services.length > 1 ? `${services.length} services today` : 'Service today',
                value: firstService.name,
                sub: services.map((s) => formatServiceTime(s.startTime)).join(' · '),
              }
            : {
                icon: 'event',
                label: 'No service today',
                value: today.nextServiceDay
                  ? serviceDay.format(new Date(today.nextServiceDay.serviceDate))
                  : '—',
                sub: today.nextServiceDay
                  ? today.nextServiceDay.services
                      .map((s) => `${s.name} ${formatServiceTime(s.startTime)}`)
                      .join(' · ')
                  : 'Nothing in the next two weeks',
              },
          {
            icon: 'pin',
            label: 'Count',
            value: today.headcountToday,
            sub: today.lastServiceDay
              ? `Last ${shortWeekday.format(today.lastServiceDay.serviceDate)}: ${today.lastServiceDay.total}`
              : 'All services today',
          },
          {
            icon: 'person_add',
            label: 'First timers',
            value: today.firstTimers,
            sub: `${today.returning} came back`,
          },
        ]}
      />

      <div>
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
      </div>
    </div>
  );
}

/** The template's gradient greeting card, with glassy tiles for today's figures. */
function Hero({ greeting: hello, name, stats }) {
  const verse = verseOfTheDay();
  return (
    <section className="hero rounded-card p-6 sm:p-8 lg:p-10">
      <svg
        viewBox="0 0 320 220"
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-10 -z-10 w-[220px] opacity-40 sm:-right-6 sm:-top-4 sm:w-[300px] sm:opacity-70"
      >
        <circle cx="248" cy="70" r="46" fill="rgb(var(--hero-glow) / .55)" />
        <path
          d="M120 196c26-18 52-18 78 0s52 18 78 0 52-18 78 0"
          fill="none"
          stroke="rgba(255,255,255,.25)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      <p className="mb-1.5 text-sm font-bold text-white/90">{longDate.format(new Date())}</p>
      <h1 className="hero-title mb-2 break-words">{name ? `${hello}, ${name}` : hello}</h1>
      <p className="mb-2 max-w-[52ch] text-base font-semibold text-white">
        Record the count and type up first-timer cards for today’s service.
      </p>
      <p className="mb-6 max-w-[52ch] text-white/90">
        “{verse.text}” <span className="text-white/90">— {verse.reference}</span>
      </p>
      <div className="grid max-w-4xl grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {stats.map((s, i) => (
          <div key={s.label} className={`tile-glass ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.06em] text-white">
              <Icon name={s.icon} size={15} />
              {s.label}
            </span>
            <span className="break-words font-display text-xl font-bold leading-tight tabular-nums">
              {s.value}
            </span>
            <span className="text-meta text-white/90">{s.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** No service today: point to late entry for recent services. */
function NoServiceToday() {
  return (
    <section className="card flex flex-col gap-4 sm:flex-row sm:items-center">
      <span className="icon-tile tone-primary h-12 w-12">
        <Icon name="event" size={24} />
      </span>
      <div className="flex-1">
        <h2 className="card-title">No service today</h2>
        <p className="card-sub">
          Missed a count or some cards? You can still enter them for any service in the past week.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/attendance" className="btn btn-primary">
          <Icon name="pin" size={18} />
          Record attendance
        </Link>
        <Link href="/newcomers/new" className="btn btn-ghost">
          <Icon name="person_add" size={18} />
          Enter cards
        </Link>
      </div>
    </section>
  );
}
