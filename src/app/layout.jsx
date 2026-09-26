import './globals.css';
import Providers from '@/components/Providers';
import { ICON_FONT_URL } from '@/components/ui/Icon';
import { THEME_SCRIPT } from '@/components/ui/ThemeToggle';

export const metadata = {
  title: { default: 'PTC Chapel', template: '%s · PTC Chapel' },
  description: 'RCCG Peculiar Treasure Chapel — church management',
  icons: { icon: '/ptc-logo.png' },
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#12112a' },
  ],
  width: 'device-width',
  initialScale: 1,
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
          href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Nunito:wght@600;700;800;900&display=swap"
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
