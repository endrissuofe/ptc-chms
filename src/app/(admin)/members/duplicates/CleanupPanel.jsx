'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Busy from '@/components/ui/Busy';
import FormAlert from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';

const people = (n) => (n === 1 ? '1 record' : `${n} records`);

/** One button for every record that is plainly the same person entered twice. */
export default function CleanupPanel({ members, firstTimers }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [state, setState] = useState({ kind: 'idle' });
  const total = members + firstTimers;

  async function run() {
    const ok = await confirm({
      title: `Merge ${people(total)} entered twice?`,
      body: 'Each is merged into the other record with the same phone and name: its birthday, address, visits, calls and messages move across. Different people sharing a phone are not touched.',
      confirmLabel: 'Merge them',
    });
    if (!ok) return;
    setState({ kind: 'busy' });
    try {
      const r = await sendJson('/api/members/cleanup', 'POST');
      setState({
        kind: 'ok',
        message: `Merged ${people(r.members)} on Members and ${people(r.firstTimers)} on First timers.`,
      });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  if (total === 0) {
    return state.kind === 'ok' ? <FormAlert success={state.message} /> : null;
  }
  return (
    <section className="of-panel flex flex-col gap-3 p-5 sm:p-6" aria-labelledby="cleanup-title">
      <h2 id="cleanup-title" className="of-h2">
        Entered twice
      </h2>
      <p className="max-w-[65ch] text-meta text-muted">
        {members > 0 && `${people(members)} on Members`}
        {members > 0 && firstTimers > 0 && ' and '}
        {firstTimers > 0 && `${people(firstTimers)} on First timers`} have the same phone and the
        same name as another record. They can all be merged in one go.
      </p>
      {state.kind === 'error' && <FormAlert error={state.error} />}
      <button
        type="button"
        onClick={run}
        aria-disabled={state.kind === 'busy'}
        className="of-btn self-start"
      >
        <Busy
          busy={state.kind === 'busy'}
          busyLabel="Merging…"
          icon="person_check"
          label={`Merge all ${people(total)}`}
        />
      </button>
    </section>
  );
}
