import ChurchAvatar from '@/components/brand/ChurchAvatar';
import { CHURCH } from '@/lib/church-profile';

/**
 * The church's identity: its logo as a round profile picture, and optionally its name.
 * (The product's own logo is OnefoldLogo in components/brand.)
 * `badge` renders next to the church name.
 */
export default function Logo({ size = 40, withName = false, subtitle, badge }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ChurchAvatar size={size} />
      {withName && (
        <div className="flex min-w-0 flex-col leading-none">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-brand text-lg font-bold tracking-[-0.01em]">
              {CHURCH.name}
            </span>
            {badge}
          </div>
          {subtitle && (
            <span className="mt-1 truncate text-2xs font-semibold text-muted max-[420px]:hidden">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
