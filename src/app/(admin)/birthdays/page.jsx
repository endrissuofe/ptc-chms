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
import { FEATURES } from '@/lib/features';

export const metadata = { title: 'Birthdays' };
export const dynamic = 'force-dynamic';

const RANGES = {
  week: { label: 'This week', days: 7, rest: 'this week' },
  month: { label: 'Next 30 days', days: 30, rest: 'in the next 30 days' },
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
  const comingUp = total - today.people.length;
  const n = today.people.length;

  return (
    <div className="flex max-w-5xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Birthdays and anniversaries</p>
        <h1 className="of-h1">
          {n === 0
            ? 'No birthdays or anniversaries today'
            : n === 1
              ? '1 person celebrating today'
              : `${n} people celebrating today`}
        </h1>
        <p className="flex flex-wrap gap-x-2 text-meta text-muted">
          <span>{dayLabel.format(new Date(today.date))}</span>
          <span>
            <span aria-hidden="true">· </span>
            {comingUp === 0
              ? `Nobody else ${RANGES[range].rest}`
              : `${comingUp} more ${RANGES[range].rest}`}
          </span>
        </p>
      </header>

      {n > 0 && (
        <section aria-label="Today" className="overflow-hidden rounded-[1.5rem] bg-of-sun-soft">
          <ul className="divide-y divide-line">
            {today.people.map((p) => (
              <Celebrant key={`${p.kind}-${p.id}`} person={p} date={today.date} today />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="coming-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="coming-up" className="of-h2">
            Coming up
          </h2>
          <nav aria-label="Show" className="of-tabs">
            {Object.entries(RANGES).map(([key, r]) => (
              <Link
                key={key}
                href={key === 'week' ? '/birthdays' : `/birthdays?range=${key}`}
                aria-current={range === key ? 'page' : undefined}
                className={`of-tab ${range === key ? 'bg-of-accent-soft text-of-accent-ink' : ''}`}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        </div>

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
          <div className="of-panel divide-y divide-line overflow-hidden">
            {upcoming.map((d) => (
              <section key={d.date} aria-labelledby={`day-${d.date}`}>
                <h3 id={`day-${d.date}`} className="of-eyebrow px-4 pt-4 sm:px-5 sm:pt-5">
                  {dayLabel.format(new Date(d.date))}
                </h3>
                <ul className="divide-y divide-line">
                  {d.people.map((p) => (
                    <Celebrant key={`${p.kind}-${p.id}`} person={p} date={d.date} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SmsStatus({ person: p }) {
  if (p.smsSent) {
    return (
      <span className="chip chip-success">
        <Icon name="check" size={14} />
        SMS wish sent
      </span>
    );
  }
  if (p.canSms && beforeSending()) return <span className="chip">SMS wish at 7 AM</span>;
  if (p.canSms) return <span className="chip">No SMS wish today</span>;
  return <span className="chip">No SMS (not agreed)</span>;
}

function Celebrant({ person: p, date, today = false }) {
  const kind = CELEBRATIONS[p.kind];
  const wish =
    p.kind === 'anniversary'
      ? `Happy wedding anniversary, ${p.firstName}! Wishing you a joyful day. From your church family at Ptchapel.`
      : `Happy birthday, ${p.firstName}! Wishing you a wonderful day. From your church family at Ptchapel.`;
  // Today the wish is the main job, so WhatsApp is the one pine button; later days stay quiet.
  const quiet = today ? 'of-btn-quiet bg-surface' : 'of-btn-quiet';
  return (
    <li className="flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center md:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={p.name} />
        <div className="min-w-0 flex-1">
          <p className="break-words font-brand text-lg font-semibold leading-tight">{p.name}</p>
          <p className="mt-0.5 text-meta text-muted">
            <span className="tabular-nums">{formatPhone(p.phone)}</span> ·{' '}
            {p.who === 'member' ? 'Member' : 'First timer'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`chip ${kind.chip}`}>
              <Icon name={kind.icon} size={14} />
              {kind.label}
            </span>
            {today && <SmsStatus person={p} />}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">
        <a
          href={`${whatsAppLink(p.phone)}?text=${encodeURIComponent(wish)}`}
          target="_blank"
          rel="noreferrer"
          className={today ? 'of-btn px-4' : quiet}
        >
          <Icon name="chat" size={18} />
          WhatsApp
        </a>
        <a href={telLink(p.phone)} className={quiet}>
          <Icon name="call" size={18} />
          Call
        </a>
        <CopyButton text={socialsText(p.kind, p.name)} className={quiet} />
        {FEATURES.celebrationGraphics && <MakeGraphic kind={p.kind} name={p.name} date={date} />}
      </div>
    </li>
  );
}
