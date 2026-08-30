import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://the-mahjong-room.openai.site'),
  title: 'The Mahjong Room — Learn by playing',
  description: 'Play your first guided game of American Mahjong with a patient coach beside you.',
  openGraph: {
    title: 'Learn American Mahjong by playing.',
    description: 'Your first guided game starts here.',
    images: [{ url: '/og.png', width: 1736, height: 908, alt: 'The Mahjong Room guided game' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Learn American Mahjong by playing.',
    description: 'Your first guided game starts here.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
