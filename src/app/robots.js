/** A private staff app: ask search engines to stay out entirely. */
export default function robots() {
  return { rules: { userAgent: '*', disallow: '/' } };
}
