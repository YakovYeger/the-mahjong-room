import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://the-mahjong-room.openai.site'),
  title: 'The Mahjong Room — Learn by playing',
  description: 'Learn American Mahjong across guided games with a patient coach beside you.',
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
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__MAHJONG_RUNTIME_CONFIG__=${runtimeConfig};`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
