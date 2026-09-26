import { getAttendanceForm } from '@/services/attendance.service';
import { suggestedService } from '@/lib/church';
import { dayFromIso, isoDay } from '@/lib/dates';
import AttendanceForm from './AttendanceForm';

export const metadata = { title: 'Record attendance' };
export const dynamic = 'force-dynamic';

/**
 * /attendance?date=YYYY-MM-DD&service=<key>
 * The Today screen links here with the chosen service. Ushers can pick any service day
 * from the last week; anything else falls back to the most recent service day.
 */
export default async function AttendancePage({ searchParams }) {
  const { service, date } = await searchParams;
  const form = await getAttendanceForm({
    serviceDate: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? dayFromIso(date) : undefined,
  });
  const recorded = Object.fromEntries(
    form.services.map((s) => [s.key, Boolean(form.byService[s.key].saved)]),
  );
  const initialService = form.services.some((s) => s.key === service)
    ? service
    : suggestedService(form.services, recorded);
  const serviceDate = isoDay(form.serviceDate);

  return (
    <AttendanceForm
      key={serviceDate}
      serviceDate={serviceDate}
      serviceDays={form.serviceDays.map(isoDay)}
      services={form.services}
      byService={form.byService}
      initialService={initialService}
    />
  );
}
