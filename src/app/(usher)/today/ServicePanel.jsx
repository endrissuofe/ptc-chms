'use client';

import { useState } from 'react';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import Icon from '@/components/ui/Icon';
import { formatServiceTime, suggestedService } from '@/lib/church';

/**
 * Service switch plus the two usher actions, which follow the selected service.
 * One service: a plain heading. Several: segmented tabs (scroll sideways if many).
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
      <p className="card text-sm text-muted">
        No services are set up yet. Ask an admin to add one under Services.
      </p>
    );
  }
  const count = attendance[selected];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">Your jobs for {service.name}</h2>
        {services.length > 1 && (
          <div role="tablist" aria-label="Service" className="seg-tabs">
            {services.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={s.key === selected}
                onClick={() => setSelected(s.key)}
                className="seg-tab"
              >
                {attendance[s.key].recorded && (
                  <Icon name="check_circle" size={16} className="text-success" />
                )}
                {s.name}
                <span className="font-sans text-xs font-semibold text-muted">
                  {formatServiceTime(s.startTime)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Link
          href={`/attendance?service=${selected}`}
          className="card group flex flex-col gap-4 transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="icon-tile tone-primary h-12 w-12">
              <Icon name="groups" size={24} />
            </span>
            {count.recorded ? (
              <span className="chip chip-success">
                <Icon name="check" size={14} />
                Recorded · {count.total} people
              </span>
            ) : (
              <span className="chip chip-coral">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral-strong" />
                Door count pending
              </span>
            )}
          </div>
          <div>
            <h3 className="text-xl font-black group-hover:text-primary">Record attendance</h3>
            <p className="card-sub">
              {count.recorded
                ? `Tap to correct the ${service.name} count.`
                : `Enter the men, women, teens and children counted at the door.`}
            </p>
          </div>
          <span className="btn btn-primary mt-auto self-start">
            {count.recorded ? 'Correct the count' : 'Record the count'}
            <Icon name="arrow_forward" size={18} />
          </span>
        </Link>

        <Link
          href={`/newcomers/new?service=${selected}`}
          className="card group flex flex-col gap-4 transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="icon-tile tone-coral h-12 w-12">
              <Icon name="person_add" size={24} />
            </span>
            <span className="chip chip-primary">
              <Icon name="fact_check" size={14} />
              {firstTimers === 1 ? '1 card today' : `${firstTimers} cards today`}
            </span>
          </div>
          <div>
            <h3 className="text-xl font-black group-hover:text-primary">Enter first-timer cards</h3>
            <p className="card-sub">Type up the paper cards for {service.name}, one by one.</p>
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <span className="btn btn-coral">
              <Icon name="add" size={18} />
              Enter a card
            </span>
            {firstTimers > 0 && (
              <span className="flex items-center gap-2 text-[13px] text-muted">
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
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}
