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
    <section className="relative isolate overflow-hidden rounded-card p-6 text-white shadow-[0_18px_40px_-18px_rgba(67,56,202,.65)] sm:p-8 lg:p-10 [background:radial-gradient(120%_90%_at_100%_0%,rgba(255,138,112,.38)_0%,transparent_55%),linear-gradient(135deg,#4338ca_0%,#5a4fe6_45%,#7462f0_100%)]">
      <svg
        viewBox="0 0 320 220"
        aria-hidden="true"
        className="absolute -right-24 -top-16 -z-10 w-[250px] opacity-50 sm:-right-10 sm:-top-5 sm:w-[360px] sm:max-w-[80%] sm:opacity-95"
      >
        <circle cx="248" cy="70" r="46" fill="#ffb199" opacity=".85" />
        <path
          d="M248 6v10M248 124v10M184 70h10M302 70h10M203 25l7 7M286 108l7 7M203 115l7-7M286 32l7-7"
          stroke="#ffb199"
          strokeWidth="5"
          strokeLinecap="round"
          opacity=".7"
        />
        <path
          d="M120 196c26-18 52-18 78 0s52 18 78 0 52-18 78 0"
          fill="none"
          stroke="rgba(255,255,255,.28)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M150 170c22-14 44-14 66 0s44 14 66 0 44-14 66 0"
          fill="none"
          stroke="rgba(255,255,255,.16)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="m118 44 4.5 10 10.5 1.5-7.6 7.3 1.8 10.4-9.2-4.9-9.2 4.9 1.8-10.4-7.6-7.3 10.5-1.5z"
          fill="#ffd98a"
        />
      </svg>
      <p className="mb-1.5 text-sm font-bold text-white/80">{longDate.format(new Date())}</p>
      <h1 className="mb-2 text-[clamp(1.8rem,1.3rem+2vw,2.7rem)] font-black tracking-[-0.015em] text-white">
        {name ? `${hello}, ${name}` : hello}
      </h1>
      <p className="mb-6 max-w-[52ch] text-base text-white/90">
        “{verse.text}” <span className="whitespace-nowrap text-white/70">— {verse.reference}</span>
      </p>
      <div className="grid max-w-4xl grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`flex flex-col gap-0.5 rounded-tile border border-white/20 bg-white/[.13] px-4 py-3.5 backdrop-blur-sm ${
              i === 0 ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-white/85">
              <Icon name={s.icon} size={15} />
              {s.label}
            </span>
            <span className="line-clamp-2 font-display text-[1.35rem] font-black leading-tight tabular-nums">
              {s.value}
            </span>
            <span className="truncate text-[13px] text-white/85">{s.sub}</span>
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
        <Link href="/attendance" className="btn btn-soft">
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
