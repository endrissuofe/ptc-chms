'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import StageBadge from '@/components/ui/StageBadge';
import { formatPhone } from '@/lib/phone';
import { OUTCOMES, telLink, whatsAppLink } from '@/lib/followup';
import { daysAgo, formatMoment, formatServiceDay, plural } from '@/lib/format';

const TABS = [
  { key: 'to_call', label: 'To call' },
  { key: 'called', label: 'Called' },
  { key: 'all', label: 'All' },
];

const EMPTY = {
  to_call: {
    icon: 'task_alt',
    tone: 'tone-success',
    title: 'Everyone has been called. Well done!',
    text: 'New first timers appear here as soon as the ushers enter their cards.',
  },
  called: {
    icon: 'phone_in_talk',
    tone: 'tone-primary',
    title: 'Nobody reached since their latest visit',
    text: 'When you log a call, the person moves here until they visit again.',
  },
  all: {
    icon: 'groups',
    tone: 'tone-primary',
    title: 'No first timers yet',
    text: 'They appear here once the ushers enter the cards.',
  },
};

/** Every word must be in the name, or the digits in the phone number. */
function matches(p, q) {
  const digits = q.replace(/\D/g, '').replace(/^(234|0)/, '');
  if (digits.length >= 3 && !/[a-z]/i.test(q)) return p.phone.includes(digits);
  const name = `${p.firstName} ${p.lastName}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => name.includes(w));
}

/** The follow-up team's shared list, with Call and WhatsApp on every person. */
export default function FollowUpList({ lists }) {
  const [tab, setTab] = useState('to_call');
  const [q, setQ] = useState('');

  const shown = useMemo(
    () => (q.trim() ? lists[tab].filter((p) => matches(p, q.trim())) : lists[tab]),
    [lists, tab, q],
  );
  const empty = EMPTY[tab];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="group" aria-label="Show" className="of-tabs self-start">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className="of-tab"
            >
              {t.label}
              <span className="of-count">{lists[t.key].length}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <span className="sr-only">Search by name or phone</span>
          <Icon
            name="search"
            size={20}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            enterKeyHint="search"
            placeholder="Search by name or phone"
            className="input rounded-full pl-11 focus:border-of-accent focus:ring-of-accent/30"
          />
        </label>
      </div>

      {shown.length === 0 ? (
        q ? (
          <EmptyState
            card
            icon="person_search"
            title={`Nobody matches “${q}”`}
            action={
              <button type="button" onClick={() => setQ('')} className="of-btn-quiet">
                Clear search
              </button>
            }
          />
        ) : (
          <EmptyState card icon={empty.icon} tone={empty.tone} title={empty.title}>
            {empty.text}
          </EmptyState>
        )
      ) : (
        <ul className="of-panel divide-y divide-line overflow-hidden">
          {shown.map((p) => (
            <PersonRow key={p.id} person={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Status({ person: p }) {
  if (p.state === 'reached') {
    return (
      <span className="chip chip-success">
        <Icon name="phone_in_talk" size={14} />
        Reached {formatMoment(p.lastContactAt)}
      </span>
    );
  }
  if (p.state === 'wrong_number') {
    return (
      <span className="chip chip-danger">
        <Icon name="error_outline" size={14} />
        Wrong number
      </span>
    );
  }
  const outcome = p.tried && OUTCOMES[p.lastOutcome];
  return (
    <>
      {p.askedForCall && (
        <span className={`chip ${p.overdue ? 'chip-danger' : 'chip-coral'}`}>
          <Icon name="forum" size={14} />
          Asked for a call {daysAgo(p.days)}
        </span>
      )}
      {p.toCall && !p.askedForCall && (
        <span className={`chip ${p.overdue ? 'chip-danger' : ''}`}>
          <Icon name={p.overdue ? 'alarm' : 'schedule'} size={14} />
          {p.overdue ? `Waiting ${p.days} days` : `Visited ${daysAgo(p.days)}`}
        </span>
      )}
      {outcome && (
        <span className={`chip ${outcome.chip}`}>
          <Icon name={outcome.icon} size={14} />
          {outcome.label} · {formatMoment(p.lastAttemptAt)}
        </span>
      )}
    </>
  );
}

function PersonRow({ person: p }) {
  const name = `${p.firstName} ${p.lastName}`;
  return (
    <li className="flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center md:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/newcomers/${p.id}#log`}
              className="inline-flex min-h-[32px] min-w-0 items-center break-words font-brand text-lg font-semibold leading-tight hover:text-of-accent-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-of-accent/40"
            >
              {name}
            </Link>
            <StageBadge stage={p.stage} />
          </div>
          <p className="mt-0.5 text-meta text-muted">
            <span className="tabular-nums">{formatPhone(p.phone)}</span> · First came{' '}
            {formatServiceDay(p.firstVisitDate)}
            {p.visitCount > 1 && ` · ${plural(p.visitCount, 'visit')}`}
          </p>
          {p.address && (
            <p className="mt-0.5 flex items-start gap-1 break-words text-meta text-muted">
              <Icon name="home" size={15} className="mt-px shrink-0" />
              {p.address}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Status person={p} />
            {p.cardUnclear && (
              <span className="chip chip-warning">
                <Icon name="flag" size={14} />
                Card hard to read
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 md:flex md:shrink-0">
        <a href={telLink(p.phone)} className="of-btn px-4">
          <Icon name="call" size={18} />
          Call
        </a>
        <a href={whatsAppLink(p.phone)} target="_blank" rel="noreferrer" className="of-btn-quiet">
          <Icon name="chat" size={18} />
          WhatsApp
        </a>
        <Link
          href={`/newcomers/${p.id}#log`}
          className="of-btn-quiet w-11 px-0"
          aria-label={`Open ${name} and log a call`}
          title="Open and log a call"
        >
          <Icon name="chevron_right" size={20} />
        </Link>
      </div>
    </li>
  );
}
