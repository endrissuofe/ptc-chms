'use client';

import { signOut } from 'next-auth/react';
import Icon from '@/components/ui/Icon';

/** Shown instead of the screen when the login was switched off or changed after sign-in. */
export default function AccountNotice({ status }) {
  const off = status === 'inactive';
  return (
    <section className="card mx-auto mt-6 flex max-w-md flex-col items-center gap-4 text-center">
      <span className="icon-tile tone-warning h-14 w-14">
        <Icon name={off ? 'lock' : 'refresh'} size={28} />
      </span>
      <h1 className="text-2xl font-black">
        {off ? 'This login has been switched off' : 'Your access has changed'}
      </h1>
      <p className="text-muted">
        {off ? 'Ask a church admin if you still need access.' : 'Please sign in again to continue.'}
      </p>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="btn btn-primary"
      >
        <Icon name="logout" size={18} />
        {off ? 'Sign out' : 'Sign in again'}
      </button>
    </section>
  );
}
