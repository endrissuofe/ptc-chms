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

/** Small pill for the top bar. */
export function OnlineBadge() {
  const online = useOnline();
  return online ? (
    <span className="chip chip-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      <span className="max-sm:sr-only">Online</span>
    </span>
  ) : (
    <span className="chip chip-danger">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
      <span className="max-sm:sr-only">Offline</span>
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
      className="flex items-center gap-2.5 rounded-tile border border-line bg-surface px-4 py-3 text-sm shadow-soft"
    >
      {online ? (
        <>
          <Icon name="check_circle" size={19} filled className="text-success" />
          <span>Connected — entries save straight to the church system</span>
        </>
      ) : (
        <>
          <Icon name="cloud_off" size={19} className="text-danger" />
          <span>No connection — entries can’t be saved until data returns</span>
        </>
      )}
    </div>
  );
}
