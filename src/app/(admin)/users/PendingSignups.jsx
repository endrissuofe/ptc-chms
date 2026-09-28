'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import Busy from '@/components/ui/Busy';
import FormAlert from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { JOINABLE_ROLES, ROLE_INFO } from '@/lib/users';
import { formatPhone } from '@/lib/phone';
import { formatMoment } from '@/lib/format';

/** Sign-ups from invite links, waiting for an admin. */
export default function PendingSignups({ pending }) {
  const [done, setDone] = useState(null);
  if (!pending.length) return done ? <FormAlert success={done} /> : null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">Waiting for approval · {pending.length}</h2>
      {done && <FormAlert success={done} />}
      <ul className="flex flex-col gap-3">
        {pending.map((p) => (
          <Signup key={p.id} person={p} onDone={setDone} />
        ))}
      </ul>
    </section>
  );
}

function Signup({ person: p, onDone }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [role, setRole] = useState(p.role);
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind !== 'idle' && state.kind !== 'error';
  const selectId = `role-${p.id}`;

  async function approve() {
    if (busy) return;
    setState({ kind: 'approving' });
    try {
      await sendJson(`/api/users/${p.id}/approve`, 'POST', { role });
      onDone(`${p.displayName} is in, as ${ROLE_INFO[role].label}. They’ve been emailed.`);
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  async function decline() {
    if (busy) return;
    const ok = await confirm({
      title: `Decline ${p.displayName}?`,
      body: 'Their sign-up is removed. They can’t sign in.',
      confirmLabel: 'Decline',
      tone: 'danger',
      icon: 'person_remove',
    });
    if (!ok) return;
    setState({ kind: 'declining' });
    try {
      await sendJson(`/api/users/${p.id}`, 'DELETE');
      onDone(`Declined ${p.displayName}.`);
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <li className="card card-compact flex flex-col gap-3 border-warning/40">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={p.displayName} />
        <div className="min-w-0 flex-1">
          <p className="break-words font-display text-lg font-black">{p.displayName}</p>
          <p className="break-words text-meta text-muted">
            {p.email} · {formatPhone(p.phone)} · signed up {formatMoment(p.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label htmlFor={selectId} className="flex min-w-[12rem] flex-col">
          <span className="field-label">Team</span>
          <select
            id={selectId}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input"
          >
            {JOINABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_INFO[r].label}
                {r === p.role ? ' (asked for)' : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={approve} aria-disabled={busy} className="btn btn-primary">
          <Busy busy={state.kind === 'approving'} icon="how_to_reg" label="Approve" />
        </button>
        <button
          type="button"
          onClick={decline}
          aria-disabled={busy}
          className="btn btn-danger-ghost"
        >
          <Busy busy={state.kind === 'declining'} icon="close" label="Decline" />
        </button>
      </div>
      {state.kind === 'error' && <FormAlert error={state.error} />}
      {role !== p.role && (
        <p className="field-hint mt-0 flex items-center gap-1.5">
          <Icon name="info" size={15} />
          They asked for {ROLE_INFO[p.role].label}.
        </p>
      )}
    </li>
  );
}
