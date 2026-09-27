'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';

const isActive = (pathname, href) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * The tapped item lights up straight away, before the next page has loaded
 * (on weak church Wi-Fi a page can take a few seconds).
 */
function usePendingHref() {
  const pathname = usePathname();
  const [pending, setPending] = useState(null);
  useEffect(() => setPending(null), [pathname]);
  return [pending, setPending];
}

/** Desktop: icon rail down the left, labels under the icons, the active one in a soft pill. */
export function Rail({ items }) {
  const pathname = usePathname();
  const [pending, setPending] = usePendingHref();
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 top-[68px] z-20 hidden w-[96px] border-r border-line bg-surface lg:block"
    >
      <ul className="flex max-h-full flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {items.map((item) => {
          const active = pending ? pending === item.href : isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setPending(item.href)}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={`group flex flex-col items-center gap-1 rounded-tile px-1 py-1.5 text-center font-display text-2xs font-extrabold leading-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <span
                  className={`grid h-[34px] w-[54px] place-items-center rounded-full transition-colors ${
                    active ? 'bg-primary-soft text-primary-ink' : 'group-hover:bg-surface-2'
                  }`}
                >
                  <Icon name={item.icon} size={23} filled={active} />
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

function TabLink({ href, icon, label, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-full flex-col items-center justify-center gap-0.5 font-display text-2xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
        active ? 'text-ink' : 'text-muted'
      }`}
    >
      <span
        className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
          active ? 'bg-primary-soft text-primary-ink' : ''
        }`}
      >
        <Icon name={icon} size={22} filled={active} />
      </span>
      {label}
    </Link>
  );
}

/** Phone: bottom tab bar, plus a "More" tab holding every other screen the role can open. */
export function TabBar({ items, more = [] }) {
  const pathname = usePathname();
  const [pending, setPending] = usePendingHref();
  const [open, setOpen] = useState(false);
  const moreActive = more.some((i) => isActive(pathname, i.href));
  const count = items.length + (more.length ? 1 : 0);
  useEffect(() => setOpen(false), [pathname]);
  if (count < 2) return null;

  const activeHref = pending ?? items.find((i) => isActive(pathname, i.href))?.href;
  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-bar backdrop-blur-md lg:hidden"
      >
        <ul
          className="mx-auto grid min-h-[62px] max-w-xl px-1"
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <li key={item.href}>
              <TabLink
                {...item}
                active={activeHref === item.href}
                onClick={() => setPending(item.href)}
              />
            </li>
          ))}
          {more.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={`flex h-full w-full flex-col items-center justify-center gap-0.5 font-display text-2xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                  moreActive && !pending ? 'text-ink' : 'text-muted'
                }`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${
                    moreActive && !pending ? 'bg-primary-soft text-primary-ink' : ''
                  }`}
                >
                  <Icon name="menu" size={22} />
                </span>
                More
              </button>
            </li>
          )}
        </ul>
      </nav>
      {open && <MoreSheet items={more} pathname={pathname} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The "More" sheet: slides up from the bottom, Escape or tapping outside closes it. */
function MoreSheet({ items, pathname, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label="More screens"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-card border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40 motion-safe:animate-fade-in lg:hidden"
    >
      <div className="flex flex-col gap-1 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="flex items-center justify-between px-2 pb-1">
          <h2 className="card-title">More</h2>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
            <Icon name="close" size={22} />
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[56px] items-center gap-3 rounded-tile px-3 font-bold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary ${
                    active ? 'bg-primary-soft text-primary-ink' : 'bg-surface-2 hover:bg-surface-3'
                  }`}
                >
                  <Icon name={item.icon} size={22} filled={active} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
