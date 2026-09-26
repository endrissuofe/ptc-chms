import Logo from '@/components/ui/Logo';
import Icon from '@/components/ui/Icon';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { OnlineBadge } from '@/components/ui/ConnectionStatus';
import { getCurrentUser } from '@/lib/auth';
import { ROLE_LABELS, navFor } from '@/lib/nav';
import { Rail, TabBar } from './NavBars';
import UserMenu from './UserMenu';
import AccountNotice from './AccountNotice';

const today = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/**
 * The frame around every signed-in screen: top bar, desktop rail, phone tab bar.
 * The menu comes from the signed-in person's role (lib/nav.js).
 */
export default async function AppShell({ children }) {
  const user = await getCurrentUser();
  // A login switched off or changed since sign-in sees a notice, not the screen or the menu.
  const blocked = user && user.status !== 'ok';
  const role = blocked ? null : user?.role;
  const name = user?.name || 'Signed in';
  const nav = navFor(role);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 h-[68px] border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="flex h-full items-center gap-2 px-4 sm:gap-3 lg:pl-7 lg:pr-6">
          <div className="mr-auto min-w-0">
            <Logo size={38} withName subtitle="RCCG Peculiar Treasure Chapel" />
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-bold text-ink-2 xl:inline-flex">
            <Icon name="calendar_today" size={16} className="text-coral-strong" />
            {today.format(new Date())}
          </span>
          <OnlineBadge />
          <ThemeToggle />
          <UserMenu
            name={name}
            roleLabel={ROLE_LABELS[role] || ''}
            more={nav.more.map(({ href, label, icon }) => ({ href, label, icon }))}
          />
        </div>
      </header>

      <Rail items={nav.rail} />

      <main
        className={`px-4 pt-5 sm:px-6 lg:ml-[96px] lg:px-9 lg:pb-12 lg:pt-8 ${
          nav.tabs.length > 1 ? 'pb-28' : 'pb-10'
        }`}
      >
        <div className="mx-auto max-w-[1320px]">
          {blocked ? <AccountNotice status={user.status} /> : children}
        </div>
      </main>

      <TabBar items={nav.tabs} />
    </div>
  );
}
