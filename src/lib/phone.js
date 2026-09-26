/**
 * Nigerian phone numbers. Everything is stored as +234XXXXXXXXXX (13 characters)
 * so "0803 456 7890", "803-456-7890" and "+234 803 456 7890" all match the same person.
 */
const VALID_PREFIX = /^[789][01]\d{8}$/; // 070x, 080x, 081x, 090x, 091x ...

export function normalizePhone(input) {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, '');
  if (digits.startsWith('234')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!VALID_PREFIX.test(digits)) return null;
  return `+234${digits}`;
}

export function isValidPhone(input) {
  return normalizePhone(input) !== null;
}

/** "+2348034567890" -> "0803 456 7890" for display. */
export function formatPhone(normalized) {
  if (!normalized) return '';
  const local = `0${normalized.replace('+234', '')}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
