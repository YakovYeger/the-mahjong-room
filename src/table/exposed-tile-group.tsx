import { tileLabel } from '../game/tiles';
import type { Tile } from '../game/types';
import { TileFace } from './tile-face';

export function ExposedTileGroup({ tiles, label, compact = true, highlightedTileIds = [] }: {
  tiles: readonly Tile[];
  label: string;
  compact?: boolean;
  highlightedTileIds?: readonly string[];
}) {
  return <div className="table-meld" role="group" aria-label={label}>
    <div className={`table-exposed-set${compact ? '' : ' table-exposed-set-readable'}`}>
      {tiles.map(tile => {
        const highlighted = highlightedTileIds.includes(tile.id);
        return <span key={tile.id} data-public-tile-id={tile.id} className={highlighted ? 'coach-public-focus' : undefined} title={`${tileLabel(tile)}${highlighted ? ' · Coach focus: public copy' : ''}`}>
          <TileFace tile={tile} compact={compact} />
        </span>;
      })}
    </div>
  </div>;
}
