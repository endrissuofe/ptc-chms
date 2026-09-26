'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import {
  COUNT_FIELDS,
  clampCount,
  isUnusualChange,
  percentChange,
  totalCount,
} from '@/lib/attendance';

const GROUPS = {
  men: {
    label: 'Men',
    hint: 'Adults',
    icon: 'man',
    tint: 'bg-stage-first-bg text-primary',
    bar: 'bg-primary',
  },
  women: {
    label: 'Women',
    hint: 'Adults',
    icon: 'woman',
    tint: 'bg-stage-regular-bg text-secondary',
    bar: 'bg-secondary',
  },
  teens: {
    label: 'Teens',
    hint: 'Ages 13–17',
    icon: 'school',
    tint: 'bg-stage-class-bg text-tertiary',
    bar: 'bg-tertiary',
  },
  children: {
    label: 'Children',
    hint: 'Under 13',
    icon: 'child_care',
    tint: 'bg-stage-second-bg text-ink',
    bar: 'bg-ink/60',
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

const shortDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const lagosToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
const isToday = (day) => day === lagosToday();

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
      <p className="rounded-xl border border-line bg-surface p-5 text-[15px] text-muted">
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
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1 px-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stage-second-bg px-2.5 py-1 text-[11px] font-semibold">
            <Icon name="church" size={14} />
            {dayLabel.format(new Date(serviceDate))}
          </span>
          {savedHere?.savedAt && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
              <Icon name="schedule" size={15} className="text-secondary" />
              Saved {clock.format(new Date(savedHere.savedAt))}
            </span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{service.name} Attendance</h1>
        <p className="text-[13px] text-muted">
          Enter the door count. Tap a number to type it, or use − and +.
        </p>
      </section>

      {serviceDays.length > 1 && (
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Day
          </span>
          <div role="tablist" aria-label="Day" className="flex gap-2 overflow-x-auto">
            {serviceDays.map((day) => (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={day === serviceDate}
                onClick={() => day !== serviceDate && goToDay(day)}
                className={`flex h-10 shrink-0 items-center rounded-full border px-4 text-[13px] font-semibold ${
                  day === serviceDate
                    ? 'border-primary bg-stage-first-bg text-primary'
                    : 'border-line bg-surface text-muted'
                }`}
              >
                {isToday(day) ? 'Today' : shortDay.format(new Date(day))}
              </button>
            ))}
          </div>
        </div>
      )}

      {services.length > 1 && (
        <div role="tablist" aria-label="Service" className="flex gap-2 overflow-x-auto">
          {services.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={s.key === selected}
              onClick={() => {
                setSelected(s.key);
                setStatus({ state: 'idle' });
              }}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold ${
                s.key === selected
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-surface text-muted'
              }`}
            >
              {saved[s.key] && <Icon name="check" size={16} />}
              {s.name}
            </button>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Total headcount
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-[32px] font-bold leading-9 tabular-nums" aria-live="polite">
                {total}
              </span>
              {change !== null && total > 0 && (
                <span
                  className={`flex items-center gap-0.5 text-[13px] font-semibold ${change >= 0 ? 'text-secondary' : 'text-danger'}`}
                >
                  <Icon name="trending_up" size={16} className={change < 0 ? '-scale-y-100' : ''} />
                  {change > 0 ? '+' : ''}
                  {change}% vs last time
                </span>
              )}
            </div>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stage-first-bg text-primary">
            <Icon name="group" size={22} />
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-paper" aria-hidden="true">
          {COUNT_FIELDS.map((f) => (
            <div
              key={f}
              className={`h-full transition-all duration-300 ${GROUPS[f].bar}`}
              style={{ width: total ? `${(draft[f] / total) * 100}%` : 0 }}
            />
          ))}
        </div>
        {previous && (
          <p className="text-[11px] text-muted">
            Last time ({dayLabel.format(new Date(previous.serviceDate))}): {previous.total}
          </p>
        )}
        {dirty && total > 0 && isUnusualChange(change) && (
          <p className="flex items-start gap-1.5 rounded-lg bg-stage-first-bg px-3 py-2 text-[13px] font-semibold text-stage-first-text">
            <Icon name="error_outline" size={18} />
            That’s very different from last time — please check the numbers before saving.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3">
        {COUNT_FIELDS.map((f) => (
          <Counter
            key={`${selected}-${f}`}
            group={GROUPS[f]}
            value={draft[f]}
            onChange={(v) => update({ [f]: clampCount(v) })}
          />
        ))}
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <label
            htmlFor="attendance-note"
            className="flex items-center gap-1.5 text-[15px] font-semibold"
          >
            <Icon name="edit_note" size={18} className="text-muted" />
            Note
          </label>
          <span className="text-[11px] font-semibold text-muted">Optional</span>
        </div>
        <textarea
          id="attendance-note"
          rows={3}
          maxLength={300}
          value={draft.note}
          onChange={(e) => update({ note: e.target.value })}
          placeholder="e.g. Heavy rain, guest minister, Holy Communion Sunday"
          className="w-full resize-none rounded-lg bg-paper p-3 text-[15px] placeholder:text-muted/70 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="flex items-center gap-1 text-[11px] text-muted">
          <Icon name="info" size={14} />
          Helps the pastors understand changes in attendance.
        </p>
      </section>

      {status.state === 'error' && (
        <p role="alert" className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">
          {status.message}
        </p>
      )}

      {status.state === 'saved' && !dirty ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3 text-white"
        >
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="check_circle" size={20} filled />
            {service.name} saved • {total}
          </span>
          <Link href="/today" className="text-[13px] font-semibold underline underline-offset-2">
            Back to Today
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={save}
          disabled={!dirty || total === 0 || status.state === 'saving'}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-white active:bg-primary-dark disabled:opacity-50"
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
  );
}

function Counter({ group, value, onChange }) {
  const id = `count-${group.label.toLowerCase()}`;
  const step =
    'flex items-center justify-center rounded-xl bg-paper text-ink active:scale-90 active:bg-stage-second-bg transition';
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${group.tint}`}
          >
            <Icon name={group.icon} size={20} />
          </span>
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold">{group.label}</span>
            <span className="text-[11px] font-semibold text-muted">{group.hint}</span>
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`One fewer ${group.label.toLowerCase()}`}
            onClick={() => onChange(value - 1)}
            disabled={value === 0}
            className={`h-12 w-12 disabled:opacity-40 ${step}`}
          >
            <Icon name="remove" size={22} />
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
            className={`h-12 w-[4.5rem] rounded-lg bg-transparent text-center font-bold tabular-nums focus:bg-paper focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              value >= 1000 ? 'text-[22px]' : 'text-[32px]'
            }`}
          />
          <button
            type="button"
            aria-label={`One more ${group.label.toLowerCase()}`}
            onClick={() => onChange(value + 1)}
            className={`h-12 w-12 ${step}`}
          >
            <Icon name="add" size={22} />
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {[5, 10].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`Add ${n} ${group.label.toLowerCase()}`}
            onClick={() => onChange(value + n)}
            className={`h-9 px-3 text-[13px] font-semibold ${step}`}
          >
            +{n}
          </button>
        ))}
      </div>
    </div>
  );
}
