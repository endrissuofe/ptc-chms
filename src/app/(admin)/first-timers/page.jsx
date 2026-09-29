import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import FormAlert from '@/components/ui/FormAlert';
import StageBadge from '@/components/ui/StageBadge';
import { formatPhone } from '@/lib/phone';
import { STAGES, STAGE_LABELS } from '@/lib/stages';
import { OUTCOMES, followUpState } from '@/lib/followup';
import { formatMoment, formatServiceDate } from '@/lib/format';
import { PEOPLE_VIEWS, listPeople, readyToMove } from '@/services/newcomer.service';
import MoveToMembers from './MoveToMembers';

export const metadata = { title: 'First timers' };
export const dynamic = 'force-dynamic';

const VIEWS = [
  { key: 'all', label: 'All' },
  ...[
    STAGES.FIRST_TIMER,
    STAGES.SECOND_TIMER,
    STAGES.REGULAR,
    STAGES.BELIEVERS_CLASS,
    STAGES.MEMBER,
    STAGES.LOST,
  ].map((s) => ({ key: s, label: STAGE_LABELS[s] })),
  { key: 'unclear', label: 'Card hard to read', icon: 'flag' },
  { key: 'moved', label: 'In Members', icon: 'how_to_reg' },
];

/** /first-timers?view=second_timer&q=okafor&page=2 */
export default async function FirstTimersPage({ searchParams }) {
  const sp = await searchParams;
  const view = sp.view in PEOPLE_VIEWS ? sp.view : 'all';
  const q = sp.q || '';
  const moved = Number(sp.moved) || 0;
  const current = Math.max(Number(sp.page) || 1, 1);
  const [list, ready] = await Promise.all([listPeople({ view, q, page: current }), readyToMove()]);
  const pages = Math.max(Math.ceil(list.total / list.limit), 1);
  const link = (changes) => {
    const next = { view, q, page: 1, ...changes };
    const params = new URLSearchParams();
    if (next.view !== 'all') params.set('view', next.view);
    if (next.q) params.set('q', next.q);
    if (next.page > 1) params.set('page', String(next.page));
    const s = params.toString();
    return s ? `/first-timers?${s}` : '/first-timers';
  };
  const exportHref = `/api/newcomers/export?${new URLSearchParams({ view, ...(q && { q }) })}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="groups" size={16} />
            Follow-up
          </p>
          <h1 className="page-title">First timers</h1>
        </div>
        <a href={exportHref} className="btn btn-soft">
          <Icon name="download" size={18} />
          Export to Excel
        </a>
      </div>

      {moved > 0 && (
        <FormAlert
          success={`Moved ${moved === 1 ? '1 person' : `${moved} people`} into the Members list.`}
        />
      )}

      {ready.length > 0 && (
        <MoveToMembers
          people={ready.map((p) => ({
            id: String(p._id),
            name: `${p.firstName} ${p.lastName}`,
            phone: formatPhone(p.phone),
            stage: p.stage,
            firstVisitDate: p.firstVisitDate,
            visitCount: p.visitCount,
          }))}
        />
      )}

      <section className="card flex flex-col gap-4">
        <form className="flex flex-wrap gap-2" action="/first-timers">
          {view !== 'all' && <input type="hidden" name="view" value={view} />}
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Search by name or phone</span>
            <Icon
              name="search"
              size={20}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              name="q"
              type="search"
              enterKeyHint="search"
              defaultValue={q}
              placeholder="Search by name or phone"
              className="input pl-11"
            />
          </label>
          <button type="submit" className="btn btn-soft">
            Search
          </button>
          {q && (
            <Link href={link({ q: '' })} className="btn btn-ghost">
              Clear
            </Link>
          )}
        </form>

        <nav aria-label="Filter" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          {VIEWS.map((v) => {
            const count = list.counts[v.key] ?? 0;
            const active = view === v.key;
            if (!active && count === 0 && v.key !== 'all') return null;
            return (
              <Link
                key={v.key}
                href={link({ view: v.key })}
                aria-current={active ? 'page' : undefined}
                className="toggle-chip shrink-0"
              >
                {v.icon && <Icon name={v.icon} size={16} />}
                {v.label}
                <span className="seg-count">{count}</span>
              </Link>
            );
          })}
        </nav>

        {list.items.length === 0 ? (
          q ? (
            <EmptyState
              icon="person_search"
              title={`Nobody matches “${q}”`}
              action={{ href: link({ q: '' }), label: 'Clear search' }}
            />
          ) : list.counts.all === 0 && view === 'all' ? (
            <EmptyState
              icon="person_add"
              title="No first timers yet"
              action={{ href: '/newcomers/new', label: 'Enter a card', icon: 'add' }}
            >
              They appear here once the ushers enter the cards.
            </EmptyState>
          ) : (
            <EmptyState
              icon="filter_list"
              title="Nobody in this group"
              action={{ href: link({ view: 'all' }), label: 'Show everyone' }}
            />
          )
        ) : (
          <>
            <div className="relative -mx-5 hidden overflow-x-auto sm:-mx-6 md:block">
              <table className="table min-w-[760px]">
                <thead>
                  <tr>
                    {['Name', 'Phone', 'First visit', 'Visits', 'Stage', 'Last call'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((p) => (
                    <Row key={String(p._id)} person={p} />
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col divide-y divide-line md:hidden">
              {list.items.map((p) => (
                <MobileRow key={String(p._id)} person={p} />
              ))}
            </ul>
          </>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
            <span className="text-meta text-muted">
              Page {current} of {pages} · {list.total} people
            </span>
            <div className="flex gap-2">
              {current > 1 && (
                <Link href={link({ page: current - 1 })} className="btn btn-ghost btn-sm">
                  <Icon name="arrow_back" size={16} />
                  Previous
                </Link>
              )}
              {current < pages && (
                <Link href={link({ page: current + 1 })} className="btn btn-ghost btn-sm">
                  Next
                  <Icon name="arrow_forward" size={16} />
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function LastCall({ person: p }) {
  const { state, tried } = followUpState(p);
  if (state === 'reached') {
    return (
      <span className="chip chip-success">
        <Icon name="phone_in_talk" size={14} />
        Reached {formatMoment(p.lastContactAt)}
      </span>
    );
  }
  // Only calls since their latest visit count; an older "Reached" means it's time to call again.
  const outcome = tried && OUTCOMES[p.lastOutcome];
  if (outcome) {
    return (
      <span className={`chip ${outcome.chip}`}>
        <Icon name={outcome.icon} size={14} />
        {outcome.label}
      </span>
    );
  }
  return (
    <span className="chip chip-warning">{p.lastAttemptAt ? 'Call again' : 'Not called yet'}</span>
  );
}

function Flags({ person: p }) {
  return (
    <>
      {p.cardUnclear && (
        <span className="chip chip-warning" title="Card hard to read">
          <Icon name="flag" size={14} />
        </span>
      )}
      {p.movedToMembersAt && (
        <span className="chip chip-success" title="Moved to Members">
          <Icon name="how_to_reg" size={14} />
        </span>
      )}
    </>
  );
}

function Row({ person: p }) {
  const name = `${p.firstName} ${p.lastName}`;
  return (
    <tr className="transition-colors hover:bg-surface-2/60">
      <td className="pl-5 sm:pl-6">
        <Link href={`/newcomers/${p._id}`} className="flex min-h-[44px] items-center gap-3">
          <Avatar name={name} size="sm" />
          <span className="font-display font-semibold hover:text-primary">{name}</span>
          <Flags person={p} />
        </Link>
      </td>
      <td className="whitespace-nowrap tabular-nums">{formatPhone(p.phone)}</td>
      <td className="whitespace-nowrap">{formatServiceDate(p.firstVisitDate)}</td>
      <td className="tabular-nums">{p.visitCount}</td>
      <td>
        <StageBadge stage={p.stage} />
      </td>
      <td className="pr-5 sm:pr-6">
        <LastCall person={p} />
      </td>
    </tr>
  );
}

function MobileRow({ person: p }) {
  const name = `${p.firstName} ${p.lastName}`;
  return (
    <li>
      <Link href={`/newcomers/${p._id}`} className="flex items-start gap-3 py-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate font-display font-semibold">{name}</span>
            <Flags person={p} />
          </p>
          <p className="text-meta text-muted">
            {formatPhone(p.phone)} · {formatServiceDate(p.firstVisitDate)} · {p.visitCount}{' '}
            {p.visitCount === 1 ? 'visit' : 'visits'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <StageBadge stage={p.stage} />
            <LastCall person={p} />
          </div>
        </div>
      </Link>
    </li>
  );
}
