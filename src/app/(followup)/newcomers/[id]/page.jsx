import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import StageBadge from '@/components/ui/StageBadge';
import { getSession } from '@/lib/auth';
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
  const session = await getSession();
  const canManage = hasRole(session?.user, ROLES.PASTOR, ROLES.ADMIN);
  // Prayer requests: pastors and admins here — never the follow-up team.
  const [{ person, visits, followUps, sms, prayerRequests }, services] = await Promise.all([
    load(id, canManage),
    listServices({ includeInactive: true }),
  ]);
  const serviceName = Object.fromEntries(services.map((s) => [s.key, s.name]));
  const name = `${person.firstName} ${person.lastName}`;
  const birthday = formatBirthday(person.birthDay, person.birthMonth);

  const history = [
    ...followUps.map((f) => ({ kind: 'call', at: f.createdAt, item: f })),
    ...sms.map((s) => ({ kind: 'sms', at: s.createdAt, item: s })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <Link
        href={canManage ? '/first-timers' : '/my-newcomers'}
        className="tap-link self-start text-sm"
      >
        <Icon name="arrow_back" size={18} />
        {canManage ? 'First timers' : 'Follow-up list'}
      </Link>

      <section className="card flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="page-title break-words">{name}</h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
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

        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <a href={telLink(person.phone)} className="btn btn-coral">
            <Icon name="call" size={18} />
            Call
          </a>
          <a
            href={whatsAppLink(person.phone)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-soft"
          >
            <Icon name="chat" size={18} />
            WhatsApp
          </a>
        </div>

        <dl className="grid gap-x-6 gap-y-3 rounded-tile bg-surface-2 p-4 sm:grid-cols-2">
          <Detail icon="smartphone" label="Phone" value={formatPhone(person.phone)} />
          <Detail icon="mail" label="Email" value={person.email || '—'} />
          <Detail icon="cake" label="Birthday" value={birthday || '—'} />
          <Detail
            icon="sms"
            label="SMS"
            value={person.smsConsent ? 'Agreed to messages' : 'No messages'}
          />
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <Journey stage={person.stage} />
          <LogCall personId={String(person._id)} firstName={person.firstName} />
          <section className="card flex flex-col gap-4">
            <h2 className="card-title">History</h2>
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
          <section className="card flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="card-title">Visits</h2>
              <span className="label-caps">{visits.length} in total</span>
            </div>
            <ul className="flex flex-col gap-2">
              {visits.map((v, i) => (
                <li
                  key={String(v._id)}
                  className="flex items-center gap-3 rounded-tile bg-surface-2 px-4 py-3"
                >
                  <span className="icon-tile tone-primary h-9 w-9">
                    <Icon name="church" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{formatServiceDay(v.serviceDate)}</p>
                    <p className="text-meta text-muted">
                      {serviceName[v.service] || v.service} ·{' '}
                      {v.source === 'card' ? 'Card' : 'Came back'}
                    </p>
                  </div>
                  {i === visits.length - 1 && (
                    <span className="chip chip-primary">First visit</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {prayerRequests && (
            <section className="card flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="icon-tile tone-violet h-9 w-9">
                  <Icon name="volunteer_activism" size={18} />
                </span>
                <h2 className="card-title flex-1">Prayer requests</h2>
                <Link href="/prayer-requests" className="tap-link text-sm text-primary">
                  All requests
                </Link>
              </div>
              {prayerRequests.length === 0 ? (
                <p className="text-muted">No prayer request on their cards.</p>
              ) : (
                prayerRequests.map((r) => (
                  <figure key={String(r._id)} className="rounded-tile bg-surface-2 p-4">
                    <blockquote className="italic">“{r.text}”</blockquote>
                    <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-meta text-muted">
                      {formatServiceDay(r.serviceDate || r.createdAt)}
                      <span className="chip">{PRAYER_STATUSES[r.status]?.label}</span>
                    </figcaption>
                  </figure>
                ))
              )}
            </section>
          )}

          {canManage && (
            <ManagePerson
              person={{
                id: String(person._id),
                firstName: person.firstName,
                lastName: person.lastName,
                phone: formatPhone(person.phone),
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

function Detail({ icon, label, value }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
      <Icon name={icon} size={18} className="text-muted" />
      <dt className="min-w-[5rem] text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-bold">{value}</dd>
    </div>
  );
}

/** The five-step newcomer journey; Lost is shown as a note under it. */
function Journey({ stage }) {
  const current = JOURNEY.indexOf(stage);
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="card-title">Journey</h2>
        {current >= 0 && (
          <span className="chip chip-primary">
            Step {current + 1} of {JOURNEY.length}
          </span>
        )}
      </div>
      <ol className="grid grid-cols-5 gap-1">
        {JOURNEY.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={s} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full font-display text-sm font-black ${
                  done
                    ? 'bg-success text-on-primary'
                    : now
                      ? 'bg-primary-fill text-on-primary-fill shadow-primary-glow'
                      : 'bg-surface-2 text-muted'
                }`}
              >
                {done ? <Icon name="check" size={18} /> : i + 1}
              </span>
              <span
                className={`text-2xs font-bold leading-tight ${now ? 'text-primary-ink' : 'text-muted'}`}
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
      <li className="relative flex gap-3 pb-5 last:pb-0">
        <span className={`icon-tile h-9 w-9 ${outcome?.chip?.replace('chip-', 'tone-')}`}>
          <Icon name={channel?.icon || 'call'} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-bold">
              {channel?.label}: {outcome?.label}
            </span>
            <span className="text-xs text-muted">{formatMoment(item.createdAt)}</span>
          </p>
          {item.note && <p className="mt-0.5 text-sm">{item.note}</p>}
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
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span className={`icon-tile h-9 w-9 ${sent ? 'tone-teal' : 'tone-danger'}`}>
        <Icon name="sms" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="font-bold">SMS: {title}</span>
          <span className="text-xs text-muted">{formatMoment(item.createdAt)}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">“{item.body}”</p>
        <p className={`mt-0.5 text-xs font-bold ${sent ? 'text-success' : 'text-danger'}`}>
          {sent ? 'Sent' : 'Not delivered'}
        </p>
      </div>
    </li>
  );
}
