const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Mongo filter for a name/phone search box: "tunde bakare", "bakare" or "0803 456".
 * Every word must match the first or last name; digits alone search the phone number.
 */
export function searchFilter(q) {
  if (!q?.trim()) return {};
  const digits = q.replace(/\D/g, '').replace(/^(234|0)/, '');
  if (digits.length >= 3 && !/[a-z]/i.test(q)) return { phone: new RegExp(digits) };
  const words = q
    .trim()
    .split(/\s+/)
    .map((w) => new RegExp(escapeRx(w), 'i'));
  return { $and: words.map((rx) => ({ $or: [{ firstName: rx }, { lastName: rx }] })) };
}
