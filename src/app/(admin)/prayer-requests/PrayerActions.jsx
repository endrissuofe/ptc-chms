'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import FormAlert from '@/components/ui/FormAlert';
import { sendJson } from '@/lib/client-api';

const ACTIONS = {
  prayed: {
    label: 'Prayed for',
    done: 'Marked as prayed for',
    icon: 'check_circle',
    className: 'btn-primary',
  },
  needs_visit: {
    label: 'Needs a visit',
    done: 'Marked as needing a visit',
    icon: 'home_pin',
    className: 'btn-soft',
  },
  new: { label: 'Back to New', done: 'Moved back to New', icon: 'replay', className: 'btn-ghost' },
};

/** Mark a prayer request prayed for / needs a visit, or put it back to New. */
export default function PrayerActions({ id, status }) {
  const router = useRouter();
  const [pressed, setPressed] = useState(null);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);

  async function set(next) {
    if (pressed) return;
    setPressed(next);
    setError(null);
    try {
      await sendJson(`/api/prayer-requests?id=${id}`, 'PATCH', { status: next });
      // Say so first; the card then moves to its new tab.
      setDone(ACTIONS[next].done);
      setTimeout(() => router.refresh(), 900);
    } catch (err) {
      setError(err);
      setPressed(null);
    }
  }

  if (done) return <FormAlert success={`${done}.`} />;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {Object.entries(ACTIONS)
          .filter(([key]) => key !== status)
          .map(([key, a]) => (
            <button
              key={key}
              type="button"
              aria-disabled={Boolean(pressed)}
              onClick={() => set(key)}
              className={`btn btn-sm ${a.className}`}
            >
              <Busy busy={pressed === key} icon={a.icon} label={a.label} size={16} />
            </button>
          ))}
      </div>
      {error && <FormAlert error={error} />}
    </div>
  );
}
