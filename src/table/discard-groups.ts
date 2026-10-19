import { tileKey } from '../game/tiles';
import type { Tile } from '../game/types';

export interface DiscardGroup {
  key: string;
  tile: Tile;
  copies: { tile: Tile; position: number }[];
}

// Presentation only. Never merge wildcards with natural tiles or modify the
// ordered pool. Flowers share one rules identity; their original IDs and flower
// indices remain available on the individual copies.
export function groupDiscards(tiles: readonly Tile[], claimTileId?: string): DiscardGroup[] {
  const groups = new Map<string, DiscardGroup>();
  tiles.forEach((tile, index) => {
    if (tile.id === claimTileId) return;
    const key = tile.type.kind === 'flower' ? 'flower-any' : tileKey(tile);
    const group = groups.get(key) ?? { key, tile, copies: [] };
    group.copies.push({ tile, position: index + 1 });
    groups.set(key, group);
  });
  return [...groups.values()];
}
