import { getSession } from '@/lib/auth';
import { toServiceDate, isoDay } from '@/lib/dates';
import { listServices } from '@/services/churchService.service';
import ServicesManager from './ServicesManager';

export const metadata = { title: 'Services' };
export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const [session, services] = await Promise.all([
    getSession(),
    listServices({ includeInactive: true }),
  ]);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-9">Services</h1>
        <p className="mt-1 text-[15px] text-muted">
          Ushers record attendance and first-timer cards against these. Each day they only see the
          services held that day. Times are Lagos time.
        </p>
      </div>
      <ServicesManager
        initial={services.map((s) => ({ ...s, date: s.date ? isoDay(s.date) : undefined }))}
        isAdmin={session?.user?.role === 'admin'}
        today={isoDay(toServiceDate())}
      />
    </div>
  );
}
