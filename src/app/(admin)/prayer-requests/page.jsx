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

/** The headline says what the open tab holds, e.g. "2 new prayer requests". */
function headline(status, n) {
  const requests = n === 1 ? '1 prayer request' : `${n} prayer requests`;
  if (status === 'new') {
    if (n === 0) return 'No new prayer requests';
    return n === 1 ? '1 new prayer request' : `${n} new prayer requests`;
  }
  if (status === 'prayed') return n === 0 ? 'Nothing prayed for yet' : `${requests} prayed for`;
  if (status === 'needs_visit')
    return n === 0 ? 'Nobody waiting for a visit' : `${requests} need${n === 1 ? 's' : ''} a visit`;
  return n === 0 ? 'No prayer requests yet' : requests;
}

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
    <div className="flex flex-col gap-6 font-ui lg:gap-7">
      <header className="of-hero flex flex-col gap-2">
        <p className="of-eyebrow">Prayer requests</p>
        <h1 className="of-h1">{headline(status, counts[status] ?? items.length)}</h1>
        <p className="flex items-center gap-1.5 text-meta text-muted">
          <Icon name="lock" size={16} />
          Private: only the prayer team, pastors and admins can see these.
        </p>
      </header>

      <section aria-label="Requests" className="flex min-w-0 flex-col gap-4">
        <nav
          aria-label="Show"
          className="of-tabs max-w-full self-start overflow-x-auto [scrollbar-width:none]"
        >
          {TABS.map(([key, t]) => {
            const active = status === key;
            return (
              <Link
                key={key}
                href={key === 'new' ? '/prayer-requests' : `/prayer-requests?status=${key}`}
                aria-current={active ? 'page' : undefined}
                className={`of-tab shrink-0 whitespace-nowrap ${
                  active ? 'bg-of-accent-soft text-of-accent-ink' : ''
                }`}
              >
                <Icon name={t.icon} size={16} />
                {t.label}
                <span className={`of-count ${active ? 'bg-surface text-of-accent-ink' : ''}`}>
                  {counts[key]}
                </span>
              </Link>
            );
          })}
        </nav>

        {items.length === 0 ? (
          <div className="of-panel">
            {status === 'new' ? (
              <EmptyState icon="task_alt" tone="tone-success" title="No new prayer requests">
                New requests appear here as soon as a first-timer card with a prayer request is
                saved.
              </EmptyState>
            ) : (
              <EmptyState
                icon="volunteer_activism"
                tone="tone-violet"
                title="Nothing here yet"
                action={{ href: '/prayer-requests', label: 'See new requests' }}
              />
            )}
          </div>
        ) : (
          <ul className="of-panel divide-y divide-line overflow-hidden">
            {items.map((r) => (
              <RequestRow key={String(r._id)} request={r} canOpenProfile={canOpenProfile} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RequestRow({ request: r, canOpenProfile }) {
  const p = r.person;
  const name = p ? `${p.firstName} ${p.lastName}` : 'Unknown';
  const nameClass = 'break-words font-brand text-lg font-semibold leading-tight';
  return (
    <li className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Avatar name={name} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {canOpenProfile && p ? (
                <Link
                  href={`/newcomers/${p._id}`}
                  className={`inline-flex min-h-[32px] min-w-0 items-center hover:text-of-accent-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-of-accent/40 ${nameClass}`}
                >
                  {name}
                </Link>
              ) : (
                <p className={nameClass}>{name}</p>
              )}
              {p && <StageBadge stage={p.stage} />}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 text-meta text-muted">
              {p?.phone && (
                <>
                  <a href={telLink(p.phone)} className="tap-link font-semibold tabular-nums">
                    {formatPhone(p.phone)}
                  </a>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>{formatServiceDay(r.serviceDate || r.createdAt)}</span>
              <span className={`chip ${STATUS_CHIP[r.status]}`}>
                <Icon name={PRAYER_STATUSES[r.status].icon} size={14} />
                {PRAYER_STATUSES[r.status].label}
              </span>
            </p>
          </div>

          <blockquote className="max-w-[68ch] break-words border-l-2 border-of-accent/40 pl-4 text-body leading-relaxed text-ink">
            “{r.text}”
          </blockquote>

          {r.status !== 'new' && (
            <p className="text-xs text-muted">
              {PRAYER_STATUSES[r.status].label}
              {r.updatedBy?.displayName && ` · ${r.updatedBy.displayName}`} ·{' '}
              {formatMoment(r.updatedAt)}
            </p>
          )}
        </div>
      </div>

      <div className="lg:w-[17rem] lg:shrink-0 lg:pt-1">
        <PrayerActions id={String(r._id)} status={r.status} />
      </div>
    </li>
  );
}
