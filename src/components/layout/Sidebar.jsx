'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Logo from '@/components/ui/Logo';

// soon: screen not built yet (shows "Coming soon").
const MAIN = [
  { href: '/dashboard', label: 'Dashboard', soon: true },
  { href: '/first-timers', label: 'First Timers', soon: true },
  { href: '/prayer-requests', label: 'Prayer Requests', roles: ['pastor'], soon: true },
  { href: '/sms', label: 'SMS Messages', roles: ['admin'], soon: true },
  { href: '/services', label: 'Services', roles: ['admin', 'pastor'] },
];

/** The phone screens ushers use; pastors and admins can open them too. */
const USHER = [
  { href: '/today', label: 'Today' },
  { href: '/attendance', label: 'Record attendance' },
  { href: '/newcomers/new', label: 'Enter first-timer cards' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;
  const items = MAIN.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-6 bg-ink p-5 text-white/80">
      <div className="text-white">
        <Logo size={44} withName subtitle="Church Management" />
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((i) => {
          const active = pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'bg-primary text-white' : 'hover:bg-white/10'}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="flex items-center justify-between gap-2">
                {i.label}
                {i.soon && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                    Soon
                  </span>
                )}
              </span>
            </Link>
          );
        })}
        <span className="mt-4 px-3 text-xs uppercase tracking-wider text-white/50">
          Usher screens
        </span>
        {USHER.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="rounded-lg px-3 py-2.5 text-sm hover:bg-white/10"
          >
            {i.label}
          </Link>
        ))}
        <span className="mt-4 px-3 text-xs uppercase tracking-wider text-white/50">
          Future modules
        </span>
        <Link href="/modules" className="rounded-lg px-3 py-2.5 text-sm hover:bg-white/10">
          Coming Later
        </Link>
      </nav>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="mt-auto rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"
      >
        Sign out
      </button>
    </aside>
  );
}
