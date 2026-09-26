'use client';

import { useSyncExternalStore } from 'react';
import Icon from './Icon';

function subscribe(onChange) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** True while the phone has a connection. Assumes online during server render. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Small pill for the mobile header. */
export function OnlineBadge() {
  const online = useOnline();
  return online ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-stage-regular-bg px-2 py-0.5 text-[11px] font-semibold text-stage-regular-text">
      <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
      Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-[11px] font-semibold text-danger">
      <span className="h-1.5 w-1.5 rounded-full bg-danger" />
      Offline
    </span>
  );
}

/**
 * Strip at the bottom of usher screens.
 * TODO(offline queue): show queued entries and last sync time once entries can save offline.
 */
export function SyncStrip() {
  const online = useOnline();
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm"
    >
      {online ? (
        <>
          <Icon name="check_circle" size={18} filled className="text-secondary" />
          <span>Connected — entries save straight to the church system</span>
        </>
      ) : (
        <>
          <Icon name="cloud_off" size={18} className="text-danger" />
          <span>No connection — entries can’t be saved until data returns</span>
        </>
      )}
    </div>
  );
}
