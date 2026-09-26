'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';

const isActive = (pathname, href) => pathname === href || pathname.startsWith(`${href}/`);

/** Desktop: icon rail down the left, labels under the icons, the active one in a soft pill. */
export function Rail({ items }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 top-[68px] z-20 hidden w-[96px] border-r border-line bg-surface lg:block"
    >
      <ul className="flex max-h-full flex-col gap-1.5 overflow-y-auto px-2 py-4">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`group flex flex-col items-center gap-1 rounded-tile px-1 pb-2 pt-1.5 text-center font-display text-[11.5px] font-extrabold leading-tight ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <span
                  className={`relative grid h-[34px] w-[54px] place-items-center rounded-full transition-colors ${
                    active ? 'bg-primary-soft text-primary-ink' : 'group-hover:bg-surface-2'
                  }`}
                >
                  <Icon name={item.icon} size={23} filled={active} />
                  {item.soon && (
                    <span className="absolute -right-1.5 -top-1.5 rounded-full bg-surface-3 px-1.5 py-px font-sans text-[9px] font-bold uppercase tracking-wide text-muted shadow-[0_0_0_2px_rgb(var(--surface))]">
                      Soon
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone: bottom tab bar with the same pill for the active tab. */
export function TabBar({ items }) {
  const pathname = usePathname();
  if (items.length < 2) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(30,27,58,.06)] backdrop-blur-md lg:hidden"
    >
      <ul
        className="mx-auto grid h-[62px] max-w-xl px-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 font-display text-[11px] font-extrabold ${
                  active ? 'text-ink' : 'text-muted'
                }`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                    active ? 'bg-primary-soft text-primary-ink' : ''
                  }`}
                >
                  <Icon name={item.icon} size={22} filled={active} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
