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
    <div className="flex max-w-5xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">Church calendar</p>
        <h1 className="of-h1">Services</h1>
      </header>
      <ServicesManager
        initial={services.map((s) => ({ ...s, date: s.date ? isoDay(s.date) : undefined }))}
        isAdmin={session?.user?.role === 'admin'}
        today={isoDay(toServiceDate())}
      />
    </div>
  );
}
