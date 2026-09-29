import { listFollowUps } from '@/services/followup.service';
import FollowUpList from './FollowUpList';

export const metadata = { title: 'Follow-up' };
export const dynamic = 'force-dynamic';

export default async function FollowUpPage() {
  const { toCall, called, all, stats } = await listFollowUps();
  const facts = [
    stats.overdue ? `${stats.overdue} waiting over 3 days` : 'Nobody waiting over 3 days',
    `${stats.reachedThisWeek} reached in the last 7 days`,
    stats.reachRate == null ? null : `${stats.reachRate}% of people called were reached (30 days)`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6 font-ui lg:gap-7">
      <header className="of-hero flex flex-col gap-2">
        <p className="of-eyebrow">Follow-up</p>
        <h1 className="of-h1">
          {stats.toCall === 0
            ? 'Everyone has been called'
            : stats.toCall === 1
              ? '1 person to call'
              : `${stats.toCall} people to call`}
        </h1>
        <p className="flex flex-wrap gap-x-2 text-meta text-muted">
          {facts.map((f, i) => (
            <span key={f} className={i === 0 && stats.overdue ? 'font-semibold text-danger' : ''}>
              {i > 0 && <span aria-hidden="true">· </span>}
              {f}
            </span>
          ))}
        </p>
      </header>

      <FollowUpList lists={{ to_call: toCall, called, all }} />
    </div>
  );
}
