import { MiniGamesHeader } from '../mini-games-header';
import { CharlestonShuffle } from './charleston-shuffle';
import '../mini-games.css';

export const metadata = {
  title: 'Charleston Shuffle · The Mahjong Room',
  description: 'Choose three tiles to pass each round and find your strongest Training Card lines.',
};

export default function CharlestonPage() {
  return <main className="mini-games-page">
    <MiniGamesHeader playing />
    <div className="mini-games-content shuffle-content">
      <header className="mini-games-intro">
        <h1>Charleston Shuffle</h1>
        <p>Shape your opening hand in three passes.</p>
      </header>
      <CharlestonShuffle />
    </div>
  </main>;
}
