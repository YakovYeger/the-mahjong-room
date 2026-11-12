import type { CSSProperties } from 'react';

export function PuzzleSolveBurst() {
  return <div className="daily-solve-burst" aria-hidden="true">
    {[0, 1].map(burst => <div className="firework" key={burst} style={{
      left: burst === 0 ? '22%' : '78%',
      top: burst === 0 ? '24%' : '38%',
      '--burst-delay': `${burst * 180}ms`,
    } as CSSProperties}>{Array.from({ length: 10 }, (_, ray) => {
      const angle = ray * Math.PI / 5;
      const distance = ray % 2 ? 56 : 88;
      return <i key={ray} style={{
        '--ray-x': `${Math.cos(angle) * distance}px`,
        '--ray-y': `${Math.sin(angle) * distance}px`,
        '--ray-color': ['#d3a54e', '#8baf97', '#ebc974'][ray % 3],
      } as CSSProperties} />;
    })}</div>)}
  </div>;
}

