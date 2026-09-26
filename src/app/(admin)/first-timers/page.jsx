import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
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
  { key: 'unclear', label: 'Card hard to read', tone: 'text-warning' },
  { key: 'moved', label: 'In Members', tone: 'text-success' },
];

/** /first-timers?view=second_timer&q=okafor&page=2 */
export default async function FirstTimersPage({ searchParams }) {
  const sp = await searchParams;
  const view = sp.view in PEOPLE_VIEWS ? sp.view : 'all';
  const q = sp.q || '';
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
            Newcomers
          </p>
          <h1 className="page-title">First timers</h1>
          <p className="page-sub">
            {list.counts.all === 1 ? '1 person' : `${list.counts.all} people`} being followed up
            {list.counts.moved > 0 && ` · ${list.counts.moved} moved to Members`}
          </p>
        </div>
        <a href={exportHref} className="btn btn-soft">
          <Icon name="download" size={18} />
          Export to Excel
        </a>
      </div>

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

        <nav aria-label="Filter" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {VIEWS.map((v) => {
            const count = list.counts[v.key] ?? 0;
            const active = view === v.key;
            if (!active && count === 0 && v.key !== 'all') return null;
            return (
              <Link
                key={v.key}
                href={link({ view: v.key })}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-bold transition ${
                  active
                    ? 'border-ink bg-ink text-surface'
                    : `border-line-2 bg-surface hover:bg-surface-2 ${v.tone || 'text-ink-2'}`
                }`}
              >
                {v.label}
                <span
                  className={`rounded-full px-1.5 text-xs ${active ? 'bg-surface/20' : 'bg-surface-2'}`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>

        {list.items.length === 0 ? (
          <p className="py-10 text-center text-muted">
            {q
              ? `Nobody matches “${q}”.`
              : list.counts.all === 0
                ? 'No first timers yet. They appear here once the ushers enter the cards.'
                : 'Nobody here.'}
          </p>
        ) : (
          <>
            <div className="-mx-5 hidden overflow-x-auto sm:-mx-6 md:block">
              <table className="w-full min-w-[760px] text-left text-[14.5px]">
                <thead>
                  <tr className="border-y border-line bg-surface-2/60">
                    {['Name', 'Phone', 'First visit', 'Visits', 'Stage', 'Last call'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="label-caps px-3 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
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
            <span className="text-[13px] text-muted">
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
    <span className="chip chip-coral">{p.lastAttemptAt ? 'Call again' : 'Not called yet'}</span>
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
    <tr className="transition hover:bg-surface-2/60">
      <td className="px-3 py-3 pl-5 sm:pl-6">
        <Link href={`/newcomers/${p._id}`} className="flex items-center gap-3">
          <Avatar name={name} size="sm" />
          <span className="font-display font-extrabold hover:text-primary">{name}</span>
          <Flags person={p} />
        </Link>
      </td>
      <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatPhone(p.phone)}</td>
      <td className="whitespace-nowrap px-3 py-3">{formatServiceDate(p.firstVisitDate)}</td>
      <td className="px-3 py-3 tabular-nums">{p.visitCount}</td>
      <td className="px-3 py-3">
        <StageBadge stage={p.stage} />
      </td>
      <td className="px-3 py-3 pr-5 sm:pr-6">
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
            <span className="truncate font-display font-extrabold">{name}</span>
            <Flags person={p} />
          </p>
          <p className="text-[13px] text-muted">
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
