import Icon from '@/components/ui/Icon';
import { previewFollowUpReport, recentEmails } from '@/services/alerts.service';
import AlertsManager from './AlertsManager';

export const metadata = { title: 'Email alerts' };
export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const [preview, emails] = await Promise.all([previewFollowUpReport(), recentEmails(10)]);
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="mail" size={16} />
            Admin
          </p>
          <h1 className="page-title">Email alerts</h1>
          <p className="page-sub">
            Every morning at 7 AM the follow-up team gets one email: the previous day’s first
            timers, and anyone still not reached after 72 hours. Pastors are copied in.
          </p>
        </div>
      </div>
      <AlertsManager
        settings={preview.settings}
        report={preview.report}
        email={preview.email}
        recent={emails.map((e) => ({
          id: String(e._id),
          kind: e.kind,
          subject: e.subject,
          to: e.to.length + (e.cc?.length ?? 0),
          status: e.status,
          error: e.error ?? null,
          at: e.createdAt,
        }))}
      />
    </div>
  );
}
