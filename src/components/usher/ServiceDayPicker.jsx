'use client';

import Icon from '@/components/ui/Icon';

const shortDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const lagosToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());

const chip = (active, activeClass) =>
  `flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold ${
    active ? activeClass : 'border-line bg-surface text-muted'
  }`;

/** Service days from the past week ("Today", "Wed 23 Sept", ...). Hidden when there's only one. */
export function DayChips({ days, selected, onSelect }) {
  if (days.length < 2) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Day
      </span>
      <div role="tablist" aria-label="Day" className="flex gap-2 overflow-x-auto">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={day === selected}
            onClick={() => day !== selected && onSelect(day)}
            className={chip(day === selected, 'border-primary bg-stage-first-bg text-primary')}
          >
            {day === lagosToday() ? 'Today' : shortDay.format(new Date(day))}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The day's services. `done` marks services with a tick (e.g. headcount saved). */
export function ServiceChips({ services, selected, onSelect, done = {} }) {
  if (services.length < 2) return null;
  return (
    <div role="tablist" aria-label="Service" className="flex gap-2 overflow-x-auto">
      {services.map((s) => (
        <button
          key={s.key}
          type="button"
          role="tab"
          aria-selected={s.key === selected}
          onClick={() => onSelect(s.key)}
          className={chip(s.key === selected, 'border-ink bg-ink text-white')}
        >
          {done[s.key] && <Icon name="check" size={16} />}
          {s.name}
        </button>
      ))}
    </div>
  );
}
