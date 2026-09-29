'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import Avatar from '@/components/ui/Avatar';
import Icon from '@/components/ui/Icon';
import { useTheme } from '@/components/ui/ThemeToggle';

const ITEM =
  'flex min-h-[44px] w-full items-center gap-2.5 rounded-control px-3 text-left text-body font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-primary';

/**
 * Account button in the top bar: who is signed in, My account, the light/dark switch and Sign out.
 * A simple disclosure: Escape or clicking/tabbing away closes it and focus returns to the button.
 */
export default function UserMenu({ name, roleLabel }) {
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const wrap = useRef(null);
  const button = useRef(null);
  const panel = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    panel.current?.querySelector('a, button')?.focus();
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onFocus = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open]);

  const dark = theme === 'dark';
  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Account: ${name}`}
        className="ml-1 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-surface py-[3px] pl-[4px] pr-2.5 text-sm font-bold transition-colors hover:border-field focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary"
      >
        <Avatar name={name} size="sm" />
        <span className="hidden max-w-[140px] truncate xl:inline">{name}</span>
        <Icon
          name="expand_more"
          size={18}
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 origin-top-right rounded-tile border border-line bg-surface p-1.5 shadow-pop motion-safe:animate-pop-in"
        >
          <div className="flex items-center gap-3 px-2.5 pb-2 pt-1.5">
            <Avatar name={name} />
            <div className="min-w-0">
              <p className="truncate font-display font-semibold">{name}</p>
              <p className="text-meta text-muted">{roleLabel}</p>
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <Link href="/account" onClick={() => setOpen(false)} className={ITEM}>
            <Icon name="manage_accounts" size={19} className="text-muted" />
            My account
          </Link>
          <button type="button" onClick={toggleTheme} className={ITEM}>
            <Icon name={dark ? 'light_mode' : 'dark_mode'} size={19} className="text-muted" />
            {dark ? 'Light theme' : 'Dark theme'}
          </button>
          <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className={ITEM}>
            <Icon name="logout" size={19} className="text-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
