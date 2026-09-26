'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { MONTHS } from '@/lib/birthday';

async function send(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.details?.[0]?.message || data.error || 'Could not save');
  return data;
}

/** Pastors and admins: milestones, move to Members, and correcting the card's details. */
export default function ManagePerson({ person }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState({ kind: 'idle' });

  async function run(action, success) {
    setState({ kind: 'busy' });
    try {
      await action();
      setState({ kind: 'ok', message: success });
      router.refresh();
      return true;
    } catch (err) {
      setState({ kind: 'error', message: err.message });
      return false;
    }
  }

  const toggle = (field, value, message) =>
    run(() => send(`/api/newcomers/${person.id}`, 'PATCH', { [field]: value }), message);

  const move = () => {
    if (!window.confirm(`Move ${person.firstName} into the Members list?`)) return;
    run(
      () => send('/api/newcomers/move-to-members', 'POST', { ids: [person.id] }),
      `${person.firstName} is now in the Members list.`,
    );
  };

  return (
    <section className="card flex flex-col gap-4">
      <h2 className="card-title flex items-center gap-2">
        <Icon name="shield_person" size={22} className="text-primary" />
        Pastors and admins
      </h2>

      <div className="flex flex-col gap-2">
        <Toggle
          checked={person.inBelieversClass}
          disabled={state.kind === 'busy'}
          onChange={(v) =>
            toggle('inBelieversClass', v, v ? 'Marked as in Believers’ Class.' : 'Updated.')
          }
          icon="school"
          label="In Believers’ Class"
        />
        <Toggle
          checked={person.isMember}
          disabled={state.kind === 'busy'}
          onChange={(v) => toggle('isMember', v, v ? 'Marked as a member.' : 'Updated.')}
          icon="verified"
          label="Has become a member"
        />
      </div>

      {!person.moved && (
        <button
          type="button"
          onClick={move}
          disabled={state.kind === 'busy'}
          className="btn btn-soft self-start"
        >
          <Icon name="group_add" size={18} />
          Move to Members list
        </button>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={19} />
          {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <p role="status" className="alert alert-success">
          <Icon name="check_circle" size={19} filled />
          {state.message}
        </p>
      )}

      <div className="border-t border-line pt-4">
        {editing ? (
          <EditDetails
            person={person}
            busy={state.kind === 'busy'}
            onCancel={() => setEditing(false)}
            onSave={async (changes) => {
              const ok = await run(
                () => send(`/api/newcomers/${person.id}`, 'PATCH', changes),
                'Details saved.',
              );
              if (ok) setEditing(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost btn-sm">
            <Icon name="edit_note" size={17} />
            Correct details
          </button>
        )}
      </div>
    </section>
  );
}

function Toggle({ checked, onChange, disabled, icon, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-tile bg-surface-2 px-4 py-3">
      <Icon name={icon} size={19} className="text-muted" />
      <span className="flex-1 font-bold">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-[rgb(var(--primary))]"
      />
    </label>
  );
}

function EditDetails({ person, busy, onCancel, onSave }) {
  const [f, setF] = useState(person);
  const set = (key) => (e) =>
    setF((v) => ({
      ...v,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  function submit(e) {
    e.preventDefault();
    onSave({
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      phone: f.phone,
      email: f.email.trim(),
      birthDay: f.birthDay ? Number(f.birthDay) : null,
      birthMonth: f.birthMonth ? Number(f.birthMonth) : null,
      smsConsent: f.smsConsent,
      cardUnclear: f.cardUnclear,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name">
          <input value={f.firstName} onChange={set('firstName')} required className="input" />
        </Field>
        <Field label="Last name">
          <input value={f.lastName} onChange={set('lastName')} required className="input" />
        </Field>
        <Field label="Phone">
          <input
            value={f.phone}
            onChange={set('phone')}
            required
            inputMode="tel"
            className="input"
          />
        </Field>
        <Field label="Email">
          <input type="email" value={f.email} onChange={set('email')} className="input" />
        </Field>
        <Field label="Birthday">
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <select
              value={f.birthDay}
              onChange={set('birthDay')}
              className="input"
              aria-label="Day"
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <select
              value={f.birthMonth}
              onChange={set('birthMonth')}
              className="input"
              aria-label="Month"
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-[14.5px]">
        <input
          type="checkbox"
          checked={f.smsConsent}
          onChange={set('smsConsent')}
          className="h-5 w-5"
        />
        Agreed to SMS messages
      </label>
      <label className="flex items-center gap-2.5 text-[14.5px]">
        <input
          type="checkbox"
          checked={f.cardUnclear}
          onChange={set('cardUnclear')}
          className="h-5 w-5"
        />
        Card hard to read
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary">
          <Icon name="save" size={18} />
          Save
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
