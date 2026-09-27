'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeCallbackUrl } from '@/lib/safe-url';
import Icon from '@/components/ui/Icon';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const res = await signIn('credentials', {
      username: form.get('username'),
      password: form.get('password'),
      redirect: false,
    });
    setBusy(false);
    if (res?.error) return setError('Wrong username or password');
    router.replace(safeCallbackUrl(params.get('callbackUrl'), window.location.origin));
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      <div>
        <p className="eyebrow">Welcome back</p>
        <h1 className="page-title">Sign in</h1>
        <p className="page-sub">Use the username and password you were given.</p>
      </div>
      <label>
        <span className="field-label">Username</span>
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
            required
            className="input pl-11"
          />
        </span>
      </label>
      <label>
        <span className="field-label">Password</span>
        <span className="relative block">
          <Icon
            name="lock"
            size={20}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="input pl-11 pr-20"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[13px] font-bold text-primary hover:bg-primary-soft"
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </span>
      </label>
      {error && (
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={19} />
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-primary btn-lg">
        {busy ? 'Signing in…' : 'Sign in'}
        {!busy && <Icon name="arrow_forward" size={20} />}
      </button>
      <p className="text-center text-[13px] text-muted">
        No login yet? Ask the church admin to create one for you.
      </p>
    </form>
  );
}
