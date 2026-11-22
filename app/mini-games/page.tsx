/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the Sites runtime issue. */
import type { Tile } from '../../src/game/types';
import { TileFace } from '../../src/table/tile-face';
import { buttonVariants } from '../../src/ui/button';
import { MiniGamesHeader } from './mini-games-header';
import './mini-games.css';

export const metadata = {
  title: 'Mini-Games · The Mahjong Room',
  description: 'Play Charleston Shuffle and two daily American Mahjong puzzles.',
};

const showcaseTiles: Tile[] = [
  { id: 'showcase-bam', type: { kind: 'number', suit: 'bamboo', rank: 3 } },
  { id: 'showcase-flower', type: { kind: 'flower', index: 1 } },
  { id: 'showcase-dot', type: { kind: 'number', suit: 'dots', rank: 5 } },
];

export default function MiniGamesPage() {
  return <main className="mini-games-page">
    <MiniGamesHeader />
    <div className="mini-games-content">
      <header className="mini-games-intro">
        <h1>Mini-games</h1>
        <p>Build your Mahjong instincts a few moves at a time.</p>
      </header>
      <section className="mini-games-feature" aria-labelledby="mini-games-feature-title">
        <div className="mini-games-feature-copy">
          <p className="mini-games-eyebrow">Play anytime · 3 passes</p>
          <h2 id="mini-games-feature-title">Charleston Shuffle</h2>
          <p>Trade tiles with the table and see what your rack can become.</p>
          <a className={buttonVariants({ variant: 'secondary', className: 'mini-games-play' })} href="/mini-games/charleston">Play Charleston Shuffle</a>
        </div>
        <div className="mini-games-showcase" aria-hidden="true">
          <div>{showcaseTiles.map(tile => <span className="shuffle-tile" key={tile.id}><TileFace tile={tile} /></span>)}</div>
        </div>
      </section>
      <section className="mini-games-dailies" aria-labelledby="mini-games-daily-title">
        <h2 id="mini-games-daily-title">Daily challenges</h2>
        <div className="mini-games-daily-grid">
          <a href="/daily" className="mini-games-card">
            <span className="mini-games-card-mark" aria-hidden="true"><TileFace tile={showcaseTiles[2]} /></span>
            <span><strong>Daily Puzzle</strong><small>Pick one discard for a target hand.</small></span>
          </a>
          <a href="/daily/table-reading" className="mini-games-card">
            <span className="mini-games-card-mark" aria-hidden="true"><TileFace tile={showcaseTiles[0]} /></span>
            <span><strong>Would you throw it?</strong><small>Read the table and choose what to throw.</small></span>
          </a>
        </div>
      </section>
    </div>
  </main>;
}
