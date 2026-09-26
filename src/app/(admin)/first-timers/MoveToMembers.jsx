'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import StageBadge from '@/components/ui/StageBadge';
import { formatServiceDate } from '@/lib/format';
import { MOVE_AFTER_DAYS } from '@/lib/followup';

/**
 * First timers whose first visit was over a month ago. Tick them (or all) and move them into
 * the Members list; they then stop being followed up as first timers.
 */
export default function MoveToMembers({ people }) {
  const router = useRouter();
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
    if (!window.confirm(`Move ${n === 1 ? '1 person' : `${n} people`} into the Members list?`))
      return;
    setState({ kind: 'busy' });
    try {
      const res = await fetch('/api/newcomers/move-to-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...picked] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not move them');
      setState({
        kind: 'ok',
        message: `Moved ${data.moved} into Members${data.linked ? ` (${data.linked} were already on the list)` : ''}.`,
      });
      setPicked(new Set());
      router.refresh();
    } catch (err) {
      setState({ kind: 'error', message: err.message });
    }
  }

  return (
    <section className="card flex flex-col gap-4 border-l-4 border-l-success">
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
        <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-soft">
          {open ? 'Hide' : 'Review'}
          <Icon name="expand_more" size={18} className={open ? 'rotate-180' : ''} />
        </button>
      </div>

      {state.kind === 'ok' && (
        <p role="status" className="alert alert-success">
          <Icon name="check_circle" size={19} filled />
          <span>
            {state.message}{' '}
            <Link href="/members" className="underline">
              See Members
            </Link>
          </span>
        </p>
      )}
      {state.kind === 'error' && (
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={19} />
          {state.message}
        </p>
      )}

      {open && (
        <>
          <label className="flex items-center gap-3 border-b border-line pb-3 font-bold">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? new Set() : new Set(people.map((p) => p.id)))}
              className="h-5 w-5"
            />
            Select all
          </label>
          <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto">
            {people.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-tile px-2 py-2 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    checked={picked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-5 w-5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="block text-[13px] text-muted">
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
            disabled={picked.size === 0 || state.kind === 'busy'}
            className="btn btn-primary self-start"
          >
            <Icon name="how_to_reg" size={18} />
            {state.kind === 'busy'
              ? 'Moving…'
              : `Move ${picked.size || ''} to Members`.replace('  ', ' ')}
          </button>
        </>
      )}
    </section>
  );
}
