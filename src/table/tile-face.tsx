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

const positions: Record<number, [number, number][]> = {
  1: [[30, 35]], 2: [[30, 18], [30, 51]], 3: [[17, 16], [30, 35], [43, 54]],
  4: [[17, 18], [43, 18], [17, 52], [43, 52]],
  5: [[16, 16], [44, 16], [30, 35], [16, 54], [44, 54]],
  6: [[17, 15], [43, 15], [17, 35], [43, 35], [17, 55], [43, 55]],
  7: [[30, 12], [17, 29], [43, 29], [17, 45], [43, 45], [17, 61], [43, 61]],
  8: [[17, 12], [43, 12], [17, 28], [43, 28], [17, 44], [43, 44], [17, 60], [43, 60]],
  9: [[14, 15], [30, 15], [46, 15], [14, 35], [30, 35], [46, 35], [14, 55], [30, 55], [46, 55]],
};
const numerals = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function TileArtwork({ tile }: { tile: Tile }) {
  const type = tile.type;
  return <svg className="tile-artwork" viewBox="0 0 60 72" aria-hidden="true" focusable="false">
    {type.kind === 'number' && type.suit === 'dots' ? positions[type.rank].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`} fill="none" stroke={type.rank === 1 || i % 3 === 0 ? '#b3473e' : i % 3 === 1 ? '#17694f' : '#244d68'}><circle r={type.rank === 1 ? 20 : type.rank >= 7 ? 6 : 8} strokeWidth="2.5" /><circle r={type.rank === 1 ? 14 : 3} strokeWidth="1.5" /><circle r="1.4" fill="currentColor" stroke="none" />{type.rank === 1 ? <path d="M0-12V12M-12 0H12M-9-9L9 9M-9 9L9-9" strokeWidth="1" /> : null}</g>) : null}
    {type.kind === 'number' && type.suit === 'bamboo' ? type.rank === 1 ? <g stroke="#17694f" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M18 44Q13 20 31 19Q47 20 39 39L23 49L12 63M27 47L20 65M36 40L45 57M31 20L39 12L43 22M22 34Q29 25 37 31Q32 42 22 44" /><path d="M40 23L51 27L40 29M20 48L8 52" stroke="#b3473e" /><circle cx="36" cy="23" r="1.5" fill="#244d68" /><path d="M21 53L32 46M17 58L27 52" /></g> : positions[type.rank].map(([x,y],i) => <g key={i} transform={`translate(${x} ${y})`} stroke={type.rank >= 5 && i === 2 ? '#b3473e' : '#17694f'} strokeLinecap="round"><path d="M0-6V6" strokeWidth="4" /><path d="M-3-5H3M-3 0H3M-3 5H3" strokeWidth="1.5" /><path d="M-1-4V-1M-1 2V4" stroke="#83ad82" strokeWidth="1" /></g>) : null}
    {type.kind === 'number' && type.suit === 'characters' ? <><text x="30" y="29" textAnchor="middle" fill="#244d68" fontSize="27" fontFamily="serif">{numerals[type.rank - 1]}</text><text x="30" y="61" textAnchor="middle" fill="#b3473e" fontSize="32" fontFamily="serif">萬</text></> : null}
    {type.kind === 'wind' ? <text x="30" y="51" textAnchor="middle" fill="#244d68" fontSize="43" fontFamily="serif">{{ north: '北', east: '東', south: '南', west: '西' }[type.wind]}</text> : null}
    {type.kind === 'dragon' ? type.dragon === 'white' ? <g fill="none" stroke="#244d68"><rect x="12" y="13" width="36" height="46" rx="4" strokeWidth="3" /><rect x="17" y="18" width="26" height="36" rx="1" /><path d="M12 23H17M43 23H48M12 49H17M43 49H48" strokeWidth="2" /></g> : <text x="30" y="51" textAnchor="middle" fill={type.dragon === 'red' ? '#b3473e' : '#17694f'} fontSize="45" fontFamily="serif">{type.dragon === 'red' ? '中' : '發'}</text> : null}
    {type.kind === 'flower' ? <g><path d="M30 60V33M30 49Q15 35 14 49Q24 57 30 53M30 57Q46 42 46 52Q39 62 30 60" fill="#17694f" stroke="#17694f" strokeWidth="2" />{[0,72,144,216,288].map(a => <ellipse key={a} cx="30" cy="18" rx="6" ry="10" fill="#bc625b" stroke="#963d3a" strokeWidth="1" transform={`rotate(${a} 30 28)`} />)}<circle cx="30" cy="28" r="5" fill="#d9a244" /></g> : null}
    {type.kind === 'joker' ? <g fill="none" stroke="#a57d33"><path d="M30 8L35 25L52 30L35 35L30 53L25 35L8 30L25 25Z" strokeWidth="2" /><circle cx="30" cy="30" r="8" /><path d="M18 59Q30 67 42 59" strokeWidth="2" /><circle cx="30" cy="30" r="3" fill="#b3473e" stroke="none" /></g> : null}
  </svg>;
}

export function TileFace({ tile, compact = false }: { tile: Tile; compact?: boolean }) {
  const label = shortTile(tile);
  const family = tile.type.kind === 'number' ? tile.type.suit : tile.type.kind === 'dragon' ? `dragon-${tile.type.dragon}` : tile.type.kind;
  return <span className={`tile-face illustrated tile-${family} ${compact ? 'compact' : ''}`}>
    <strong>{label.top}</strong><TileArtwork tile={tile} /><small>{label.bottom}</small>
  </span>;
}
