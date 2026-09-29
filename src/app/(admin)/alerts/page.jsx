import { alertPeople, previewFollowUpReport, recentEmails } from '@/services/alerts.service';
import { ALERTS } from '@/lib/users';
import AlertsManager from './AlertsManager';

export const metadata = { title: 'Email alerts' };
export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const [preview, emails, people] = await Promise.all([
    previewFollowUpReport(),
    recentEmails(10),
    alertPeople(),
  ]);
  const { settings } = preview;
  const status = [
    [ALERTS.followUp.label, settings.followUpReport],
    [ALERTS.celebrations.label, settings.celebrationReport],
  ];

  return (
    <div className="flex max-w-5xl flex-col gap-6 font-ui lg:gap-8">
      <header className="of-hero flex flex-col gap-1">
        <p className="of-eyebrow">Admin</p>
        <h1 className="of-h1">Email alerts</h1>
        <p className="flex flex-wrap gap-x-2 text-meta text-muted">
          {status.map(([label, on], i) => (
            <span key={label}>
              {i > 0 && <span aria-hidden="true">· </span>}
              {label}{' '}
              <span className={on ? 'font-semibold text-ink-2' : ''}>{on ? 'on' : 'off'}</span>
            </span>
          ))}
        </p>
      </header>
      <AlertsManager
        settings={settings}
        people={people}
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
