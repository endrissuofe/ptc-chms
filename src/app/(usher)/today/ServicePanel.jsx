'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatServiceTime, suggestedService } from '@/lib/church';

/**
 * Service switch plus the two usher actions, which follow the selected service.
 * One service: no switch. Two: side by side, as in the design. More: the switch scrolls sideways.
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
      <p className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
        No services are set up yet. Ask an admin to add one under Services.
      </p>
    );
  }
  const count = attendance[selected];

  return (
    <>
      <section className="flex flex-col gap-1">
        <h2 className="px-1 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted">
          Service
        </h2>
        {services.length === 1 ? (
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
            <span className="flex items-center gap-2 text-[15px] font-semibold">
              <Icon name="schedule" size={18} className="text-primary" />
              {service.name}
            </span>
            <span className="text-[13px] text-muted">{formatServiceTime(service.startTime)}</span>
          </div>
        ) : (
          <div
            role="tablist"
            aria-label="Service"
            className={`rounded-xl border border-line bg-stage-second-bg p-1 ${
              services.length === 2 ? 'grid grid-cols-2' : 'flex snap-x gap-1 overflow-x-auto'
            }`}
          >
            {services.map((s) => {
              const active = s.key === selected;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelected(s.key)}
                  className={`flex min-h-[52px] shrink-0 snap-start flex-col items-center justify-center rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                    services.length > 2 ? 'min-w-[46%]' : ''
                  } ${active ? 'border border-line bg-surface text-ink shadow-sm' : 'text-muted'}`}
                >
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className={`h-2 w-2 rounded-full ${active ? 'bg-primary' : 'bg-[#ddc1b5]'}`}
                    />
                    {s.name}
                  </span>
                  <span className="mt-0.5 whitespace-nowrap text-[11px] font-normal text-muted">
                    {formatServiceTime(s.startTime)} •{' '}
                    {attendance[s.key].recorded ? 'Counted' : 'Not counted'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Link
        href={`/attendance?service=${selected}`}
        className="group flex flex-col rounded-xl border border-line bg-surface p-5 shadow-[0_2px_8px_-2px_rgba(29,34,56,0.04)] transition active:scale-[0.98]"
      >
        {count.recorded ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-stage-regular-bg px-2.5 py-1 text-[11px] font-semibold text-stage-regular-text">
            <Icon name="check" size={14} />
            Recorded • {count.total} people
          </span>
        ) : (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-stage-first-bg px-2.5 py-1 text-[11px] font-semibold text-stage-first-text">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Pending door count
          </span>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight group-hover:text-primary">
              Record Attendance
            </h3>
            <p className="mt-0.5 text-[13px] text-muted">
              {count.recorded
                ? `Tap to correct the ${service.name} count`
                : `Tap to record headcount for ${service.name}`}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white group-hover:bg-primary-dark">
            <Icon name="arrow_forward" size={22} />
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-line/60 bg-paper/70 px-3 py-1.5 text-[11px] font-semibold text-muted">
          <Icon name="groups" size={15} className="text-secondary" />
          Men, Women, Teens, Children
        </div>
      </Link>

      <Link
        href={`/newcomers/new?service=${selected}`}
        className="group flex flex-col rounded-xl border border-line bg-surface p-5 shadow-[0_2px_8px_-2px_rgba(29,34,56,0.04)] transition active:scale-[0.98]"
      >
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-stage-regular-bg px-2.5 py-1 text-[11px] font-semibold text-stage-regular-text">
          <Icon name="fact_check" size={14} />
          {firstTimers === 1 ? '1 card entered today' : `${firstTimers} cards entered today`}
        </span>
        <div className="mt-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight group-hover:text-primary">
              Enter First-Timer Cards
            </h3>
            <p className="mt-0.5 text-[13px] text-muted">
              Type up the paper cards for {service.name}
            </p>
          </div>
          <span className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-white group-hover:bg-primary-dark">
            <Icon name="add" size={18} />
            Enter card
          </span>
        </div>
        {firstTimers > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
            <div className="flex -space-x-2">
              {recentInitials.map((initials, i) => (
                <span
                  key={i}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-surface ${AVATAR_TINTS[i % AVATAR_TINTS.length]}`}
                >
                  {initials}
                </span>
              ))}
            </div>
            {lastCardTime && (
              <span className="text-[13px] text-muted">Last entry: {lastCardTime}</span>
            )}
          </div>
        )}
      </Link>
    </>
  );
}

const AVATAR_TINTS = [
  'bg-[#ffdbcc] text-[#351000]',
  'bg-[#a6f1e1] text-[#00201b]',
  'bg-[#f3daff] text-[#2b0b40]',
];
