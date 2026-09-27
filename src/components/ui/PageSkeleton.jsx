/** Shown while a screen's data loads (weak church Wi-Fi): a title bar and card placeholders. */
export default function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2.5">
        <div className="h-3.5 w-24 rounded-full bg-surface-3 motion-safe:animate-pulse" />
        <div className="h-9 w-56 max-w-full rounded-full bg-surface-3 motion-safe:animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card card-compact flex flex-col gap-3">
            <div className="h-3 w-20 rounded-full bg-surface-3 motion-safe:animate-pulse" />
            <div className="h-8 w-16 rounded-full bg-surface-3 motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
      <div className="card flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 rounded-full bg-surface-3 motion-safe:animate-pulse" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3.5 w-2/5 rounded-full bg-surface-3 motion-safe:animate-pulse" />
              <div className="h-3 w-3/5 rounded-full bg-surface-2 motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
