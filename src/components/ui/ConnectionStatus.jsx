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
