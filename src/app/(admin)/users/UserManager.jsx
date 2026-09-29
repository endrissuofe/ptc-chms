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

/** Everyone with a login, as rows in one panel; "Add a login" is this area's one main action. */
export default function UserManager({ users, meId }) {
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(null);
  const addButton = useRef(null);

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="logins-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="logins-title" className="of-h2">
            Everyone with a login
          </h2>
          <p className="text-meta text-muted">Change a role or password, or switch a login off.</p>
        </div>
        {!adding && (
          <button
            ref={addButton}
            type="button"
            onClick={() => {
              setAdding(true);
              setDone(null);
            }}
            className="of-btn"
          >
            <Icon name="person_add" size={18} />
            Add a login
          </button>
        )}
      </div>

      {adding && (
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
      )}
      {!adding && done && <FormAlert success={done} />}

      <ul className="of-panel divide-y divide-line overflow-hidden">
        {users.map((u) => (
          <UserRow key={u.id} user={u} isMe={u.id === meId} />
        ))}
      </ul>
    </section>
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
          className="tap-link text-sm text-of-accent-ink hover:text-of-accent-ink hover:underline"
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
        {Object.entries(ROLE_INFO).map(([key, r]) => {
          const on = value === key;
          return (
            <label
              key={key}
              className={`flex cursor-pointer items-start gap-3 rounded-tile border p-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-of-accent/40 ${
                on ? 'border-of-accent bg-of-accent-soft' : 'border-line hover:bg-surface-2'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={key}
                checked={on}
                onChange={() => onChange(key)}
                className="sr-only"
              />
              <Icon
                name={r.icon}
                size={20}
                className={`mt-0.5 ${on ? 'text-of-accent-ink' : 'text-muted'}`}
              />
              <span className="min-w-0">
                <span className={`block font-semibold ${on ? 'text-of-accent-ink' : ''}`}>
                  {r.label}
                </span>
                <span className="block text-meta text-muted">{r.does}</span>
              </span>
            </label>
          );
        })}
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
  const [f, setF] = useState({
    displayName: '',
    username: '',
    email: '',
    role: 'usher',
    password: '',
  });
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
      const first = ['displayName', 'username', 'email', 'password'].find((k) => bad[k]);
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
      aria-labelledby="add-login-title"
      className="of-panel flex flex-col gap-5 p-5 motion-safe:animate-fade-in sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h3 id="add-login-title" className="of-h2">
          Add a login
        </h3>
        <p className="text-meta text-muted">
          For one person or a team’s shared phone. Give them the username and password yourself.
        </p>
      </div>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col">
          <span className="field-label">
            Email <span className="font-semibold text-muted">For email alerts</span>
          </span>
          <input
            name="email"
            type="email"
            value={f.email}
            onChange={set('email')}
            autoCapitalize="none"
            spellCheck={false}
            maxLength={120}
            placeholder="e.g. grace@gmail.com"
            className="input"
            aria-invalid={fields.email ? true : undefined}
            aria-describedby={fields.email ? `add-email-error` : undefined}
          />
          <FieldError id={`add-email-error`}>{fields.email}</FieldError>
        </label>
        <div>
          <PasswordField
            value={f.password}
            onChange={set('password')}
            label="Password"
            required
            error={fields.password}
            errorId="add-password-error"
          />
        </div>
      </div>

      {banner && <FormAlert error={banner} />}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="submit" aria-disabled={busy} className="of-btn">
          <Busy busy={busy} icon="save" label="Add login" />
        </button>
        <button type="button" onClick={onCancel} className="of-btn-quiet">
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
  const [f, setF] = useState({
    displayName: u.displayName,
    email: u.email ?? '',
    role: u.role,
    password: '',
  });
  const [state, setState] = useState({ kind: 'idle' });
  const role = ROLE_INFO[u.role];
  const busy = state.kind === 'busy' || state.kind === 'switching';
  const { fields, banner } = splitError(state.kind === 'error' ? state.error : null);

  useEffect(() => {
    if (editing) form.current?.querySelector('input')?.focus();
  }, [editing]);

  function close() {
    setEditing(false);
    setF({ displayName: u.displayName, email: u.email ?? '', role: u.role, password: '' });
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
    if (f.email.trim().toLowerCase() !== (u.email ?? '')) changes.email = f.email.trim();
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
    <li className={`flex flex-col gap-4 p-4 sm:p-5 ${u.active ? '' : 'bg-surface-2'}`}>
      <div className="flex items-start gap-3 sm:items-center">
        <Avatar name={u.displayName} className={u.active ? '' : 'opacity-60'} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`break-words font-brand text-lg font-semibold leading-tight ${u.active ? '' : 'text-ink-2'}`}
            >
              {u.displayName}
            </span>
            {isMe && <span className="chip bg-of-accent-soft text-of-accent-ink">You</span>}
            {!u.active && <span className="chip chip-danger">Switched off</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-meta text-muted">
            <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
              <Icon name={role?.icon || 'person'} size={15} />
              {role?.label || u.role}
            </span>
            <span aria-hidden="true">·</span>
            <span className="break-all">{u.email || u.username}</span>
            <span aria-hidden="true">·</span>
            <span>
              {u.lastSignInAt
                ? `Last signed in ${formatMoment(u.lastSignInAt)}`
                : 'Never signed in'}
            </span>
          </p>
        </div>
        {!editing && (
          <button
            ref={changeButton}
            type="button"
            onClick={() => {
              setEditing(true);
              setState({ kind: 'idle' });
            }}
            className="of-btn-quiet shrink-0 px-3.5"
          >
            <Icon name="edit_note" size={17} />
            Change
            <span className="sr-only"> {u.displayName}</span>
          </button>
        )}
      </div>

      {!editing && state.kind === 'ok' && <FormAlert success={state.message} />}

      {editing && (
        <form
          ref={form}
          onSubmit={submit}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          className="flex flex-col gap-4 border-t border-line pt-4 motion-safe:animate-fade-in md:ml-14"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col">
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
            <label className="flex flex-col">
              <span className="field-label">
                Email <span className="font-semibold text-muted">For email alerts</span>
              </span>
              <input
                name="email"
                type="email"
                value={f.email}
                onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))}
                autoCapitalize="none"
                spellCheck={false}
                maxLength={120}
                placeholder="e.g. grace@gmail.com"
                className="input"
                aria-invalid={fields.email ? true : undefined}
                aria-describedby={fields.email ? `${u.id}-email-error` : undefined}
              />
              <FieldError id={`${u.id}-email-error`}>{fields.email}</FieldError>
            </label>
          </div>
          {isMe ? (
            <p className="field-hint mt-0">You can’t change your own role.</p>
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
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="submit" aria-disabled={busy} className="of-btn">
              <Busy busy={state.kind === 'busy'} icon="save" label="Save" />
            </button>
            <button type="button" onClick={close} className="of-btn-quiet">
              Cancel
            </button>
            {!isMe && (
              <button
                type="button"
                aria-disabled={busy}
                onClick={switchActive}
                className={`of-btn-quiet sm:ml-auto ${u.active ? 'text-danger hover:text-danger' : ''}`}
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
