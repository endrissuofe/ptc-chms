import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { formatPhone } from '@/lib/phone';
import { CELEBRATIONS, socialsText } from '@/lib/celebrations';
import { telLink, whatsAppLink } from '@/lib/followup';
import { listCelebrations } from '@/services/celebration.service';
import CopyButton from './CopyButton';
import MakeGraphic from './MakeGraphic';

export const metadata = { title: 'Birthdays' };
export const dynamic = 'force-dynamic';

const RANGES = {
  week: { label: 'This week', days: 7 },
  month: { label: 'Next 30 days', days: 30 },
};

/** Before 8 AM Lagos the 7 AM wishes may still be on their way. */
const beforeSending = () =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  ) < 8;

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** /birthdays?range=week|month */
export default async function BirthdaysPage({ searchParams }) {
  const sp = await searchParams;
  const range = sp.range in RANGES ? sp.range : 'week';
  const days = await listCelebrations({ days: RANGES[range].days });
  const [today, ...later] = days;
  const upcoming = later.filter((d) => d.people.length);
  const total = days.reduce((n, d) => n + d.people.length, 0);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="cake" size={16} />
            Church family
          </p>
          <h1 className="page-title">Birthdays</h1>
        </div>
      </div>

      <nav aria-label="Show" className="seg-tabs self-start">
        {Object.entries(RANGES).map(([key, r]) => (
          <Link
            key={key}
            href={key === 'week' ? '/birthdays' : `/birthdays?range=${key}`}
            aria-current={range === key ? 'page' : undefined}
            className="seg-tab"
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <section className="card flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="icon-tile tone-coral h-11 w-11">
            <Icon name="celebration" size={22} />
          </span>
          <div>
            <h2 className="section-title">Today</h2>
            <p className="card-sub">{dayLabel.format(new Date(today.date))}</p>
          </div>
        </div>
        {today.people.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {today.people.map((p) => (
              <Celebrant key={`${p.kind}-${p.id}`} person={p} date={today.date} today />
            ))}
          </ul>
        ) : (
          <EmptyState icon="cake" title="No birthdays or anniversaries today" />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="section-title">Coming up · {RANGES[range].label.toLowerCase()}</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            card
            icon="event"
            title={total ? 'Nothing else coming up' : 'No birthdays or anniversaries coming up'}
            action={
              range === 'week'
                ? { href: '/birthdays?range=month', label: 'See the next 30 days' }
                : null
            }
          >
            Add birthdays and anniversaries on the Members screen, or in the member upload.
          </EmptyState>
        ) : (
          upcoming.map((d) => (
            <div key={d.date} className="card card-compact flex flex-col gap-3">
              <h3 className="card-title">{dayLabel.format(new Date(d.date))}</h3>
              <ul className="grid gap-3 md:grid-cols-2">
                {d.people.map((p) => (
                  <Celebrant key={`${p.kind}-${p.id}`} person={p} date={d.date} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Celebrant({ person: p, date, today = false }) {
  const kind = CELEBRATIONS[p.kind];
  const wish =
    p.kind === 'anniversary'
      ? `Happy wedding anniversary, ${p.firstName}! Wishing you a joyful day. From your church family at Ptchapel.`
      : `Happy birthday, ${p.firstName}! Wishing you a wonderful day. From your church family at Ptchapel.`;
  return (
    <li className="flex flex-col gap-3 rounded-tile bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <Avatar name={p.name} />
        <div className="min-w-0 flex-1">
          <p className="break-words font-display text-lg font-semibold">{p.name}</p>
          <p className="text-meta text-muted">
            {formatPhone(p.phone)} · {p.who === 'member' ? 'Member' : 'First timer'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`chip ${kind.chip}`}>
              <Icon name={kind.icon} size={14} />
              {kind.label}
            </span>
            {today &&
              (p.smsSent ? (
                <span className="chip chip-success">
                  <Icon name="check" size={14} />
                  SMS wish sent
                </span>
              ) : p.canSms && beforeSending() ? (
                <span className="chip">SMS wish at 7 AM</span>
              ) : p.canSms ? (
                <span className="chip">No SMS wish today</span>
              ) : (
                <span className="chip">No SMS (not agreed)</span>
              ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={telLink(p.phone)} className="btn btn-soft btn-sm">
          <Icon name="call" size={16} />
          Call
        </a>
        <a
          href={`${whatsAppLink(p.phone)}?text=${encodeURIComponent(wish)}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-soft btn-sm"
        >
          <Icon name="chat" size={16} />
          WhatsApp
        </a>
        <CopyButton text={socialsText(p.kind, p.name)} />
        <MakeGraphic kind={p.kind} name={p.name} date={date} />
      </div>
    </li>
  );
}
