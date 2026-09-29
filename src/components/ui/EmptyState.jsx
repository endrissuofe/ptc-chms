import Link from 'next/link';
import Icon from './Icon';

/**
 * The one way to show "nothing here": an icon, a line of text and (optionally) the next step.
 * `action` is { href, label, icon } or a React element.
 */
export default function EmptyState({
  icon = 'inventory_2',
  title,
  children,
  action,
  tone = 'tone-primary',
  card = false,
}) {
  const body = (
    <div className="empty-state">
      <span className={`icon-tile h-12 w-12 ${tone}`}>
        <Icon name={icon} size={24} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        {children && <p className="max-w-[46ch] text-meta">{children}</p>}
      </div>
      {action?.href ? (
        <Link href={action.href} className="btn btn-soft btn-sm">
          {action.icon && <Icon name={action.icon} size={17} />}
          {action.label}
        </Link>
      ) : (
        action
      )}
    </div>
  );
  return card ? <section className="card">{body}</section> : body;
}
