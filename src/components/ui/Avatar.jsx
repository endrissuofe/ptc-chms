const TONES = ['tone-primary', 'tone-coral', 'tone-teal', 'tone-violet', 'tone-warning'];

export function initials(name = '') {
  const parts = name
    .replace(/^(bro|sis|pastor|rev|dr|mr|mrs|ms)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?';
}

/** Initials in a soft circle; the colour is picked from the name so it stays the same. */
export default function Avatar({ name, size = 'md', className = '' }) {
  const sum = [...(name || '')].reduce((n, c) => n + c.charCodeAt(0), 0);
  const sizes = {
    sm: 'h-[34px] w-[34px] text-[12px]',
    md: 'h-11 w-11 text-[15px]',
    lg: 'h-14 w-14 text-lg',
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full font-display font-black tracking-wide ${sizes[size]} ${TONES[sum % TONES.length]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
