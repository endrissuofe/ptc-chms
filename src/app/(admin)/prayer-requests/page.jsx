import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
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

const STATUS_CHIP = { new: 'chip-violet', prayed: 'chip-success', needs_visit: 'chip-warning' };

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

      <nav aria-label="Show" className="seg-tabs self-start">
        {TABS.map(([key, t]) => (
          <Link
            key={key}
            href={key === 'new' ? '/prayer-requests' : `/prayer-requests?status=${key}`}
            aria-current={status === key ? 'page' : undefined}
            className="seg-tab"
          >
            <Icon name={t.icon} size={16} />
            {t.label}
            <span className="seg-count">{counts[key]}</span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        status === 'new' ? (
          <EmptyState card icon="task_alt" tone="tone-success" title="No new prayer requests">
            New requests appear here as soon as a first-timer card with a prayer request is saved.
          </EmptyState>
        ) : (
          <EmptyState
            card
            icon="volunteer_activism"
            tone="tone-violet"
            title="Nothing here yet"
            action={{ href: '/prayer-requests', label: 'See new requests' }}
          />
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => {
            const p = r.person;
            const name = p ? `${p.firstName} ${p.lastName}` : 'Unknown';
            return (
              <li key={String(r._id)} className="card flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    {canOpenProfile && p ? (
                      <Link
                        href={`/newcomers/${p._id}`}
                        className="inline-flex min-h-[44px] items-center break-words font-display text-lg font-black hover:text-primary"
                      >
                        {name}
                      </Link>
                    ) : (
                      <p className="break-words font-display text-lg font-black">{name}</p>
                    )}
                    {p?.phone && (
                      <a href={telLink(p.phone)} className="tap-link text-meta font-semibold">
                        {formatPhone(p.phone)}
                      </a>
                    )}
                  </div>
                  {p && <StageBadge stage={p.stage} />}
                </div>

                <p className="flex flex-wrap items-center gap-2 text-meta text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="event" size={15} />
                    {formatServiceDay(r.serviceDate || r.createdAt)}
                  </span>
                  <span className={`chip ${STATUS_CHIP[r.status]}`}>
                    <Icon name={PRAYER_STATUSES[r.status].icon} size={14} />
                    {PRAYER_STATUSES[r.status].label}
                  </span>
                </p>

                <blockquote className="flex-1 rounded-tile bg-surface-2 p-4 text-body italic leading-relaxed">
                  “{r.text}”
                </blockquote>

                {r.status !== 'new' && (
                  <p className="text-xs text-muted">
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
