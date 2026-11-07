import { organizeTileIds } from './tiles';
import { arrangeHand } from './training-card';
import type { Exposure, HandDefinition, Tile } from './types';

/** Arrange only the concealed rack. A pinned pattern takes precedence over suit sorting. */
export function organizeRack(tiles: Tile[], exposures: Exposure[], followedHand?: HandDefinition): string[] {
  if (!followedHand) return organizeTileIds(tiles);
  const layout = arrangeHand([...tiles, ...exposures.flatMap(set => set.tiles)], exposures, followedHand);
  const rackIds = new Set(tiles.map(tile => tile.id));
  return [...layout.matchingTileIds, ...layout.extras.map(tile => tile.id)].filter(id => rackIds.has(id));
}
