import { getSmsOverview } from '@/services/sms.service';
import { isoDay } from '@/lib/dates';
import Icon from '@/components/ui/Icon';
import SmsManager from './SmsManager';

export const metadata = { title: 'SMS messages' };
export const dynamic = 'force-dynamic';

export default async function SmsPage() {
  const overview = await getSmsOverview();
  const day = (preview) => ({ ...preview, serviceDate: isoDay(preview.serviceDate) });

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="sms" size={16} />
            Messages
          </p>
          <h1 className="page-title">SMS messages</h1>
          <p className="page-sub">
            The automatic thank-you and invite messages to first timers, and a record of every send.
          </p>
        </div>
      </div>
      <SmsManager
        status={overview.status}
        balance={overview.balance}
        templates={overview.templates}
        upcoming={{
          sunday_thanks: day(overview.upcoming.sunday_thanks),
          saturday_invite: day(overview.upcoming.saturday_invite),
        }}
        missedThanks={overview.missedThanks.map(day)}
        runs={overview.runs}
      />
    </div>
  );
}
