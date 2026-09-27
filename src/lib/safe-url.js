/**
 * Where to go after signing in. Only pages on this site are allowed: a link like
 * /login?callbackUrl=https://evil.example must never forward someone off the site.
 * Accepts "/first-timers" or a full URL on this site (next-auth sends those); anything else → "/".
 */
export function safeCallbackUrl(callbackUrl, origin) {
  if (!callbackUrl) return '/';
  try {
    const url = new URL(callbackUrl, origin);
    if (url.origin !== origin) return '/';
    if (url.pathname.startsWith('/login')) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
