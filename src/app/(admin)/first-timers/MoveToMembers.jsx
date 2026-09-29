'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert from '@/components/ui/FormAlert';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { sendJson } from '@/lib/client-api';
import StageBadge from '@/components/ui/StageBadge';
import { formatServiceDate } from '@/lib/format';
import { MOVE_AFTER_DAYS } from '@/lib/followup';

/**
 * First timers whose first visit was over a month ago. Tick them (or all) and move them into
 * the Members list; they then stop being followed up as first timers.
 */
export default function MoveToMembers({ people }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [state, setState] = useState({ kind: 'idle' });

  const allPicked = picked.size === people.length;
  const toggle = (id) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function move() {
    const n = picked.size;
    const ok = await confirm({
      title: `Move ${n === 1 ? '1 person' : `${n} people`} into the Members list?`,
      body: 'They stop being followed up as first timers. Their visits and calls stay linked.',
      confirmLabel: 'Move to Members',
      icon: 'group_add',
    });
    if (!ok) return;
    setState({ kind: 'busy' });
    try {
      const data = await sendJson('/api/newcomers/move-to-members', 'POST', { ids: [...picked] });
      setPicked(new Set());
      setState({ kind: 'idle' });
      // Shown by the page, so the message stays even when this box disappears.
      router.replace(`/first-timers?moved=${data.moved}`, { scroll: false });
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', error: err });
    }
  }

  return (
    <section className="of-panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5 sm:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-of-accent-soft text-of-accent-ink">
          <Icon name="group_add" size={22} />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h2 className="of-h2">
            {people.length === 1 ? '1 person' : `${people.length} people`} ready for the Members
            list
          </h2>
          <p className="text-meta text-muted">
            First came over {MOVE_AFTER_DAYS} days ago. Tick who has joined and move them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="ready-to-move"
          className="of-btn-quiet"
        >
          {open ? 'Hide' : 'Review'}
          <Icon
            name="expand_more"
            size={18}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {state.kind === 'error' && (
        <div className="px-5 pb-4 sm:px-6">
          <FormAlert error={state.error} />
        </div>
      )}

      {open && (
        <div
          id="ready-to-move"
          className="flex flex-col border-t border-line motion-safe:animate-fade-in"
        >
          <label className="flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-line px-5 py-2 font-semibold sm:px-6">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? new Set() : new Set(people.map((p) => p.id)))}
              className="checkbox"
            />
            Select all
          </label>
          <ul className="flex max-h-[420px] flex-col divide-y divide-line overflow-y-auto">
            {people.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60 sm:px-6">
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="checkbox"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-brand font-semibold">{p.name}</span>
                    <span className="block text-meta text-muted">
                      <span className="tabular-nums">{p.phone}</span> · first came{' '}
                      {formatServiceDate(p.firstVisitDate)} · {p.visitCount}{' '}
                      {p.visitCount === 1 ? 'visit' : 'visits'}
                    </span>
                  </span>
                  <StageBadge stage={p.stage} />
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 border-t border-line p-5 sm:px-6">
            <button
              type="button"
              onClick={move}
              disabled={picked.size === 0}
              aria-disabled={state.kind === 'busy'}
              className="of-btn disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:opacity-70"
            >
              <Busy
                busy={state.kind === 'busy'}
                busyLabel="Moving…"
                icon="how_to_reg"
                label={picked.size ? `Move ${picked.size} to Members` : 'Tick people to move'}
              />
            </button>
            <p className="text-meta text-muted">Their visits and calls stay linked.</p>
          </div>
        </div>
      )}
    </section>
  );
}
