import type { Metadata } from 'next';
import './globals.css';
import '../src/ui/select.css';
import '../src/ui/components.css';
import '../src/table/table.css';
import '../src/coach/coach.css';
import '../src/accessibility/accessibility.css';
import '../src/table/discards.css';
import { AccessibilityProvider } from '../src/accessibility/provider';
import { accessibilityBootstrap } from '../src/accessibility/preferences';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://the-mahjong-room.jyeger.chatgpt.site'),
  title: 'The Mahjong Room — Learn by playing',
  description: 'Learn American Mahjong across guided games with a patient coach beside you.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Learn American Mahjong by playing.',
    description: 'A guided game that remembers where you left off.',
    images: [{ url: '/og.png', width: 1736, height: 908, alt: 'The Mahjong Room guided game' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Learn American Mahjong by playing.',
    description: 'A guided game that remembers where you left off.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const runtimeConfig = JSON.stringify({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  }).replace(/</g, '\\u003c');

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: accessibilityBootstrap }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__MAHJONG_RUNTIME_CONFIG__=${runtimeConfig};`,
          }}
        />
      </head>
      <body><AccessibilityProvider>{children}</AccessibilityProvider></body>
    </html>
  );
}
