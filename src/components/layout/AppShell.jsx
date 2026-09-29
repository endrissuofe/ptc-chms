import Icon from '@/components/ui/Icon';
import Logo from '@/components/ui/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import OnefoldLogo from '@/components/brand/Onefold';
import ChurchAvatar from '@/components/brand/ChurchAvatar';
import { OnlineBadge } from '@/components/ui/ConnectionStatus';
import { getCurrentUser } from '@/lib/auth';
import { CHURCH } from '@/lib/church-profile';
import { ROLE_LABELS, navFor } from '@/lib/nav';
import { Sidebar, TabBar } from './NavBars';
import UserMenu from './UserMenu';
import AccountNotice from './AccountNotice';

const today = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const pick = ({ href, label, icon }) => ({ href, label, icon });

/**
 * The frame around every signed-in screen, in the Onefold brand:
 * - desktop: a sidebar with the Onefold logo, the church card (its logo as a profile
 *   picture) and the menu; a slim top bar with the date and the person's menu
 * - phone: the church in the top bar, and the tab bar (+ More) at the bottom
 * The menu comes from the signed-in person's role (lib/nav.js).
 */
export default async function AppShell({ children }) {
  const user = await getCurrentUser();
  // A login switched off or changed since sign-in sees a notice, not the screen or the menu.
  const blocked = user && user.status !== 'ok';
  const role = blocked ? null : user?.role;
  const name = user?.name || 'Signed in';
  const roleLabel = ROLE_LABELS[role] || '';
  const nav = navFor(role);
  const hasTabBar = nav.tabs.length + (nav.more.length ? 1 : 0) > 1;

  return (
    <div className="min-h-screen">
      <div aria-hidden="true" className="of-sky">
        <div className="of-sky-light of-sky-1" />
        <div className="of-sky-light of-sky-2" />
        <div className="of-sky-light of-sky-3" />
        <div className="of-sky-rays" />
      </div>
      <div aria-hidden="true" className="of-grain" />
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <Sidebar items={nav.rail.map(pick)}>
        <OnefoldLogo size={21} className="of-rail-logo px-3 text-of-accent" />
        <div className="flex items-center gap-3 rounded-tile bg-surface/60 p-1.5 ring-1 ring-inset ring-line/60">
          <ChurchAvatar size={36} />
          <div className="of-rail-label min-w-0 flex-1 leading-tight">
            <p className="truncate font-brand text-base font-bold">{CHURCH.name}</p>
            <p className="truncate text-xs text-muted">
              {[roleLabel, name].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </Sidebar>

      <header className="sticky top-0 z-20 bg-paper/70 backdrop-blur-md of-rail-offset">
        <div className="flex h-[64px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-9">
          <div className="mr-auto min-w-0 lg:hidden">
            <Logo size={38} withName subtitle={CHURCH.fullName} />
          </div>
          <p className="mr-auto hidden items-center gap-2 font-ui text-sm font-medium text-ink-2 lg:flex">
            <Icon name="calendar_today" size={17} className="text-of-accent" />
            {today.format(new Date())}
          </p>
          <OnlineBadge />
          <ThemeToggle className="max-sm:hidden" />
          <UserMenu name={name} roleLabel={roleLabel} />
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={`px-4 pt-5 outline-none [overflow-x:clip] sm:px-6 of-rail-offset lg:px-9 lg:pb-12 lg:pt-8 ${
          hasTabBar ? 'pb-28' : 'pb-10'
        }`}
      >
        <div className="mx-auto max-w-[1240px]">
          {blocked ? <AccountNotice status={user.status} /> : children}
        </div>
      </main>

      <TabBar items={nav.tabs.map(pick)} more={nav.more.map(pick)} />
    </div>
  );
}
