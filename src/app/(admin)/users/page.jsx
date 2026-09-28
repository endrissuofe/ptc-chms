import Icon from '@/components/ui/Icon';
import { getSession } from '@/lib/auth';
import { listJoinLinks, listUsers } from '@/services/user.service';
import UserManager from './UserManager';
import PendingSignups from './PendingSignups';
import JoinLinks from './JoinLinks';

export const metadata = { title: 'Logins' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const [session, { users, pending }, links] = await Promise.all([
    getSession(),
    listUsers(),
    listJoinLinks(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="supervisor_account" size={16} />
            Admin
          </p>
          <h1 className="page-title">Logins</h1>
          <p className="page-sub">{users.filter((u) => u.active).length} active</p>
        </div>
      </div>
      <PendingSignups pending={pending} />
      <JoinLinks links={links} />
      <UserManager users={users} meId={session?.user?.id} />
    </div>
  );
}
