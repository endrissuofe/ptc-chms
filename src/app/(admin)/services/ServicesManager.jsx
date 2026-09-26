'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { WEEKDAYS, formatServiceTime, sortServices } from '@/lib/church';

async function api(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Something went wrong');
  return data;
}

const input =
  'h-11 rounded-[10px] border-[1.5px] border-line bg-surface px-3 text-[15px] font-normal text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';
const fieldLabel = 'flex flex-col gap-1 text-[13px] font-semibold text-muted';
const primaryBtn =
  'flex h-11 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[15px] font-semibold text-white hover:bg-primary-dark disabled:opacity-40';

/** API dates come back as ISO timestamps; the forms work in "YYYY-MM-DD". */
const normalise = (s) => ({ ...s, date: s.date ? s.date.slice(0, 10) : undefined });

/**
 * Regular services (repeat weekly) and special services (one date).
 * Admins manage both; pastors add and edit special services and see regular ones read-only.
 * Services are switched off, never deleted, so their attendance history stays.
 */
export default function ServicesManager({ initial, isAdmin, today }) {
  const [services, setServices] = useState(initial);
  const [error, setError] = useState('');

  async function run(action) {
    setError('');
    try {
      await action();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  const save = (key, changes) =>
    run(async () => {
      const updated = normalise(await api(`/api/services/${key}`, 'PATCH', changes));
      setServices((list) => list.map((s) => (s.key === key ? updated : s)));
    });

  const add = (values) =>
    run(async () => {
      const created = normalise(await api('/api/services', 'POST', values));
      setServices((list) => [...list, created]);
    });

  const regular = sortServices(services.filter((s) => s.kind === 'regular'));
  const special = services
    .filter((s) => s.kind === 'special')
    .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime));
  const upcoming = special.filter((s) => s.date >= today).reverse();
  const past = special.filter((s) => s.date < today);
  const activeRegular = regular.filter((s) => s.active).length;

  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-subtle px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <Section
        title="Regular services"
        hint={
          isAdmin
            ? 'Held every week on the chosen days.'
            : 'Held every week. Only admins can change these.'
        }
      >
        {regular.map((s) => (
          <ServiceRow
            key={s.key}
            service={s}
            editable={isAdmin}
            isLastActive={s.active && activeRegular === 1}
            onSave={(changes) => save(s.key, changes)}
          />
        ))}
      </Section>
      {isAdmin && <AddService kind="regular" today={today} onAdd={add} />}

      <Section
        title="Special services"
        hint="One-off services such as Thanksgiving or a crusade. Ushers see them on the day."
      >
        {upcoming.length === 0 && (
          <li className="px-5 py-4 text-[15px] text-muted">No special services coming up.</li>
        )}
        {upcoming.map((s) => (
          <ServiceRow key={s.key} service={s} editable onSave={(c) => save(s.key, c)} />
        ))}
      </Section>
      <AddService kind="special" today={today} onAdd={add} />

      {past.length > 0 && (
        <details className="rounded-xl border border-line bg-surface">
          <summary className="cursor-pointer px-5 py-4 text-[15px] font-semibold">
            Past special services ({past.length})
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {past.map((s) => (
              <ServiceRow key={s.key} service={s} editable onSave={(c) => save(s.key, c)} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-[13px] text-muted">{hint}</p>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {children}
      </ul>
    </section>
  );
}

function DayPicker({ value, onChange, disabled }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[13px] font-semibold text-muted">Days</legend>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((label, day) => {
          const on = value.includes(day);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day].sort())}
              className={`h-11 w-12 rounded-[10px] border-[1.5px] text-[13px] font-semibold ${
                on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-muted'
              } disabled:opacity-60`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ServiceRow({ service, editable, isLastActive = false, onSave }) {
  const [draft, setDraft] = useState({
    name: service.name,
    startTime: service.startTime,
    days: service.days || [],
    date: service.date || '',
  });
  const [busy, setBusy] = useState(false);
  const isRegular = service.kind === 'regular';

  const changes = {};
  if (draft.name.trim() !== service.name) changes.name = draft.name.trim();
  if (draft.startTime !== service.startTime) changes.startTime = draft.startTime;
  if (isRegular && draft.days.join() !== (service.days || []).join()) changes.days = draft.days;
  if (!isRegular && draft.date !== service.date) changes.date = draft.date;
  const dirty = Object.keys(changes).length > 0;

  async function submit(payload) {
    setBusy(true);
    await onSave(payload);
    setBusy(false);
  }

  const set = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));

  return (
    <li className={`px-5 py-4 ${service.active ? '' : 'bg-paper'}`}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) submit(changes);
        }}
      >
        <label className={`${fieldLabel} min-w-[200px] flex-1`}>
          Name
          <input
            value={draft.name}
            onChange={set('name')}
            maxLength={40}
            required
            disabled={!editable}
            className={input}
          />
        </label>
        {isRegular ? (
          <DayPicker
            value={draft.days}
            disabled={!editable}
            onChange={(days) => setDraft((d) => ({ ...d, days }))}
          />
        ) : (
          <label className={fieldLabel}>
            Date
            <input
              type="date"
              value={draft.date}
              onChange={set('date')}
              required
              disabled={!editable}
              className={input}
            />
          </label>
        )}
        <label className={fieldLabel}>
          Starts
          <input
            type="time"
            value={draft.startTime}
            onChange={set('startTime')}
            required
            disabled={!editable}
            className={input}
          />
        </label>
        {editable && (
          <button
            type="submit"
            disabled={!dirty || busy || (isRegular && draft.days.length === 0)}
            className={primaryBtn}
          >
            Save
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              service.active
                ? 'bg-stage-regular-bg text-stage-regular-text'
                : 'bg-stage-second-bg text-muted'
            }`}
          >
            {service.active ? 'Active' : isRegular ? 'Switched off' : 'Cancelled'}
          </span>
          {editable && (
            <button
              type="button"
              disabled={busy || isLastActive}
              aria-describedby={isLastActive ? `${service.key}-last` : undefined}
              onClick={() => submit({ active: !service.active })}
              className="h-11 rounded-[10px] border-[1.5px] border-line px-3 text-[13px] font-semibold hover:border-primary disabled:opacity-40"
            >
              {service.active ? (isRegular ? 'Switch off' : 'Cancel service') : 'Restore'}
            </button>
          )}
        </div>
      </form>
      {editable && isLastActive && (
        <p id={`${service.key}-last`} className="mt-2 text-[11px] text-muted">
          At least one regular service must stay active.
        </p>
      )}
    </li>
  );
}

function AddService({ kind, today, onAdd }) {
  const blank = { name: '', startTime: '', days: [], date: '' };
  const [values, setValues] = useState(blank);
  const isRegular = kind === 'regular';
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <section className="rounded-xl border border-dashed border-line bg-surface p-5">
      <h3 className="text-[15px] font-semibold">
        {isRegular ? 'Add a regular service' : 'Add a special service'}
      </h3>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const base = { kind, name: values.name.trim(), startTime: values.startTime };
          const payload = isRegular
            ? { ...base, days: values.days }
            : { ...base, date: values.date };
          if (await onAdd(payload)) setValues(blank);
        }}
      >
        <label className={`${fieldLabel} min-w-[200px] flex-1`}>
          Name
          <input
            value={values.name}
            onChange={set('name')}
            maxLength={40}
            required
            placeholder={isRegular ? '2nd Service' : 'Thanksgiving Service'}
            className={input}
          />
        </label>
        {isRegular ? (
          <DayPicker value={values.days} onChange={(days) => setValues((v) => ({ ...v, days }))} />
        ) : (
          <label className={fieldLabel}>
            Date
            <input
              type="date"
              min={today}
              value={values.date}
              onChange={set('date')}
              required
              className={input}
            />
          </label>
        )}
        <label className={fieldLabel}>
          Starts
          <input
            type="time"
            value={values.startTime}
            onChange={set('startTime')}
            required
            className={input}
          />
        </label>
        <button
          type="submit"
          disabled={isRegular && values.days.length === 0}
          className={primaryBtn}
        >
          <Icon name="add" size={18} />
          Add
        </button>
      </form>
      {values.startTime && (
        <p className="mt-2 text-[13px] text-muted">
          Shows as {formatServiceTime(values.startTime)}
        </p>
      )}
    </section>
  );
}
