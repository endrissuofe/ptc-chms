import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: { default: 'PTC Chapel', template: '%s · PTC Chapel' },
  description: 'RCCG Peculiar Treasure Chapel — church management',
  icons: { icon: '/ptc-logo.png' },
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#1D2238',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&family=Public+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
