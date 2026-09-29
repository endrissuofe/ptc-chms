/**
 * The Onefold mark: one fold (an almost-closed circle, its gate open) with one person being
 * brought inside (the dot). "There shall be one fold, and one shepherd" (John 10:16).
 * `animate` draws it once on arrival (the sign-in page); reduced motion shows it at rest.
 */
export function OnefoldMark({ size = 40, animate = false, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M 78 30 A 38 38 0 1 0 84 58"
        fill="none"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        className={animate ? 'of-draw' : undefined}
      />
      <circle
        cx="56"
        cy="46"
        r="10"
        fill="rgb(var(--of-dawn))"
        className={animate ? 'of-drop' : undefined}
      />
    </svg>
  );
}

/** Mark + "onefold" wordmark. The text is the product's name for screen readers. */
export default function OnefoldLogo({ size = 28, animate = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <OnefoldMark size={Math.round(size * 1.25)} animate={animate} />
      <span
        className="font-brand font-bold lowercase tracking-[-0.02em]"
        style={{ fontSize: size, lineHeight: 1 }}
      >
        onefold
      </span>
    </span>
  );
}
