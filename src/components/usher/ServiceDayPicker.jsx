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

/** Service days from the past week ("Today", "Wed 23 Sept", ...). Hidden when there's only one. */
export function DayChips({ days, selected, onSelect }) {
  if (days.length < 2) return null;
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1.5">
      <span className="label-caps px-1">Day</span>
      <div role="group" aria-label="Day" className="seg-tabs self-start">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={day === selected}
            onClick={() => day !== selected && onSelect(day)}
            className="seg-tab"
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
    <div className="flex min-w-0 max-w-full flex-col gap-1.5">
      <span className="label-caps px-1">Service</span>
      <div role="group" aria-label="Service" className="seg-tabs self-start">
        {services.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={s.key === selected}
            onClick={() => onSelect(s.key)}
            className="seg-tab"
          >
            {done[s.key] && <Icon name="check_circle" size={16} className="text-success" />}
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
