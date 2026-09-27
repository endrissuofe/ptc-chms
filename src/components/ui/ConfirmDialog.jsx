'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

/**
 * In-app confirmation instead of the browser's pop-up.
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, body, confirmLabel, tone: 'danger' }))) return;
 * Uses a native <dialog>: focus stays inside, Escape cancels, focus returns afterwards.
 */
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const dialog = useRef(null);
  const resolver = useRef(null);
  const returnFocus = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        returnFocus.current = document.activeElement;
        resolver.current = resolve;
        setRequest(options);
      }),
    [],
  );

  useEffect(() => {
    if (request && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [request]);

  function close(answer) {
    dialog.current?.close();
    resolver.current?.(answer);
    resolver.current = null;
    setRequest(null);
    returnFocus.current?.focus?.();
  }

  const danger = request?.tone === 'danger';
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <dialog
          ref={dialog}
          aria-labelledby="confirm-title"
          aria-describedby={request.body ? 'confirm-body' : undefined}
          onCancel={(e) => {
            e.preventDefault();
            close(false);
          }}
          onClick={(e) => {
            if (e.target === dialog.current) close(false);
          }}
          className="w-[min(28rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] motion-safe:animate-pop-in"
        >
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-start gap-3">
              <span className={`icon-tile h-11 w-11 ${danger ? 'tone-danger' : 'tone-primary'}`}>
                <Icon name={request.icon || (danger ? 'error_outline' : 'help')} size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="card-title">
                  {request.title}
                </h2>
                {request.body && (
                  <p id="confirm-body" className="mt-1 text-muted">
                    {request.body}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => close(false)} className="btn btn-ghost">
                {request.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`btn ${danger ? 'btn-coral' : 'btn-primary'}`}
              >
                {request.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  // Outside the provider (e.g. in tests) fall back to the browser's own dialog.
  return confirm ?? ((o) => Promise.resolve(window.confirm(`${o.title}\n\n${o.body ?? ''}`)));
}
