export const metadata = { title: 'Coming later' };

const MODULES = [
  ['Members directory', 'Phase 2'],
  ['Celebrations (birthday and anniversary SMS)', 'Phase 2'],
  ['Departments and workers', 'Phase 3'],
  ['Broadcast messages', 'Phase 3'],
  ['Giving records', 'Phase 4'],
  ['Media and social', 'Phase 4'],
];

export default function ModulesPage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Roadmap</p>
        <h1 className="page-title">Coming later</h1>
        <p className="page-sub">What the church management system will grow into after phase 1.</p>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MODULES.map(([name, phase]) => (
          <li key={name} className="card">
            <p className="font-display text-lg font-extrabold">{name}</p>
            <p className="mt-2">
              <span className="chip chip-primary">{phase}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
