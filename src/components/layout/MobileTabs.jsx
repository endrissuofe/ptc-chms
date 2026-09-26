'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';

/** Bottom tabs on phone screens. Follow-up workers see the extra Follow-Up tab. */
export default function MobileTabs({ showFollowUp = false }) {
  const pathname = usePathname();
  const tabs = [
    { href: '/today', label: 'Today', icon: 'dashboard' },
    { href: '/attendance', label: 'Attendance', icon: 'pin' },
    { href: '/newcomers/new', label: 'Newcomers', icon: 'person_add' },
    ...(showFollowUp ? [{ href: '/my-newcomers', label: 'Follow-Up', icon: 'call' }] : []),
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'font-semibold text-primary' : 'text-muted'}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={t.icon} size={24} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
