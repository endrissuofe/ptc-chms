import Link from 'next/link';
import Icon from './Icon';
import { getSession } from '@/lib/auth';
import { ROLES } from '@/lib/roles';

/** What works today, by role, so a locked screen always points somewhere useful. */
const AVAILABLE = [
  { href: '/today', label: 'Usher: Today', roles: [ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN] },
  {
    href: '/attendance',
    label: 'Usher: Record attendance',
    roles: [ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN],
  },
  {
    href: '/newcomers/new',
    label: 'Usher: Enter first-timer cards',
    roles: [ROLES.USHER, ROLES.PASTOR, ROLES.ADMIN],
  },
  { href: '/services', label: 'Services', roles: [ROLES.PASTOR, ROLES.ADMIN] },
];

/**
 * Stands in for a screen that isn't built yet. The pages stay reachable (so links and
 * role rules don't change), but say plainly that the feature is coming.
 */
export default async function ComingSoon({ title, description }) {
  const session = await getSession();
  const links = AVAILABLE.filter((l) => l.roles.includes(session?.user?.role));

  return (
    <section className="card mx-auto flex max-w-2xl flex-col gap-6 text-center">
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="icon-tile tone-primary mb-2 h-16 w-16 rounded-card">
          <Icon name="lock_clock" size={32} />
        </span>
        <span className="chip chip-coral">Coming soon</span>
        <h1 className="page-title">{title}</h1>
        <p className="max-w-[48ch] text-muted">{description}</p>
      </div>

      {links.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="label-caps text-left">Available now</h2>
          <ul className="flex flex-col gap-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-[50px] items-center justify-between rounded-tile bg-surface-2 px-4 text-left font-display font-extrabold transition hover:bg-primary-soft hover:text-primary-ink"
                >
                  {l.label}
                  <Icon name="arrow_forward" size={20} className="text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
