import Link from 'next/link';
import { ReferenceHands } from '../../src/table/reference-hands';
export default function CardsPage() {
  return <main className="cards-page"><header><Link className="brand" href="/">The Mahjong Room</Link><Link className="table-tool-button" href="/">Back to play →</Link></header><div className="cards-intro"><p className="kicker">Your collection · 2025</p><h1>A whole card of possibilities.</h1><p>Every hand from your card, with room to read, explore and plan your next move.</p><span>55 hands · 9 sections · Select Your 2025 Card before starting a game</span></div><ReferenceHands printable /></main>;
}
