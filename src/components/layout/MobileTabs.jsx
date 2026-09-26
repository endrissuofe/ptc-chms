'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Bottom tabs on phone screens. Follow-up workers see the extra Follow-Up tab. */
export default function MobileTabs({ showFollowUp = false }) {
  const pathname = usePathname();
  const tabs = [
    { href: '/today', label: 'Today' },
    { href: '/attendance', label: 'Attendance' },
    { href: '/newcomers/new', label: 'Newcomers' },
    ...(showFollowUp ? [{ href: '/my-newcomers', label: 'Follow-Up' }] : []),
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex h-16 items-center justify-center text-sm ${active ? 'font-semibold text-primary' : 'text-muted'}`}
                aria-current={active ? 'page' : undefined}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
