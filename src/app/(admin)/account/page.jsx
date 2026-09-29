import { redirect } from 'next/navigation';
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
    <div className="flex max-w-3xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">{ROLE_INFO[account.role]?.label ?? account.role}</p>
        <h1 className="of-h1">My account</h1>
      </header>
      <AccountForm
        account={{ ...account, phone: account.phone ? formatPhone(account.phone) : '' }}
      />
    </div>
  );
}
