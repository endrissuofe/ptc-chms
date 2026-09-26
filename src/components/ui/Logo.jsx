import Image from 'next/image';

/**
 * The church logo. Always use this component so the logo looks the same on every screen.
 * It sits on a white tile so its colours read the same in the dark theme.
 * `badge` renders next to the church name (e.g. the Online pill).
 */
export default function Logo({ size = 40, withName = false, subtitle, badge }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="inline-grid shrink-0 place-items-center rounded-xl border border-line bg-white shadow-soft"
        style={{ width: size, height: size }}
      >
        <Image
          src="/ptc-logo.png"
          alt="PTC Chapel logo"
          width={Math.round(size * 0.8)}
          height={Math.round(size * 0.8)}
          priority
        />
      </span>
      {withName && (
        <div className="flex min-w-0 flex-col leading-none">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap font-display text-[1.15rem] font-black tracking-[-0.01em]">
              PTC Chapel
            </span>
            {badge}
          </div>
          {subtitle && (
            <span className="mt-1 truncate text-[11.5px] font-semibold text-muted max-[420px]:hidden">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
