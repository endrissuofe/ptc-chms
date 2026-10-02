import Icon from '@/components/ui/Icon';
import { getSession } from '@/lib/auth';
import { isoDay } from '@/lib/dates';
import { ROLES } from '@/lib/roles';
import { getSmsOverview } from '@/services/sms.service';
import { audienceCounts } from '@/services/broadcast.service';
import SmsManager from './SmsManager';

export const metadata = { title: 'SMS messages' };
export const dynamic = 'force-dynamic';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' });

export default async function SmsPage() {
  const [overview, counts, session] = await Promise.all([
    getSmsOverview(),
    audienceCounts(),
    getSession(),
  ]);
  // Pastors send broadcasts and see what was sent; the automatic messages stay with admins.
  const admin = session?.user?.role === ROLES.ADMIN;
  const balance = overview.balance;
  const on = overview.templates.filter((t) => t.enabled).length;

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="of-eyebrow">Messages</p>
          <h1 className="of-h1">SMS messages</h1>
          <p className="text-meta text-muted">
            {admin
              ? `${on} of ${overview.templates.length} automatic messages switched on`
              : 'Send a message to members or first timers, and see what has been sent.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip chip-primary">
            <Icon name="badge" size={15} />
            From: {overview.senderId}
          </span>
          {balance && !balance.error && (
            <span className="chip chip-success">
              <Icon name="account_balance_wallet" size={15} />
              Balance:{' '}
              {balance.currency === 'units'
                ? `${balance.amount.toLocaleString('en-NG')} units`
                : naira.format(balance.amount)}
            </span>
          )}
        </div>
      </header>
      <SmsManager
        templates={overview.templates}
        invite={{ ...overview.invite, serviceDate: isoDay(overview.invite.serviceDate) }}
        memberInvite={{
          ...overview.memberInvite,
          serviceDate: isoDay(overview.memberInvite.serviceDate),
        }}
        runs={overview.runs}
        audienceCounts={counts}
        admin={admin}
      />
    </div>
  );
}
