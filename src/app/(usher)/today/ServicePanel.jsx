'use client';

import { useState } from 'react';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import { formatServiceTime, suggestedService } from '@/lib/church';

/**
 * Service switch plus the two usher jobs, which follow the selected service: one quiet panel,
 * one row per job. The job to do next gets the single pine button.
 * Several services: pill tabs above the panel (scroll sideways if many).
 */
export default function ServicePanel({
  services,
  attendance,
  firstTimers,
  recentInitials,
  lastCardTime,
}) {
  const recorded = Object.fromEntries(services.map((s) => [s.key, attendance[s.key].recorded]));
  const [selected, setSelected] = useState(() => suggestedService(services, recorded));
  const service = services.find((s) => s.key === selected);

  if (!service) {
    return (
      <EmptyState card icon="event" title="No services are set up yet">
        Ask an admin to add one under Services.
      </EmptyState>
    );
  }
  const count = attendance[selected];

  return (
    <div className="flex flex-col gap-3">
      {services.length > 1 && (
        <div
          role="group"
          aria-label="Service"
          className="of-tabs max-w-full self-start overflow-x-auto [scrollbar-width:none]"
        >
          {services.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={s.key === selected}
              onClick={() => setSelected(s.key)}
              className="of-tab min-h-[44px] shrink-0"
            >
              {attendance[s.key].recorded && (
                <Icon name="check_circle" size={16} className="text-of-accent-ink" />
              )}
              {s.name}
              <span className="text-xs font-medium opacity-75">
                {formatServiceTime(s.startTime)}
              </span>
            </button>
          ))}
        </div>
      )}

      <section aria-labelledby="service-heading" className="of-panel divide-y divide-line">
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 py-4 sm:px-6">
          <h2 id="service-heading" className="of-h2">
            {service.name}
          </h2>
          <p className="text-meta text-muted">{formatServiceTime(service.startTime)}</p>
        </header>

        <Job
          icon={count.recorded ? 'check' : 'groups'}
          done={count.recorded}
          title="Head count"
          status={
            count.recorded ? (
              <span className="font-semibold text-of-accent-ink">Saved · {count.total} people</span>
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="mr-1.5 inline-block h-2 w-2 rounded-full bg-of-sun align-middle motion-safe:animate-pulse"
                />
                <span className="font-semibold text-ink-2">Not recorded yet</span> · Enter the men,
                women, teens and children counted.
              </>
            )
          }
          action={
            <Link
              href={`/attendance?service=${selected}`}
              className={`${count.recorded ? 'of-btn-quiet' : 'of-btn text-base'} min-h-[52px] w-full sm:min-h-[48px] sm:w-auto`}
            >
              {count.recorded ? 'Correct the count' : 'Record the count'}
              <Icon name="arrow_forward" size={18} />
            </Link>
          }
        />

        <Job
          icon="person_add"
          title="First-timer cards"
          status={
            <>
              <span className="font-semibold text-ink-2">
                {firstTimers === 1 ? '1 card today' : `${firstTimers} cards today`}
              </span>
              {' · '}Type up the paper cards for {service.name}, one by one.
            </>
          }
          extra={
            firstTimers > 0 && (
              <span className="mt-2 flex items-center gap-2 text-meta text-muted">
                <span className="flex -space-x-2">
                  {recentInitials.map((initials, i) => (
                    <Avatar
                      key={i}
                      name={initials.split('').join(' ')}
                      size="sm"
                      className="ring-2 ring-surface"
                    />
                  ))}
                </span>
                {lastCardTime && `Last at ${lastCardTime}`}
              </span>
            )
          }
          action={
            <Link
              href={`/newcomers/new?service=${selected}`}
              className={`${count.recorded ? 'of-btn text-base' : 'of-btn-quiet'} min-h-[52px] w-full sm:min-h-[48px] sm:w-auto`}
            >
              <Icon name="add" size={18} />
              Enter a card
            </Link>
          }
        />
      </section>
    </div>
  );
}

/** One job row: what it is and where it stands, with its button (full width on phones). */
function Job({ icon, done = false, title, status, extra, action }) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
            done ? 'bg-of-accent-soft text-of-accent-ink' : 'bg-surface-2 text-ink-2'
          }`}
        >
          <Icon name={icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-brand text-lg font-semibold leading-tight">{title}</h3>
          <p className="mt-0.5 text-meta text-muted">{status}</p>
          {extra}
        </div>
      </div>
      <div className="sm:shrink-0">{action}</div>
    </div>
  );
}
