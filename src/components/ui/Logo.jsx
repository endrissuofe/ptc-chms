import Image from 'next/image';

/** The church logo. Always use this component so the logo looks the same on every screen. */
export default function Logo({ size = 40, withName = false, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/ptc-logo.png" alt="PTC Chapel logo" width={size} height={size} priority />
      {withName && (
        <div className="flex flex-col leading-tight">
          <span className="font-serif text-lg font-semibold">PTC Chapel</span>
          {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
