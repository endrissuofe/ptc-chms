'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';

/**
 * While `dirty`, ask before leaving: closing or reloading the tab (browser prompt) and tapping
 * any link inside the app, such as the tab bar or menu (in-app confirmation).
 */
export function useUnsavedGuard(dirty, { title, body, confirmLabel = 'Leave without saving' }) {
  const router = useRouter();
  const confirm = useConfirm();

  useEffect(() => {
    if (!dirty) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = async (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const link = e.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (
        await confirm({ title, body, confirmLabel, cancelLabel: 'Keep editing', tone: 'danger' })
      ) {
        router.push(`${url.pathname}${url.search}${url.hash}`);
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, title, body, confirmLabel, confirm, router]);
}
