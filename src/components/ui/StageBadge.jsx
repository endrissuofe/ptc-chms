import { STAGE_LABELS } from '@/lib/stages';

const STYLES = {
  first_timer: 'chip-coral',
  second_timer: 'chip-primary',
  regular: 'chip-teal',
  believers_class: 'chip-violet',
  member: 'chip-success',
  lost: '',
};

export default function StageBadge({ stage }) {
  return <span className={`chip ${STYLES[stage] ?? ''}`}>{STAGE_LABELS[stage] || stage}</span>;
}
