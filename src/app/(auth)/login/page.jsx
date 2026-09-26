'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Logo from '@/components/ui/Logo';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    router.replace(params.get('callbackUrl') || '/');
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6"
    >
      <Logo size={56} withName subtitle="Church Management" />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Username
        <input
          name="username"
          autoComplete="username"
          required
          className="h-12 rounded-lg border border-line px-3 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Password or PIN
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-lg border border-line px-3 font-normal"
        />
      </label>
      {error && (
        <p className="rounded-lg bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-12 rounded-lg bg-primary font-semibold text-white disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
