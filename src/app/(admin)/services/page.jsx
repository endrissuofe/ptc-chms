import { getSession } from '@/lib/auth';
import { toServiceDate, isoDay } from '@/lib/dates';
import { listServices } from '@/services/churchService.service';
import Icon from '@/components/ui/Icon';
import ServicesManager from './ServicesManager';

export const metadata = { title: 'Services' };
export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const [session, services] = await Promise.all([
    getSession(),
    listServices({ includeInactive: true }),
  ]);
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="event" size={16} />
            Church calendar
          </p>
          <h1 className="page-title">Services</h1>
          <p className="page-sub">
            Ushers record attendance and first-timer cards against these. Each day they only see the
            services held that day. Times are Lagos time.
          </p>
        </div>
      </div>
      <ServicesManager
        initial={services.map((s) => ({ ...s, date: s.date ? isoDay(s.date) : undefined }))}
        isAdmin={session?.user?.role === 'admin'}
        today={isoDay(toServiceDate())}
      />
    </div>
  );
}
