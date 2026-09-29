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

/** Sign-ups from invite links, waiting for an admin: the first job on this screen. */
export default function PendingSignups({ pending }) {
  const [done, setDone] = useState(null);
  if (!pending.length) return done ? <FormAlert success={done} /> : null;
  return (
    <section className="of-panel flex min-w-0 flex-col p-5 sm:p-6" aria-labelledby="pending-title">
      <div className="flex flex-col gap-1">
        <h2 id="pending-title" className="of-h2">
          Waiting for approval
        </h2>
        <p className="text-meta text-muted">
          They used a team invite link. Check the team, then approve them.
        </p>
      </div>
      {done && (
        <div className="mt-4">
          <FormAlert success={done} />
        </div>
      )}
      <ul className="mt-2 divide-y divide-line">
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
    <li className="flex flex-col gap-3 py-4 last:pb-0">
      <div className="flex items-start gap-3">
        <Avatar name={p.displayName} />
        <div className="min-w-0 flex-1">
          <p className="break-words font-brand text-lg font-semibold leading-tight">
            {p.displayName}
          </p>
          <p className="mt-0.5 break-words text-meta text-muted">
            {p.email} · <span className="tabular-nums">{formatPhone(p.phone)}</span> · signed up{' '}
            {formatMoment(p.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap md:pl-14">
        <label htmlFor={selectId} className="col-span-2 flex flex-col sm:min-w-[14rem]">
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
        <button
          type="button"
          onClick={approve}
          aria-disabled={busy}
          className="of-btn min-h-[48px]"
        >
          <Busy busy={state.kind === 'approving'} icon="how_to_reg" label="Approve" />
        </button>
        <button
          type="button"
          onClick={decline}
          aria-disabled={busy}
          className="of-btn-quiet min-h-[48px] text-danger hover:text-danger"
        >
          <Busy busy={state.kind === 'declining'} icon="close" label="Decline" />
        </button>
      </div>

      {role !== p.role && (
        <p className="flex items-center gap-1.5 text-meta text-muted md:pl-14">
          <Icon name="info" size={15} />
          They asked for {ROLE_INFO[p.role].label}.
        </p>
      )}
      {state.kind === 'error' && <FormAlert error={state.error} />}
    </li>
  );
}
