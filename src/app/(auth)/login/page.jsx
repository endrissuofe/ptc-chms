import { Suspense } from 'react';
import Icon from '@/components/ui/Icon';
import Logo from '@/components/ui/Logo';
import { describeSchedule } from '@/lib/church';
import { listServices } from '@/services/churchService.service';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const GRADIENT =
  '[background:radial-gradient(120%_90%_at_100%_0%,rgba(255,138,112,.42)_0%,transparent_55%),radial-gradient(80%_60%_at_0%_100%,rgba(45,212,191,.22)_0%,transparent_60%),linear-gradient(135deg,#4338ca_0%,#5a4fe6_45%,#7462f0_100%)]';

/** Sun, waves, stars and a church outline — the template's hero art, with a church added. */
function Artwork({ className }) {
  return (
    <svg viewBox="0 0 400 400" aria-hidden="true" className={className}>
      <circle cx="300" cy="90" r="54" fill="#ffb199" opacity=".85" />
      <path
        d="M300 14v12M300 154v12M224 90h12M364 90h12M246 36l8 8M346 136l8 8M246 144l8-8M346 44l8-8"
        stroke="#ffb199"
        strokeWidth="6"
        strokeLinecap="round"
        opacity=".7"
      />
      <path
        d="m150 60 5 11 12 1.7-8.7 8.3 2 12-10.3-5.6-10.3 5.6 2-12-8.7-8.3 12-1.7z"
        fill="#ffd98a"
      />
      <path
        d="m80 150 3 6.5 7 1-5 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-4.9 7-1z"
        fill="#ffd98a"
        opacity=".7"
      />
      {/* Church outline */}
      <g
        fill="none"
        stroke="rgba(255,255,255,.55)"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M200 176v-26M188 162h24" />
        <path d="M160 250v-48l40-32 40 32v48" />
        <path d="M120 330v-80h160v80" />
        <path d="M184 330v-38a16 16 0 0 1 32 0v38" />
        <path d="M144 276h20M236 276h20" />
      </g>
      <path
        d="M20 350c30-20 60-20 90 0s60 20 90 0 60-20 90 0 60 20 90 0"
        fill="none"
        stroke="rgba(255,255,255,.3)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M50 378c26-16 52-16 78 0s52 16 78 0 52-16 78 0 52 16 78 0"
        fill="none"
        stroke="rgba(255,255,255,.16)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default async function LoginPage() {
  const services = (await listServices()).filter((s) => s.kind === 'regular');

  const joinUs = (
    <ul className="flex flex-wrap gap-2">
      {services.map((s) => (
        <li
          key={s.key}
          className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-[13px] font-bold text-white backdrop-blur-sm"
        >
          <Icon name="schedule" size={16} />
          {s.name} · {describeSchedule(s)}
        </li>
      ))}
    </ul>
  );

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Phone: a coloured band behind the top of the form. */}
      <div className={`absolute inset-x-0 top-0 h-[360px] lg:hidden ${GRADIENT}`} />
      <Artwork className="absolute -right-16 top-2 w-[260px] opacity-60 lg:hidden" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-8 pt-8 sm:px-6 lg:justify-center lg:py-10">
        <div className="mb-8 flex flex-col gap-4 text-white lg:hidden">
          <Logo size={52} />
          <div>
            <h2 className="text-[2rem] font-black leading-tight text-white">
              Welcome to PTC Chapel
            </h2>
            <p className="mt-1 text-white/85">RCCG Peculiar Treasure Chapel</p>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-card border border-line bg-surface shadow-pop lg:grid-cols-[1.1fr_1fr]">
          <section
            className={`relative isolate hidden flex-col justify-between gap-10 overflow-hidden p-10 text-white lg:flex xl:p-12 ${GRADIENT}`}
          >
            <Artwork className="absolute -bottom-10 -right-10 -z-10 w-[440px] opacity-95" />
            <Logo size={56} />
            <div className="max-w-[30rem]">
              <p className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-white/80">
                <Icon name="church" size={17} />
                RCCG Peculiar Treasure Chapel
              </p>
              <h2 className="mb-4 text-[2.6rem] font-black leading-[1.08] text-white">
                Every visitor welcomed, every soul followed up.
              </h2>
              <p className="mb-6 max-w-[40ch] text-lg text-white/85">
                Attendance, first-timer cards, prayer and follow-up — the whole church family in one
                place.
              </p>
              <div className="rounded-tile border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-[15px] italic text-white/95">
                  “For where two or three gather in my name, there am I with them.”
                </p>
                <p className="mt-1 text-[13px] font-bold text-white/70">Matthew 18:20</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-white/75">
                Join us
              </p>
              {joinUs}
            </div>
          </section>

          <section className="flex flex-col justify-center gap-8 p-6 sm:p-10 xl:p-14">
            <div className="hidden lg:block">
              <Logo size={44} withName subtitle="Church Management" />
            </div>
            <Suspense>
              <LoginForm />
            </Suspense>
          </section>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 lg:hidden">
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
      </div>
    </main>
  );
}
