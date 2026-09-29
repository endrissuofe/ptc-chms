import Image from 'next/image';
import { CHURCH, churchInitials } from '@/lib/church-profile';

/**
 * The church's logo as a round profile picture, on white so its colours read the same in
 * the dark theme. A church without a logo shows its initials.
 */
export default function ChurchAvatar({ size = 40, church = CHURCH, className = '' }) {
  const box = { width: size, height: size };
  if (!church.logo) {
    return (
      <span
        aria-hidden="true"
        style={box}
        className={`inline-grid shrink-0 place-items-center rounded-full bg-of-accent-soft font-brand font-bold text-of-accent-ink ${className}`}
      >
        {churchInitials(church.name)}
      </span>
    );
  }
  return (
    <span
      style={box}
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-white ${className}`}
    >
      <Image
        src={church.logo}
        alt={`${church.name} logo`}
        width={Math.round(size * 0.82)}
        height={Math.round(size * 0.82)}
        priority
      />
    </span>
  );
}
