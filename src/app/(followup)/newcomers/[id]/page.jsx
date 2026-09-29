import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import StageBadge from '@/components/ui/StageBadge';
import { getCurrentUser } from '@/lib/auth';
import { HttpError } from '@/lib/api';
import { ROLES, hasRole } from '@/lib/roles';
import { STAGES, STAGE_LABELS } from '@/lib/stages';
import { formatPhone } from '@/lib/phone';
import { CHANNELS, OUTCOMES, telLink, whatsAppLink } from '@/lib/followup';
import { formatBirthday, formatMoment, formatServiceDate, formatServiceDay } from '@/lib/format';
import { TEMPLATE_INFO } from '@/lib/sms/templates';
import { PRAYER_STATUSES } from '@/services/prayer.service';
import { getProfile } from '@/services/newcomer.service';
import { listServices } from '@/services/churchService.service';
import LogCall from './LogCall';
import { RATINGS } from '@/lib/checkin';
import { checkInFor } from '@/services/checkin.service';
import ManagePerson from './ManagePerson';

export const metadata = { title: 'First-timer profile' };
export const dynamic = 'force-dynamic';

const JOURNEY = [
  STAGES.FIRST_TIMER,
  STAGES.SECOND_TIMER,
  STAGES.REGULAR,
  STAGES.BELIEVERS_CLASS,
  STAGES.MEMBER,
];

async function load(id, includePrayer) {
  try {
    return await getProfile(id, { includePrayer });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
}

export default async function NewcomerPage({ params }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const canManage = hasRole(me, ROLES.PASTOR, ROLES.ADMIN);
  // Prayer requests: pastors and admins here — never the follow-up team.
  const [{ person, visits, followUps, sms, prayerRequests }, services, checkIn] = await Promise.all(
    [
      load(id, canManage),
      listServices({ includeInactive: true }),
      checkInFor(id).catch(() => null),
    ],
  );
  const serviceName = Object.fromEntries(services.map((s) => [s.key, s.name]));
  const name = `${person.firstName} ${person.lastName}`;
  const birthday = formatBirthday(person.birthDay, person.birthMonth);

  const history = [
    ...followUps.map((f) => ({ kind: 'call', at: f.createdAt, item: f })),
    ...sms.map((s) => ({ kind: 'sms', at: s.createdAt, item: s })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-7">
      <Link
        href={canManage ? '/first-timers' : '/my-newcomers'}
        className="of-link -my-2 self-start text-muted hover:text-ink"
      >
        <Icon name="arrow_back" size={18} />
        {canManage ? 'First timers' : 'Follow-up list'}
      </Link>

      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <h1 className="of-h1 break-words">{name}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StageBadge stage={person.stage} />
                {person.movedToMembersAt && (
                  <span className="chip chip-success">
                    <Icon name="how_to_reg" size={14} />
                    In Members since {formatServiceDate(person.movedToMembersAt)}
                  </span>
                )}
                {person.cardUnclear && (
                  <span className="chip chip-warning">
                    <Icon name="flag" size={14} />
                    Card hard to read
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
            <a href={telLink(person.phone)} className="of-btn px-6">
              <Icon name="call" size={18} />
              Call
            </a>
            <a
              href={whatsAppLink(person.phone)}
              target="_blank"
              rel="noreferrer"
              className="of-btn-quiet px-5"
            >
              <Icon name="chat" size={18} />
              WhatsApp
            </a>
          </div>
        </div>

        <dl className="grid gap-px overflow-hidden rounded-[1.5rem] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <Detail icon="smartphone" label="Phone" value={formatPhone(person.phone)} numeric />
          <Detail
            icon="home"
            label="Address"
            value={person.address || '—'}
            className="lg:col-span-2 2xl:col-span-1"
          />
          <Detail icon="mail" label="Email" value={person.email || '—'} />
          <Detail icon="cake" label="Birthday" value={birthday || '—'} />
          <Detail
            icon="sms"
            label="Messages"
            className="sm:max-lg:col-span-2"
            value={person.smsConsent ? 'Agreed to SMS' : 'No SMS'}
          />
        </dl>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <LogCall
            personId={String(person._id)}
            firstName={person.firstName}
            callerName={me?.personal ? me.name : null}
          />
          <section className="of-panel flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="of-h2">History</h2>
            {history.length === 0 ? (
              <EmptyState icon="history_toggle_off" title="No calls or messages yet">
                Log the first call above.
              </EmptyState>
            ) : (
              <ol className="flex flex-col">
                {history.map((h) => (
                  <HistoryItem key={`${h.kind}-${h.item._id}`} entry={h} />
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <Journey stage={person.stage} />
          {checkIn?.answeredAt && <CheckInAnswer checkIn={checkIn} />}

          <section className="of-panel flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="of-h2">Visits</h2>
              <span className="of-eyebrow">{visits.length} in total</span>
            </div>
            <ol className="flex flex-col divide-y divide-line">
              {visits.map((v, i) => (
                <li
                  key={String(v._id)}
                  className="flex items-center gap-3 py-3 first:pt-1 last:pb-0"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-of-accent-soft text-of-accent-ink">
                    <Icon name="church" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{formatServiceDay(v.serviceDate)}</p>
                    <p className="text-meta text-muted">
                      {serviceName[v.service] || v.service} ·{' '}
                      {v.source === 'card' ? 'Filled a card' : 'Came back'}
                    </p>
                  </div>
                  {i === visits.length - 1 && (
                    <span className="chip chip-primary">First visit</span>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {prayerRequests && (
            <section className="of-panel flex flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="of-h2">Prayer requests</h2>
                <Link href="/prayer-requests" className="of-link">
                  All requests
                </Link>
              </div>
              {prayerRequests.length === 0 ? (
                <p className="text-meta text-muted">No prayer request on their cards.</p>
              ) : (
                prayerRequests.map((r) => (
                  <figure key={String(r._id)} className="rounded-tile bg-surface-2 p-4">
                    <blockquote className="break-words">“{r.text}”</blockquote>
                    <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-meta text-muted">
                      {formatServiceDay(r.serviceDate || r.createdAt)}
                      <span className="chip">{PRAYER_STATUSES[r.status]?.label}</span>
                    </figcaption>
                  </figure>
                ))
              )}
              <p className="flex items-center gap-1.5 text-2xs text-muted">
                <Icon name="lock" size={14} />
                Only the prayer team, pastors and admins see these.
              </p>
            </section>
          )}

          {canManage && (
            <ManagePerson
              person={{
                id: String(person._id),
                firstName: person.firstName,
                lastName: person.lastName,
                phone: formatPhone(person.phone),
                address: person.address || '',
                email: person.email || '',
                birthDay: person.birthDay ?? '',
                birthMonth: person.birthMonth ?? '',
                smsConsent: person.smsConsent,
                cardUnclear: person.cardUnclear,
                inBelieversClass: person.inBelieversClass,
                isMember: person.isMember,
                moved: Boolean(person.movedToMembersAt),
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label, value, numeric = false, className = '' }) {
  return (
    <div className={`flex min-w-0 items-start gap-3 bg-surface px-5 py-4 ${className}`}>
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0">
        <dt className="of-eyebrow">{label}</dt>
        <dd
          className={`mt-0.5 font-semibold [overflow-wrap:anywhere] ${numeric ? 'tabular-nums' : ''}`}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

/** The five-step newcomer journey as one connected line; Lost is a note under it. */
function Journey({ stage }) {
  const current = JOURNEY.indexOf(stage);
  return (
    <section className="of-panel flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="of-h2">Journey</h2>
        {current >= 0 && (
          <span className="of-eyebrow">
            Step {current + 1} of {JOURNEY.length}
          </span>
        )}
      </div>
      <ol className="relative grid grid-cols-5">
        <span
          aria-hidden="true"
          className="absolute left-[10%] right-[10%] top-[17px] h-0.5 bg-line"
        />
        {current > 0 && (
          <span
            aria-hidden="true"
            className="absolute left-[10%] top-[17px] h-0.5 bg-of-accent"
            style={{ width: `${(current / (JOURNEY.length - 1)) * 80}%` }}
          />
        )}
        {JOURNEY.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li
              key={s}
              aria-current={now ? 'step' : undefined}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold tabular-nums ring-4 ring-surface ${
                  done
                    ? 'bg-of-accent text-of-on-accent'
                    : now
                      ? 'bg-of-accent-soft text-of-accent-ink outline outline-2 outline-of-accent'
                      : 'bg-surface-2 text-muted'
                }`}
              >
                {done ? <Icon name="check" size={18} /> : i + 1}
              </span>
              <span
                className={`text-2xs font-semibold leading-tight ${now ? 'text-of-accent-ink' : 'text-muted'}`}
              >
                {STAGE_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>
      {stage === STAGES.LOST && (
        <p className="alert alert-warning">
          <Icon name="info" size={19} />
          Hasn’t been back for over 6 weeks. A call could bring them back.
        </p>
      )}
    </section>
  );
}

function HistoryItem({ entry: { kind, item } }) {
  if (kind === 'call') {
    const outcome = OUTCOMES[item.outcome];
    const channel = CHANNELS[item.channel];
    const who = item.callerName || item.worker?.displayName;
    return (
      <li className="relative flex gap-3 pb-5 before:absolute before:bottom-0 before:left-[17px] before:top-10 before:w-px before:bg-line last:pb-0 last:before:hidden">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${outcome?.chip?.replace('chip-', 'tone-') || 'bg-surface-2'}`}
        >
          <Icon name={channel?.icon || 'call'} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-semibold">
              {channel?.label}: {outcome?.label}
            </span>
            <span className="text-xs text-muted">{formatMoment(item.createdAt)}</span>
          </p>
          {item.note && <p className="mt-0.5 break-words text-sm">{item.note}</p>}
          {who && <p className="mt-0.5 text-xs text-muted">By {who}</p>}
        </div>
      </li>
    );
  }
  const title =
    TEMPLATE_INFO[item.template]?.title ||
    (item.template === 'broadcast' ? 'Broadcast' : 'Message');
  const sent = item.status === 'sent';
  return (
    <li className="relative flex gap-3 pb-5 before:absolute before:bottom-0 before:left-[17px] before:top-10 before:w-px before:bg-line last:pb-0 last:before:hidden">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${sent ? 'tone-teal' : 'tone-danger'}`}
      >
        <Icon name="sms" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-semibold">SMS: {title}</span>
          <span className="text-xs text-muted">{formatMoment(item.createdAt)}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 break-words text-sm text-ink-2">“{item.body}”</p>
        <p className={`mt-0.5 text-xs font-semibold ${sent ? 'text-success' : 'text-danger'}`}>
          {sent ? 'Sent' : 'Not delivered'}
        </p>
      </div>
    </li>
  );
}

/** What they said on the one-month check-in survey. */
function CheckInAnswer({ checkIn: c }) {
  const rating = RATINGS[c.rating];
  return (
    <section className="of-panel flex flex-col gap-3 p-5 sm:p-6">
      <div>
        <h2 className="of-h2">One-month check-in</h2>
        <p className="text-meta text-muted">Answered {formatMoment(c.answeredAt)}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {rating && (
          <span className={`chip ${rating.chip}`}>
            <Icon name="star" size={14} filled />
            {c.rating}/5 · {rating.label}
          </span>
        )}
        {c.wantsCall && (
          <span className="chip chip-coral">
            <Icon name="forum" size={14} />
            Asked for a call
          </span>
        )}
      </div>
      {c.comment && <p className="break-words rounded-tile bg-surface-2 p-3">“{c.comment}”</p>}
    </section>
  );
}
