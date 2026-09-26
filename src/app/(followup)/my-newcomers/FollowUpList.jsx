'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
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
  to_call: 'Everyone has been called. Well done!',
  called: 'Nobody has been called yet.',
  all: 'No first timers yet. They appear here once the ushers enter the cards.',
};

/** The follow-up team's shared list, with Call and WhatsApp buttons on every person. */
export default function FollowUpList({ lists }) {
  const [tab, setTab] = useState('to_call');
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, '').replace(/^(234|0)/, '');
    if (!needle) return lists[tab];
    return lists[tab].filter(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(needle) ||
        (digits.length >= 3 && p.phone.includes(digits)),
    );
  }, [lists, tab, q]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="tablist" aria-label="Show" className="seg-tabs self-start">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className="seg-tab"
            >
              {t.label}
              <span className="rounded-full bg-surface-3 px-2 py-0.5 font-sans text-xs font-bold text-ink-2">
                {lists[t.key].length}
              </span>
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <span className="sr-only">Search by name or phone</span>
          <Icon
            name="search"
            size={20}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone"
            className="input pl-11"
          />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="card py-10 text-center text-muted">
          {q ? `Nobody matches “${q}”.` : EMPTY[tab]}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {shown.map((p) => (
            <PersonCard key={p.id} person={p} />
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
    <span className="flex flex-wrap gap-1.5">
      {p.toCall && (
        <span className={`chip ${p.overdue ? 'chip-danger' : 'chip-coral'}`}>
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
    </span>
  );
}

function PersonCard({ person: p }) {
  const name = `${p.firstName} ${p.lastName}`;
  return (
    <li className="card flex flex-col gap-4 !p-4 sm:!p-5">
      <div className="flex items-start gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/newcomers/${p.id}`}
              className="truncate font-display text-lg font-black hover:text-primary"
            >
              {name}
            </Link>
            <StageBadge stage={p.stage} />
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {formatPhone(p.phone)} · First came {formatServiceDay(p.firstVisitDate)}
            {p.visitCount > 1 && ` · ${plural(p.visitCount, 'visit')}`}
          </p>
        </div>
        <Link
          href={`/newcomers/${p.id}#log`}
          className="icon-btn -mr-2 -mt-1"
          aria-label={`Open ${name}`}
          title="Open profile and log a call"
        >
          <Icon name="arrow_forward" size={20} />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Status person={p} />
        {p.cardUnclear && (
          <span className="chip chip-warning">
            <Icon name="flag" size={14} />
            Card hard to read
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={whatsAppLink(p.phone)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-success"
        >
          <Icon name="chat" size={18} />
          WhatsApp
        </a>
        <a href={telLink(p.phone)} className="btn btn-coral">
          <Icon name="call" size={18} />
          Call
        </a>
      </div>
    </li>
  );
}
