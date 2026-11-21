import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import { RATINGS } from '@/lib/checkin';
import { formatMoment, formatServiceDate, plural } from '@/lib/format';
import { checkInSummary, listCheckIns } from '@/services/checkin.service';

export const metadata = { title: 'Check-in answers' };
export const dynamic = 'force-dynamic';

const TABS = {
  answered: { label: 'Answered', href: '/first-timers/check-ins' },
  waiting: { label: 'Not answered yet', href: '/first-timers/check-ins?view=waiting' },
};

/**
 * /first-timers/check-ins?view=answered|waiting
 * What first timers said on the one-month check-in, newest first (last 90 days).
 */
export default async function CheckInsPage({ searchParams }) {
  const sp = await searchParams;
  const view = sp.view === 'waiting' ? 'waiting' : 'answered';
  const [{ answered, waiting }, summary] = await Promise.all([listCheckIns(), checkInSummary()]);
  const rows = view === 'answered' ? answered : waiting;
  const calls = answered.filter((r) => r.wantsCall || (r.rating && r.rating <= 2)).length;

  return (
    <div className="flex max-w-5xl flex-col gap-6 font-ui lg:gap-7">
      <header className="flex flex-col gap-2">
        <p className="of-eyebrow">First timers</p>
        <h1 className="of-h1">Check-in answers</h1>
        <p className="flex flex-wrap gap-x-2 text-meta text-muted">
          <span>
            {summary.answered} of {plural(summary.sent, 'person', 'people')} answered in the last 90
            days
          </span>
          {summary.average != null && (
            <span>
              <span aria-hidden="true">· </span>
              average {summary.average} out of 5
            </span>
          )}
          {calls > 0 && (
            <span>
              <span aria-hidden="true">· </span>
              {plural(calls, 'asks', 'ask')} for a call
            </span>
          )}
        </p>
      </header>

      <nav aria-label="Show" className="of-tabs self-start">
        {Object.entries(TABS).map(([key, t]) => (
          <Link
            key={key}
            href={t.href}
            aria-current={view === key ? 'page' : undefined}
            className={`of-tab ${view === key ? 'bg-of-accent-soft text-of-accent-ink' : ''}`}
          >
            {t.label} ({key === 'answered' ? answered.length : waiting.length})
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          card
          icon={view === 'answered' ? 'reviews' : 'schedule_send'}
          title={view === 'answered' ? 'No answers yet' : 'Everyone has answered'}
        >
          {view === 'answered'
            ? 'First timers get the survey by SMS a month after their first visit. Answers show here.'
            : 'Nobody asked in the last 90 days is still to answer.'}
        </EmptyState>
      ) : (
        <ul className="of-panel divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/newcomers/${r.personId}`}
                className="flex gap-3 p-4 transition-colors hover:bg-surface-2 sm:px-5"
              >
                <Avatar name={r.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="break-words font-semibold">{r.name}</p>
                    <p className="text-meta text-muted">
                      {r.answeredAt
                        ? `Answered ${formatMoment(r.answeredAt)}`
                        : `Sent ${formatMoment(r.sentAt)}`}
                    </p>
                  </div>
                  {r.answeredAt ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {r.rating && (
                          <span className={`chip ${RATINGS[r.rating].chip}`}>
                            <Icon name="star" size={14} filled />
                            {r.rating}/5 · {RATINGS[r.rating].label}
                          </span>
                        )}
                        {r.wantsCall && (
                          <span className="chip chip-coral">
                            <Icon name="forum" size={14} />
                            Asked for a call
                          </span>
                        )}
                      </div>
                      {r.comment && (
                        <p className="break-words rounded-tile bg-surface-2 p-3">“{r.comment}”</p>
                      )}
                    </>
                  ) : (
                    <p className="text-meta text-muted">
                      First visit {formatServiceDate(r.firstVisitDate)}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
