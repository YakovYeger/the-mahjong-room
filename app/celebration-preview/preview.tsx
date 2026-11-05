'use client';
import { useState } from 'react';
import { CelebrationLayer, type Celebration } from '../../src/table/celebration';
export default function CelebrationPreview() {
  const [reward, setReward] = useState<Celebration | null>(null);
  return <main style={{ minHeight: '100dvh', background: '#143f35', padding: 20, color: '#fff3d1' }}>
    <h1>Table celebrations</h1>
    {(['mahjong', 'call', 'joker'] as const).map(kind => <button key={kind} onClick={() => setReward({ id: Date.now(), kind, title: kind === 'mahjong' ? 'Mahjong!' : kind === 'call' ? 'Kong!' : 'Hello, Joker!', detail: kind === 'mahjong' ? 'Beautifully played. This one is yours.' : kind === 'call' ? 'Rose makes a call.' : 'A little wild luck. Make it count.' })}>{kind}</button>)}
    <CelebrationLayer celebration={reward} />
  </main>;
}
