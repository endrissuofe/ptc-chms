'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { useOnline } from './ConnectionStatus';

/** What people see when a screen fails to load: a plain message and "Try again". */
export default function ErrorScreen({ error, reset }) {
  const online = useOnline();
  useEffect(() => {
    // Shows up in the Vercel logs for the developer; the person sees the friendly card.
    console.error(error);
  }, [error]);

  return (
    <section className="card mx-auto mt-4 flex max-w-md flex-col items-center gap-4 text-center motion-safe:animate-fade-in">
      <span className="icon-tile tone-warning h-14 w-14">
        <Icon name={online ? 'error_outline' : 'wifi_off'} size={28} />
      </span>
      <h1 className="section-title">{online ? 'This page didn’t load' : 'You’re offline'}</h1>
      <p className="text-muted">
        {online
          ? 'Something went wrong on our side. Please try again in a moment.'
          : 'Check the Wi-Fi or mobile data, then try again.'}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => reset()} className="btn btn-primary">
          <Icon name="refresh" size={18} />
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Home screen
        </Link>
      </div>
    </section>
  );
}
