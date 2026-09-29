import { Suspense } from 'react';
import OnefoldLogo from '@/components/brand/Onefold';
import { PRODUCT_LINE, PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/site';
import LoginForm from './LoginForm';

export const metadata = { title: { absolute: `Sign in · ${PRODUCT_NAME}` } };

const POINTS = ['Follow-up that nobody forgets', 'Private prayer requests', 'Automatic SMS'];

/**
 * The Onefold sign-in: one page for every church. After signing in, each person lands in
 * their own church's space (its name and logo), so no church is named here.
 */
export default function LoginPage() {
  return (
    <main className="of-night relative isolate flex min-h-screen overflow-hidden font-ui">
      <div aria-hidden="true">
        <div className="of-glow of-glow-1" />
        <div className="of-glow of-glow-2" />
        <div className="of-glow of-glow-3" />
        <div className="of-rays" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-16">
        <div className="flex flex-col gap-7 lg:gap-9">
          <OnefoldLogo size={30} animate className="text-of-mist" />
          <div className="flex flex-col gap-4">
            <h1 className="max-w-[14ch] text-balance font-brand text-[2.5rem] font-bold leading-[1.03] tracking-[-0.02em] sm:text-[3.25rem] lg:text-[3.75rem]">
              {PRODUCT_TAGLINE}
            </h1>
            <p className="max-w-[46ch] text-lg leading-relaxed text-of-mist/70">{PRODUCT_LINE}</p>
          </div>
          <ul className="hidden flex-wrap gap-2 text-meta text-of-mist/75 sm:flex">
            {POINTS.map((p) => (
              <li key={p} className="of-glass rounded-full px-3 py-1.5">
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="of-glass w-full max-w-md justify-self-start rounded-[1.75rem] p-6 shadow-2xl sm:p-8 lg:justify-self-end">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
