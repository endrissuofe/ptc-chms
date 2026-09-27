'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import { ROLE_INFO, MIN_PASSWORD } from '@/lib/users';
import { formatMoment } from '@/lib/format';

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

const WORDS = ['grace', 'faith', 'hope', 'light', 'peace', 'joy', 'psalm', 'zion', 'dove', 'altar'];

/** An easy-to-read password to give someone, e.g. "faith-4821-dove". */
function suggestPassword() {
  const n = new Uint32Array(3);
  crypto.getRandomValues(n);
  return `${WORDS[n[0] % WORDS.length]}-${1000 + (n[1] % 9000)}-${WORDS[n[2] % WORDS.length]}`;
}

export default function UserManager({ users, meId }) {
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(null);

  return (
    <div className="flex flex-col gap-5">
      {done && (
        <p role="status" className="alert alert-success">
          <Icon name="check_circle" size={19} filled />
          {done}
        </p>
      )}

      {adding ? (
        <AddUser
          onCancel={() => setAdding(false)}
          onDone={(message) => {
            setAdding(false);
            setDone(message);
          }}
        />
      ) : (
        <button
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
      )}

      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <UserRow key={u.id} user={u} isMe={u.id === meId} onDone={setDone} />
        ))}
      </ul>
    </div>
  );
}

function PasswordField({ value, onChange, label, required }) {
  const [show, setShow] = useState(false);
  return (
    <label className="flex flex-col">
      <span className="field-label">
        {label}
        <button
          type="button"
          onClick={() => {
            onChange(suggestPassword());
            setShow(true);
          }}
          className="text-meta font-bold text-primary"
        >
          Suggest one
        </button>
      </span>
      <span className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD} characters`}
          className="input pr-20"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-meta font-bold text-muted hover:bg-surface-2"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </span>
    </label>
  );
}

function RolePicker({ value, onChange }) {
  return (
    <fieldset className="flex flex-col">
      <legend className="field-label">What can they do?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(ROLE_INFO).map(([key, r]) => (
          <label
            key={key}
            className={`flex cursor-pointer items-start gap-3 rounded-tile border-[1.5px] p-3 transition ${
              value === key ? 'border-primary bg-primary-soft' : 'border-line-2 hover:bg-surface-2'
            }`}
          >
            <input
              type="radio"
              name="role"
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
  const [f, setF] = useState({ displayName: '', username: '', role: 'usher', password: '' });
  const [state, setState] = useState({ kind: 'idle' });
  const set = (key) => (v) => setF((s) => ({ ...s, [key]: v?.target ? v.target.value : v }));

  async function submit(e) {
    e.preventDefault();
    setState({ kind: 'busy' });
    try {
      const u = await send('/api/users', 'POST', f);
      router.refresh();
      onDone(
        `Added ${u.displayName} as ${ROLE_INFO[u.role]?.label ?? u.role}. They sign in with the username “${u.username}” and the password you set. Tell them in person or by phone.`,
      );
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4">
      <h2 className="card-title">Add a login</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col">
          <span className="field-label">Name shown in the app</span>
          <input
            value={f.displayName}
            onChange={set('displayName')}
            required
            maxLength={60}
            placeholder="e.g. Ushering Team or Sis. Deborah"
            className="input"
          />
        </label>
        <label className="flex flex-col">
          <span className="field-label">Username</span>
          <input
            value={f.username}
            onChange={(e) =>
              set('username')(e.target.value.toLowerCase().replace(/\s+/g, '').slice(0, 30))
            }
            required
            autoCapitalize="none"
            autoComplete="off"
            placeholder="e.g. ushers"
            className="input"
          />
        </label>
      </div>
      <RolePicker value={f.role} onChange={set('role')} />
      <div className="sm:max-w-sm">
        <PasswordField value={f.password} onChange={set('password')} label="Password" required />
      </div>

      {state.kind === 'error' && (
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={19} />
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={state.kind === 'busy'} className="btn btn-primary">
          <Icon name="save" size={18} />
          {state.kind === 'busy' ? 'Saving…' : 'Add login'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}

function UserRow({ user: u, isMe, onDone }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ displayName: u.displayName, role: u.role, password: '' });
  const [state, setState] = useState({ kind: 'idle' });
  const role = ROLE_INFO[u.role];

  async function save(changes, message) {
    setState({ kind: 'busy' });
    try {
      await send(`/api/users/${u.id}`, 'PATCH', changes);
      setState({ kind: 'idle' });
      setEditing(false);
      setF((s) => ({ ...s, password: '' }));
      onDone(message);
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  function submit(e) {
    e.preventDefault();
    const changes = {};
    if (f.displayName.trim() !== u.displayName) changes.displayName = f.displayName.trim();
    if (f.role !== u.role) changes.role = f.role;
    if (f.password) changes.password = f.password;
    if (!Object.keys(changes).length) {
      setEditing(false);
      return;
    }
    save(
      changes,
      changes.password
        ? `Saved. ${u.displayName}’s new password works from their next sign-in.`
        : `Saved changes to ${f.displayName.trim()}${changes.role ? ` (now ${ROLE_INFO[changes.role].label})` : ''}.`,
    );
  }

  return (
    <li className={`card flex flex-col gap-4 !p-4 sm:!p-5 ${u.active ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={u.displayName} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-display text-lg font-black">{u.displayName}</span>
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

      {editing && (
        <form onSubmit={submit} className="flex flex-col gap-4 border-t border-line pt-4">
          <label className="flex flex-col sm:max-w-sm">
            <span className="field-label">Name shown in the app</span>
            <input
              value={f.displayName}
              onChange={(e) => setF((s) => ({ ...s, displayName: e.target.value }))}
              required
              maxLength={60}
              className="input"
            />
          </label>
          {isMe ? (
            <p className="text-meta text-muted">You can’t change your own role.</p>
          ) : (
            <RolePicker value={f.role} onChange={(role) => setF((s) => ({ ...s, role }))} />
          )}
          <div className="sm:max-w-sm">
            <PasswordField
              value={f.password}
              onChange={(password) => setF((s) => ({ ...s, password }))}
              label="New password (leave empty to keep it)"
            />
          </div>

          {state.kind === 'error' && (
            <p role="alert" className="alert alert-danger">
              <Icon name="error_outline" size={19} />
              {state.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={state.kind === 'busy'} className="btn btn-primary">
              <Icon name="save" size={18} />
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">
              Cancel
            </button>
            {!isMe && (
              <button
                type="button"
                disabled={state.kind === 'busy'}
                onClick={() =>
                  save(
                    { active: !u.active },
                    u.active
                      ? `${u.displayName} is switched off and can no longer sign in.`
                      : `${u.displayName} can sign in again.`,
                  )
                }
                className={`btn sm:ml-auto ${u.active ? 'btn-ghost text-danger' : 'btn-soft'}`}
              >
                <Icon name={u.active ? 'lock' : 'how_to_reg'} size={18} />
                {u.active ? 'Switch off' : 'Switch back on'}
              </button>
            )}
          </div>
        </form>
      )}
    </li>
  );
}
