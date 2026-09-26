'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';

const ACTIONS = {
  prayed: { label: 'Prayed for', icon: 'check_circle', className: 'btn-primary' },
  needs_visit: { label: 'Needs a visit', icon: 'home_pin', className: 'btn-soft' },
  new: { label: 'Back to New', icon: 'replay', className: 'btn-ghost' },
};

/** Mark a prayer request prayed for / needs a visit, or put it back to New. */
export default function PrayerActions({ id, status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function set(next) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/prayer-requests?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {Object.entries(ACTIONS)
          .filter(([key]) => key !== status)
          .map(([key, a]) => (
            <button
              key={key}
              type="button"
              disabled={busy}
              onClick={() => set(key)}
              className={`btn btn-sm ${a.className}`}
            >
              <Icon name={a.icon} size={16} />
              {a.label}
            </button>
          ))}
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
