import { Suspense } from 'react';
import Icon from '@/components/ui/Icon';
import Logo from '@/components/ui/Logo';
import { describeSchedule } from '@/lib/church';
import { listServices } from '@/services/churchService.service';
import { ONE_LINER } from '@/lib/site';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

/** A small sun over a church, drawn in the hero's own colours. Sits in its own space. */
function Artwork({ className }) {
  return (
    <svg viewBox="0 0 200 170" aria-hidden="true" className={className}>
      <circle cx="148" cy="44" r="30" fill="rgb(var(--hero-glow) / .55)" />
      <g
        fill="none"
        stroke="rgba(255,255,255,.35)"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M86 58V40M78 48h16" />
        <path d="M62 104V78l24-20 24 20v26" />
        <path d="M38 150v-46h96v46" />
        <path d="M76 150v-22a10 10 0 0 1 20 0v22" />
        <path d="M50 120h12M110 120h12" />
      </g>
      <path
        d="M8 160c20-12 40-12 60 0s40 12 60 0 40-12 64 0"
        fill="none"
        stroke="rgba(255,255,255,.22)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

async function regularServices() {
  // Sign-in must keep working even if the service times can't be read.
  try {
    return (await listServices()).filter((s) => s.kind === 'regular');
  } catch {
    return [];
  }
}

export default async function LoginPage() {
  const services = await regularServices();

  return (
    <main className="min-h-screen lg:grid lg:place-items-center lg:px-6 lg:py-10">
      {/* Phone: a short gradient band with the name and what the app is for. */}
      <header className="hero rounded-b-card px-5 pb-8 pt-8 lg:hidden">
        <div className="flex items-center gap-3">
          <Logo size={48} />
          <p className="font-display text-xl font-black text-white">Ptchapel</p>
        </div>
        <p className="mt-4 max-w-[34ch] text-white/90">{ONE_LINER}</p>
      </header>

      <div className="mx-auto grid w-full max-w-5xl overflow-hidden lg:rounded-card lg:border lg:border-line lg:bg-surface lg:shadow-pop lg:grid-cols-[1.05fr_1fr]">
        <section className="hero hidden flex-col gap-10 p-10 lg:flex xl:p-12">
          <Logo size={52} />
          <div className="flex flex-col gap-4">
            <p className="inline-flex items-center gap-1.5 text-meta font-extrabold uppercase tracking-[0.08em] text-white/90">
              <Icon name="church" size={17} />
              Peculiar Treasure Chapel · RCCG Youth Province 2
            </p>
            <h2 className="hero-title max-w-[16ch]">
              Every visitor welcomed, every soul followed up.
            </h2>
            <p className="max-w-[40ch] text-base text-white/90">{ONE_LINER}</p>
          </div>
          <div className="mt-auto flex items-end justify-between gap-6">
            {services.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-2xs font-extrabold uppercase tracking-[0.08em] text-white/90">
                  Join us
                </p>
                <ul className="flex flex-col items-start gap-2">
                  {services.map((s) => (
                    <li key={s.key} className="chip-glass">
                      <Icon name="schedule" size={16} />
                      {s.name} · {describeSchedule(s)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Artwork className="hidden w-[170px] shrink-0 xl:block" />
          </div>
        </section>

        <section className="flex flex-col justify-center px-5 py-8 sm:px-10 lg:p-12 xl:p-14">
          <div className="mx-auto w-full max-w-sm">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </div>

      {services.length > 0 && (
        <div className="flex flex-col items-center gap-2 px-5 pb-10 lg:hidden">
          <p className="label-caps">Join us</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {services.map((s) => (
              <li key={s.key} className="chip chip-primary">
                <Icon name="schedule" size={14} />
                {s.name} · {describeSchedule(s)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
