import Icon from '@/components/ui/Icon';
import { isoDay } from '@/lib/dates';
import { getSmsOverview } from '@/services/sms.service';
import { audienceCounts } from '@/services/broadcast.service';
import SmsManager from './SmsManager';

export const metadata = { title: 'SMS messages' };
export const dynamic = 'force-dynamic';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' });

export default async function SmsPage() {
  const [overview, counts] = await Promise.all([getSmsOverview(), audienceCounts()]);
  const balance = overview.balance;

  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="sms" size={16} />
            Messages
          </p>
          <h1 className="page-title">SMS messages</h1>
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
      </div>
      <SmsManager
        templates={overview.templates}
        invite={{ ...overview.invite, serviceDate: isoDay(overview.invite.serviceDate) }}
        runs={overview.runs}
        audienceCounts={counts}
      />
    </div>
  );
}
