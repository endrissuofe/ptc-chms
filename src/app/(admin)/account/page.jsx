import { redirect } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { getCurrentUser } from '@/lib/auth';
import { ROLE_INFO } from '@/lib/users';
import { formatPhone } from '@/lib/phone';
import { getAccount } from '@/services/user.service';
import AccountForm from './AccountForm';

export const metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

/** Everyone: their own details, the emails they get, and their password. */
export default async function AccountPage() {
  const me = await getCurrentUser();
  if (me?.status !== 'ok') redirect('/login');
  const account = await getAccount(me.id);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="person" size={16} />
            {ROLE_INFO[account.role]?.label ?? account.role}
          </p>
          <h1 className="page-title">My account</h1>
        </div>
      </div>
      <AccountForm
        account={{ ...account, phone: account.phone ? formatPhone(account.phone) : '' }}
      />
    </div>
  );
}
