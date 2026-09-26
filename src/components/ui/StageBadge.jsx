import { STAGE_LABELS } from '@/lib/stages';

const STYLES = {
  first_timer: 'bg-stage-first-bg text-stage-first-text',
  second_timer: 'bg-stage-second-bg text-stage-second-text',
  regular: 'bg-stage-regular-bg text-stage-regular-text',
  believers_class: 'bg-stage-class-bg text-stage-class-text',
  member: 'bg-stage-member-bg text-stage-member-text',
  lost: 'bg-line text-muted',
};

export default function StageBadge({ stage }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[stage] || STYLES.lost}`}
    >
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}
