'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeCallbackUrl } from '@/lib/safe-url';
import Icon from '@/components/ui/Icon';
import Busy from '@/components/ui/Busy';
import PasswordInput from '@/components/ui/PasswordInput';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const res = await signIn('credentials', {
        username: form.get('username'),
        password: form.get('password'),
        redirect: false,
      });
      if (res?.error) {
        setError(
          res.error === 'PENDING'
            ? 'Your sign-up is waiting for an admin to approve it. You’ll get an email when you’re in.'
            : 'Wrong username, email or password.',
        );
        setBusy(false);
        return;
      }
      // Stay "busy" while the next screen loads.
      router.replace(safeCallbackUrl(params.get('callbackUrl'), window.location.origin));
    } catch {
      setError('No connection. Check the Wi-Fi or data and try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      <div>
        <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-of-mist/55">
          Welcome back
        </p>
        <h2 className="font-brand text-[1.75rem] font-semibold leading-tight tracking-[-0.01em]">
          Sign in
        </h2>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-of-mist/80">Email or username</span>
        <span className="relative block">
          <Icon
            name="person"
            size={20}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-of-mist/55"
          />
          <input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            required
            placeholder="you@church.org"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            className="of-field pl-11"
          />
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-of-mist/80">Password</span>
        <PasswordInput
          withIcon
          tone="night"
          name="password"
          autoComplete="current-password"
          enterKeyHint="go"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </label>
      {error && (
        <p
          id="login-error"
          role="alert"
          className="flex items-start gap-2 rounded-control border border-white/15 bg-white/10 px-3.5 py-3 text-sm"
        >
          <Icon name="error_outline" size={19} className="mt-px shrink-0 text-of-dawn" />
          {error}
        </p>
      )}
      <button type="submit" aria-disabled={busy} className="of-button mt-1">
        <Busy busy={busy} busyLabel="Signing in…" label="Sign in" />
        {!busy && <Icon name="arrow_forward" size={20} />}
      </button>
      <p className="text-center text-meta text-of-mist/60">
        No login yet? Ask your team leader for your team’s sign-up link.
      </p>
    </form>
  );
}
