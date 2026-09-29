import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import { formatServiceDay } from '@/lib/format';
import { getCurrentUser } from '@/lib/auth';
import { ROLES } from '@/lib/roles';
import { STAGE_LABELS } from '@/lib/stages';
import { getDashboard } from '@/services/dashboard.service';
import { countPending } from '@/services/user.service';
import { checkInSummary } from '@/services/checkin.service';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

// One colour per service in the chart, in the order services are listed.
const SERVICE_COLOURS = ['bg-of-accent', 'bg-of-sun', 'bg-teal', 'bg-violet', 'bg-warning'];

const monthName = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', month: 'long' });
const lagosHour = () =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
const greeting = () => {
  const h = lagosHour();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;

export default async function DashboardPage() {
  const me = await getCurrentUser();
  const isAdmin = me?.role === ROLES.ADMIN;
  const [d, signups, checkIns] = await Promise.all([
    getDashboard(),
    isAdmin ? countPending() : 0,
    checkInSummary(),
  ]);
  const colour = Object.fromEntries(
    d.services.map((s, i) => [s.key, SERVICE_COLOURS[i % SERVICE_COLOURS.length]]),
  );
  const sundayChange =
    d.lastSunday && d.previousSunday ? d.lastSunday.total - d.previousSunday.total : null;
  const monthChange = d.firstTimersThisMonth - d.firstTimersLastMonth;
  const firstName = (me?.name || '').split(' ')[0];

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="of-eyebrow">Dashboard</p>
          <h1 className="of-h1">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <Link href="/newcomers/new" className="of-btn">
          <Icon name="person_add" size={18} />
          Enter a card
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <ToCall people={d.toCall} n={d.needsAttention} />
        <LastSunday d={d} change={sundayChange} />
      </div>

      {d.celebrationsToday.length > 0 && (
        <Link
          href="/birthdays"
          className="flex flex-wrap items-center gap-4 rounded-[1.5rem] bg-of-sun-soft px-5 py-4 transition hover:brightness-[.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-of-accent/40"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-of-sun">
            <Icon name="celebration" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-brand text-lg font-semibold leading-snug">
              Today we celebrate{' '}
              {d.celebrationsToday
                .slice(0, 3)
                .map((c) => c.name)
                .join(', ')}
              {d.celebrationsToday.length > 3 && ` and ${d.celebrationsToday.length - 3} more`}
            </span>
            <span className="block text-meta text-ink-2">
              Birthdays and anniversaries · wish them and post on the church’s socials
            </span>
          </span>
          <span className="of-link">
            Birthdays
            <Icon name="arrow_forward" size={16} />
          </span>
        </Link>
      )}

      <OtherTasks n={{ ...d.needsAttention, signups }} />

      <section aria-label="This month" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          value={d.firstTimersThisMonth}
          label={`First timers in ${monthName.format(new Date())}`}
          sub={`${signed(monthChange)} on last month (${d.firstTimersLastMonth})`}
        />
        <Figure
          value={d.secondVisitRate == null ? '—' : `${d.secondVisitRate}%`}
          label="Came back"
          sub="Of first timers who visited again"
        />
        <Figure
          value={d.funnel.joined}
          label="Became members"
          sub={
            d.movedThisMonth
              ? `${d.movedThisMonth} moved to Members this month`
              : 'First timers who joined'
          }
        />
        <Figure
          value={checkIns.average == null ? '—' : checkIns.average}
          label="One-month check-in"
          sub={
            checkIns.sent
              ? `Out of 5 · ${checkIns.answered} of ${checkIns.sent} answered (90 days)`
              : 'Asked a month after a first visit'
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-5">
        <section className="of-panel flex min-w-0 flex-col gap-5 p-5 sm:p-6 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="of-h2">Attendance</h2>
              <p className="text-meta text-muted">Every service day in the last 8 weeks</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {d.services
                .filter((s) => d.trend.some((t) => t.byService[s.key]))
                .map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-meta font-medium">
                    <span className={`h-2.5 w-2.5 rounded-full ${colour[s.key]}`} />
                    {s.name}
                  </span>
                ))}
            </div>
          </div>
          <AttendanceChart trend={d.trend} colour={colour} />
        </section>

        <section className="of-panel flex min-w-0 flex-col gap-5 p-5 sm:p-6 lg:col-span-2">
          <div>
            <h2 className="of-h2">First-timer journey</h2>
            <p className="text-meta text-muted">Everyone who has filled a card</p>
          </div>
          <Funnel f={d.funnel} />
        </section>
      </div>

      <p className="text-meta text-muted">
        {d.callsThisWeek === 1 ? '1 follow-up call' : `${d.callsThisWeek} follow-up calls`} logged
        in the last 7 days
        {d.reachRate != null && ` · ${d.reachRate}% of people called were reached (30 days)`}.
      </p>
    </div>
  );
}

/** The main job: who is waiting for a call, longest first. */
function ToCall({ people, n }) {
  if (!n.toCall) {
    return (
      <section className="of-panel flex flex-col items-start justify-center gap-3 p-6">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-of-accent-soft text-of-accent-ink">
          <Icon name="task_alt" size={22} />
        </span>
        <h2 className="of-h2">Everyone has been called</h2>
        <p className="text-meta text-muted">
          New first timers appear here as soon as the ushers enter their cards.
        </p>
      </section>
    );
  }
  return (
    <section className="of-panel flex min-w-0 flex-col p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="of-h2">
          {n.toCall === 1 ? '1 person to call' : `${n.toCall} people to call`}
        </h2>
        {n.overdue > 0 && (
          <span className="chip chip-danger">
            <Icon name="alarm" size={14} />
            {n.overdue} over 3 days
          </span>
        )}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {people.map((p) => (
          <li key={p.id}>
            <Link
              href={`/newcomers/${p.id}#log`}
              className="-mx-2 flex min-h-[56px] items-center gap-3 rounded-tile px-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-of-accent/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-meta text-muted">
                  {p.askedForCall ? 'Asked for a call' : STAGE_LABELS[p.stage] || p.stage}
                </span>
              </span>
              <span
                className={`text-meta tabular-nums ${p.overdue ? 'font-semibold text-danger' : 'text-muted'}`}
              >
                {p.days === 0 ? 'Today' : p.days === 1 ? '1 day' : `${p.days} days`}
              </span>
              <Icon name="chevron_right" size={20} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/my-newcomers" className="of-link mt-2 self-start">
        {n.toCall > people.length ? `See all ${n.toCall}` : 'Open the follow-up list'}
        <Icon name="arrow_forward" size={16} />
      </Link>
    </section>
  );
}

/** Last Sunday's count, the change on the week before, and a small line of recent Sundays. */
function LastSunday({ d, change }) {
  const sundays = d.trend.filter((t) => new Date(t.serviceDate).getUTCDay() === 0);
  return (
    <section className="of-panel flex min-w-0 flex-col gap-3 p-5 sm:p-6">
      <p className="of-eyebrow">Last Sunday</p>
      {d.lastSunday ? (
        <>
          <div className="flex items-end justify-between gap-4">
            <p className="of-figure text-[3.25rem]">{d.lastSunday.total}</p>
            <Sparkline values={sundays.map((t) => t.total)} />
          </div>
          <p className="text-meta text-muted">
            {formatServiceDay(d.lastSunday.serviceDate)}
            {change != null && (
              <>
                {' · '}
                <span
                  className={`font-semibold ${change >= 0 ? 'text-of-accent-ink' : 'text-danger'}`}
                >
                  {signed(change)}
                </span>{' '}
                on the week before
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <p className="of-figure text-[3.25rem] text-muted">—</p>
          <p className="text-meta text-muted">No count recorded yet.</p>
          <Link href="/attendance" className="of-link self-start">
            Record attendance
            <Icon name="arrow_forward" size={16} />
          </Link>
        </>
      )}
    </section>
  );
}

function Sparkline({ values }) {
  if (values.length < 2) return null;
  const w = 160;
  const h = 52;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    4 + (i * (w - 8)) / (values.length - 1),
    h - 6 - ((v - min) / span) * (h - 12),
  ]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts.at(-1);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[52px] w-40 max-w-[45%] shrink-0"
      role="img"
      aria-label={`Sundays: ${values.join(', ')}`}
    >
      <path d={`${line} L${lx},${h} L4,${h} Z`} fill="rgb(var(--of-accent) / 0.12)" />
      <path
        d={line}
        fill="none"
        stroke="rgb(var(--of-accent))"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle
        cx={lx}
        cy={ly}
        r="4"
        fill="rgb(var(--of-sun))"
        stroke="rgb(var(--surface))"
        strokeWidth="2"
      />
    </svg>
  );
}

function Figure({ value, label, sub }) {
  return (
    <div className="of-panel flex min-w-0 flex-col gap-1.5 p-5">
      <p className="of-figure text-[2rem]">{value}</p>
      <p className="font-semibold">{label}</p>
      <p className="text-meta text-muted">{sub}</p>
    </div>
  );
}

/** Everything else that needs someone: sign-ups, prayer, unclear cards, ready for Members. */
function OtherTasks({ n }) {
  const items = [
    n.signups > 0 && {
      href: '/users',
      icon: 'how_to_reg',
      title: n.signups === 1 ? '1 sign-up waiting' : `${n.signups} sign-ups waiting`,
      sub: 'People who used a team invite link',
    },
    n.newPrayer > 0 && {
      href: '/prayer-requests',
      icon: 'volunteer_activism',
      title: n.newPrayer === 1 ? '1 new prayer request' : `${n.newPrayer} new prayer requests`,
      sub: 'Not yet prayed for',
    },
    n.unclear > 0 && {
      href: '/first-timers?view=unclear',
      icon: 'flag',
      title: n.unclear === 1 ? '1 card hard to read' : `${n.unclear} cards hard to read`,
      sub: 'Check the paper card and correct the details',
    },
    n.readyToMove > 0 && {
      href: '/first-timers',
      icon: 'group_add',
      title:
        n.readyToMove === 1
          ? '1 person ready for Members'
          : `${n.readyToMove} people ready for Members`,
      sub: 'First came over a month ago',
    },
  ].filter(Boolean);
  if (!items.length) return null;
  return (
    <section className="of-panel p-2 sm:p-3" aria-label="Also needs attention">
      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.href + i.icon}>
            <Link
              href={i.href}
              className="flex min-h-[56px] items-center gap-3 rounded-tile px-3 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-of-accent/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-of-accent-soft text-of-accent-ink">
                <Icon name={i.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{i.title}</span>
                <span className="block text-meta text-muted">{i.sub}</span>
              </span>
              <Icon name="chevron_right" size={20} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Stacked bars, one per service day, split by service. Plain CSS so it stays light. */
function AttendanceChart({ trend, colour }) {
  if (!trend.length) {
    return (
      <EmptyState
        icon="insights"
        title="No counts yet"
        action={{ href: '/attendance', label: 'Record attendance', icon: 'pin' }}
      >
        The chart fills in once the ushers record attendance.
      </EmptyState>
    );
  }
  const max = Math.max(...trend.map((t) => t.total), 1);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-52 items-end gap-1.5 sm:gap-2.5" role="list" aria-label="Attendance">
        {trend.map((t) => (
          <div
            key={String(t.serviceDate)}
            role="listitem"
            aria-label={`${formatServiceDay(t.serviceDate)}: ${t.total}`}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-2xs font-semibold tabular-nums text-ink-2">{t.total}</span>
            <div
              className="flex w-full max-w-[40px] flex-col-reverse overflow-hidden rounded-t-[10px]"
              style={{ height: `${Math.max((t.total / max) * 100, 2)}%` }}
            >
              {Object.entries(t.byService).map(([key, n]) => (
                <div
                  key={key}
                  className={colour[key] || 'bg-muted'}
                  style={{ height: `${(n / (t.total || 1)) * 100}%` }}
                  title={`${n}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 border-t border-line pt-2 sm:gap-2.5">
        {trend.map((t, i) => (
          <span
            key={String(t.serviceDate)}
            className={`min-w-0 flex-1 text-center text-2xs text-muted ${
              (trend.length - 1 - i) % 2 ? 'max-sm:invisible' : ''
            }`}
          >
            {formatServiceDay(t.serviceDate).replace(/^\w+ /, '')}
          </span>
        ))}
      </div>
    </div>
  );
}

function Funnel({ f }) {
  const steps = [
    { label: 'Filled a card', n: f.received },
    { label: 'Came back', n: f.cameBack },
    { label: 'Regular (3+ visits)', n: f.regular },
    { label: 'Believers’ Class', n: f.believersClass },
    { label: 'Became members', n: f.joined },
  ];
  if (!f.received) {
    return (
      <EmptyState
        icon="person_add"
        title="No first timers yet"
        action={{ href: '/newcomers/new', label: 'Enter a card', icon: 'add' }}
      />
    );
  }
  return (
    <ol className="flex flex-col gap-3.5">
      {steps.map((s, i) => {
        const pct = Math.round((s.n / f.received) * 100);
        return (
          <li key={s.label} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">
                <span className="mr-2 tabular-nums text-muted">{i + 1}</span>
                {s.label}
              </span>
              <span className="tabular-nums">
                <strong className="font-semibold">{s.n}</strong>{' '}
                <span className="text-muted">· {pct}%</span>
              </span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-of-accent"
                style={{ width: `${pct}%`, opacity: 1 - i * 0.12 }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
