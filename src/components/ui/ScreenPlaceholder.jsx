/** Temporary body for screens still to be built. Points at the approved design. */
export default function ScreenPlaceholder({ title, design, children }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Screen to be built from <code>docs/design/{design}</code>.
      </p>
      {children}
    </section>
  );
}
