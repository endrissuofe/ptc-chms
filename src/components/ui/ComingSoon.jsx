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
    <section className="flex max-w-2xl flex-col gap-5 rounded-xl border border-line bg-surface p-6">
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-stage-first-bg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Icon name="lock_clock" size={14} />
          Coming soon
        </span>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-[15px] text-muted">{description}</p>
      </div>

      {links.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted">
            Available now
          </h2>
          <ul className="flex flex-col gap-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-[44px] items-center justify-between rounded-lg bg-paper px-4 text-[15px] font-semibold"
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
