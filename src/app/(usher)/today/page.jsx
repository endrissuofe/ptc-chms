import Icon from '@/components/ui/Icon';
import { SyncStrip } from '@/components/ui/ConnectionStatus';
import { getSession } from '@/lib/auth';
import { getUsherToday } from '@/services/today.service';
import Link from 'next/link';
import { formatServiceTime } from '@/lib/church';
import ServicePanel from './ServicePanel';

export const metadata = { title: 'Today' };

const TZ = 'Africa/Lagos';
const longDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
// Service dates are stored as midnight UTC of the Lagos day, so read them back in UTC.
const shortWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' });
const serviceDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

export default async function TodayPage() {
  const [session, today] = await Promise.all([getSession(), getUsherToday()]);
  const name = session?.user?.name;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-start justify-between gap-2 rounded-xl border border-line bg-surface p-5">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Icon name="calendar_today" size={15} className="text-primary" />
            {longDate.format(new Date())}
          </p>
          <h1 className="mt-1 text-[22px] font-semibold leading-7 tracking-tight">
            {name ? `Welcome back, ${name}` : 'Welcome back'}
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            “For where two or three gather in my name, there am I with them.”
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-stage-first-bg">
          <Icon name="church" size={22} className="text-primary" />
        </span>
      </section>

      {today.services.length ? (
        <ServicePanel
          services={today.services}
          attendance={today.attendance}
          firstTimers={today.firstTimers}
          recentInitials={today.recentInitials}
          lastCardTime={today.lastCardAt ? clock.format(today.lastCardAt) : null}
        />
      ) : (
        <NoServiceToday next={today.nextServiceDay} />
      )}

      <section className="flex flex-col gap-1">
        <h2 className="px-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted">
          Today so far
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          <Metric
            icon="pin"
            iconClass="text-primary"
            value={today.headcountToday}
            label="Door count"
            footnote={
              today.lastServiceDay
                ? `Last ${shortWeekday.format(today.lastServiceDay.serviceDate)}: ${today.lastServiceDay.total}`
                : 'All services'
            }
          />
          <Metric
            icon="person_add"
            iconClass="text-primary"
            valueClass="text-primary"
            value={today.firstTimers}
            label="First timers"
            footnote="Cards entered"
          />
          <Metric
            icon="replay"
            iconClass="text-tertiary"
            valueClass="text-tertiary"
            value={today.returning}
            label="Returning"
            footnote="Came back"
          />
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-line bg-stage-class-bg p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-tertiary">
          <Icon name="sms" size={20} />
        </span>
        <div className="min-w-0 text-stage-class-text">
          <p className="text-[13px] font-semibold">Automatic thank-you SMS</p>
          <p className="mt-1 text-[13px] leading-snug">
            {today.isSunday ? (
              <>
                Goes out at <strong>6:00 PM today</strong> to first timers entered today who agreed
                to messages.
              </>
            ) : (
              <>
                Goes out on <strong>Sundays at 6:00 PM</strong> to that day’s first timers who
                agreed to messages.
              </>
            )}
          </p>
        </div>
      </section>

      <SyncStrip />
    </div>
  );
}

function Metric({ icon, iconClass, value, valueClass = 'text-ink', label, footnote }) {
  return (
    <div className="flex min-h-[104px] flex-col justify-between rounded-xl border border-line bg-surface p-3">
      <Icon name={icon} size={20} className={iconClass} />
      <div className="my-1 flex flex-col">
        <span className={`text-[32px] font-bold leading-tight tabular-nums ${valueClass}`}>
          {value}
        </span>
        <span className="text-[11px] text-muted">{label}</span>
      </div>
      <span className="rounded bg-stage-second-bg px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-muted">
        {footnote}
      </span>
    </div>
  );
}

/** No service today: say when the next one is, and point to late entry for recent services. */
function NoServiceToday({ next }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Icon name="event" size={20} className="text-primary" />
        <h2 className="text-lg font-semibold">No service today</h2>
      </div>
      {next && (
        <p className="text-[15px]">
          Next: <strong>{serviceDay.format(new Date(next.serviceDate))}</strong> —{' '}
          {next.services.map((s) => `${s.name} ${formatServiceTime(s.startTime)}`).join(', ')}
        </p>
      )}
      <Link
        href="/attendance"
        className="flex min-h-[44px] items-center justify-between rounded-lg bg-paper px-4 text-[15px] font-semibold"
      >
        Enter a count from the past week
        <Icon name="arrow_forward" size={20} className="text-primary" />
      </Link>
    </section>
  );
}
