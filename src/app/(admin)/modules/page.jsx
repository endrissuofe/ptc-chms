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
      <h1 className="text-3xl font-semibold">Coming later</h1>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MODULES.map(([name, phase]) => (
          <li key={name} className="rounded-xl border border-line bg-surface p-5">
            <p className="font-semibold">{name}</p>
            <p className="mt-1 text-sm text-muted">{phase}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
