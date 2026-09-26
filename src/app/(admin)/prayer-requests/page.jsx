import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import StageBadge from '@/components/ui/StageBadge';
import { getSession } from '@/lib/auth';
import { ROLES, hasRole } from '@/lib/roles';
import { formatPhone } from '@/lib/phone';
import { telLink } from '@/lib/followup';
import { formatMoment, formatServiceDay } from '@/lib/format';
import { PRAYER_STATUSES, listPrayerRequests } from '@/services/prayer.service';
import PrayerActions from './PrayerActions';

export const metadata = { title: 'Prayer requests' };
export const dynamic = 'force-dynamic';

const TABS = [...Object.entries(PRAYER_STATUSES), ['all', { label: 'All', icon: 'inventory_2' }]];

/** Prayer team, pastors and admins only (middleware and the role check below). */
export default async function PrayerRequestsPage({ searchParams }) {
  const sp = await searchParams;
  const status = sp.status in PRAYER_STATUSES || sp.status === 'all' ? sp.status : 'new';
  const [session, { items, counts }] = await Promise.all([
    getSession(),
    listPrayerRequests({ status }),
  ]);
  // The prayer team sees requests only; profiles (calls, visits) are for pastors and admins.
  const canOpenProfile = hasRole(session?.user, ROLES.PASTOR, ROLES.ADMIN);

  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="volunteer_activism" size={16} />
            Prayer
          </p>
          <h1 className="page-title">Prayer requests</h1>
        </div>
      </div>

      <nav role="tablist" aria-label="Show" className="seg-tabs self-start">
        {TABS.map(([key, t]) => (
          <Link
            key={key}
            href={key === 'new' ? '/prayer-requests' : `/prayer-requests?status=${key}`}
            role="tab"
            aria-selected={status === key}
            className="seg-tab"
          >
            <Icon name={t.icon} size={16} />
            {t.label}
            <span className="rounded-full bg-surface-3 px-2 py-0.5 font-sans text-xs font-bold text-ink-2">
              {counts[key]}
            </span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="card py-12 text-center text-muted">
          {status === 'new' ? 'No new prayer requests.' : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => {
            const p = r.person;
            const name = p ? `${p.firstName} ${p.lastName}` : 'Unknown';
            return (
              <li
                key={String(r._id)}
                className={`card flex flex-col gap-4 border-l-4 ${
                  r.status === 'needs_visit'
                    ? 'border-l-coral'
                    : r.status === 'prayed'
                      ? 'border-l-success'
                      : 'border-l-violet'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    {canOpenProfile && p ? (
                      <Link
                        href={`/newcomers/${p._id}`}
                        className="block truncate font-display text-lg font-black hover:text-primary"
                      >
                        {name}
                      </Link>
                    ) : (
                      <p className="truncate font-display text-lg font-black">{name}</p>
                    )}
                    {p?.phone && (
                      <a href={telLink(p.phone)} className="text-[13px] text-muted hover:text-ink">
                        {formatPhone(p.phone)}
                      </a>
                    )}
                  </div>
                  {p && <StageBadge stage={p.stage} />}
                </div>

                <p className="flex items-center gap-1.5 text-[13px] text-muted">
                  <Icon name="event" size={15} />
                  {formatServiceDay(r.serviceDate || r.createdAt)}
                </p>

                <blockquote className="flex-1 rounded-tile bg-surface-2 p-4 text-[15px] italic leading-relaxed">
                  “{r.text}”
                </blockquote>

                {r.status !== 'new' && (
                  <p className="text-[12.5px] text-muted">
                    {PRAYER_STATUSES[r.status].label}
                    {r.updatedBy?.displayName && ` · ${r.updatedBy.displayName}`} ·{' '}
                    {formatMoment(r.updatedAt)}
                  </p>
                )}

                <PrayerActions id={String(r._id)} status={r.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
