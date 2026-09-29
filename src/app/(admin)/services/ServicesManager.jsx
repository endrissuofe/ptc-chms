'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import EmptyState from '@/components/ui/EmptyState';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import {
  USHER_BACKDATE_DAYS,
  WEEKDAYS,
  describeSchedule,
  formatServiceTime,
  sortServices,
} from '@/lib/church';

/** API dates come back as ISO timestamps; the forms work in "YYYY-MM-DD". */
const normalise = (s) => ({ ...s, date: s.date ? s.date.slice(0, 10) : undefined });

/** Special services may be dated from a week ago (late entries), like the server allows. */
function earliestDate(today) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - USHER_BACKDATE_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Regular services (repeat weekly) and special services (one date).
 * Admins manage both; pastors add and edit special services and see regular ones read-only.
 * Services are switched off, never deleted, so their attendance history stays.
 */
export default function ServicesManager({ initial, isAdmin, today }) {
  const [services, setServices] = useState(initial);

  const replace = (updated) =>
    setServices((list) => list.map((s) => (s.key === updated.key ? normalise(updated) : s)));
  const added = (created) => setServices((list) => [...list, normalise(created)]);

  const regular = sortServices(services.filter((s) => s.kind === 'regular'));
  const special = services
    .filter((s) => s.kind === 'special')
    .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime));
  const upcoming = special.filter((s) => s.date >= today).reverse();
  const past = special.filter((s) => s.date < today);
  const activeRegular = regular.filter((s) => s.active).length;

  return (
    <>
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
            today={today}
            onSaved={replace}
          />
        ))}
        {isAdmin && <AddService kind="regular" today={today} onAdded={added} />}
      </Section>

      <Section
        title="Special services"
        hint="One-off services such as Thanksgiving or a crusade. Ushers see them on the day."
      >
        {upcoming.length === 0 && (
          <EmptyState icon="event" title="No special services coming up">
            Add one below and the ushers will see it on the day.
          </EmptyState>
        )}
        {upcoming.map((s) => (
          <ServiceRow key={s.key} service={s} editable today={today} onSaved={replace} />
        ))}
        <AddService kind="special" today={today} onAdded={added} />
      </Section>

      {past.length > 0 && (
        <details className="of-panel group p-5 sm:p-6">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-brand text-lg font-semibold">
            <Icon
              name="expand_more"
              size={22}
              className="text-muted transition-transform group-open:rotate-180"
            />
            Past special services ({past.length})
          </summary>
          <div className="mt-4 flex flex-col gap-3 motion-safe:animate-fade-in">
            {past.map((s) => (
              <ServiceRow key={s.key} service={s} editable today={today} onSaved={replace} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="of-panel flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="of-h2">{title}</h2>
        <p className="text-meta text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function DayPicker({ value, onChange, error, errorId }) {
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="field-label">Days</legend>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((label, day) => {
          const on = value.includes(day);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day].sort())}
              className="toggle-chip min-w-[52px] px-3"
            >
              {label}
            </button>
          );
        })}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </fieldset>
  );
}

/** Name, days or date, and start time: shared by editing and adding. */
function ServiceFields({ kind, values, setValues, fields, idPrefix, minDate }) {
  const isRegular = kind === 'regular';
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const invalid = (key) =>
    fields[key] ? { 'aria-invalid': true, 'aria-describedby': `${idPrefix}-${key}-error` } : {};
  return (
    <div className="flex flex-wrap items-start gap-3">
      <label className="flex min-w-[200px] flex-1 flex-col">
        <span className="field-label">Name</span>
        <input
          name="name"
          value={values.name}
          onChange={set('name')}
          maxLength={40}
          required
          placeholder={isRegular ? 'e.g. 2nd Service' : 'e.g. Thanksgiving Service'}
          className="input"
          {...invalid('name')}
        />
        <FieldError id={`${idPrefix}-name-error`}>{fields.name}</FieldError>
      </label>
      {isRegular ? (
        <DayPicker
          value={values.days}
          onChange={(days) => setValues((v) => ({ ...v, days }))}
          error={fields.days}
          errorId={`${idPrefix}-days-error`}
        />
      ) : (
        <label className="flex flex-col">
          <span className="field-label">Date</span>
          <input
            name="date"
            type="date"
            min={minDate}
            value={values.date}
            onChange={set('date')}
            required
            className="input"
            {...invalid('date')}
          />
          <FieldError id={`${idPrefix}-date-error`}>{fields.date}</FieldError>
        </label>
      )}
      <label className="flex flex-col">
        <span className="field-label">Starts</span>
        <input
          name="startTime"
          type="time"
          value={values.startTime}
          onChange={set('startTime')}
          required
          className="input"
          {...invalid('startTime')}
        />
        <FieldError id={`${idPrefix}-startTime-error`}>{fields.startTime}</FieldError>
        {values.startTime && !fields.startTime && (
          <span className="field-hint">Shows as {formatServiceTime(values.startTime)}</span>
        )}
      </label>
    </div>
  );
}

/** Errors from the server: those naming a field go under it; anything else in a banner. */
function splitError(err) {
  const fields = err?.fields ?? {};
  return { fields, banner: err && !Object.keys(fields).length ? err : null };
}

function ServiceRow({ service, editable, isLastActive = false, today, onSaved }) {
  const confirm = useConfirm();
  const changeButton = useRef(null);
  const form = useRef(null);
  const isRegular = service.kind === 'regular';
  const start = {
    name: service.name,
    startTime: service.startTime,
    days: service.days || [],
    date: service.date || '',
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(start);
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy' || state.kind === 'switching';
  const { fields, banner } = splitError(state.kind === 'error' ? state.error : null);

  useEffect(() => {
    if (editing) form.current?.querySelector('input')?.focus();
  }, [editing]);

  const changes = {};
  if (draft.name.trim() !== service.name) changes.name = draft.name.trim();
  if (draft.startTime !== service.startTime) changes.startTime = draft.startTime;
  if (isRegular && draft.days.join() !== (service.days || []).join()) changes.days = draft.days;
  if (!isRegular && draft.date !== service.date) changes.date = draft.date;
  const dirty = Object.keys(changes).length > 0;

  function close() {
    setEditing(false);
    setDraft(start);
    requestAnimationFrame(() => changeButton.current?.focus());
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !dirty) return;
    if (isRegular && draft.days.length === 0) {
      setState({ kind: 'error', error: { fields: { days: 'Choose at least one day' } } });
      return;
    }
    setState({ kind: 'busy' });
    try {
      const updated = await sendJson(`/api/services/${service.key}`, 'PATCH', changes);
      onSaved(updated);
      setEditing(false);
      setState({ kind: 'ok', message: 'Saved.' });
      requestAnimationFrame(() => changeButton.current?.focus());
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  async function switchActive() {
    if (busy) return;
    if (service.active) {
      const ok = await confirm({
        title: isRegular ? `Switch off ${service.name}?` : `Cancel ${service.name}?`,
        body: isRegular
          ? 'Ushers stop seeing it. Its attendance history is kept, and you can switch it back on.'
          : 'Ushers won’t see it on the day. You can restore it later.',
        confirmLabel: isRegular ? 'Switch off' : 'Cancel service',
        cancelLabel: 'Keep it',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setState({ kind: 'switching' });
    try {
      const updated = await sendJson(`/api/services/${service.key}`, 'PATCH', {
        active: !service.active,
      });
      onSaved(updated);
      setState({
        kind: 'ok',
        message: updated.active ? 'Switched back on.' : isRegular ? 'Switched off.' : 'Cancelled.',
      });
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  const when = describeSchedule(service);

  return (
    <div
      className={`flex flex-col gap-3 rounded-tile border border-line p-4 ${service.active ? 'bg-surface' : 'bg-surface-2'}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words font-brand text-lg font-semibold">{service.name}</p>
          <p className="text-meta text-muted">{when}</p>
        </div>
        <span className={`chip ${service.active ? 'chip-success' : 'chip-warning'}`}>
          <Icon name={service.active ? 'check_circle' : 'pending'} size={14} />
          {service.active ? 'Active' : isRegular ? 'Switched off' : 'Cancelled'}
        </span>
        {editable && !editing && (
          <button
            ref={changeButton}
            type="button"
            onClick={() => {
              setEditing(true);
              setState({ kind: 'idle' });
            }}
            aria-expanded={false}
            className="of-btn-quiet min-h-[40px]"
          >
            <Icon name="edit_note" size={17} />
            Change
          </button>
        )}
      </div>

      {editing && (
        <form
          ref={form}
          onSubmit={save}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          className="flex flex-col gap-4 border-t border-line pt-4 motion-safe:animate-fade-in"
        >
          <ServiceFields
            kind={service.kind}
            values={draft}
            setValues={(fn) => {
              setDraft(fn);
              setState({ kind: 'idle' });
            }}
            fields={fields}
            idPrefix={`edit-${service.key}`}
            minDate={earliestDate(today)}
          />
          {banner && <FormAlert error={banner} />}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!dirty}
              aria-disabled={busy}
              className="of-btn disabled:opacity-50"
            >
              <Busy busy={state.kind === 'busy'} icon="save" label="Save" />
            </button>
            <button type="button" onClick={close} className="of-btn-quiet bg-transparent">
              Cancel
            </button>
            <button
              type="button"
              onClick={switchActive}
              disabled={isLastActive}
              aria-disabled={busy}
              aria-describedby={isLastActive ? `${service.key}-last` : undefined}
              className={`btn sm:ml-auto ${service.active ? 'btn-danger-ghost' : 'btn-soft'}`}
            >
              <Busy
                busy={state.kind === 'switching'}
                busyLabel="Saving…"
                icon={service.active ? 'lock' : 'how_to_reg'}
                label={service.active ? (isRegular ? 'Switch off' : 'Cancel service') : 'Restore'}
              />
            </button>
          </div>
          {isLastActive && (
            <p id={`${service.key}-last`} className="field-hint">
              At least one regular service must stay active.
            </p>
          )}
        </form>
      )}

      {!editing && state.kind === 'ok' && <FormAlert success={state.message} />}
      {!editing && banner && <FormAlert error={banner} />}
    </div>
  );
}

function AddService({ kind, today, onAdded }) {
  const blank = { name: '', startTime: '', days: [], date: '' };
  const [values, setValues] = useState(blank);
  const [state, setState] = useState({ kind: 'idle' });
  const isRegular = kind === 'regular';
  const busy = state.kind === 'busy';
  const { fields, banner } = splitError(state.kind === 'error' ? state.error : null);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (isRegular && values.days.length === 0) {
      setState({ kind: 'error', error: { fields: { days: 'Choose at least one day' } } });
      return;
    }
    const base = { kind, name: values.name.trim(), startTime: values.startTime };
    const payload = isRegular ? { ...base, days: values.days } : { ...base, date: values.date };
    setState({ kind: 'busy' });
    try {
      const created = await sendJson('/api/services', 'POST', payload);
      onAdded(created);
      setValues(blank);
      setState({ kind: 'ok', message: `${created.name} added.` });
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <div className="rounded-tile border-[1.5px] border-dashed border-field/60 bg-surface-2/60 p-4">
      <h3 className="flex items-center gap-2 font-brand text-body font-semibold">
        <Icon name="add_circle" size={20} className="text-of-accent-ink" />
        {isRegular ? 'Add a regular service' : 'Add a special service'}
      </h3>
      <form className="mt-3 flex flex-col gap-3" onSubmit={submit}>
        <ServiceFields
          kind={kind}
          values={values}
          setValues={(fn) => {
            setValues(fn);
            if (state.kind !== 'busy') setState({ kind: 'idle' });
          }}
          fields={fields}
          idPrefix={`add-${kind}`}
          minDate={earliestDate(today)}
        />
        {banner && <FormAlert error={banner} />}
        {state.kind === 'ok' && <FormAlert success={state.message} />}
        <button type="submit" aria-disabled={busy} className="of-btn self-start">
          <Busy busy={busy} busyLabel="Adding…" icon="add" label="Add service" />
        </button>
      </form>
    </div>
  );
}
