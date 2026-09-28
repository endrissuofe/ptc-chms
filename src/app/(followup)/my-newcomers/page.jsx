import Icon from '@/components/ui/Icon';
import StatCard from '@/components/ui/StatCard';
import { listFollowUps } from '@/services/followup.service';
import FollowUpList from './FollowUpList';

export const metadata = { title: 'Follow-up' };
export const dynamic = 'force-dynamic';

export default async function FollowUpPage() {
  const { toCall, called, all, stats } = await listFollowUps();

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Icon name="call" size={16} />
            Follow-up team
          </p>
          <h1 className="page-title">Follow-up</h1>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          compact
          icon="call"
          tone="tone-coral"
          label="To call"
          value={stats.toCall}
          sub={stats.overdue ? `${stats.overdue} waiting over 3 days` : 'Nobody overdue'}
        />
        <StatCard
          compact
          icon="phone_in_talk"
          tone="tone-success"
          label="Reached"
          value={stats.reachedThisWeek}
          sub="In the last 7 days"
        />
        <StatCard
          compact
          icon="trending_up"
          tone="tone-primary"
          label="Reach rate"
          value={stats.reachRate == null ? '—' : `${stats.reachRate}%`}
          sub="Of people called, last 30 days"
        />
      </div>

      <FollowUpList lists={{ to_call: toCall, called, all }} />
    </div>
  );
}
