import { getCardEntry } from '@/services/newcomer.service';
import { dayFromIso, isoDay } from '@/lib/dates';
import CardEntry from './CardEntry';

export const metadata = { title: 'Enter first-timer card' };
export const dynamic = 'force-dynamic';

/**
 * /newcomers/new?date=YYYY-MM-DD&service=<key>
 * Ushers type up paper first-timer cards here, one after another.
 */
export default async function NewNewcomerPage({ searchParams }) {
  const { service, date } = await searchParams;
  const entry = await getCardEntry({
    serviceDate: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? dayFromIso(date) : undefined,
  });
  const serviceDate = isoDay(entry.serviceDate);
  const initialService = entry.services.some((s) => s.key === service)
    ? service
    : entry.services[0]?.key;

  if (!initialService) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-[15px] text-muted">
        There has been no service in the past week to enter cards for. Ask an admin if a service is
        missing from the Services list.
      </p>
    );
  }

  return (
    <CardEntry
      key={serviceDate}
      serviceDate={serviceDate}
      serviceDays={entry.serviceDays.map(isoDay)}
      services={entry.services}
      cardsByService={entry.cardsByService}
      initialService={initialService}
    />
  );
}
