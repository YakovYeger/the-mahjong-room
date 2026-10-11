import type { Tile } from '../game/types';

export function trainingTileLabel(tileKey: string) {
  if (tileKey === 'flower-any') return 'F';
  if (tileKey === 'joker') return '★';
  const [kind, value] = tileKey.split('-');
  if (kind === 'wind') return value?.[0].toUpperCase() ?? 'W';
  if (kind === 'dragon') return `${value?.[0].toUpperCase() ?? 'G'}D`;
  return `${value}${kind === 'bamboo' ? 'B' : kind === 'characters' ? 'C' : 'D'}`;
}

export function compactTile(tile: Tile) {
  if (tile.type.kind === 'number') return `${tile.type.rank}${tile.type.suit === 'bamboo' ? 'B' : tile.type.suit === 'characters' ? 'C' : 'D'}`;
  if (tile.type.kind === 'wind') return tile.type.wind[0].toUpperCase();
  if (tile.type.kind === 'dragon') return `${tile.type.dragon[0].toUpperCase()}D`;
  if (tile.type.kind === 'flower') return 'F';
  return '★';
}

