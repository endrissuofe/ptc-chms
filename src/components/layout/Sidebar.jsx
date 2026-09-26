'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Logo from '@/components/ui/Logo';

const MAIN = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/first-timers', label: 'First Timers' },
  { href: '/prayer-requests', label: 'Prayer Requests', roles: ['pastor'] },
  { href: '/sms', label: 'SMS Messages', roles: ['admin'] },
  { href: '/services', label: 'Services', roles: ['admin', 'pastor'] },
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
              {i.label}
            </Link>
          );
        })}
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
