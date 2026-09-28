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
        <p className="eyebrow">Welcome back</p>
        <h1 className="page-title">Sign in</h1>
        <p className="page-sub">Use your email, or the username the church admin gave you.</p>
      </div>
      <label>
        <span className="field-label">Email or username</span>
        <span className="relative block">
          <Icon
            name="person"
            size={20}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
            className="input pl-11"
          />
        </span>
      </label>
      <label>
        <span className="field-label">Password</span>
        <PasswordInput
          withIcon
          name="password"
          autoComplete="current-password"
          enterKeyHint="go"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </label>
      {error && (
        <p id="login-error" role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={19} />
          {error}
        </p>
      )}
      <button type="submit" aria-disabled={busy} className="btn btn-primary btn-lg">
        <Busy busy={busy} busyLabel="Signing in…" label="Sign in" />
        {!busy && <Icon name="arrow_forward" size={20} />}
      </button>
      <p className="text-center text-meta text-muted">
        No login yet? Ask your team leader for your team’s sign-up link.
      </p>
    </form>
  );
}
