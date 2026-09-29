'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { MONTHS } from '@/lib/birthday';
import { sendJson } from '@/lib/client-api';

/** Pastors and admins: milestones, move to Members, and correcting the card's details. */
export default function ManagePerson({ person }) {
  const router = useRouter();
  const confirm = useConfirm();
  const editButton = useRef(null);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState({ kind: 'idle' });
  // Ticks show straight away; they roll back if saving fails.
  const [milestones, setMilestones] = useState({
    inBelieversClass: person.inBelieversClass,
    isMember: person.isMember,
  });
  const [savingField, setSavingField] = useState(null);

  useEffect(() => {
    setMilestones({ inBelieversClass: person.inBelieversClass, isMember: person.isMember });
  }, [person.inBelieversClass, person.isMember]);

  async function toggle(field, value, message) {
    const before = milestones;
    setMilestones((m) => ({ ...m, [field]: value }));
    setSavingField(field);
    setState({ kind: 'idle' });
    try {
      await sendJson(`/api/newcomers/${person.id}`, 'PATCH', { [field]: value });
      setState({ kind: 'ok', message });
      router.refresh();
    } catch (err) {
      setMilestones(before);
      setState({ kind: 'error', error: err });
    } finally {
      setSavingField(null);
    }
  }

  async function move() {
    const ok = await confirm({
      title: `Move ${person.firstName} into the Members list?`,
      body: 'They stop being followed up as a first timer. Their visits and calls stay linked.',
      confirmLabel: 'Move to Members',
      icon: 'group_add',
    });
    if (!ok) return;
    setState({ kind: 'busy' });
    try {
      await sendJson('/api/newcomers/move-to-members', 'POST', { ids: [person.id] });
      setState({ kind: 'ok', message: `${person.firstName} is now in the Members list.` });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <section className="of-panel flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <h2 className="of-h2">Pastors and admins</h2>
        <p className="text-meta text-muted">Milestones and corrections</p>
      </div>

      <div className="flex flex-col gap-2">
        <Toggle
          checked={milestones.inBelieversClass}
          saving={savingField === 'inBelieversClass'}
          onChange={(v) =>
            toggle(
              'inBelieversClass',
              v,
              v ? 'Marked as in Believers’ Class.' : 'Believers’ Class tick removed.',
            )
          }
          icon="school"
          label="In Believers’ Class"
        />
        <Toggle
          checked={milestones.isMember}
          saving={savingField === 'isMember'}
          onChange={(v) =>
            toggle('isMember', v, v ? 'Marked as a member.' : 'Member tick removed.')
          }
          icon="verified"
          label="Has become a member"
        />
      </div>

      {!person.moved && (
        <button
          type="button"
          onClick={move}
          aria-disabled={state.kind === 'busy'}
          className="of-btn-quiet self-start"
        >
          <Busy
            busy={state.kind === 'busy'}
            busyLabel="Moving…"
            icon="group_add"
            label="Move to Members list"
          />
        </button>
      )}

      {state.kind === 'error' && <FormAlert error={state.error} />}
      {state.kind === 'ok' && !editing && <FormAlert success={state.message} />}

      <div className="border-t border-line pt-4">
        {editing ? (
          <EditDetails
            person={person}
            onCancel={() => {
              setEditing(false);
              requestAnimationFrame(() => editButton.current?.focus());
            }}
            onSaved={(message) => {
              setEditing(false);
              setState({ kind: 'ok', message });
              router.refresh();
              requestAnimationFrame(() => editButton.current?.focus());
            }}
          />
        ) : (
          <button
            ref={editButton}
            type="button"
            onClick={() => {
              setEditing(true);
              setState({ kind: 'idle' });
            }}
            className="of-link"
          >
            <Icon name="edit_note" size={17} />
            Correct details
          </button>
        )}
      </div>
    </section>
  );
}

function Toggle({ checked, onChange, saving, icon, label }) {
  return (
    <label className="check-row">
      <Icon name={icon} size={19} className="text-muted" />
      <span className="flex-1 font-bold">{label}</span>
      {saving && <Icon name="sync" size={17} className="text-muted motion-safe:animate-spin" />}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="checkbox"
      />
    </label>
  );
}

function EditDetails({ person, onCancel, onSaved }) {
  const confirm = useConfirm();
  const form = useRef(null);
  const [f, setF] = useState(person);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) =>
    setF((v) => ({
      ...v,
      [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));
  const fields = error?.fields ?? {};

  useEffect(() => {
    form.current?.querySelector('input')?.focus();
  }, []);

  async function submit(e, sharedPhoneConfirmed = false) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const body = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      address: f.address.trim(),
      email: f.email.trim(),
      birthDay: f.birthDay ? Number(f.birthDay) : null,
      birthMonth: f.birthMonth ? Number(f.birthMonth) : null,
      smsConsent: f.smsConsent,
      cardUnclear: f.cardUnclear,
      // Only send the phone if it changed, so the shared-number check runs only when needed.
      ...(f.phone !== person.phone && { phone: f.phone, sharedPhoneConfirmed }),
    };
    try {
      await sendJson(`/api/newcomers/${person.id}`, 'PATCH', body);
      onSaved('Details saved.');
    } catch (err) {
      setBusy(false);
      if (err.status === 409 && err.details?.matches) {
        const names = err.details.matches.map((m) => `${m.firstName} ${m.lastName}`).join(', ');
        const ok = await confirm({
          title: 'Someone else uses this number',
          body: `${names} is on this number too. Is it a shared family phone?`,
          confirmLabel: 'Yes, it’s shared',
          cancelLabel: 'Let me check',
          icon: 'contact_phone',
        });
        if (ok) submit(null, true);
        return;
      }
      setError(err);
      const first = Object.keys(err.fields ?? {})[0];
      if (first) form.current?.querySelector(`[name="${first}"]`)?.focus();
    }
  }

  const invalid = (key) =>
    fields[key] ? { 'aria-invalid': true, 'aria-describedby': `edit-${key}-error` } : {};

  return (
    <form
      ref={form}
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="flex flex-col gap-4 motion-safe:animate-fade-in"
    >
      <h3 className="card-title">Correct details</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" error={fields.firstName} errorId="edit-firstName-error">
          <input
            name="firstName"
            value={f.firstName}
            onChange={set('firstName')}
            required
            className="input"
            {...invalid('firstName')}
          />
        </Field>
        <Field label="Last name" error={fields.lastName} errorId="edit-lastName-error">
          <input
            name="lastName"
            value={f.lastName}
            onChange={set('lastName')}
            required
            className="input"
            {...invalid('lastName')}
          />
        </Field>
        <Field label="Phone" error={fields.phone} errorId="edit-phone-error">
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            value={f.phone}
            onChange={set('phone')}
            required
            className="input"
            {...invalid('phone')}
          />
        </Field>
        <Field label="Home address" error={fields.address} errorId="edit-address-error">
          <input
            name="address"
            value={f.address}
            onChange={set('address')}
            maxLength={200}
            className="input"
            {...invalid('address')}
          />
        </Field>
        <Field label="Email" error={fields.email} errorId="edit-email-error">
          <input
            name="email"
            type="email"
            value={f.email}
            onChange={set('email')}
            className="input"
            {...invalid('email')}
          />
        </Field>
        <Field label="Birthday" error={fields.birthDay} errorId="edit-birthDay-error">
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <select
              name="birthDay"
              value={f.birthDay}
              onChange={set('birthDay')}
              className="input"
              aria-label="Day"
              {...invalid('birthDay')}
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
      <label className="check-row">
        <input
          type="checkbox"
          checked={f.smsConsent}
          onChange={set('smsConsent')}
          className="checkbox"
        />
        Agreed to SMS messages
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={f.cardUnclear}
          onChange={set('cardUnclear')}
          className="checkbox"
        />
        Card hard to read
      </label>
      {error && !Object.keys(fields).length && <FormAlert error={error} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" aria-disabled={busy} className="btn btn-primary">
          <Busy busy={busy} icon="save" label="Save details" />
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, errorId, children }) {
  return (
    <label className="flex flex-col">
      <span className="field-label">{label}</span>
      {children}
      <FieldError id={errorId}>{error}</FieldError>
    </label>
  );
}
