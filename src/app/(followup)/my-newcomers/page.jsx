import Icon from '@/components/ui/Icon';
import { listFollowUps } from '@/services/followup.service';
import FollowUpList from './FollowUpList';

export const metadata = { title: 'Follow-up' };
export const dynamic = 'force-dynamic';

export default async function FollowUpPage() {
  const { toCall, called, all, stats } = await listFollowUps();

  const tiles = [
    {
      icon: 'call',
      tone: 'tone-coral',
      label: 'To call',
      value: stats.toCall,
      sub: stats.overdue ? `${stats.overdue} waiting over 3 days` : 'Nobody overdue',
    },
    {
      icon: 'phone_in_talk',
      tone: 'tone-success',
      label: 'Reached',
      value: stats.reachedThisWeek,
      sub: 'In the last 7 days',
    },
    {
      icon: 'trending_up',
      tone: 'tone-primary',
      label: 'Reach rate',
      value: stats.reachRate == null ? '—' : `${stats.reachRate}%`,
      sub: 'Of people called, last 30 days',
    },
  ];

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
        {tiles.map((t) => (
          <div key={t.label} className="card flex flex-col gap-1 !p-3 sm:!p-5">
            <span className="flex items-center gap-2">
              <span className={`icon-tile hidden h-8 w-8 sm:inline-grid ${t.tone}`}>
                <Icon name={t.icon} size={17} />
              </span>
              <span className="label-caps">{t.label}</span>
            </span>
            <span className="font-display text-2xl font-black tabular-nums sm:text-3xl">
              {t.value}
            </span>
            <span className="hidden text-[13px] text-muted sm:block">{t.sub}</span>
          </div>
        ))}
      </div>

      <FollowUpList lists={{ to_call: toCall, called, all }} />
    </div>
  );
}
