import { listServices } from '@/services/churchService.service';
import ServicesManager from './ServicesManager';

export const metadata = { title: 'Services' };
export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const services = await listServices({ includeInactive: true });
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-9">Services</h1>
        <p className="mt-1 text-[15px] text-muted">
          The services ushers record attendance and first-timer cards for. Times are Lagos time and
          appear in the Saturday invite SMS.
        </p>
      </div>
      <ServicesManager initial={services} />
    </div>
  );
}
