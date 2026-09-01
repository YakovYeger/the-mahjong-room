import type { Dragon, Suit, Tile, Wind } from './types';

export function tileKey(tile: Tile): string {
  const type = tile.type;
  if (type.kind === 'number') return `${type.suit}-${type.rank}`;
  if (type.kind === 'wind') return `wind-${type.wind}`;
  if (type.kind === 'dragon') return `dragon-${type.dragon}`;
  if (type.kind === 'flower') return `flower-${type.index}`;
  return 'joker';
}

export function tileLabel(tile: Tile): string {
  const type = tile.type;
  if (type.kind === 'number') return `${type.rank} ${type.suit === 'bamboo' ? 'Bam' : type.suit === 'characters' ? 'Crak' : 'Dot'}`;
  if (type.kind === 'wind') return `${type.wind[0].toUpperCase()}${type.wind.slice(1)} Wind`;
  if (type.kind === 'dragon') return `${type.dragon[0].toUpperCase()}${type.dragon.slice(1)} Dragon`;
  if (type.kind === 'flower') return 'Flower';
  return 'Joker';
}

export function normalizeTileOrder(order: string[], tiles: Tile[]): string[] {
  const tileIds = new Set(tiles.map((tile) => tile.id));
  const retained = order.filter((id) => tileIds.has(id));
  const retainedIds = new Set(retained);
  return [...retained, ...tiles.map((tile) => tile.id).filter((id) => !retainedIds.has(id))];
}

export function reorderTileIds(order: string[], movingId: string, targetId: string): string[] {
  const movingIndex = order.indexOf(movingId);
  const targetIndex = order.indexOf(targetId);
  if (movingIndex === -1 || targetIndex === -1 || movingIndex === targetIndex) return [...order];
  const reordered = order.filter((id) => id !== movingId);
  const currentTargetIndex = reordered.indexOf(targetId);
  reordered.splice(movingIndex < targetIndex ? currentTargetIndex + 1 : currentTargetIndex, 0, movingId);
  return reordered;
}

export function placeTileId(order: string[], movingId: string, targetId: string, placement: 'before' | 'after'): string[] {
  const movingIndex = order.indexOf(movingId);
  const targetIndex = order.indexOf(targetId);
  if (movingIndex === -1 || targetIndex === -1 || movingIndex === targetIndex) return [...order];
  const reordered = order.filter((id) => id !== movingId);
  const currentTargetIndex = reordered.indexOf(targetId);
  reordered.splice(currentTargetIndex + (placement === 'after' ? 1 : 0), 0, movingId);
  return reordered;
}

export function moveTileId(order: string[], tileId: string, offset: -1 | 1): string[] {
  const from = order.indexOf(tileId);
  const to = from + offset;
  if (from === -1 || to < 0 || to >= order.length) return [...order];
  const reordered = [...order];
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  return reordered;
}

export function createWall(): Tile[] {
  const tiles: Tile[] = [];
  let serial = 0;
  const add = (type: Tile['type'], copies: number) => {
    for (let copy = 0; copy < copies; copy += 1) tiles.push({ id: `tile-${serial++}`, type });
  };
  for (const suit of ['bamboo', 'characters', 'dots'] as Suit[]) {
    for (let rank = 1; rank <= 9; rank += 1) add({ kind: 'number', suit, rank }, 4);
  }
  for (const wind of ['north', 'east', 'south', 'west'] as Wind[]) add({ kind: 'wind', wind }, 4);
  for (const dragon of ['red', 'green', 'white'] as Dragon[]) add({ kind: 'dragon', dragon }, 4);
  for (let index = 1; index <= 8; index += 1) add({ kind: 'flower', index }, 1);
  add({ kind: 'joker' }, 8);
  return tiles;
}

export function deterministicShuffle<T>(values: T[], seed: number): T[] {
  const result = [...values];
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
