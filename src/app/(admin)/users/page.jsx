import Icon from '@/components/ui/Icon';
import { getSession } from '@/lib/auth';
import { listUsers } from '@/services/user.service';
import UserManager from './UserManager';

export const metadata = { title: 'Logins' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const [session, users] = await Promise.all([getSession(), listUsers()]);
  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="supervisor_account" size={16} />
            Admin
          </p>
          <h1 className="page-title">Logins</h1>
          <p className="page-sub">
            Who can sign in and what each person can do · {users.filter((u) => u.active).length}{' '}
            active
          </p>
        </div>
      </div>
      <UserManager users={users} meId={session?.user?.id} />
    </div>
  );
}
