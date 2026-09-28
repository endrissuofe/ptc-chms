import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { formatServiceDay } from '@/lib/format';
import { getDashboard } from '@/services/dashboard.service';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

// One colour per service in the chart, in the order services are listed.
const SERVICE_COLOURS = ['bg-primary', 'bg-coral', 'bg-teal', 'bg-violet', 'bg-warning'];

const monthName = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', month: 'long' });

export default async function DashboardPage() {
  const d = await getDashboard();
  const colour = Object.fromEntries(
    d.services.map((s, i) => [s.key, SERVICE_COLOURS[i % SERVICE_COLOURS.length]]),
  );
  const sundayChange =
    d.lastSunday && d.previousSunday ? d.lastSunday.total - d.previousSunday.total : null;
  const monthChange = d.firstTimersThisMonth - d.firstTimersLastMonth;

  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="home" size={16} />
            Overview
          </p>
          <h1 className="page-title">Dashboard</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          icon="groups"
          tone="tone-primary"
          label="Last Sunday"
          value={d.lastSunday ? d.lastSunday.total : '—'}
          sub={
            d.lastSunday
              ? `${formatServiceDay(d.lastSunday.serviceDate)}${
                  sundayChange == null
                    ? ''
                    : ` · ${sundayChange >= 0 ? '+' : ''}${sundayChange} on the week before`
                }`
              : 'No count recorded yet'
          }
        />
        <StatCard
          icon="person_add"
          tone="tone-coral"
          label={`First timers in ${monthName.format(new Date())}`}
          value={d.firstTimersThisMonth}
          sub={`${monthChange >= 0 ? '+' : ''}${monthChange} on last month (${d.firstTimersLastMonth})`}
        />
        <StatCard
          icon="repeat"
          tone="tone-teal"
          label="Came back"
          value={d.secondVisitRate == null ? '—' : `${d.secondVisitRate}%`}
          sub="Of first timers visited again"
        />
        <StatCard
          icon="how_to_reg"
          tone="tone-success"
          label="Became members"
          value={d.funnel.joined}
          sub={
            d.movedThisMonth
              ? `${d.movedThisMonth} moved to Members this month`
              : 'First timers who joined'
          }
        />
      </div>

      {d.celebrationsToday.length > 0 && (
        <Link
          href="/birthdays"
          className="card card-compact flex flex-wrap items-center gap-3 transition hover:shadow-lift focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary"
        >
          <span className="icon-tile tone-coral h-11 w-11">
            <Icon name="celebration" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-black">
              Today we celebrate{' '}
              {d.celebrationsToday
                .slice(0, 3)
                .map((c) => c.name)
                .join(', ')}
              {d.celebrationsToday.length > 3 && ` and ${d.celebrationsToday.length - 3} more`}
            </span>
            <span className="block text-meta text-muted">
              Birthdays and anniversaries · wish them and post on the church’s socials
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
            Birthdays
            <Icon name="arrow_forward" size={16} />
          </span>
        </Link>
      )}

      <NeedsAttention n={d.needsAttention} />

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <section className="card flex min-w-0 flex-col gap-4 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="card-title">Attendance</h2>
              <p className="card-sub">Every service day in the last 8 weeks</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {d.services
                .filter((s) => d.trend.some((t) => t.byService[s.key]))
                .map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-meta font-bold">
                    <span className={`h-2.5 w-2.5 rounded-full ${colour[s.key]}`} />
                    {s.name}
                  </span>
                ))}
            </div>
          </div>
          <AttendanceChart trend={d.trend} colour={colour} />
        </section>

        <section className="card flex min-w-0 flex-col gap-4 lg:col-span-2">
          <div>
            <h2 className="card-title">First-timer journey</h2>
            <p className="card-sub">Everyone who has filled a card, and how far they’ve come</p>
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

function NeedsAttention({ n }) {
  const items = [
    n.overdue > 0 && {
      href: '/my-newcomers',
      icon: 'alarm',
      tone: 'tone-danger',
      title: n.overdue === 1 ? '1 person not called' : `${n.overdue} people not called`,
      sub: 'Waiting over 3 days since their visit',
      action: 'Follow-up list',
    },
    n.newPrayer > 0 && {
      href: '/prayer-requests',
      icon: 'volunteer_activism',
      tone: 'tone-violet',
      title: n.newPrayer === 1 ? '1 new prayer request' : `${n.newPrayer} new prayer requests`,
      sub: 'Not yet prayed for',
      action: 'Prayer requests',
    },
    n.unclear > 0 && {
      href: '/first-timers?view=unclear',
      icon: 'flag',
      tone: 'tone-warning',
      title: n.unclear === 1 ? '1 card hard to read' : `${n.unclear} cards hard to read`,
      sub: 'Check the paper card and correct the details',
      action: 'Review',
    },
    n.readyToMove > 0 && {
      href: '/first-timers',
      icon: 'group_add',
      tone: 'tone-success',
      title:
        n.readyToMove === 1
          ? '1 person ready for Members'
          : `${n.readyToMove} people ready for Members`,
      sub: 'First came over a month ago',
      action: 'Review',
    },
  ].filter(Boolean);

  if (!items.length) {
    return (
      <p className="alert alert-success">
        <Icon name="task_alt" size={19} />
        All caught up: everyone has been called and nothing needs attention.
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">Needs attention</h2>
      <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,16rem),1fr))]">
        {items.map((i) => (
          <li key={i.href + i.icon}>
            <Link
              href={i.href}
              className="card card-compact flex h-full flex-col gap-3 transition hover:shadow-lift focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary"
            >
              <span className={`icon-tile h-10 w-10 ${i.tone}`}>
                <Icon name={i.icon} size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-display text-lg font-black leading-snug">
                  {i.title}
                </span>
                <span className="block text-meta text-muted">{i.sub}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                {i.action}
                <Icon name="arrow_forward" size={16} />
              </span>
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
      <div className="flex h-56 items-end gap-1.5 sm:gap-2.5" role="list" aria-label="Attendance">
        {trend.map((t) => (
          <div
            key={String(t.serviceDate)}
            role="listitem"
            aria-label={`${formatServiceDay(t.serviceDate)}: ${t.total}`}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
          >
            <span className="text-2xs font-bold tabular-nums text-ink-2">{t.total}</span>
            <div
              className="flex w-full max-w-[44px] flex-col-reverse overflow-hidden rounded-t-control"
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
      <div className="flex gap-1.5 sm:gap-2.5">
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
    { label: 'Filled a card', n: f.received, bar: 'bg-coral' },
    { label: 'Came back', n: f.cameBack, bar: 'bg-primary' },
    { label: 'Regular (3+ visits)', n: f.regular, bar: 'bg-teal' },
    { label: 'Believers’ Class', n: f.believersClass, bar: 'bg-violet' },
    { label: 'Became members', n: f.joined, bar: 'bg-success' },
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
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const pct = Math.round((s.n / f.received) * 100);
        return (
          <li key={s.label} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-bold">
                <span className="mr-2 text-muted">{i + 1}</span>
                {s.label}
              </span>
              <span className="tabular-nums">
                <strong>{s.n}</strong> <span className="text-muted">· {pct}%</span>
              </span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-2">
              <span className={`block h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
