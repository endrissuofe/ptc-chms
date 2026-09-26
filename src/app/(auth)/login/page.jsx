'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/Icon';
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
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      <div>
        <p className="eyebrow">Welcome</p>
        <h1 className="page-title">Sign in</h1>
        <p className="page-sub">Use the username and password or PIN you were given.</p>
      </div>
      <label>
        <span className="field-label">Username</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="input"
        />
      </label>
      <label>
        <span className="field-label">Password or PIN</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </label>
      {error && (
        <p role="alert" className="alert alert-danger">
          <Icon name="error_outline" size={19} />
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn btn-primary btn-lg">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-card border border-line bg-surface shadow-lift lg:grid-cols-2">
        <section className="relative isolate hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex [background:radial-gradient(120%_90%_at_100%_0%,rgba(255,138,112,.38)_0%,transparent_55%),linear-gradient(135deg,#4338ca_0%,#5a4fe6_45%,#7462f0_100%)]">
          <svg
            viewBox="0 0 320 220"
            aria-hidden="true"
            className="absolute -right-10 top-6 -z-10 w-[340px] opacity-90"
          >
            <circle cx="248" cy="70" r="46" fill="#ffb199" opacity=".85" />
            <path
              d="M248 6v10M248 124v10M184 70h10M302 70h10M203 25l7 7M286 108l7 7M203 115l7-7M286 32l7-7"
              stroke="#ffb199"
              strokeWidth="5"
              strokeLinecap="round"
              opacity=".7"
            />
            <path
              d="M120 196c26-18 52-18 78 0s52 18 78 0 52-18 78 0"
              fill="none"
              stroke="rgba(255,255,255,.28)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="m118 44 4.5 10 10.5 1.5-7.6 7.3 1.8 10.4-9.2-4.9-9.2 4.9 1.8-10.4-7.6-7.3 10.5-1.5z"
              fill="#ffd98a"
            />
          </svg>
          <Logo size={48} />
          <div>
            <h2 className="mb-3 text-[2.4rem] font-black leading-tight text-white">
              Every visitor
              <br />
              welcomed and followed up.
            </h2>
            <p className="max-w-[38ch] text-white/85">
              Door counts, first-timer cards and the follow-up that turns a first visit into a
              church family.
            </p>
          </div>
          <p className="text-sm font-bold text-white/75">RCCG Peculiar Treasure Chapel</p>
        </section>
        <section className="flex flex-col gap-8 p-6 sm:p-10">
          <Logo size={44} withName subtitle="RCCG Peculiar Treasure Chapel" />
          <Suspense>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
