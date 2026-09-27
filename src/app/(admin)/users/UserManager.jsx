'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import Busy from '@/components/ui/Busy';
import PasswordInput from '@/components/ui/PasswordInput';
import FormAlert, { FieldError } from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { ROLE_INFO, MIN_PASSWORD } from '@/lib/users';
import { formatMoment } from '@/lib/format';

const WORDS = ['grace', 'faith', 'hope', 'light', 'peace', 'joy', 'psalm', 'zion', 'dove', 'altar'];

/** An easy-to-read password to give someone, e.g. "faith-4821-dove". */
function suggestPassword() {
  const n = new Uint32Array(3);
  crypto.getRandomValues(n);
  return `${WORDS[n[0] % WORDS.length]}-${1000 + (n[1] % 9000)}-${WORDS[n[2] % WORDS.length]}`;
}

/** Server errors: those naming a field go under it, the rest in a banner. */
function splitError(err) {
  const fields = err?.fields ?? {};
  // A taken username comes back as a 409 without a field name.
  if (err?.status === 409 && /username/i.test(err.message)) {
    return { fields: { username: err.message }, banner: null };
  }
  return { fields, banner: err && !Object.keys(fields).length ? err : null };
}

export default function UserManager({ users, meId }) {
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(null);
  const addButton = useRef(null);

  return (
    <div className="flex flex-col gap-5">
      {adding ? (
        <AddUser
          onCancel={() => {
            setAdding(false);
            requestAnimationFrame(() => addButton.current?.focus());
          }}
          onDone={(message) => {
            setAdding(false);
            setDone(message);
            requestAnimationFrame(() => addButton.current?.focus());
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <button
            ref={addButton}
            type="button"
            onClick={() => {
              setAdding(true);
              setDone(null);
            }}
            className="btn btn-primary self-start"
          >
            <Icon name="person_add" size={18} />
            Add a login
          </button>
          {done && <FormAlert success={done} />}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <UserRow key={u.id} user={u} isMe={u.id === meId} />
        ))}
      </ul>
    </div>
  );
}

function PasswordField({ value, onChange, label, required, error, errorId }) {
  return (
    <div className="flex flex-col">
      <div className="field-label">
        <label htmlFor={errorId.replace('-error', '')}>{label}</label>
        <button
          type="button"
          onClick={() => onChange(suggestPassword())}
          className="tap-link text-sm text-primary"
        >
          Suggest one
        </button>
      </div>
      <PasswordInput
        id={errorId.replace('-error', '')}
        name="password"
        reveal={Boolean(value) && WORDS.some((w) => value.startsWith(`${w}-`))}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={MIN_PASSWORD}
        autoComplete="new-password"
        placeholder={`At least ${MIN_PASSWORD} characters`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

function RolePicker({ value, onChange, name }) {
  return (
    <fieldset className="flex flex-col">
      <legend className="field-label">What can they do?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(ROLE_INFO).map(([key, r]) => (
          <label
            key={key}
            className={`flex cursor-pointer items-start gap-3 rounded-tile border-[1.5px] p-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-primary ${
              value === key
                ? 'border-primary bg-primary-soft'
                : 'border-field/50 hover:bg-surface-2'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
              className="sr-only"
            />
            <Icon name={r.icon} size={20} className="mt-0.5 text-primary" />
            <span>
              <span className="block font-bold">{r.label}</span>
              <span className="block text-meta text-muted">{r.does}</span>
            </span>
          </label>
        ))}
      </div>
      {value === 'admin' && (
        <p className="alert alert-warning mt-2">
          <Icon name="shield_person" size={19} />
          Admins can see and change everything, including SMS and logins. Only choose this for
          people who run the system.
        </p>
      )}
    </fieldset>
  );
}

function AddUser({ onCancel, onDone }) {
  const router = useRouter();
  const form = useRef(null);
  const [f, setF] = useState({ displayName: '', username: '', role: 'usher', password: '' });
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy';
  const { fields, banner } = splitError(state.kind === 'error' ? state.error : null);
  const set = (key) => (v) => {
    setF((s) => ({ ...s, [key]: v?.target ? v.target.value : v }));
    if (!busy) setState({ kind: 'idle' });
  };

  useEffect(() => {
    form.current?.querySelector('input')?.focus();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setState({ kind: 'busy' });
    try {
      const u = await sendJson('/api/users', 'POST', f);
      router.refresh();
      onDone(
        `Added ${u.displayName} as ${ROLE_INFO[u.role]?.label ?? u.role}. They sign in with the username “${u.username}” and the password you set. Tell them in person or by phone.`,
      );
    } catch (err) {
      setState({ kind: 'error', error: err });
      const { fields: bad } = splitError(err);
      const first = ['displayName', 'username', 'password'].find((k) => bad[k]);
      if (first) form.current?.querySelector(`[name="${first}"]`)?.focus();
    }
  }

  const invalid = (key) =>
    fields[key] ? { 'aria-invalid': true, 'aria-describedby': `add-${key}-error` } : {};

  return (
    <form
      ref={form}
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      className="card flex flex-col gap-4 motion-safe:animate-fade-in"
    >
      <h2 className="card-title">Add a login</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col">
          <span className="field-label">Name shown in the app</span>
          <input
            name="displayName"
            value={f.displayName}
            onChange={set('displayName')}
            required
            maxLength={60}
            placeholder="e.g. Ushering Team or Sis. Grace"
            className="input"
            {...invalid('displayName')}
          />
          <FieldError id="add-displayName-error">{fields.displayName}</FieldError>
        </label>
        <label className="flex flex-col">
          <span className="field-label">Username</span>
          <input
            name="username"
            value={f.username}
            onChange={(e) =>
              set('username')(e.target.value.toLowerCase().replace(/\s+/g, '').slice(0, 30))
            }
            required
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. ushers"
            className="input"
            {...invalid('username')}
          />
          <FieldError id="add-username-error">{fields.username}</FieldError>
        </label>
      </div>
      <RolePicker name="add-role" value={f.role} onChange={set('role')} />
      <div className="sm:max-w-sm">
        <PasswordField
          value={f.password}
          onChange={set('password')}
          label="Password"
          required
          error={fields.password}
          errorId="add-password-error"
        />
      </div>

      {banner && <FormAlert error={banner} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" aria-disabled={busy} className="btn btn-primary">
          <Busy busy={busy} icon="save" label="Add login" />
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function UserRow({ user: u, isMe }) {
  const router = useRouter();
  const confirm = useConfirm();
  const form = useRef(null);
  const changeButton = useRef(null);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ displayName: u.displayName, role: u.role, password: '' });
  const [state, setState] = useState({ kind: 'idle' });
  const role = ROLE_INFO[u.role];
  const busy = state.kind === 'busy' || state.kind === 'switching';
  const { fields, banner } = splitError(state.kind === 'error' ? state.error : null);

  useEffect(() => {
    if (editing) form.current?.querySelector('input')?.focus();
  }, [editing]);

  function close() {
    setEditing(false);
    setF({ displayName: u.displayName, role: u.role, password: '' });
    requestAnimationFrame(() => changeButton.current?.focus());
  }

  async function save(changes, message, kind = 'busy') {
    setState({ kind });
    try {
      await sendJson(`/api/users/${u.id}`, 'PATCH', changes);
      setEditing(false);
      setF((s) => ({ ...s, password: '' }));
      setState({ kind: 'ok', message });
      router.refresh();
      requestAnimationFrame(() => changeButton.current?.focus());
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    const changes = {};
    if (f.displayName.trim() !== u.displayName) changes.displayName = f.displayName.trim();
    if (f.role !== u.role) changes.role = f.role;
    if (f.password) changes.password = f.password;
    if (!Object.keys(changes).length) {
      close();
      return;
    }
    save(
      changes,
      changes.password
        ? `Saved. ${u.displayName}’s new password works from their next sign-in.`
        : `Saved${changes.role ? `: now ${ROLE_INFO[changes.role].label}` : ''}.`,
    );
  }

  async function switchActive() {
    if (busy) return;
    if (u.active) {
      const ok = await confirm({
        title: `Switch off ${u.displayName}?`,
        body: 'They are signed out straight away and can’t sign in until you switch them back on.',
        confirmLabel: 'Switch off',
        cancelLabel: 'Keep them',
        tone: 'danger',
        icon: 'lock',
      });
      if (!ok) return;
    }
    save(
      { active: !u.active },
      u.active ? 'Switched off. They can no longer sign in.' : 'They can sign in again.',
      'switching',
    );
  }

  return (
    <li className={`card card-compact flex flex-col gap-4 ${u.active ? '' : 'bg-surface-2'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={u.displayName} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words font-display text-lg font-black">{u.displayName}</span>
            {isMe && <span className="chip chip-primary">You</span>}
            {!u.active && <span className="chip chip-danger">Switched off</span>}
          </p>
          <p className="text-meta text-muted">
            {u.username} ·{' '}
            {u.lastSignInAt ? `Last signed in ${formatMoment(u.lastSignInAt)}` : 'Never signed in'}
          </p>
        </div>
        <span className="chip">
          <Icon name={role?.icon || 'person'} size={14} />
          {role?.label || u.role}
        </span>
        {!editing && (
          <button
            ref={changeButton}
            type="button"
            onClick={() => {
              setEditing(true);
              setState({ kind: 'idle' });
            }}
            className="btn btn-ghost btn-sm"
          >
            <Icon name="edit_note" size={17} />
            Change
          </button>
        )}
      </div>

      {!editing && state.kind === 'ok' && <FormAlert success={state.message} />}

      {editing && (
        <form
          ref={form}
          onSubmit={submit}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          className="flex flex-col gap-4 border-t border-line pt-4 motion-safe:animate-fade-in"
        >
          <label className="flex flex-col sm:max-w-sm">
            <span className="field-label">Name shown in the app</span>
            <input
              name="displayName"
              value={f.displayName}
              onChange={(e) => setF((s) => ({ ...s, displayName: e.target.value }))}
              required
              maxLength={60}
              aria-invalid={fields.displayName ? true : undefined}
              aria-describedby={fields.displayName ? `${u.id}-displayName-error` : undefined}
              className="input"
            />
            <FieldError id={`${u.id}-displayName-error`}>{fields.displayName}</FieldError>
          </label>
          {isMe ? (
            <p className="field-hint">You can’t change your own role.</p>
          ) : (
            <RolePicker
              name={`role-${u.id}`}
              value={f.role}
              onChange={(r) => setF((s) => ({ ...s, role: r }))}
            />
          )}
          <div className="sm:max-w-sm">
            <PasswordField
              value={f.password}
              onChange={(password) => setF((s) => ({ ...s, password }))}
              label="New password (leave empty to keep it)"
              error={fields.password}
              errorId={`${u.id}-password-error`}
            />
          </div>

          {banner && <FormAlert error={banner} />}
          <div className="flex flex-wrap gap-2">
            <button type="submit" aria-disabled={busy} className="btn btn-primary">
              <Busy busy={state.kind === 'busy'} icon="save" label="Save" />
            </button>
            <button type="button" onClick={close} className="btn btn-ghost">
              Cancel
            </button>
            {!isMe && (
              <button
                type="button"
                aria-disabled={busy}
                onClick={switchActive}
                className={`btn sm:ml-auto ${u.active ? 'btn-danger-ghost' : 'btn-soft'}`}
              >
                <Busy
                  busy={state.kind === 'switching'}
                  icon={u.active ? 'lock' : 'how_to_reg'}
                  label={u.active ? 'Switch off' : 'Switch back on'}
                />
              </button>
            )}
          </div>
        </form>
      )}
    </li>
  );
}
