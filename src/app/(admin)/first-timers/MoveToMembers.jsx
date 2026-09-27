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
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="icon-tile tone-success h-11 w-11">
          <Icon name="group_add" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="card-title">
            {people.length === 1 ? '1 person' : `${people.length} people`} ready for the Members
            list
          </h2>
          <p className="card-sub">First came over {MOVE_AFTER_DAYS} days ago.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="ready-to-move"
          className="btn btn-soft"
        >
          {open ? 'Hide' : 'Review'}
          <Icon
            name="expand_more"
            size={18}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {state.kind === 'error' && <FormAlert error={state.error} />}

      {open && (
        <div id="ready-to-move" className="flex flex-col gap-3 motion-safe:animate-fade-in">
          <label className="check-row font-bold">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? new Set() : new Set(people.map((p) => p.id)))}
              className="checkbox"
            />
            Select all
          </label>
          <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
            {people.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-tile px-3 py-2 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="checkbox"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-bold">{p.name}</span>
                    <span className="block text-meta text-muted">
                      {p.phone} · first came {formatServiceDate(p.firstVisitDate)} · {p.visitCount}{' '}
                      {p.visitCount === 1 ? 'visit' : 'visits'}
                    </span>
                  </span>
                  <StageBadge stage={p.stage} />
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={move}
            disabled={picked.size === 0}
            aria-disabled={state.kind === 'busy'}
            className="btn btn-primary self-start"
          >
            <Busy
              busy={state.kind === 'busy'}
              busyLabel="Moving…"
              icon="how_to_reg"
              label={picked.size ? `Move ${picked.size} to Members` : 'Tick people to move'}
            />
          </button>
        </div>
      )}
    </section>
  );
}
