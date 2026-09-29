/**
 * The church using this copy of Onefold: its name and logo, shown like a profile picture.
 * Today there is one church; when more join, this comes from the signed-in person's church.
 */
export const CHURCH = {
  name: 'Ptchapel',
  fullName: 'Peculiar Treasure Chapel · RCCG Youth Province 2',
  logo: '/ptc-logo.png',
};

/** "Grace Covenant Church" -> "GC": for churches without a logo. */
export const churchInitials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
