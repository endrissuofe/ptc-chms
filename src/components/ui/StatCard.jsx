import Icon from './Icon';

/** One headline figure: label, value, a short line under it. Same look on every screen. */
export default function StatCard({
  icon,
  tone = 'tone-primary',
  label,
  value,
  sub,
  compact = false,
}) {
  return (
    <div className="card card-compact flex min-w-0 flex-col gap-1.5">
      <span className="flex items-start justify-between gap-2">
        <span className="label-caps">{label}</span>
        {icon && (
          <span className={`icon-tile h-9 w-9 ${tone} ${compact ? 'max-sm:hidden' : ''}`}>
            <Icon name={icon} size={18} />
          </span>
        )}
      </span>
      <span className={`stat-value ${compact ? 'max-sm:text-2xl' : ''}`}>{value}</span>
      {sub && (
        <span className={`text-meta text-muted ${compact ? 'max-sm:hidden' : ''}`}>{sub}</span>
      )}
    </div>
  );
}
