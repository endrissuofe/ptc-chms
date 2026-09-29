'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import EmptyState from '@/components/ui/EmptyState';
import FormAlert from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { useUnsavedGuard } from '@/lib/use-unsaved-guard';
import { DayChips, ServiceChips } from '@/components/usher/ServiceDayPicker';
import {
  COUNT_FIELDS,
  clampCount,
  isUnusualChange,
  percentChange,
  totalCount,
} from '@/lib/attendance';

const GROUPS = {
  men: { label: 'Men', hint: 'Adults', bar: 'bg-primary' },
  women: { label: 'Women', hint: 'Adults', bar: 'bg-coral' },
  teens: { label: 'Teens', hint: 'Ages 13–17', bar: 'bg-teal' },
  children: {
    label: 'Children',
    hint: 'Under 13',
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
 * Attendance count for one service on one day. Drafts are kept per service while switching;
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
      <EmptyState card icon="event" title="No service in the past week to record">
        Ask an admin if a service is missing from the Services list.
      </EmptyState>
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
  const confirm = useConfirm();
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

  const busy = status.state === 'saving' || status.state === 'removing';

  // Ask before leaving with numbers that haven't been saved (tab bar, back, closing the page).
  useUnsavedGuard(anyDirty && !busy, {
    title: 'Leave without saving?',
    body: 'You have numbers that aren’t saved yet.',
  });

  const goToDay = async (day) => {
    if (
      anyDirty &&
      !(await confirm({
        title: 'Leave this day?',
        body: 'You have numbers that aren’t saved yet.',
        confirmLabel: 'Leave without saving',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      }))
    ) {
      return;
    }
    setDrafts(Object.fromEntries(services.map((s) => [s.key, saved[s.key] ?? EMPTY])));
    router.push(`/attendance?date=${day}`);
  };

  const update = (changes) => {
    setStatus((s) => (s.state === 'saving' ? s : { state: 'idle' }));
    setDrafts((d) => ({ ...d, [selected]: { ...d[selected], ...changes } }));
  };

  const failed = (err) =>
    setStatus({
      state: 'error',
      error: navigator.onLine
        ? err
        : { message: 'No connection. Your numbers are still here — try again when data returns.' },
    });

  async function save() {
    if (busy) return;
    setStatus({ state: 'saving' });
    try {
      const data = await sendJson('/api/attendance', 'POST', {
        serviceDate,
        service: selected,
        ...pick(draft),
      });
      setSaved((s) => ({ ...s, [selected]: { ...pick(draft), savedAt: data.updatedAt } }));
      setStatus({ state: 'saved' });
      router.refresh();
    } catch (err) {
      failed(err);
    }
  }

  async function remove() {
    if (busy) return;
    const ok = await confirm({
      title: `Remove the ${service.name} count?`,
      body: 'Use this if the count was saved on the wrong service or day. You can enter it again afterwards.',
      confirmLabel: 'Remove count',
      tone: 'danger',
      icon: 'remove',
    });
    if (!ok) return;
    setStatus({ state: 'removing' });
    try {
      await sendJson('/api/attendance', 'DELETE', { serviceDate, service: selected });
      setSaved((s) => ({ ...s, [selected]: null }));
      setDrafts((d) => ({ ...d, [selected]: EMPTY }));
      setStatus({ state: 'removed' });
      router.refresh();
    } catch (err) {
      failed(err);
    }
  }

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="of-eyebrow">Attendance · {dayLabel.format(new Date(serviceDate))}</p>
          <h1 className="of-h1 break-words">{service.name}</h1>
          <p className="text-meta text-muted">Tap a number to type it, or use − and +.</p>
        </div>
        {savedHere?.savedAt && (
          <span className="chip chip-success">
            <Icon name="schedule" size={15} />
            Saved {clock.format(new Date(savedHere.savedAt))}
          </span>
        )}
      </header>

      <div className="flex min-w-0 flex-wrap gap-4">
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
          <section className="of-panel flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="of-eyebrow">Total count</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="of-figure text-stat-lg" aria-live="polite">
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
              <p className="text-meta text-muted">
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

          <section className="of-panel flex flex-col gap-2 p-5 sm:p-6">
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
          </section>

          {status.state === 'error' && <FormAlert error={status.error} />}
          {status.state === 'removed' && (
            <FormAlert
              success={`${service.name} count removed. Enter the right numbers when ready.`}
            />
          )}

          {savedHere && !dirty ? (
            <div role="status" className="alert alert-success flex-wrap justify-between">
              <span className="flex items-center gap-2">
                <Icon name="check_circle" size={20} filled />
                {status.state === 'saved' ? 'Saved' : 'Already saved'} · {service.name}: {total}
              </span>
              <Link href="/today" className="tap-link text-success underline underline-offset-2">
                Back to Today
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={!dirty || total === 0}
              aria-disabled={busy}
              className="of-btn min-h-[56px] w-full text-base disabled:opacity-50"
            >
              <Busy
                busy={status.state === 'saving'}
                icon="how_to_reg"
                size={20}
                label={
                  total === 0
                    ? 'Enter the count to save'
                    : savedHere
                      ? 'Save correction'
                      : 'Save attendance'
                }
              />
            </button>
          )}
          {savedHere && (
            <button
              type="button"
              onClick={remove}
              aria-disabled={busy}
              className="of-btn-quiet self-center bg-transparent"
            >
              <Busy
                busy={status.state === 'removing'}
                busyLabel="Removing…"
                icon="remove"
                label="Remove this count"
                size={17}
              />
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
    'grid place-items-center rounded-full bg-surface-2 text-ink transition hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary active:scale-90';
  return (
    <div className="of-panel flex flex-col gap-4 p-5">
      <label htmlFor={id} className="flex items-center gap-3">
        <span className={`h-9 w-1.5 shrink-0 rounded-full ${group.bar}`} aria-hidden="true" />
        <span className="flex flex-col leading-tight">
          <span className="font-brand text-lg font-semibold">{group.label}</span>
          <span className="text-meta text-muted">{group.hint}</span>
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
          className={`of-figure h-14 w-full min-w-0 rounded-tile bg-transparent text-center focus:bg-surface-2 focus:outline-none focus:ring-4 focus:ring-of-accent/20 ${
            value >= 1000 ? 'text-2xl' : 'text-stat'
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
            className="of-btn-quiet min-h-[40px] min-w-[64px] tabular-nums"
          >
            +{n}
          </button>
        ))}
      </div>
    </div>
  );
}
