'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { DayChips, ServiceChips } from '@/components/usher/ServiceDayPicker';
import {
  COUNT_FIELDS,
  clampCount,
  isUnusualChange,
  percentChange,
  totalCount,
} from '@/lib/attendance';

const GROUPS = {
  men: { label: 'Men', hint: 'Adults', icon: 'man', tone: 'tone-primary', bar: 'bg-primary' },
  women: { label: 'Women', hint: 'Adults', icon: 'woman', tone: 'tone-coral', bar: 'bg-coral' },
  teens: { label: 'Teens', hint: 'Ages 13–17', icon: 'school', tone: 'tone-teal', bar: 'bg-teal' },
  children: {
    label: 'Children',
    hint: 'Under 13',
    icon: 'child_care',
    tone: 'tone-violet',
    bar: 'bg-violet',
  },
};

// Service dates are midnight UTC of the Lagos day; save times are real instants.
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const EMPTY = { men: 0, women: 0, teens: 0, children: 0, note: '' };
const pick = (s) => ({ ...Object.fromEntries(COUNT_FIELDS.map((f) => [f, s[f]])), note: s.note });
const same = (a, b) => JSON.stringify(pick(a)) === JSON.stringify(pick(b));

/**
 * Door headcount for one service on one day. Drafts are kept per service while switching;
 * switching day loads that day from the server.
 */
export default function AttendanceForm({
  serviceDate,
  serviceDays,
  services,
  byService,
  initialService,
}) {
  if (!services.length) {
    return (
      <p className="card text-[15px] text-muted">
        There has been no service in the past week to record. Ask an admin if a service is missing
        from the Services list.
      </p>
    );
  }
  return (
    <CountForm
      serviceDate={serviceDate}
      serviceDays={serviceDays}
      services={services}
      byService={byService}
      initialService={initialService}
    />
  );
}

function CountForm({ serviceDate, serviceDays, services, byService, initialService }) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialService);
  const [saved, setSaved] = useState(() =>
    Object.fromEntries(services.map((s) => [s.key, byService[s.key].saved])),
  );
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(services.map((s) => [s.key, byService[s.key].saved ?? EMPTY])),
  );
  const [status, setStatus] = useState({ state: 'idle' }); // idle | saving | saved | error

  const service = services.find((s) => s.key === selected);
  const draft = drafts[selected];
  const savedHere = saved[selected];
  const total = totalCount(draft);
  const dirty = savedHere ? !same(draft, savedHere) : total > 0 || draft.note !== '';
  const anyDirty = services.some((s) =>
    saved[s.key] ? !same(drafts[s.key], saved[s.key]) : totalCount(drafts[s.key]) > 0,
  );
  const previous = byService[selected].previous;
  const change = percentChange(total, previous?.total);

  // Warn before leaving with numbers that haven't been saved (weak Wi-Fi, accidental back).
  useEffect(() => {
    if (!anyDirty) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  const goToDay = (day) => {
    if (anyDirty && !window.confirm('You have numbers that aren’t saved. Leave this day anyway?')) {
      return;
    }
    router.push(`/attendance?date=${day}`);
  };

  const update = (changes) => {
    setStatus({ state: 'idle' });
    setDrafts((d) => ({ ...d, [selected]: { ...d[selected], ...changes } }));
  };

  async function save() {
    setStatus({ state: 'saving' });
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceDate, service: selected, ...pick(draft) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save. Please try again.');
      setSaved((s) => ({ ...s, [selected]: { ...pick(draft), savedAt: data.updatedAt } }));
      setStatus({ state: 'saved' });
      router.refresh();
    } catch (err) {
      setStatus({
        state: 'error',
        message: navigator.onLine
          ? err.message
          : 'No connection. Your numbers are still here — tap Save again when data returns.',
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="calendar_today" size={16} />
            {dayLabel.format(new Date(serviceDate))}
          </p>
          <h1 className="page-title">{service.name} attendance</h1>
          <p className="page-sub">Enter the door count. Tap a number to type it, or use − and +.</p>
        </div>
        {savedHere?.savedAt && (
          <span className="chip chip-success">
            <Icon name="schedule" size={15} />
            Saved {clock.format(new Date(savedHere.savedAt))}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <DayChips days={serviceDays} selected={serviceDate} onSelect={goToDay} />
        <ServiceChips
          services={services}
          selected={selected}
          done={saved}
          onSelect={(key) => {
            setSelected(key);
            setStatus({ state: 'idle' });
          }}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
          {COUNT_FIELDS.map((f) => (
            <Counter
              key={`${selected}-${f}`}
              group={GROUPS[f]}
              value={draft[f]}
              onChange={(v) => update({ [f]: clampCount(v) })}
            />
          ))}
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-[92px] lg:self-start">
          <section className="card flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-caps">Total headcount</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className="font-display text-[44px] font-black leading-none tabular-nums"
                    aria-live="polite"
                  >
                    {total}
                  </span>
                  {change !== null && total > 0 && (
                    <span className={`chip ${change >= 0 ? 'chip-success' : 'chip-danger'}`}>
                      <Icon
                        name="trending_up"
                        size={15}
                        className={change < 0 ? '-scale-y-100' : ''}
                      />
                      {change > 0 ? '+' : ''}
                      {change}% vs last time
                    </span>
                  )}
                </div>
              </div>
              <span className="icon-tile tone-primary h-12 w-12">
                <Icon name="groups" size={24} />
              </span>
            </div>
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3"
              aria-hidden="true"
            >
              {COUNT_FIELDS.map((f) => (
                <div
                  key={f}
                  className={`h-full transition-all duration-300 ${GROUPS[f].bar}`}
                  style={{ width: total ? `${(draft[f] / total) * 100}%` : 0 }}
                />
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {COUNT_FIELDS.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded ${GROUPS[f].bar}`} />
                  {GROUPS[f].label}
                  <strong className="ml-auto tabular-nums">{draft[f]}</strong>
                </li>
              ))}
            </ul>
            {previous && (
              <p className="text-[13px] text-muted">
                Last time ({dayLabel.format(new Date(previous.serviceDate))}):{' '}
                <strong className="text-ink">{previous.total}</strong>
              </p>
            )}
            {dirty && total > 0 && isUnusualChange(change) && (
              <p className="alert alert-warning">
                <Icon name="error_outline" size={19} />
                That’s very different from last time — please check the numbers before saving.
              </p>
            )}
          </section>

          <section className="card flex flex-col gap-2">
            <label htmlFor="attendance-note" className="field-label">
              <span className="flex items-center gap-1.5">
                <Icon name="edit_note" size={19} className="text-muted" />
                Note
              </span>
              <span className="font-semibold text-muted">Optional</span>
            </label>
            <textarea
              id="attendance-note"
              rows={3}
              maxLength={300}
              value={draft.note}
              onChange={(e) => update({ note: e.target.value })}
              placeholder="e.g. Heavy rain, guest minister, Holy Communion Sunday"
              className="input resize-none"
            />
            <p className="flex items-center gap-1 text-[12.5px] text-muted">
              <Icon name="info" size={15} />
              Helps the pastors understand changes in attendance.
            </p>
          </section>

          {status.state === 'error' && (
            <p role="alert" className="alert alert-danger">
              <Icon name="error_outline" size={20} />
              {status.message}
            </p>
          )}

          {status.state === 'saved' && !dirty ? (
            <div role="status" className="alert alert-success justify-between">
              <span className="flex items-center gap-2 text-[15px]">
                <Icon name="check_circle" size={20} filled />
                {service.name} saved · {total}
              </span>
              <Link href="/today" className="font-bold underline underline-offset-2">
                Back to Today
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={!dirty || total === 0 || status.state === 'saving'}
              className="btn btn-primary btn-lg w-full"
            >
              <Icon
                name={status.state === 'saving' ? 'sync' : 'how_to_reg'}
                size={20}
                className={status.state === 'saving' ? 'animate-spin' : ''}
              />
              {status.state === 'saving'
                ? 'Saving…'
                : savedHere
                  ? dirty
                    ? 'Save correction'
                    : 'Saved — no changes'
                  : 'Save attendance'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Counter({ group, value, onChange }) {
  const id = `count-${group.label.toLowerCase()}`;
  const step =
    'grid place-items-center rounded-full bg-surface-2 text-ink transition hover:bg-surface-3 active:scale-90';
  return (
    <div className="card flex flex-col gap-4">
      <label htmlFor={id} className="flex items-center gap-3">
        <span className={`icon-tile ${group.tone}`}>
          <Icon name={group.icon} size={22} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-display text-lg font-extrabold">{group.label}</span>
          <span className="text-[13px] text-muted">{group.hint}</span>
        </span>
      </label>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={`One fewer ${group.label.toLowerCase()}`}
          onClick={() => onChange(value - 1)}
          disabled={value === 0}
          className={`h-12 w-12 shrink-0 disabled:opacity-40 ${step}`}
        >
          <Icon name="remove" size={24} />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '') || 0)}
          className={`h-14 w-full min-w-0 rounded-tile bg-transparent text-center font-display font-black tabular-nums focus:bg-surface-2 focus:outline-none focus:ring-4 focus:ring-primary/20 ${
            value >= 1000 ? 'text-[30px]' : 'text-[40px]'
          }`}
        />
        <button
          type="button"
          aria-label={`One more ${group.label.toLowerCase()}`}
          onClick={() => onChange(value + 1)}
          className={`h-12 w-12 shrink-0 ${step}`}
        >
          <Icon name="add" size={24} />
        </button>
      </div>
      <div className="flex justify-center gap-2">
        {[5, 10].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Add ${n} ${group.label.toLowerCase()}`}
            onClick={() => onChange(value + n)}
            className="btn btn-soft btn-sm"
          >
            +{n}
          </button>
        ))}
      </div>
    </div>
  );
}
