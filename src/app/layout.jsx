import './globals.css';
import Providers from '@/components/Providers';
import { ICON_FONT_URL } from '@/components/ui/Icon';
import { THEME_SCRIPT } from '@/components/ui/ThemeToggle';
import { PRODUCT_NAME, SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://ptc-chms.vercel.app'),
  title: { default: SITE_NAME, template: '%s · Ptchapel' },
  description: SITE_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  manifest: '/manifest.webmanifest',
  // Private staff app: keep it out of search results.
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `Sign in · ${PRODUCT_NAME}`,
    description: SITE_DESCRIPTION,
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: `${PRODUCT_NAME} logo` }],
  },
  appleWebApp: { capable: true, title: PRODUCT_NAME, statusBarStyle: 'default' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#12112a' },
  ],
  width: 'device-width',
  initialScale: 1,
  // Lets the phone tab bar sit above the iPhone home bar when installed as an app.
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    // The theme script sets data-theme before React loads, so the attribute differs on purpose.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply a saved light/dark choice before the first paint (no white flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Nunito:wght@600;700;800;900&family=Familjen+Grotesk:wght@600;700&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href={ICON_FONT_URL} rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
