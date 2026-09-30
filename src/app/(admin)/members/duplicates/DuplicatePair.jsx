'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import { MONTHS } from '@/lib/birthday';

const short = (d, m) => `${d} ${MONTHS[m - 1].slice(0, 3)}`;
const addedOn = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** One member of the pair: everything that helps tell whether it's the same person. */
function Side({ m }) {
  const details = [
    m.birthDay && ['cake', `Birthday ${short(m.birthDay, m.birthMonth)}`],
    m.anniversaryDay && ['favorite', `Anniversary ${short(m.anniversaryDay, m.anniversaryMonth)}`],
    m.address && ['location_on', m.address],
    m.gender && ['person', m.gender === 'male' ? 'Male' : 'Female'],
    m.wasFirstTimer && ['person_add', 'Was a first timer'],
    m.smsOptOut && ['sms', 'SMS off'],
    m.added && ['event', `Added ${addedOn.format(new Date(m.added))}`],
  ].filter(Boolean);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-card border border-line p-4">
      <p className="break-words font-brand text-lg font-semibold leading-tight">{m.name}</p>
      <ul className="flex flex-col gap-1 text-meta text-muted">
        {details.map(([icon, text]) => (
          <li key={text} className="flex items-start gap-2">
            <Icon name={icon} size={16} className="mt-0.5" />
            <span className="break-words">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two members on one phone with look-alike names: merge (keeping either) or mark as two people. */
export default function DuplicatePair({ phone, reason, a, b }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [state, setState] = useState({ kind: 'idle' });
  const busy = state.kind === 'busy';

  async function act(kind, keep, remove) {
    if (busy) return;
    if (kind === 'merge') {
      const ok = await confirm({
        title: `Keep ${keep.name} and merge ${remove.name} into it?`,
        body: `${keep.name} gets any details it's missing (birthday, address…) and ${remove.name}'s message history. ${remove.name} comes off the list.`,
        confirmLabel: 'Merge',
      });
      if (!ok) return;
    }
    setState({ kind: 'busy', action: kind === 'merge' ? keep.id : 'apart' });
    try {
      if (kind === 'merge') {
        await sendJson('/api/members/merge', 'POST', { keep: keep.id, remove: remove.id });
      } else {
        await sendJson('/api/members/not-duplicates', 'POST', { a: a.id, b: b.id });
      }
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  const spinning = (id) => busy && state.action === id;

  return (
    <article className="of-panel flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip chip-warning">{reason}</span>
        <span className="text-meta text-muted tabular-nums">Both on {phone}</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Side m={a} />
        <Side m={b} />
      </div>
      {state.kind === 'error' && <FormAlert error={state.error} />}
      <div className="flex flex-wrap gap-2">
        {[
          [a, b],
          [b, a],
        ].map(([keep, remove]) => (
          <button
            key={keep.id}
            type="button"
            className="of-btn h-auto py-2 text-left"
            disabled={busy}
            onClick={() => act('merge', keep, remove)}
          >
            <Busy
              busy={spinning(keep.id)}
              busyLabel="Merging…"
              icon="person_check"
              label={`Same person: keep ${keep.name}`}
            />
          </button>
        ))}
        <button type="button" className="of-btn-quiet" disabled={busy} onClick={() => act('apart')}>
          <Busy
            busy={spinning('apart')}
            busyLabel="Saving…"
            icon="groups"
            label="Not the same person"
          />
        </button>
      </div>
    </article>
  );
}
