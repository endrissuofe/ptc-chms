import { getSession } from '@/lib/auth';
import { listJoinLinks, listUsers } from '@/services/user.service';
import UserManager from './UserManager';
import PendingSignups from './PendingSignups';
import JoinLinks from './JoinLinks';

export const metadata = { title: 'Logins' };
export const dynamic = 'force-dynamic';

/** Logins: sign-ups waiting first, then everyone who can sign in, then the team invite links. */
export default async function UsersPage() {
  const [session, { users, pending }, links] = await Promise.all([
    getSession(),
    listUsers(),
    listJoinLinks(),
  ]);
  const active = users.filter((u) => u.active).length;
  const off = users.length - active;
  const facts = [
    active === 1 ? '1 login can sign in' : `${active} logins can sign in`,
    off ? `${off} switched off` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-7">
      <header className="of-hero flex flex-col gap-2">
        <p className="of-eyebrow">Logins</p>
        <h1 className="of-h1">
          {pending.length === 0
            ? 'Who can sign in'
            : pending.length === 1
              ? '1 sign-up waiting'
              : `${pending.length} sign-ups waiting`}
        </h1>
        <p className="flex flex-wrap gap-x-2 text-meta text-muted">
          {facts.map((f, i) => (
            <span key={f}>
              {i > 0 && <span aria-hidden="true">· </span>}
              {f}
            </span>
          ))}
        </p>
      </header>

      <PendingSignups pending={pending} />
      <UserManager users={users} meId={session?.user?.id} />
      <JoinLinks links={links} />
    </div>
  );
}
