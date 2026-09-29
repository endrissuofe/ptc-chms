import Icon from './Icon';

/**
 * A screen that isn't built yet: its name, one line on what it will do, and a "Coming soon"
 * panel. The menu tags these items "Soon" (`soon` in lib/nav.js).
 */
export default function ComingSoon({ icon, title, line }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Coming soon</p>
        <h1 className="of-h1">{title}</h1>
        <p className="text-meta text-muted">{line}</p>
      </header>
      <section className="of-panel flex flex-col items-center gap-4 px-6 py-12 text-center">
        <span className="icon-tile h-14 w-14 bg-coral-soft text-coral-ink">
          <Icon name={icon} size={28} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="of-h2">Coming soon</h2>
          <p className="text-meta text-muted">This is on the way in a later update.</p>
        </div>
      </section>
    </div>
  );
}
