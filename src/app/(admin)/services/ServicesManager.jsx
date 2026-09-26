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
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={20} />
          {error}
        </p>
      )}

      <Section
        icon="repeat"
        tone="tone-primary"
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
        {isAdmin && <AddService kind="regular" today={today} onAdd={add} />}
      </Section>

      <Section
        icon="event"
        tone="tone-coral"
        title="Special services"
        hint="One-off services such as Thanksgiving or a crusade. Ushers see them on the day."
      >
        {upcoming.length === 0 && (
          <p className="py-2 text-[15px] text-muted">No special services coming up.</p>
        )}
        {upcoming.map((s) => (
          <ServiceRow key={s.key} service={s} editable onSave={(c) => save(s.key, c)} />
        ))}
        <AddService kind="special" today={today} onAdd={add} />
      </Section>

      {past.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-display text-lg font-extrabold">
            Past special services ({past.length})
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            {past.map((s) => (
              <ServiceRow key={s.key} service={s} editable onSave={(c) => save(s.key, c)} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function Section({ icon, tone, title, hint, children }) {
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className={`icon-tile ${tone}`}>
          <Icon name={icon} size={22} />
        </span>
        <div>
          <h2 className="card-title">{title}</h2>
          <p className="card-sub">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function DayPicker({ value, onChange, disabled }) {
  return (
    <fieldset>
      <legend className="field-label">Days</legend>
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
              className={`h-11 w-12 rounded-full font-display text-[13px] font-extrabold transition ${
                on
                  ? 'bg-primary text-on-primary shadow-primary-glow'
                  : 'border border-line-2 bg-surface text-muted hover:text-ink'
              } disabled:cursor-default disabled:opacity-70`}
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
    <div
      className={`rounded-tile border border-line p-4 ${service.active ? 'bg-surface' : 'bg-surface-2'}`}
    >
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) submit(changes);
        }}
      >
        <label className="min-w-[200px] flex-1">
          <span className="field-label">Name</span>
          <input
            value={draft.name}
            onChange={set('name')}
            maxLength={40}
            required
            disabled={!editable}
            className="input"
          />
        </label>
        {isRegular ? (
          <DayPicker
            value={draft.days}
            disabled={!editable}
            onChange={(days) => setDraft((d) => ({ ...d, days }))}
          />
        ) : (
          <label>
            <span className="field-label">Date</span>
            <input
              type="date"
              value={draft.date}
              onChange={set('date')}
              required
              disabled={!editable}
              className="input"
            />
          </label>
        )}
        <label>
          <span className="field-label">Starts</span>
          <input
            type="time"
            value={draft.startTime}
            onChange={set('startTime')}
            required
            disabled={!editable}
            className="input"
          />
        </label>
        {editable && (
          <button
            type="submit"
            disabled={!dirty || busy || (isRegular && draft.days.length === 0)}
            className="btn btn-primary"
          >
            Save
          </button>
        )}
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className={`chip ${service.active ? 'chip-success' : 'chip-soft'}`}>
          <Icon name={service.active ? 'check_circle' : 'pending'} size={14} />
          {service.active ? 'Active' : isRegular ? 'Switched off' : 'Cancelled'}
          <span className="font-semibold opacity-80">· {formatServiceTime(service.startTime)}</span>
        </span>
        {editable && (
          <div className="flex items-center gap-2">
            {isLastActive && (
              <span id={`${service.key}-last`} className="text-[12px] text-muted">
                At least one regular service must stay active
              </span>
            )}
            <button
              type="button"
              disabled={busy || isLastActive}
              aria-describedby={isLastActive ? `${service.key}-last` : undefined}
              onClick={() => submit({ active: !service.active })}
              className="btn btn-ghost btn-sm"
            >
              {service.active ? (isRegular ? 'Switch off' : 'Cancel service') : 'Restore'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddService({ kind, today, onAdd }) {
  const blank = { name: '', startTime: '', days: [], date: '' };
  const [values, setValues] = useState(blank);
  const isRegular = kind === 'regular';
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <div className="rounded-tile border-[1.5px] border-dashed border-line-2 bg-surface-2/60 p-4">
      <h3 className="flex items-center gap-2 font-display text-[15px] font-extrabold">
        <Icon name="add_circle" size={20} className="text-primary" />
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
        <label className="min-w-[200px] flex-1">
          <span className="field-label">Name</span>
          <input
            value={values.name}
            onChange={set('name')}
            maxLength={40}
            required
            placeholder={isRegular ? '2nd Service' : 'Thanksgiving Service'}
            className="input"
          />
        </label>
        {isRegular ? (
          <DayPicker value={values.days} onChange={(days) => setValues((v) => ({ ...v, days }))} />
        ) : (
          <label>
            <span className="field-label">Date</span>
            <input
              type="date"
              min={today}
              value={values.date}
              onChange={set('date')}
              required
              className="input"
            />
          </label>
        )}
        <label>
          <span className="field-label">Starts</span>
          <input
            type="time"
            value={values.startTime}
            onChange={set('startTime')}
            required
            className="input"
          />
        </label>
        <button
          type="submit"
          disabled={isRegular && values.days.length === 0}
          className="btn btn-soft"
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
    </div>
  );
}
