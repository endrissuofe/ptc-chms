import Image from 'next/image';

/**
 * The church logo. Always use this component so the logo looks the same on every screen.
 * `badge` renders next to the church name (e.g. the Online pill in the mobile header).
 */
export default function Logo({ size = 40, withName = false, subtitle, badge }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image src="/ptc-logo.png" alt="PTC Chapel logo" width={size} height={size} priority />
      {withName && (
        <div className="flex min-w-0 flex-col leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-semibold">PTC Chapel</span>
            {badge}
          </div>
          {subtitle && <span className="truncate text-xs text-muted">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
