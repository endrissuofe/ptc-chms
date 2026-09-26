'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import Avatar from '@/components/ui/Avatar';
import Icon from '@/components/ui/Icon';

/** Account button in the top bar: who is signed in, and Sign out. */
export default function UserMenu({ name, roleLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="ml-1 inline-flex items-center gap-2 rounded-full border border-line bg-surface py-[3px] pl-[3px] pr-2.5 text-sm font-bold hover:border-line-2"
      >
        <Avatar name={name} size="sm" />
        <span className="hidden max-w-[140px] truncate xl:inline">{name}</span>
        <Icon name="expand_more" size={18} className="text-muted" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-[18px] border border-line bg-surface p-1.5 shadow-pop"
        >
          <div className="flex items-center gap-3 px-2.5 pb-2 pt-1.5">
            <Avatar name={name} />
            <div className="min-w-0">
              <p className="truncate font-display font-extrabold">{name}</p>
              <p className="text-[13px] text-muted">{roleLabel}</p>
            </div>
          </div>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="logout" size={19} className="text-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
