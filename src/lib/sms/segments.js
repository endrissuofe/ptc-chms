/**
 * How many SMS pages a message uses. Networks bill per page.
 * Plain text (the GSM-7 alphabet) fits 160 characters in one page, 153 per page when split.
 * Anything outside it — ₦, curly quotes, emoji — switches the whole message to Unicode:
 * 70 characters in one page, 67 per page when split.
 */
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
// These count as two characters (escape + char) in GSM-7.
const GSM_EXTENDED = '^{}\\[~]|€\f';

export function smsSegments(text = '') {
  let gsmLength = 0;
  let unicode = false;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) gsmLength += 1;
    else if (GSM_EXTENDED.includes(ch)) gsmLength += 2;
    else {
      unicode = true;
      break;
    }
  }

  if (unicode) {
    const length = [...text].length;
    const pages = length <= 70 ? 1 : Math.ceil(length / 67);
    return { encoding: 'unicode', length, pages, perPage: pages === 1 ? 70 : 67 };
  }
  const pages = gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
  return { encoding: 'gsm', length: gsmLength, pages, perPage: pages === 1 ? 160 : 153 };
}

/** Characters outside plain SMS text, so the editor can point them out. */
export function unicodeCharacters(text = '') {
  return [
    ...new Set([...text].filter((ch) => !GSM_BASIC.includes(ch) && !GSM_EXTENDED.includes(ch))),
  ];
}
