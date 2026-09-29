'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import PasswordInput from '@/components/ui/PasswordInput';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { sendJson } from '@/lib/client-api';
import { ALERTS, MIN_PASSWORD, canGetAlert } from '@/lib/users';

export default function AccountForm({ account }) {
  return (
    <>
      <Details account={account} />
      <Emails account={account} />
      <Password />
    </>
  );
}

function useSave() {
  const router = useRouter();
  const [state, setState] = useState({ kind: 'idle' });
  async function save(body, message) {
    setState({ kind: 'busy' });
    try {
      await sendJson('/api/account', 'PATCH', body);
      setState({ kind: 'ok', message });
      router.refresh();
      return true;
    } catch (err) {
      setState({ kind: 'error', error: err });
      return false;
    }
  }
  const fields = state.kind === 'error' ? (state.error.fields ?? {}) : {};
  return { state, save, fields, busy: state.kind === 'busy' };
}

function Details({ account }) {
  const [f, setF] = useState({
    displayName: account.displayName,
    email: account.email ?? '',
    phone: account.phone ?? '',
  });
  const { state, save, fields, busy } = useSave();
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const invalid = (k) =>
    fields[k] ? { 'aria-invalid': true, 'aria-describedby': `me-${k}-error` } : {};

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    save(
      { displayName: f.displayName.trim(), email: f.email.trim(), phone: f.phone.trim() },
      'Saved.',
    );
  }

  return (
    <form onSubmit={submit} className="of-panel flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="of-h2">Your details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col sm:col-span-2">
          <span className="field-label">Name</span>
          <input
            name="displayName"
            value={f.displayName}
            onChange={set('displayName')}
            required
            maxLength={60}
            autoComplete="name"
            className="input"
            {...invalid('displayName')}
          />
          <FieldError id="me-displayName-error">{fields.displayName}</FieldError>
        </label>
        <label className="flex flex-col">
          <span className="field-label">Email</span>
          <input
            name="email"
            type="email"
            value={f.email}
            onChange={set('email')}
            maxLength={120}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className="input"
            {...invalid('email')}
          />
          <FieldError id="me-email-error">{fields.email}</FieldError>
        </label>
        <label className="flex flex-col">
          <span className="field-label">Phone</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            value={f.phone}
            onChange={set('phone')}
            autoComplete="tel"
            placeholder="e.g. 0803 000 0000"
            className="input"
            {...invalid('phone')}
          />
          <FieldError id="me-phone-error">{fields.phone}</FieldError>
        </label>
      </div>
      <p className="text-meta text-muted">
        Sign in with {account.email ? 'your email or ' : ''}the username “{account.username}”.
      </p>
      {state.kind === 'error' && !Object.keys(fields).length && <FormAlert error={state.error} />}
      {state.kind === 'ok' && <FormAlert success={state.message} />}
      <button type="submit" aria-disabled={busy} className="of-btn self-start">
        <Busy busy={busy} icon="save" label="Save" />
      </button>
    </form>
  );
}

function Emails({ account }) {
  const kinds = Object.keys(ALERTS).filter((k) => canGetAlert(account.role, k));
  const [on, setOn] = useState(account.alerts);
  const { state, save } = useSave();
  if (!kinds.length) return null;

  async function toggle(kind, value) {
    setOn((s) => ({ ...s, [kind]: value }));
    const ok = await save(
      { alerts: { [kind]: value } },
      value ? `You’ll get the ${ALERTS[kind].label.toLowerCase()}.` : 'Switched off.',
    );
    if (!ok) setOn((s) => ({ ...s, [kind]: !value }));
  }

  return (
    <section className="of-panel flex flex-col gap-3 p-5 sm:p-6">
      <h2 className="of-h2">Emails you get</h2>
      {!account.email && (
        <p className="alert alert-warning">
          <Icon name="mail" size={19} />
          Add your email above to get these.
        </p>
      )}
      {kinds.map((k) => (
        <label key={k} className="check-row">
          <Icon name={ALERTS[k].icon} size={19} className="text-muted" />
          <span className="flex-1 font-bold">{ALERTS[k].label}</span>
          <input
            type="checkbox"
            role="switch"
            checked={on[k]}
            onChange={(e) => toggle(k, e.target.checked)}
            className="switch"
          />
        </label>
      ))}
      {state.kind === 'error' && <FormAlert error={state.error} />}
      {state.kind === 'ok' && <FormAlert success={state.message} />}
    </section>
  );
}

function Password() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const { state, save, fields, busy } = useSave();

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (await save(f, 'Password changed. Use it next time you sign in.')) {
      setF({ currentPassword: '', newPassword: '' });
    }
  }

  return (
    <form onSubmit={submit} className="of-panel flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="of-h2">Change password</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col">
          <span className="field-label">Current password</span>
          <PasswordInput
            name="currentPassword"
            value={f.currentPassword}
            onChange={(e) => setF((s) => ({ ...s, currentPassword: e.target.value }))}
            required
            autoComplete="current-password"
            aria-invalid={fields.currentPassword ? true : undefined}
            aria-describedby={fields.currentPassword ? 'me-current-error' : undefined}
          />
          <FieldError id="me-current-error">{fields.currentPassword}</FieldError>
        </label>
        <label className="flex flex-col">
          <span className="field-label">New password</span>
          <PasswordInput
            name="newPassword"
            value={f.newPassword}
            onChange={(e) => setF((s) => ({ ...s, newPassword: e.target.value }))}
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            aria-invalid={fields.newPassword ? true : undefined}
            aria-describedby={fields.newPassword ? 'me-new-error' : undefined}
          />
          <FieldError id="me-new-error">{fields.newPassword}</FieldError>
        </label>
      </div>
      {state.kind === 'error' && !Object.keys(fields).length && <FormAlert error={state.error} />}
      {state.kind === 'ok' && <FormAlert success={state.message} />}
      <button type="submit" aria-disabled={busy} className="of-btn-quiet self-start">
        <Busy busy={busy} icon="lock" label="Change password" />
      </button>
    </form>
  );
}
