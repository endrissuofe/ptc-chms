'use client';

import { useSyncExternalStore } from 'react';

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

/**
 * Small pill for the top bar, shown only while the connection is down (saves won't go
 * through until it's back). The wrapper stays so screen readers hear it appear.
 */
export function OnlineBadge() {
  const online = useOnline();
  return (
    <span role="status" className="contents">
      {!online && (
        <span className="chip chip-danger">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
          Offline
        </span>
      )}
    </span>
  );
}
