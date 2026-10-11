import type { Suit, Tile } from '../game/types';

export function shortTile(tile: Tile) {
  if (tile.type.kind === 'number') return { top: String(tile.type.rank), bottom: tile.type.suit === 'bamboo' ? 'BAM' : tile.type.suit === 'characters' ? 'CRAK' : 'DOT' };
  if (tile.type.kind === 'wind') return { top: tile.type.wind[0].toUpperCase(), bottom: 'WIND' };
  if (tile.type.kind === 'dragon') return { top: tile.type.dragon[0].toUpperCase(), bottom: 'DRAGON' };
  if (tile.type.kind === 'flower') return { top: 'F', bottom: 'FLOWER' };
  return { top: '★', bottom: 'JOKER' };
}

export function SuitIcon({ suit }: { suit: Suit }) {
  if (suit === 'bamboo') return <span className="suit-icon suit-bamboo" aria-hidden="true"><i /><i /><i /></span>;
  if (suit === 'characters') return <span className="suit-icon suit-characters" aria-hidden="true">萬</span>;
  return <span className="suit-icon suit-dots" aria-hidden="true"><i /></span>;
}

export function TileFace({ tile, compact = false }: { tile: Tile; compact?: boolean }) {
  const label = shortTile(tile);
  return <span className={`tile-face ${compact ? 'compact' : ''}`}>
    <strong>{label.top}</strong>
    {tile.type.kind === 'number' ? <SuitIcon suit={tile.type.suit} /> : <span className={`honor-icon honor-${tile.type.kind}`} aria-hidden="true">{tile.type.kind === 'wind' ? '風' : tile.type.kind === 'dragon' ? '龍' : tile.type.kind === 'flower' ? '✿' : '★'}</span>}
    <small>{label.bottom}</small>
  </span>;
}

