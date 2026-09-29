'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import PasswordInput from '@/components/ui/PasswordInput';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { sendJson } from '@/lib/client-api';
import { MIN_PASSWORD } from '@/lib/users';

const FIELDS = ['displayName', 'phone', 'email', 'password'];

export default function JoinForm({ token }) {
  const form = useRef(null);
  const [f, setF] = useState({ displayName: '', phone: '', email: '', password: '', website: '' });
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy';
  const fields = state.kind === 'error' ? (state.error.fields ?? {}) : {};
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const invalid = (k) =>
    fields[k] ? { 'aria-invalid': true, 'aria-describedby': `join-${k}-error` } : {};

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setState({ kind: 'busy' });
    try {
      const res = await sendJson('/api/join', 'POST', { ...f, token });
      setState({ kind: 'done', team: res.team });
    } catch (err) {
      setState({ kind: 'error', error: err });
      const first = FIELDS.find((k) => err.fields?.[k]);
      if (first) form.current?.querySelector(`[name="${first}"]`)?.focus();
    }
  }

  if (state.kind === 'done') {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="icon-tile tone-success">
          <Icon name="task_alt" size={22} />
        </span>
        <p className="of-h2">Thank you, {f.displayName.trim().split(/\s+/)[0]}!</p>
        <p>
          Your sign-up for the {state.team} is waiting for an admin. We’ll email {f.email.trim()}{' '}
          when you can sign in.
        </p>
        <Link href="/login" className="of-btn-quiet self-start">
          Go to sign in
        </Link>
      </div>
    );
  }

  const banner = state.kind === 'error' && !Object.keys(fields).length ? state.error : null;
  return (
    <form ref={form} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col">
        <span className="field-label">Full name</span>
        <input
          name="displayName"
          value={f.displayName}
          onChange={set('displayName')}
          required
          maxLength={60}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="e.g. Grace Okafor"
          className="input"
          {...invalid('displayName')}
        />
        <FieldError id="join-displayName-error">{fields.displayName}</FieldError>
      </label>
      <label className="flex flex-col">
        <span className="field-label">Phone number</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          value={f.phone}
          onChange={set('phone')}
          required
          autoComplete="tel"
          placeholder="e.g. 0803 000 0000"
          className="input"
          {...invalid('phone')}
        />
        <FieldError id="join-phone-error">{fields.phone}</FieldError>
      </label>
      <label className="flex flex-col">
        <span className="field-label">Email</span>
        <input
          name="email"
          type="email"
          value={f.email}
          onChange={set('email')}
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="You’ll sign in with this"
          className="input"
          {...invalid('email')}
        />
        <FieldError id="join-email-error">{fields.email}</FieldError>
      </label>
      <label className="flex flex-col">
        <span className="field-label">Choose a password</span>
        <PasswordInput
          name="password"
          value={f.password}
          onChange={set('password')}
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD} characters`}
          {...invalid('password')}
        />
        <FieldError id="join-password-error">{fields.password}</FieldError>
      </label>
      {/* Left empty by people; bots fill it in. */}
      <input
        name="website"
        value={f.website}
        onChange={set('website')}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
      />
      {banner && <FormAlert error={banner} />}
      <button type="submit" aria-disabled={busy} className="of-btn min-h-[52px] text-base">
        <Busy busy={busy} busyLabel="Sending…" icon="how_to_reg" label="Ask to join" />
      </button>
    </form>
  );
}
