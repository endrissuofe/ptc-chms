import Link from 'next/link';
import Icon from '@/components/ui/Icon';
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
        <Headline
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
        <Headline
          icon="person_add"
          tone="tone-coral"
          label={`First timers in ${monthName.format(new Date())}`}
          value={d.firstTimersThisMonth}
          sub={`${monthChange >= 0 ? '+' : ''}${monthChange} on last month (${d.firstTimersLastMonth})`}
        />
        <Headline
          icon="repeat"
          tone="tone-teal"
          label="Came back"
          value={d.secondVisitRate == null ? '—' : `${d.secondVisitRate}%`}
          sub="Of first timers visited again"
        />
        <Headline
          icon="how_to_reg"
          tone="tone-success"
          label="Joined the church"
          value={d.funnel.joined}
          sub={
            d.movedThisMonth
              ? `${d.movedThisMonth} moved to Members this month`
              : 'Members, from first timers'
          }
        />
      </div>

      <NeedsAttention n={d.needsAttention} />

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <section className="card flex flex-col gap-4 lg:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="card-title">Attendance</h2>
              <p className="card-sub">Every service day in the last 8 weeks</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {d.services
                .filter((s) => d.trend.some((t) => t.byService[s.key]))
                .map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-[13px] font-bold">
                    <span className={`h-2.5 w-2.5 rounded-full ${colour[s.key]}`} />
                    {s.name}
                  </span>
                ))}
            </div>
          </div>
          <AttendanceChart trend={d.trend} colour={colour} />
        </section>

        <section className="card flex flex-col gap-4 lg:col-span-2">
          <div>
            <h2 className="card-title">Newcomer journey</h2>
            <p className="card-sub">Everyone who has filled a card, and how far they’ve come</p>
          </div>
          <Funnel f={d.funnel} />
        </section>
      </div>

      <p className="text-[13px] text-muted">
        {d.callsThisWeek === 1 ? '1 follow-up call' : `${d.callsThisWeek} follow-up calls`} logged
        in the last 7 days
        {d.reachRate != null && ` · ${d.reachRate}% of people called were reached (30 days)`}.
      </p>
    </div>
  );
}

function Headline({ icon, tone, label, value, sub }) {
  return (
    <div className="card flex flex-col gap-1 !p-4 sm:!p-5">
      <span className="flex items-start justify-between gap-2">
        <span className="label-caps">{label}</span>
        <span className={`icon-tile h-9 w-9 ${tone}`}>
          <Icon name={icon} size={18} />
        </span>
      </span>
      <span className="font-display text-[2.1rem] font-black leading-none tabular-nums">
        {value}
      </span>
      <span className="text-[13px] text-muted">{sub}</span>
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
      <h2 className="card-title">Needs attention</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((i) => (
          <li key={i.href + i.icon}>
            <Link
              href={i.href}
              className="card flex h-full flex-col gap-3 !p-4 transition hover:shadow-lift sm:!p-5"
            >
              <span className={`icon-tile h-10 w-10 ${i.tone}`}>
                <Icon name={i.icon} size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-display text-lg font-black leading-snug">
                  {i.title}
                </span>
                <span className="block text-[13px] text-muted">{i.sub}</span>
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
      <p className="py-10 text-center text-muted">
        No counts yet. They appear here once the ushers record attendance.
      </p>
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
            <span className="text-[11.5px] font-bold tabular-nums text-ink-2">{t.total}</span>
            <div
              className="flex w-full max-w-[44px] flex-col-reverse overflow-hidden rounded-t-[10px]"
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
        {trend.map((t) => (
          <span
            key={String(t.serviceDate)}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-muted"
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
    { label: 'Joined the church', n: f.joined, bar: 'bg-success' },
  ];
  if (!f.received) {
    return <p className="py-10 text-center text-muted">No first timers yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const pct = Math.round((s.n / f.received) * 100);
        return (
          <li key={s.label} className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2 text-[14px]">
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
